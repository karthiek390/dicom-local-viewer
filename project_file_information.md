## Preflight Check

Before starting on a new machine, run:

```powershell
./scripts/preflight.ps1
```

Or on macOS/Linux:

```bash
./scripts/preflight.sh
```

What it checks:

- Docker CLI exists
- Docker Compose v2 exists
- Docker engine is running
- `.env` presence
- required lockfiles and Dockerfiles exist
- optional local Node.js and npm versions
- blocked dependency versions such as compromised Axios releases

The helper start script now runs preflight automatically before bringing up the stack.

## Script Guide

This repo includes four helper script flows. They are complementary, not replacements for one another.

### 1. Preflight

Purpose:

- verify that the machine and repo are ready before launch

What it does:

- checks Docker CLI, Docker Compose, and Docker engine availability
- checks `.env`
- checks required lockfiles and Dockerfiles
- checks optional local Node.js and npm versions
- checks blocked lockfile versions such as compromised Axios releases

Use it when:

- you are onboarding a new machine
- you want to diagnose startup problems without changing Docker state

Commands:

```powershell
./scripts/preflight.ps1
```

```bash
./scripts/preflight.sh
```

### 2. Start

Purpose:

- do a quick normal startup

What it does:

- moves to the project root
- runs preflight
- starts the stack with `docker compose up --build -d`
- opens or prints `http://localhost:8080`

Use it when:

- your local setup is already in a good state
- you just want to bring the app up quickly

Commands:

```powershell
./scripts/start.ps1
```

```bash
./scripts/start.sh
```

### 3. Deploy Containerized

Purpose:

- provide the most guided startup flow for onboarding and recovery

What it does:

- creates `.env` from `.env.example` if `.env` is missing
- runs preflight
- optionally performs a fresh Docker reset with `--fresh`
- starts the stack with `docker compose up --build -d`
- prints follow-up commands such as status and logs

Use it when:

- you are a new user starting the project for the first time
- you want a more guided launch flow than `start`
- you want a clean Docker-backed app session with `--fresh`

Commands:

```powershell
./scripts/deploy_containerized.ps1
./scripts/deploy_containerized.ps1 --fresh
```

```bash
./scripts/deploy_containerized.sh
./scripts/deploy_containerized.sh --fresh
```

`--fresh` means:

- `.env` is created first if missing
- Docker-managed state for this stack is reset non-interactively
- the Orthanc named volume is removed
- the stack is started again

`--fresh` does not:

- delete `api/data`
- delete `.env`
- delete the original host DICOM source folders

### 4. Reset

Purpose:

- explicitly clean Docker-managed runtime state without starting the app

What it does:

- prompts before destructive cleanup steps by default
- stops and removes project containers and networks
- can remove Docker-managed volumes such as `orthanc_data`
- leaves local bind-mounted files alone

Use it when:

- you want to clean the Docker environment manually
- you want to reset before troubleshooting or testing
- you do not want the helper to immediately restart the stack afterward

Commands:

```powershell
./scripts/reset.ps1
./scripts/reset.ps1 --reset-all
```

```bash
./scripts/reset.sh
./scripts/reset.sh --reset-all
```

`--reset-all` skips prompts and is used internally by `deploy_containerized --fresh`.

### Recommended Script Choice

For most users:

- first guided run: `deploy_containerized`
- quick repeat startup: `start`
- diagnostics only: `preflight`
- explicit cleanup only: `reset`

## Start

### Full stack

```powershell
docker compose up --build
```

Then open:

```text
http://localhost:8080
```

### Service-specific refresh

Frontend only:

```powershell
docker compose build web
docker compose up -d web
```

Frontend + API:

```powershell
docker compose build web api
docker compose up -d web api
```

### Helper script

```powershell
./scripts/start.ps1
```

macOS/Linux:

```bash
./scripts/start.sh
```

### Guided deploy script

Windows:

