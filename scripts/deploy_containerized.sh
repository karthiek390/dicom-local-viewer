#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)

FRESH=false
if [ "${1:-}" = "--fresh" ] || [ "${1:-}" = "-f" ]; then
  FRESH=true
fi

cd "${PROJECT_ROOT}"

printf 'Running deploy flow for dicom-local-viewer_Phase2_Complete...\n'

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp ".env.example" ".env"
    printf '[INFO] .env was missing, so a new one was created from .env.example.\n'
    printf '[INFO] Path-based upload remains disabled until you add real host-path mappings in .env.\n'
    printf '\n'
  else
    printf '[FAIL] .env is missing and .env.example was not found.\n' >&2
    exit 1
  fi
fi

"${SCRIPT_DIR}/preflight.sh"

if [ "$FRESH" = "true" ]; then
  printf '\n'
  printf '%s\n' '--fresh requested: resetting Docker-managed state before startup...'
  "${SCRIPT_DIR}/reset.sh" --reset-all
fi

printf '\nStarting all services (detached)...\n'
docker compose up --build -d

printf '\nServices started.\n\n'
printf 'Open:             http://localhost:8080\n'
printf 'Check status:     docker compose ps\n'
printf 'Follow logs:      docker compose logs -f\n\n'
printf 'On a first startup or after --fresh, allow a minute or two for builds and service initialization.\n'
