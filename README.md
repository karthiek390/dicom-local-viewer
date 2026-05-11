# dicom-local-viewer

A self-contained local-first DICOM viewer for researchers, clinicians, and medical teams to securely view MRI, CT, X-ray, ultrasound, PET, mammography, fluoroscopy, nuclear medicine, radiotherapy, pathology, and cardiology imaging locally with minimal infrastructure and lightweight deployment.

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

## Demo Video

See the sample workflow demonstration in:

- Dataset upload
- Local visualization
- OHIF viewer integration
- Dataset deletion workflow

`docs/dicom-local-viewer-demo.mp4`

## Acknowledgements

This project is built on top of several excellent open-source medical imaging technologies:

- OHIF Viewer — Web-based open-source medical imaging viewer used for DICOM visualization
- Orthanc — Lightweight open-source DICOM server used for local DICOM storage and management

This application integrates and extends these tools into a lightweight, self-contained, local-first deployment focused on secure and simple local medical image viewing workflows.

## Additional Documentation

For detailed project documentation, scripts, path-based upload setup, feature inventory, data lifecycle, and operational notes, see [project_file_information.md](./project_file_information.md).