```powershell
./scripts/deploy_containerized.ps1
```

macOS/Linux:

```bash
./scripts/deploy_containerized.sh
```

Fresh Docker reset before startup:

```powershell
./scripts/deploy_containerized.ps1 --fresh
```

```bash
./scripts/deploy_containerized.sh --fresh
```

`--fresh` removes Docker-managed state for this stack, including the `orthanc_data` volume, then starts the app again.
It does not delete local bind-mounted files such as `api/data` or your original host DICOM folders.

If `.env` is missing, the deploy helper now creates it from `.env.example` before running preflight.
That default template is intentionally safe and cross-platform:

- the stack still starts normally
- `Choose Folder` still works
- `Upload Dataset From Path` stays disabled until you add a real `HOST_SOURCE_ROOT_0` and matching `SOURCE_ROOT_MAPPINGS` for that machine

## Dependency Integrity And Version Policy

This project now uses lockfile-based installs for the app services:

- `api/Dockerfile` uses `npm ci --omit=dev`
- `nginx/Dockerfile` uses `npm ci`
- `OHIF/Dockerfile` uses `yarn install --frozen-lockfile`

That matters because it keeps Docker rebuilds aligned with the versions already locked in:

- `api/package-lock.json`
- `web/package-lock.json`
- OHIF's own `yarn.lock` inside the tagged OHIF source tree

Current application dependency highlights:

- API Axios is locked to `1.14.0` in `api/package-lock.json`
- Web Vue is locked to `3.5.32`
- Web Vite is locked to `6.4.1`
- Web `@vitejs/plugin-vue` is locked to `5.2.4`

Blocked version policy:

- Axios `1.14.1` and `0.30.4` are treated as blocked because of the March 2026 supply-chain compromise

If a maintainer updates dependencies later, the safe workflow should be:

1. update intentionally
2. review advisories
3. rebuild and test locally
4. commit the updated lockfiles together with the manifest changes

## Direct Path Upload Setup

The app now supports a backend-driven `Upload Dataset From Path` flow in addition to the browser `Choose Folder` flow.

Important:

- this works only when the API container can read the host folder through a Docker bind mount
- this is cross-platform, but each host OS needs its own absolute host path and Docker file-sharing setup
- the typed path must stay inside one of the configured allowed source roots
- if this setup is not configured first, path-based upload will not work and users should use `Choose Folder` instead

### Runtime configuration

Path-based upload settings now come from a local `.env` file.

Files:

- `.env.example` is the tracked template
- `.env` is the local machine-specific file used by Docker Compose

For a new machine or new session:

1. copy `.env.example` to `.env`
2. update the values for that machine
3. restart the affected Docker services

Set `SOURCE_ROOT_MAPPINGS` to a JSON array that maps native host paths to mounted container paths.
Set `HOST_SOURCE_ROOT_0` to the host folder that should be mounted into the API container.

Default template behavior:

- `.env.example` now uses `HOST_SOURCE_ROOT_0=./api/data`
- `.env.example` now uses `SOURCE_ROOT_MAPPINGS=[]`
- this keeps the stack portable on Windows, macOS, and Linux before you customize machine-specific path upload settings
- `Choose Folder` still works with that default template
- `Upload Dataset From Path` stays effectively disabled until you add a real host-path mapping for that machine

Current `docker-compose.yml` wiring:

- `HOST_SOURCE_ROOT_0` controls the bind mount source path
- `SOURCE_ROOT_MAPPINGS` tells the API how to translate native typed paths to `/host-sources/root0`

Example shape:

```json
[
  {
    "hostPath": "C:\\Users\\name\\Datasets",
    "containerPath": "/host-sources/root0"
  }
]
```

The same pattern works for macOS and Linux host paths.

Windows `.env` example:

