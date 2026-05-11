$ErrorActionPreference = 'Stop'

$skipPrompts = $false
if ($args.Count -gt 0 -and ($args[0] -eq '--reset-all' -or $args[0] -eq '-a')) {
  $skipPrompts = $true
}

function Confirm-Step {
  param([string]$Prompt)

  if ($script:skipPrompts) {
    return $true
  }

  $answer = Read-Host "$Prompt [y/N]"
  if ($null -eq $answer) {
    return $false
  }

  $normalized = $answer.Trim().ToLowerInvariant()
  return $normalized -eq 'y' -or $normalized -eq 'yes'
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not (Test-Path 'docker-compose.yml')) {
  Write-Host "[FAIL] docker-compose.yml not found in $projectRoot" -ForegroundColor Red
  exit 1
}

if ($null -eq (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host '[FAIL] Docker is not installed or not on PATH.' -ForegroundColor Red
  exit 1
}

cmd /c "docker info >nul 2>nul"
if ($LASTEXITCODE -ne 0) {
  Write-Host '[FAIL] Docker engine is not running. Start Docker Desktop or the Docker service first.' -ForegroundColor Red
  exit 1
}

Write-Host 'Resetting Docker-managed state for dicom-local-viewer_Phase2_Complete...' -ForegroundColor Cyan
Write-Host 'This removes containers, networks, and the Orthanc named volume.'
Write-Host 'It does not delete local files in api/data or host DICOM source folders.'
Write-Host ''

Write-Host "Project root: $projectRoot"
Write-Host ''
Write-Host 'Warning: this will remove Docker-managed runtime state for this local viewer instance.' -ForegroundColor Yellow
Write-Host 'Imported Orthanc studies will be deleted because the orthanc_data volume will be removed.' -ForegroundColor Yellow
Write-Host 'Saved dataset registry files under api/data stay in place.' -ForegroundColor Yellow
Write-Host 'Original host DICOM source folders are never touched.' -ForegroundColor Yellow

if (-not (Confirm-Step 'Proceed with Docker environment reset?')) {
  Write-Host 'Reset cancelled.'
  exit 1
}

Write-Host ''
Write-Host 'Step 1 - stop and remove project containers and networks.' -ForegroundColor Cyan
if (Confirm-Step 'Run docker compose down --remove-orphans?') {
  docker compose down --remove-orphans
  Write-Host 'Containers and networks removed.' -ForegroundColor Green
} else {
  Write-Host 'Skipped container removal.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Step 2 - remove Docker-managed volumes for this project.' -ForegroundColor Cyan
if (Confirm-Step 'Run docker compose down --volumes --remove-orphans to remove the Orthanc volume?') {
  docker compose down --volumes --remove-orphans
  Write-Host 'Docker-managed volumes removed.' -ForegroundColor Green
} else {
  Write-Host 'Skipped volume removal.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Reset complete.' -ForegroundColor Green
Write-Host 'Bring the stack back with: docker compose up --build -d'
Write-Host 'Follow startup logs with: docker compose logs -f'
