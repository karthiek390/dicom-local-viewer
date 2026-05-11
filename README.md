# dicom-local-viewer

A fully self-contained local-first DICOM viewer app built inside this repo for convenience, but designed to run independently from the rest of the repository.

## Project Rules

- Runtime behavior must stay self-contained inside `dicom-local-viewer/`
- No runtime dependency on files, configs, imports, volumes, env files, or services outside this folder
- The app is local-first and browser-driven
- The app is intentionally lightweight and avoids heavy infrastructure such as a database, background job queue, or external auth provider

## Stack

- Frontend: Vue 3 + Vite
- Backend: Node.js + Express
- Reverse proxy: Nginx
- DICOM store: Orthanc
- Viewer: OHIF
- Runtime: Docker Compose

## Quick Setup For New Machines

1. Install Docker Desktop or Docker Engine with Docker Compose v2.
2. Copy `.env.example` to `.env`.
3. Run the local readiness check:

```powershell
./scripts/preflight.ps1
```

On macOS or Linux:

```bash
./scripts/preflight.sh
```

4. Start the stack:

```powershell
./scripts/start.ps1
```

On macOS or Linux:

```bash
./scripts/start.sh
```

5. Open:

```text
http://localhost:8080
```

Use `Choose Folder` first if you have not configured path-based upload roots in `.env`.

If Docker is already installed and you want the most guided first-run path, you can use:

Windows:

```powershell
./scripts/deploy_containerized.ps1
```

macOS/Linux:

```bash
./scripts/deploy_containerized.sh
```

That helper creates `.env` from `.env.example` if needed, runs preflight, starts the stack, and prints follow-up guidance.

## Host Requirements

Required for normal usage:

- Docker Desktop or Docker Engine with Docker Compose v2

Optional for local development outside Docker:

- Node.js 20+
- npm 10+

Not required:

- Python

## Additional Documentation

For detailed project documentation, scripts, path-based upload setup, feature inventory, data lifecycle, and operational notes, see [project_file_information.md](./project_file_information.md).