```dotenv
HOST_SOURCE_ROOT_0=C:/Users/name/Datasets
SOURCE_ROOT_MAPPINGS=[{"hostPath":"C:\\Users\\name\\Datasets","containerPath":"/host-sources/root0","label":"Primary Source Root"}]
```

macOS `.env` example:

```dotenv
HOST_SOURCE_ROOT_0=/Users/name/Datasets
SOURCE_ROOT_MAPPINGS=[{"hostPath":"/Users/name/Datasets","containerPath":"/host-sources/root0","label":"Primary Source Root"}]
```

Linux `.env` example:

```dotenv
HOST_SOURCE_ROOT_0=/home/name/datasets
SOURCE_ROOT_MAPPINGS=[{"hostPath":"/home/name/datasets","containerPath":"/host-sources/root0","label":"Primary Source Root"}]
```

Equivalent mapping examples:

```json
[
  {
    "hostPath": "/Users/name/Datasets",
    "containerPath": "/host-sources/root0"
  }
]
```

```json
[
  {
    "hostPath": "/home/name/datasets",
    "containerPath": "/host-sources/root0"
  }
]
```

Do not need to hardcode the source root directly in `docker-compose.yml` anymore. Update `.env` instead.

### Notes

- Use read-only mounts for source roots.
- Docker Desktop users must allow file sharing for the selected host folder.
- If `.env` is missing, or if `SOURCE_ROOT_MAPPINGS` and `HOST_SOURCE_ROOT_0` do not match, `Upload Dataset From Path` will return a configuration error and `Choose Folder` will still work.
- After the bind mount is configured, type only the real dataset path in the UI, for example `C:\Users\Jon Doe\Documents\projects\DICOM Dataset`.

## Recommended Usage Policy For Path-Based Upload

Path-based upload is an advanced setup-dependent feature.

Recommended project policy:

- keep source-root mappings in `.env` instead of hardcoding long-term values directly in `docker-compose.yml`
- preconfigure only a small set of trusted common roots or whole drives as read-only mounts
- do not try to rewrite Docker config and restart containers automatically from a user-entered path

### What users should understand before using it

`Upload Dataset From Path` is not the same as `Choose Folder`.

`Choose Folder`:

- works through the browser picker
- does not require Docker source-root mapping setup
- is the safer default option for most users

`Upload Dataset From Path`:

- requires Docker bind mounts and matching source-root mappings first
- only works for paths inside the configured allowed roots
- will fail for paths outside those roots even if the path exists on the host machine

### Setup rule for new sessions or new machines

Before using `Upload Dataset From Path`, the user or maintainer must:

1. decide which local folders or drives should be allowed
2. update `.env` so `HOST_SOURCE_ROOT_0` points at the allowed host root
3. update `.env` so `SOURCE_ROOT_MAPPINGS` contains the matching host-path to container-path rule
4. restart the affected Docker services so the new mounts take effect

If those steps are not completed:

- do not use `Upload Dataset From Path`
- use `Choose Folder` instead

### Why this rule exists

The API runs inside Docker, not directly on the host OS.

That means:

- a typed path like `C:\Temp\Test`
- or `D:\Datasets\Study1`
- or a USB path like `E:\ScanSet1`

cannot be read by the API unless the relevant host root is already mounted into the container and mapped in configuration.

### Practical guidance for maintainers

If users regularly need path-based upload from new locations:

- update `.env` deliberately for the allowed roots
- keep those mounts read-only
- document those roots clearly

Do not encourage users to type arbitrary machine paths and expect them to work automatically.

If the setup has not been prepared for a location, the correct guidance is:

- leave path-based upload alone
- use `Choose Folder`

## Local Data Lifecycle

### Stored in the browser

- Theme
- Viewer mode
- Active dataset id convenience pointer
- Current Folder preferences
- Query-state navigation
- Recent locations
- Resume-session pointer
- Opened-item history
- Activity log
- Usage indicator snapshots

Current browser-managed keys include:

