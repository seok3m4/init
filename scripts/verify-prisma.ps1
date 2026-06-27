param()

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$schema = Join-Path $root "backend/api/prisma/schema.prisma"
$apiDir = Join-Path $root "backend/api"

if (-not (Test-Path -LiteralPath $schema)) {
  Write-Host "[skip] backend/api/prisma/schema.prisma not found"
  exit 0
}

if (-not (Test-Path -LiteralPath (Join-Path $apiDir "package.json"))) {
  throw "schema.prisma exists but backend/api/package.json is missing"
}

$rootEnvExample = Join-Path $root ".env.example"
if (-not $env:DATABASE_URL -and (Test-Path -LiteralPath $rootEnvExample)) {
  $databaseUrlLine = Get-Content -Encoding UTF8 -LiteralPath $rootEnvExample | Where-Object { $_ -match "^DATABASE_URL=" } | Select-Object -First 1
  if ($databaseUrlLine) {
    $env:DATABASE_URL = $databaseUrlLine.Substring("DATABASE_URL=".Length)
  }
}

Push-Location $apiDir
try {
  $localPrismaCmd = Join-Path $apiDir "node_modules/.bin/prisma.cmd"
  $localPrisma = Join-Path $apiDir "node_modules/.bin/prisma"
  if (Test-Path -LiteralPath $localPrismaCmd) {
    & $localPrismaCmd validate
  } elseif (Test-Path -LiteralPath $localPrisma) {
    & $localPrisma validate
  } elseif (Get-Command npx -ErrorAction SilentlyContinue) {
    npx prisma validate
  } else {
    throw "Prisma CLI is not available. Run npm install in backend/api."
  }
} finally {
  Pop-Location
}

Write-Host "[ok] verify-prisma passed"
