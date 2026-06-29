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

if (-not (Test-Path -LiteralPath (Join-Path $apiDir "package-lock.json"))) {
  throw "schema.prisma exists but backend/api/package-lock.json is missing"
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

  if (-not (Test-Path -LiteralPath $localPrismaCmd) -and -not (Test-Path -LiteralPath $localPrisma)) {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
      throw "npm is not available. Node.js 20.x and npm >=10 are required."
    }
    npm ci --ignore-scripts
    if ($LASTEXITCODE -ne 0) {
      throw "npm ci failed while preparing local Prisma CLI"
    }
  }

  if (Test-Path -LiteralPath $localPrismaCmd) {
    $prisma = $localPrismaCmd
  } elseif (Test-Path -LiteralPath $localPrisma) {
    $prisma = $localPrisma
  } else {
    throw "Local Prisma CLI is not available after npm ci."
  }

  & $prisma validate
  if ($LASTEXITCODE -ne 0) {
    throw "prisma validate failed"
  }

  & $prisma generate
  if ($LASTEXITCODE -ne 0) {
    throw "prisma generate failed"
  }
} finally {
  Pop-Location
}

Write-Host "[ok] verify-prisma passed"