- `site-theme`
- `viewer-mode`
- `current-folder-sort-by`
- `current-folder-sort-dir`
- `current-folder-page-size`
- `dicom-local-viewer:active-dataset-id`
- `dicom-local-viewer:recent-active-session`
- `dicom-local-viewer:recent-locations:<sessionId>`
- `dicom-local-viewer:opened-selections:<sessionId>`
- `dicom-local-viewer:activity-log:<sessionId>`
- `dicom-local-viewer:usage-indicators:<sessionId>`

### Stored in the API session

- Analyzed DICOM file list
- Recursive tree model
- Metadata cache
- Ignored-file summary source data
- Staged local files used for browsing, metadata lookup, export, and OHIF import

### Stored in Orthanc

- Only files that the user explicitly opens in OHIF
- Imported studies remain there until cleared

### Stored in the backend dataset registry file

- Saved dataset records now live in `api/data/datasets-registry.json` on the host project folder
- The API uses the mounted runtime path `/opt/app/data/datasets-registry.json` inside Docker
- This registry stores saved dataset metadata such as label, source path, session id, lightweight summary fields, timestamps, and duplicate-detection file manifests
- This registry also stores saved dataset status fields such as `sessionAvailable`, `staleSession`, and `orthancImported`
- This registry is now the source of truth for the saved dataset catalog instead of browser `localStorage`

### Why the split matters

- Browser storage is kept lightweight so large saved dataset catalogs do not depend on `localStorage`
- The backend registry file is easier to inspect, paginate, reconcile, and delete predictably
- Browser session state can be cleared safely without losing the durable saved dataset catalog
- Stale session handling is clearer because saved dataset records can outlive live API sessions

## Important Behavior Notes

- Removing URL query parameters resets the UI view, but does not itself clear Orthanc
- `Clear Imported Studies` removes only imported Orthanc studies for the current session
- `Clear Current Session` removes staged session files, resets the UI state, and clears imported studies for that session
- The app remains intentionally local-first and does not require remote services

## Local Stack Shutdown Expectations

The current Docker setup has different persistence behavior for the saved dataset registry, live API sessions, browser state, and Orthanc.

If you run:

```powershell
docker compose down
```

expect the following:

- Saved dataset records remain in `api/data/datasets-registry.json`
- The API runtime session map is lost, so previously live datasets may come back as stale saved records
- Browser `localStorage` preferences remain in the same browser
- Browser `sessionStorage` convenience state should not be treated as durable restore state
- Orthanc imported studies should remain because the compose stack uses the named volume `orthanc_data`

After starting the stack again:

- The app reloads the backend registry as the source of truth
- Saved datasets whose old `sessionId` no longer exists are reconciled to stale and unavailable
- Those stale saved datasets remain in the backend registry for visibility
- Those stale saved datasets do not appear in the openable Dataset Selector or Workspace Datasets lists until they are re-analyzed
- Recent-session browser pointers that no longer resolve are cleared safely when resume fails

If you run:

```powershell
docker compose down -v
```

expect one additional destructive consequence:

- The Orthanc named volume is removed, so imported studies are lost

This does not delete the original source folder, and it does not remove the saved dataset registry file in `api/data`.

If you prefer a helper command for that clean Docker reset behavior, use:

Windows:

```powershell
./scripts/reset.ps1
```

macOS/Linux:

```bash
./scripts/reset.sh
```

Non-interactive reset:

```powershell
./scripts/reset.ps1 --reset-all
```

```bash
./scripts/reset.sh --reset-all
```

By default, `reset` now prompts before destructive Docker cleanup steps.
`--reset-all` skips prompts and is what the deploy helper uses internally for `--fresh`.

## Current Scope Boundaries

The app still does not include:

- Postgres
- Prisma
- RabbitMQ
- Celery
- OAuth
- Multi-user persistence

These remain possible future directions, but are intentionally out of the runtime scope of this local-first Phase 2 implementation.
