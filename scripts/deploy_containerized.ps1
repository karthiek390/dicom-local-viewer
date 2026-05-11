$ErrorActionPreference = 'Stop'

$fresh = $false
if ($args.Count -gt 0 -and ($args[0] -eq '--fresh' -or $args[0] -eq '-f')) {
  $fresh = $true
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host 'Running deploy flow for dicom-local-viewer_Phase2_Complete...' -ForegroundColor Cyan

if (-not (Test-Path '.env')) {
  if (Test-Path '.env.example') {
    Copy-Item '.env.example' '.env'
    Write-Host '[INFO] .env was missing, so a new one was created from .env.example.' -ForegroundColor Yellow
    Write-Host '[INFO] Path-based upload remains disabled until you add real host-path mappings in .env.' -ForegroundColor Yellow
    Write-Host ''
  } else {
    Write-Host '[FAIL] .env is missing and .env.example was not found.' -ForegroundColor Red
    exit 1
  }
}

& "$PSScriptRoot\preflight.ps1"

if ($fresh) {
  Write-Host ''
  Write-Host '--fresh requested: resetting Docker-managed state before startup...' -ForegroundColor Yellow
  & "$PSScriptRoot\reset.ps1" '--reset-all'
}

Write-Host ''
Write-Host 'Starting all services (detached)...' -ForegroundColor Cyan
docker compose up --build -d

Write-Host ''
Write-Host 'Services started.' -ForegroundColor Green
Write-Host ''
Write-Host 'Open:             http://localhost:8080'
Write-Host 'Check status:     docker compose ps'
Write-Host 'Follow logs:      docker compose logs -f'
Write-Host ''
Write-Host 'On a first startup or after --fresh, allow a minute or two for builds and service initialization.'
Start-Process "http://localhost:8080"
