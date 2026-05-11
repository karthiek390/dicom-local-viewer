$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
& "$PSScriptRoot\preflight.ps1"
docker compose up --build -d
Start-Process "http://localhost:8080"
