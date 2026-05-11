#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)
SKIP_PROMPTS=false

if [ "${1:-}" = "--reset-all" ] || [ "${1:-}" = "-a" ]; then
  SKIP_PROMPTS=true
fi

confirm() {
  if [ "$SKIP_PROMPTS" = "true" ]; then
    return 0
  fi

  printf '\n%s [y/N] ' "$1"
  read -r answer
  case $(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]') in
    y|yes) return 0 ;;
    *) return 1 ;;
  esac
}

cd "${PROJECT_ROOT}"

if [ ! -f "docker-compose.yml" ]; then
  printf '[FAIL] docker-compose.yml not found in %s\n' "${PROJECT_ROOT}" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  printf '[FAIL] Docker is not installed or not on PATH.\n' >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  printf '[FAIL] Docker engine is not running. Start Docker Desktop or the Docker service first.\n' >&2
  exit 1
fi

printf 'Resetting Docker-managed state for dicom-local-viewer_Phase2_Complete...\n'
printf 'This removes containers, networks, and the Orthanc named volume.\n'
printf 'It does not delete local files in api/data or host DICOM source folders.\n\n'

printf 'Project root: %s\n' "${PROJECT_ROOT}"
printf '\n'
printf 'Warning: this will remove Docker-managed runtime state for this local viewer instance.\n'
printf 'Imported Orthanc studies will be deleted because the orthanc_data volume will be removed.\n'
printf 'Saved dataset registry files under api/data stay in place.\n'
printf 'Original host DICOM source folders are never touched.\n'

if ! confirm "Proceed with Docker environment reset?"; then
  printf 'Reset cancelled.\n'
  exit 1
fi

printf '\nStep 1 - stop and remove project containers and networks.\n'
if confirm "Run docker compose down --remove-orphans?"; then
  docker compose down --remove-orphans
  printf 'Containers and networks removed.\n'
else
  printf 'Skipped container removal.\n'
fi

printf '\nStep 2 - remove Docker-managed volumes for this project.\n'
if confirm "Run docker compose down --volumes --remove-orphans to remove the Orthanc volume?"; then
  docker compose down --volumes --remove-orphans
  printf 'Docker-managed volumes removed.\n'
else
  printf 'Skipped volume removal.\n'
fi

printf '\nReset complete.\n'
printf 'Bring the stack back with: docker compose up --build -d\n'
printf 'Follow startup logs with: docker compose logs -f\n'
