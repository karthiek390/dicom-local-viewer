#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)

cd "${PROJECT_ROOT}"
"${SCRIPT_DIR}/preflight.sh"

echo "Starting Docker services..."
docker compose up --build -d

echo "Open http://localhost:8080"
