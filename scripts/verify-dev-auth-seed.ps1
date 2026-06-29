param()

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$contract = Join-Path $root "docs/03_contracts/dev-auth-contract.md"
$seed = Join-Path $root "backend/api/prisma/seed.ts"
$packageJson = Join-Path $root "backend/api/package.json"

if (-not (Test-Path -LiteralPath $contract)) {
  throw "docs/03_contracts/dev-auth-contract.md is missing"
}

if (-not (Test-Path -LiteralPath $seed)) {
  throw "backend/api/prisma/seed.ts is missing"
}

$contractText = Get-Content -Encoding UTF8 -LiteralPath $contract -Raw
foreach ($needle in @("CurrentUser", "X-Dev-User-Id", "DEV_COMPANY_USER", "DEV_CANDIDATE_USER", "COMMON_UNAUTHORIZED", "COMMON_FORBIDDEN")) {
  if ($contractText -notmatch [regex]::Escape($needle)) {
    throw "dev auth contract does not mention $needle"
  }
}

$seedText = Get-Content -Encoding UTF8 -LiteralPath $seed -Raw
foreach ($needle in @("userId: 1", "userType: ""COMPANY""", "companyId: 1", "userId: 2", "userType: ""CANDIDATE""", "candidateId: 1", "upsert")) {
  if ($seedText -notmatch [regex]::Escape($needle)) {
    throw "seed.ts does not contain required dev seed marker: $needle"
  }
}

if (Test-Path -LiteralPath $packageJson) {
  $packageText = Get-Content -Encoding UTF8 -LiteralPath $packageJson -Raw
  if ($packageText -notmatch '"dev:init"') {
    throw "backend/api/package.json exists but scripts.dev:init is missing"
  }
  if ($packageText -notmatch '"seed"\s*:\s*"tsx prisma/seed.ts"') {
    throw "backend/api/package.json exists but prisma.seed is missing"
  }
} else {
  Write-Host "[skip] backend/api/package.json not found; seed script contract will be enforced once package.json exists"
}

Write-Host "[ok] verify-dev-auth-seed passed"
