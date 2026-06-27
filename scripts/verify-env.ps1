param(
    [switch]$RequireValues,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$exampleFiles = @(
    ".env.example",
    "backend/api/.env.example",
    "backend/worker/.env.example",
    "frontend/.env.example"
)

$requiredNames = @(
    "DATABASE_URL",
    "REDIS_URL",
    "AWS_REGION",
    "S3_BUCKET",
    "SQS_QUEUE_URL",
    "OPENAI_API_KEY",
    "JWT_SECRET"
)

$existingExamples = @()
foreach ($file in $exampleFiles) {
    $path = Join-Path $root $file
    if (Test-Path -LiteralPath $path) {
        $existingExamples += $file
    }
}

if ($existingExamples.Count -eq 0) {
    if (-not $Quiet) {
        Write-Host "Env harness skipped: no .env.example files found yet." -ForegroundColor Yellow
    }
    exit 0
}

$allText = ""
foreach ($file in $existingExamples) {
    $allText += "`n# $file`n"
    $allText += Get-Content -Encoding UTF8 -LiteralPath (Join-Path $root $file) -Raw
}

$missing = @()
foreach ($name in $requiredNames) {
    if ($allText -notmatch "(?m)^$([regex]::Escape($name))=") {
        $missing += $name
    }
}

if ($missing.Count -gt 0) {
    Write-Host "Env harness failed: missing required names in .env.example files:" -ForegroundColor Red
    foreach ($name in $missing) {
        Write-Host " - $name" -ForegroundColor Red
    }
    exit 1
}

if ($RequireValues) {
    foreach ($name in $requiredNames) {
        if (-not [Environment]::GetEnvironmentVariable($name)) {
            Write-Host "Env harness failed: required environment variable is not set: $name" -ForegroundColor Red
            exit 1
        }
    }
}

if (-not $Quiet) {
    Write-Host "Env harness passed." -ForegroundColor Green
}

