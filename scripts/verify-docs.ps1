param()

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$failed = $false

function Test-RequiredPath {
  param([string]$RelativePath)
  $path = Join-Path $root $RelativePath
  if (Test-Path -LiteralPath $path) {
    Write-Host "[ok] $RelativePath"
  } else {
    Write-Host "[fail] missing $RelativePath"
    $script:failed = $true
  }
}

function Test-FileContains {
  param([string]$RelativePath, [string[]]$Needles)
  $path = Join-Path $root $RelativePath
  if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "[fail] missing $RelativePath"
    $script:failed = $true
    return
  }
  $text = Get-Content -Encoding UTF8 -LiteralPath $path -Raw
  foreach ($needle in $Needles) {
    if ($text -notmatch [regex]::Escape($needle)) {
      Write-Host "[fail] $RelativePath does not mention '$needle'"
      $script:failed = $true
    }
  }
}

$requiredPaths = @(
  "AGENTS.md",
  "docs/05_agents/AGENTS.md",
  "docs/04_implementation/team-split-5dev-1pm.md",
  "docs/04_implementation/test-strategy.md",
  "docs/03_contracts/api-index.md",
  "docs/03_contracts/api-spec.md",
  "docs/03_contracts/enums.md",
  "docs/03_contracts/error-codes.md",
  "docs/02_architecture/data-model.md",
  "docs/02_architecture/erd.md",
  "docs/02_architecture/erdcloud/init_erd_v0.5_refined_erdcloud.sql",
  "frontend/src/app",
  "frontend/src/api",
  "frontend/src/features",
  "backend/api/src",
  "backend/api/prisma",
  "backend/worker/src",
  "backend/common/src",
  "infra/aws",
  "infra/docker",
  "infra/db/migrations",
  "infra/local"
)

foreach ($path in $requiredPaths) {
  Test-RequiredPath $path
}

Test-FileContains "AGENTS.md" @("React + Next.js + TypeScript", "NestJS + TypeScript", "Prisma", "pgvector", "AWS ECR + AWS ECS + AWS CloudFront + Amazon S3")
Test-FileContains "docs/04_implementation/team-split-5dev-1pm.md" @("React + Next.js + TypeScript", "NestJS + TypeScript", "OpenAI Agents SDK", "MediaPipe")

$erdPath = Join-Path $root "docs/02_architecture/erdcloud/init_erd_v0.5_refined_erdcloud.sql"
if (Test-Path -LiteralPath $erdPath) {
  $erd = Get-Content -Encoding UTF8 -LiteralPath $erdPath -Raw
  foreach ($table in @("users", "companies", "file_assets", "postings", "applications", "interview_sessions", "ai_process_logs", "evaluation_reports")) {
    if ($erd -notmatch "CREATE TABLE\s+$table\s*\(") {
      Write-Host "[fail] ERDCloud SQL missing table $table"
      $failed = $true
    }
  }
}

$apiIndex = Join-Path $root "docs/03_contracts/api-index.md"
$apiSpec = Join-Path $root "docs/03_contracts/api-spec.md"
if ((Test-Path -LiteralPath $apiIndex) -and (Test-Path -LiteralPath $apiSpec)) {
  $indexText = Get-Content -Encoding UTF8 -LiteralPath $apiIndex -Raw
  $specText = Get-Content -Encoding UTF8 -LiteralPath $apiSpec -Raw
  $ids = [regex]::Matches($indexText, "API-[A-Z]+-[0-9]+") | ForEach-Object { $_.Value } | Sort-Object -Unique
  foreach ($id in $ids) {
    if ($specText -notmatch [regex]::Escape($id)) {
      Write-Host "[fail] API ID $id exists in api-index.md but not api-spec.md"
      $failed = $true
    }
  }
}

if ($failed) {
  throw "verify-docs failed"
}

Write-Host "[ok] verify-docs passed"
