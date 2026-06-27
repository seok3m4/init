param(
    [string]$ApiDir = "backend/api",
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$apiPath = Join-Path $root $ApiDir
$packagePath = Join-Path $apiPath "package.json"
$schemaPath = Join-Path $apiPath "prisma/schema.prisma"
$migrationsPath = Join-Path $apiPath "prisma/migrations"

if (-not (Test-Path -LiteralPath $schemaPath)) {
    if (-not $Quiet) {
        Write-Host "Prisma harness skipped: $ApiDir/prisma/schema.prisma not found." -ForegroundColor Yellow
    }
    exit 0
}

if (-not (Test-Path -LiteralPath $packagePath)) {
    Write-Host "Prisma harness failed: $ApiDir/package.json is required when schema.prisma exists." -ForegroundColor Red
    exit 1
}

Push-Location $apiPath
try {
    $packageJson = Get-Content -Encoding UTF8 -LiteralPath $packagePath -Raw
    if ($packageJson -notmatch '"prisma"') {
        Write-Host "Prisma harness failed: package.json should include Prisma dependency or script when schema.prisma exists." -ForegroundColor Red
        exit 1
    }

    $hadDatabaseUrl = [bool][Environment]::GetEnvironmentVariable("DATABASE_URL")
    if (-not $hadDatabaseUrl) {
        $env:DATABASE_URL = "postgresql://user:pass@localhost:5432/init"
    }

    if (Test-Path -LiteralPath "node_modules/.bin/prisma.cmd") {
        & .\node_modules\.bin\prisma.cmd validate
    } elseif (Get-Command npx -ErrorAction SilentlyContinue) {
        npx prisma validate
    } else {
        Write-Host "Prisma harness skipped runtime validation: npx/prisma is not available." -ForegroundColor Yellow
    }

    if (-not $hadDatabaseUrl) {
        Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
    }

    if (-not (Test-Path -LiteralPath $migrationsPath)) {
        Write-Host "Prisma harness warning: prisma/migrations not found yet." -ForegroundColor Yellow
    }
} finally {
    Pop-Location
}

if (-not $Quiet) {
    Write-Host "Prisma harness passed." -ForegroundColor Green
}

