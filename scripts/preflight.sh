#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)

FAILED_CHECKS=0
WARNING_CHECKS=0

write_check_result() {
  level=$1
  message=$2

  case "$level" in
    PASS)
      printf '[PASS] %s\n' "$message"
      ;;
    WARN)
      WARNING_CHECKS=$((WARNING_CHECKS + 1))
      printf '[WARN] %s\n' "$message"
      ;;
    FAIL)
      FAILED_CHECKS=$((FAILED_CHECKS + 1))
      printf '[FAIL] %s\n' "$message"
      ;;
    *)
      printf '[INFO] %s\n' "$message"
      ;;
  esac
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

extract_first_semver() {
  printf '%s\n' "$1" | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1
}

version_at_least() {
  actual=$1
  minimum=$2

  if [ -z "$actual" ]; then
    return 1
  fi

  if [ "$(printf '%s\n%s\n' "$minimum" "$actual" | sort -V | head -n 1)" = "$minimum" ]; then
    return 0
  fi

  return 1
}

lock_package_version() {
  lock_file=$1
  package_name=$2

  if [ ! -f "$lock_file" ]; then
    return 1
  fi

  node -e "
const fs = require('fs');
const lockFile = process.argv[1];
const packageName = process.argv[2];
const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
const entry = lock.packages && lock.packages['node_modules/' + packageName];
if (entry && entry.version) {
  process.stdout.write(String(entry.version));
}
" "$lock_file" "$package_name"
}

test_blocked_package_versions() {
  package_name=$1
  lock_file=$2
  reason=$3
  shift 3

  version=$(lock_package_version "$lock_file" "$package_name" 2>/dev/null || true)
  if [ -z "$version" ]; then
    write_check_result WARN "$package_name was not found in $lock_file."
    return
  fi

  for blocked_version in "$@"; do
    if [ "$version" = "$blocked_version" ]; then
      write_check_result FAIL "$package_name $version is blocked. $reason"
      return
    fi
  done

  write_check_result PASS "$package_name is locked to $version in $lock_file."
}

cd "${PROJECT_ROOT}"
printf 'Running local preflight for dicom-local-viewer_Phase2_Complete...\n'

if command_exists docker; then
  docker_version_text=$(docker version --format '{{.Client.Version}}' 2>/dev/null || true)
  if [ -n "$docker_version_text" ]; then
    write_check_result PASS "Docker CLI detected ($docker_version_text)."
  else
    write_check_result FAIL "Docker CLI is installed but not responding normally."
  fi
else
  write_check_result FAIL "Docker is not installed or not on PATH."
fi

if command_exists docker; then
  compose_version_text=$(docker compose version 2>/dev/null || true)
  if [ -n "$compose_version_text" ]; then
    compose_version=$(extract_first_semver "$compose_version_text" || true)
    if [ -n "$compose_version" ]; then
      write_check_result PASS "Docker Compose detected ($compose_version)."
    else
      write_check_result PASS "Docker Compose detected."
    fi
  else
    write_check_result FAIL "Docker Compose is not available. Install Docker Compose v2."
  fi

  if docker info >/dev/null 2>&1; then
    write_check_result PASS "Docker engine is running."
  else
    write_check_result FAIL "Docker engine is not running. Start Docker Desktop or the Docker service first."
  fi
fi

if command_exists node; then
  node_version_text=$(node --version 2>/dev/null || true)
  node_version=$(extract_first_semver "$node_version_text" || true)
  if version_at_least "$node_version" "20.0.0"; then
    write_check_result PASS "Optional local Node.js detected ($node_version)."
  else
    write_check_result WARN "Optional local Node.js is $node_version_text. Use Node.js 20+ for local npm builds."
  fi
else
  write_check_result WARN "Node.js is not installed locally. That is okay for Docker-only usage, but local npm builds will not work."
fi

if command_exists npm; then
  npm_version_text=$(npm --version 2>/dev/null || true)
  npm_version=$(extract_first_semver "$npm_version_text" || true)
  if version_at_least "$npm_version" "10.0.0"; then
    write_check_result PASS "Optional local npm detected ($npm_version)."
  else
    write_check_result WARN "Optional local npm is $npm_version_text. Use npm 10+ with Node.js 20+ for local builds."
  fi
else
  write_check_result WARN "npm is not installed locally. That is okay for Docker-only usage."
fi

if command_exists python3; then
  python_version_text=$(python3 --version 2>/dev/null || true)
  write_check_result PASS "Python detected ($python_version_text), but this project does not require Python."
elif command_exists python; then
  python_version_text=$(python --version 2>/dev/null || true)
  write_check_result PASS "Python detected ($python_version_text), but this project does not require Python."
else
  write_check_result PASS "Python is not required for this project."
fi

if [ -f ".env" ]; then
  write_check_result PASS ".env is present."
else
  write_check_result WARN ".env is missing. Copy .env.example to .env before using path-based upload."
fi

for required_file in \
  "docker-compose.yml" \
  "api/package-lock.json" \
  "web/package-lock.json" \
  "api/Dockerfile" \
  "nginx/Dockerfile" \
  "OHIF/Dockerfile"
do
  if [ -f "$required_file" ]; then
    write_check_result PASS "$required_file is present."
  else
    write_check_result FAIL "$required_file is missing."
  fi
done

if command_exists node; then
  test_blocked_package_versions \
    "axios" \
    "api/package-lock.json" \
    "These versions were reported as compromised in the March 2026 Axios supply-chain incident." \
    "1.14.1" \
    "0.30.4"
else
  write_check_result WARN "Skipping blocked lockfile dependency checks because Node.js is not installed locally."
fi

printf '\n'
if [ "$FAILED_CHECKS" -gt 0 ]; then
  printf 'Preflight failed with %s blocking issue(s) and %s warning(s).\n' "$FAILED_CHECKS" "$WARNING_CHECKS"
  exit 1
fi

printf 'Preflight passed with %s warning(s).\n' "$WARNING_CHECKS"
