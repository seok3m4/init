param(
    [string]$CasesDir = "docs/04_implementation/ai-golden",
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$casesPath = Join-Path $root $CasesDir

if (-not (Test-Path -LiteralPath $casesPath)) {
    if (-not $Quiet) {
        Write-Host "AI golden harness skipped: $CasesDir not found yet." -ForegroundColor Yellow
    }
    exit 0
}

$jsonFiles = Get-ChildItem -LiteralPath $casesPath -Filter "*.json" -File
if ($jsonFiles.Count -eq 0) {
    if (-not $Quiet) {
        Write-Host "AI golden harness skipped: no golden JSON files found." -ForegroundColor Yellow
    }
    exit 0
}

foreach ($file in $jsonFiles) {
    $json = Get-Content -Encoding UTF8 -LiteralPath $file.FullName -Raw | ConvertFrom-Json
    if (-not $json.input) {
        Write-Host "AI golden harness failed: missing input in $($file.Name)." -ForegroundColor Red
        exit 1
    }
    if (-not $json.expected) {
        Write-Host "AI golden harness failed: missing expected in $($file.Name)." -ForegroundColor Red
        exit 1
    }
    if (-not $json.expected.outputShape) {
        Write-Host "AI golden harness failed: missing expected.outputShape in $($file.Name)." -ForegroundColor Red
        exit 1
    }
}

if (-not $Quiet) {
    Write-Host "AI golden harness passed." -ForegroundColor Green
}

