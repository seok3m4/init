param(
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure {
    param([string]$Message)
    $failures.Add($Message) | Out-Null
}

function Require-Path {
    param([string]$RelativePath)
    $path = Join-Path $root $RelativePath
    if (-not (Test-Path -LiteralPath $path)) {
        Add-Failure "Missing required path: $RelativePath"
    }
}

function Read-Text {
    param([string]$RelativePath)
    $path = Join-Path $root $RelativePath
    return Get-Content -Encoding UTF8 -LiteralPath $path -Raw
}

$requiredPaths = @(
    "AGENTS.md",
    "docs/AGENTS.md",
    "docs/05_agents/AGENTS.md",
    "docs/05_agents/agent-a-auth-infra.md",
    "docs/05_agents/agent-b-company-recruiting.md",
    "docs/05_agents/agent-c-company-interview-criteria.md",
    "docs/05_agents/agent-d-candidate-application-interview.md",
    "docs/05_agents/agent-e-ai-report-pipeline.md",
    "docs/04_implementation/team-split-5dev-1pm.md",
    "docs/03_contracts/api-index.md",
    "docs/03_contracts/api-spec.md",
    "docs/03_contracts/enums.md",
    "docs/03_contracts/error-codes.md",
    "docs/02_architecture/data-model.md",
    "docs/02_architecture/erd.md",
    "docs/02_architecture/async-ai-pipeline.md",
    "docs/02_architecture/erdcloud/init_erd_v0.5_refined_erdcloud.sql",
    "frontend/AGENTS.md",
    "backend/AGENTS.md",
    "backend/api/AGENTS.md",
    "backend/worker/AGENTS.md",
    "backend/common/AGENTS.md",
    "infra/AGENTS.md",
    "scripts/AGENTS.md"
)

foreach ($relativePath in $requiredPaths) {
    Require-Path $relativePath
}

$requiredFolders = @(
    "frontend/src/app",
    "frontend/src/api",
    "frontend/src/features/auth",
    "frontend/src/features/company-recruiting",
    "frontend/src/features/company-interview-criteria",
    "frontend/src/features/candidate-application-interview",
    "backend/api/src",
    "backend/api/prisma",
    "backend/worker/src",
    "backend/common/src",
    "infra/aws",
    "infra/docker",
    "infra/db/migrations",
    "infra/db/seeds"
)

foreach ($relativePath in $requiredFolders) {
    Require-Path $relativePath
}

if ((Test-Path -LiteralPath (Join-Path $root "docs/03_contracts/api-index.md")) -and
    (Test-Path -LiteralPath (Join-Path $root "docs/03_contracts/api-spec.md"))) {
    $apiIndex = Read-Text "docs/03_contracts/api-index.md"
    $apiSpec = Read-Text "docs/03_contracts/api-spec.md"

    $indexIds = [regex]::Matches($apiIndex, "API-\d{3}") | ForEach-Object { $_.Value } | Sort-Object
    $specIds = [regex]::Matches($apiSpec, "### (API-\d{3})\b") | ForEach-Object { $_.Groups[1].Value } | Sort-Object

    $duplicateIds = $indexIds | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name }
    foreach ($id in $duplicateIds) {
        Add-Failure "Duplicate API ID in api-index.md: $id"
    }

    $indexSet = [System.Collections.Generic.HashSet[string]]::new([string[]]$indexIds)
    $specSet = [System.Collections.Generic.HashSet[string]]::new([string[]]$specIds)

    foreach ($id in $indexSet) {
        if (-not $specSet.Contains($id)) {
            Add-Failure "API ID exists in api-index.md but not api-spec.md: $id"
        }
    }

    foreach ($id in $specSet) {
        if (-not $indexSet.Contains($id)) {
            Add-Failure "API ID exists in api-spec.md but not api-index.md: $id"
        }
    }
}

if (Test-Path -LiteralPath (Join-Path $root "docs/02_architecture/erdcloud/init_erd_v0.5_refined_erdcloud.sql")) {
    $erdSql = Read-Text "docs/02_architecture/erdcloud/init_erd_v0.5_refined_erdcloud.sql"
    $requiredTables = @(
        "users",
        "companies",
        "file_assets",
        "candidate_profiles",
        "postings",
        "criterion_tags",
        "evaluation_criteria",
        "question_bank",
        "applications",
        "application_documents",
        "consent_records",
        "interview_sessions",
        "interview_answers",
        "follow_up_questions",
        "evaluation_reports",
        "report_scores",
        "report_evidences",
        "manual_evaluations",
        "notifications",
        "ai_process_logs",
        "ai_guardrail_logs",
        "embeddings"
    )

    foreach ($table in $requiredTables) {
        if ($erdSql -notmatch "(?im)^\s*CREATE\s+TABLE\s+$table\s*\(") {
            Add-Failure "Missing CREATE TABLE in ERDCloud SQL: $table"
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Host "Harness failed:" -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host " - $failure" -ForegroundColor Red
    }
    exit 1
}

if (-not $Quiet) {
    Write-Host "Harness passed: docs, contracts, agents, ERD, and folder structure are consistent." -ForegroundColor Green
}
