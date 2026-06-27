param(
    [switch]$Build,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$targets = @(
    @{ Name = "api"; Path = "backend/api"; Dockerfile = "backend/api/Dockerfile" },
    @{ Name = "worker"; Path = "backend/worker"; Dockerfile = "backend/worker/Dockerfile" },
    @{ Name = "frontend"; Path = "frontend"; Dockerfile = "frontend/Dockerfile" }
)

$found = $false
foreach ($target in $targets) {
    $dockerfile = Join-Path $root $target.Dockerfile
    if (-not (Test-Path -LiteralPath $dockerfile)) {
        continue
    }

    $found = $true
    $content = Get-Content -Encoding UTF8 -LiteralPath $dockerfile -Raw
    if ($content -notmatch "(?im)^\s*FROM\s+") {
        Write-Host "Docker harness failed: missing FROM in $($target.Dockerfile)." -ForegroundColor Red
        exit 1
    }

    if ($Build) {
        if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
            Write-Host "Docker harness skipped build: docker command is not available." -ForegroundColor Yellow
            continue
        }
        docker build -f $dockerfile -t "init-$($target.Name):harness" (Join-Path $root $target.Path)
    }
}

if (-not $found) {
    if (-not $Quiet) {
        Write-Host "Docker harness skipped: no Dockerfile found yet." -ForegroundColor Yellow
    }
    exit 0
}

if (-not $Quiet) {
    Write-Host "Docker harness passed." -ForegroundColor Green
}

