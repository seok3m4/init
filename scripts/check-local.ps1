param(
    [ValidateSet("A", "B", "C", "D", "E", "PM")]
    [string]$Role,

    [switch]$SkipOwnership,
    [switch]$BuildDocker,
    [switch]$RequireEnvValues,
    [string]$SmokeBaseUrl
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$scriptRoot = $PSScriptRoot

Write-Host "Running docs/contracts harness..." -ForegroundColor Cyan
& (Join-Path $scriptRoot "verify-docs.ps1")

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

if (-not $SkipOwnership) {
    if (-not $Role) {
        Write-Host "Role is required unless -SkipOwnership is used." -ForegroundColor Red
        Write-Host "Example: powershell -ExecutionPolicy Bypass -File scripts\check-local.ps1 -Role A"
        exit 1
    }

    Write-Host "Running ownership harness for role $Role..." -ForegroundColor Cyan
    & (Join-Path $scriptRoot "verify-ownership.ps1") -Role $Role -IncludeUntracked

    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

Write-Host "Running Prisma harness..." -ForegroundColor Cyan
& (Join-Path $scriptRoot "verify-prisma.ps1")
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "Running Docker harness..." -ForegroundColor Cyan
& (Join-Path $scriptRoot "verify-docker.ps1") -Build:$BuildDocker
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "Running env harness..." -ForegroundColor Cyan
& (Join-Path $scriptRoot "verify-env.ps1") -RequireValues:$RequireEnvValues
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "Running AI golden harness..." -ForegroundColor Cyan
& (Join-Path $scriptRoot "verify-ai-golden.ps1")
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "Running smoke harness..." -ForegroundColor Cyan
if ($SmokeBaseUrl) {
    & (Join-Path $scriptRoot "smoke-local.ps1") -BaseUrl $SmokeBaseUrl
} else {
    & (Join-Path $scriptRoot "smoke-local.ps1")
}
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "Local harness passed." -ForegroundColor Green
