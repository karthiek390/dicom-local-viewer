$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$failedChecks = 0
$warningChecks = 0

function Write-CheckResult {
  param(
    [string]$Level,
    [string]$Message
  )

  switch ($Level) {
    'PASS' { Write-Host "[PASS] $Message" -ForegroundColor Green }
    'WARN' { Write-Host "[WARN] $Message" -ForegroundColor Yellow; $script:warningChecks += 1 }
    'FAIL' { Write-Host "[FAIL] $Message" -ForegroundColor Red; $script:failedChecks += 1 }
    default { Write-Host "[INFO] $Message" }
  }
}

function Test-CommandExists {
  param([string]$Name)
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-FirstSemVer {
  param([string]$Text)
  $match = [regex]::Match($Text, '\d+\.\d+\.\d+')
  if ($match.Success) {
    return $match.Value
  }

  return $null
}

function Test-VersionAtLeast {
  param(
    [string]$Actual,
    [string]$Minimum
  )

  if (-not $Actual) {
    return $false
  }

  try {
    return ([version]$Actual) -ge ([version]$Minimum)
  } catch {
    return $false
  }
}

function Get-LockPackageVersion {
  param(
    [string]$LockFile,
    [string]$PackageName
  )

  if (-not (Test-Path $LockFile)) {
    return $null
  }

  $lockText = Get-Content -Path $LockFile -Raw
  $escapedPackageName = [regex]::Escape($PackageName)
  $pattern = '"node_modules/' + $escapedPackageName + '"\s*:\s*\{[\s\S]*?"version"\s*:\s*"([^"]+)"'
  $match = [regex]::Match($lockText, $pattern)

  if ($match.Success) {
    return $match.Groups[1].Value
  }

  return $null
}

function Test-BlockedPackageVersions {
  param([array]$BlockedPackages)

  foreach ($blocked in $BlockedPackages) {
    $version = Get-LockPackageVersion -LockFile $blocked.lockFile -PackageName $blocked.name
    if (-not $version) {
      Write-CheckResult 'WARN' "$($blocked.name) was not found in $($blocked.lockFile)."
      continue
    }

    if ($blocked.versions -contains $version) {
      Write-CheckResult 'FAIL' "$($blocked.name) $version is blocked. $($blocked.reason)"
    } else {
      Write-CheckResult 'PASS' "$($blocked.name) is locked to $version in $($blocked.lockFile)."
    }
  }
}

Write-Host "Running local preflight for dicom-local-viewer_Phase2_Complete..." -ForegroundColor Cyan

if (Test-CommandExists 'docker') {
  $dockerVersionText = docker version --format '{{.Client.Version}}' 2>$null
  if ($LASTEXITCODE -eq 0 -and $dockerVersionText) {
    Write-CheckResult 'PASS' "Docker CLI detected ($dockerVersionText)."
  } else {
    Write-CheckResult 'FAIL' 'Docker CLI is installed but not responding normally.'
  }
} else {
  Write-CheckResult 'FAIL' 'Docker is not installed or not on PATH.'
}

if (Test-CommandExists 'docker') {
  $composeVersionText = docker compose version 2>$null
  if ($LASTEXITCODE -eq 0) {
    $composeVersion = Get-FirstSemVer -Text $composeVersionText
    if ($composeVersion) {
      Write-CheckResult 'PASS' "Docker Compose detected ($composeVersion)."
    } else {
      Write-CheckResult 'PASS' 'Docker Compose detected.'
    }
  } else {
    Write-CheckResult 'FAIL' 'Docker Compose is not available. Install Docker Compose v2.'
  }

  cmd /c "docker info >nul 2>nul"
  if ($LASTEXITCODE -eq 0) {
    Write-CheckResult 'PASS' 'Docker engine is running.'
  } else {
    Write-CheckResult 'FAIL' 'Docker engine is not running. Start Docker Desktop or the Docker service first.'
  }
}

if (Test-CommandExists 'node') {
  $nodeVersionText = cmd /d /c "node --version" 2>$null
  $nodeVersion = Get-FirstSemVer -Text $nodeVersionText
  if (Test-VersionAtLeast -Actual $nodeVersion -Minimum '20.0.0') {
    Write-CheckResult 'PASS' "Optional local Node.js detected ($nodeVersion)."
  } else {
    Write-CheckResult 'WARN' "Optional local Node.js is $nodeVersionText. Use Node.js 20+ for local npm builds."
  }
} else {
  Write-CheckResult 'WARN' 'Node.js is not installed locally. That is okay for Docker-only usage, but local npm builds will not work.'
}

if (Test-CommandExists 'npm.cmd') {
  try {
    $npmVersionText = & npm.cmd --version 2>$null
    $npmVersion = Get-FirstSemVer -Text $npmVersionText
    if (Test-VersionAtLeast -Actual $npmVersion -Minimum '10.0.0') {
      Write-CheckResult 'PASS' "Optional local npm detected ($npmVersion)."
    } else {
      Write-CheckResult 'WARN' "Optional local npm is $npmVersionText. Use npm 10+ with Node.js 20+ for local builds."
    }
  } catch {
    Write-CheckResult 'WARN' 'npm exists, but the local shell configuration prevented reading its version cleanly. Fix the Windows cmd AutoRun setting if you need local npm usage.'
  }
} else {
  Write-CheckResult 'WARN' 'npm is not installed locally. That is okay for Docker-only usage.'
}

if (Test-CommandExists 'python') {
  $pythonVersionText = python --version 2>$null
  Write-CheckResult 'PASS' "Python detected ($pythonVersionText), but this project does not require Python."
} else {
  Write-CheckResult 'PASS' 'Python is not required for this project.'
}

if (Test-Path '.env') {
  Write-CheckResult 'PASS' '.env is present.'
} else {
  Write-CheckResult 'WARN' '.env is missing. Copy .env.example to .env before using path-based upload.'
}

foreach ($requiredFile in @(
  'docker-compose.yml',
  'api/package-lock.json',
  'web/package-lock.json',
  'api/Dockerfile',
  'nginx/Dockerfile',
  'OHIF/Dockerfile'
)) {
  if (Test-Path $requiredFile) {
    Write-CheckResult 'PASS' "$requiredFile is present."
  } else {
    Write-CheckResult 'FAIL' "$requiredFile is missing."
  }
}

Test-BlockedPackageVersions -BlockedPackages @(
  @{
    name = 'axios'
    lockFile = 'api/package-lock.json'
    versions = @('1.14.1', '0.30.4')
    reason = 'These versions were reported as compromised in the March 2026 Axios supply-chain incident.'
  }
)

Write-Host ''
if ($failedChecks -gt 0) {
  Write-Host "Preflight failed with $failedChecks blocking issue(s) and $warningChecks warning(s)." -ForegroundColor Red
  exit 1
}

Write-Host "Preflight passed with $warningChecks warning(s)." -ForegroundColor Green
