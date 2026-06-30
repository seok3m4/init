param(
  [string]$BaseRef = $env:GITHUB_BASE_REF
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")

function Get-ChangedFiles {
  Push-Location $root
  try {
    if ($BaseRef) {
      $remoteBase = "origin/$BaseRef"
      $exists = git rev-parse --verify "$remoteBase" 2>$null
      if (-not $exists) {
        git fetch origin $BaseRef --depth=1 | Out-Null
      }
      return git diff --name-only "$remoteBase...HEAD"
    }

    $changed = @()
    $changed += git diff --name-only
    $changed += git diff --cached --name-only
    $changed += git ls-files --others --exclude-standard
    return $changed
  } finally {
    Pop-Location
  }
}

function Test-AnyPattern {
  param(
    [string]$File,
    [string[]]$Patterns
  )

  foreach ($pattern in $Patterns) {
    if ($File -match $pattern) {
      return $true
    }
  }
  return $false
}

function Set-GitHubOutput {
  param(
    [string]$Name,
    [string]$Value
  )

  if ($env:GITHUB_OUTPUT) {
    Add-Content -LiteralPath $env:GITHUB_OUTPUT -Encoding UTF8 -Value "$Name=$Value"
  }
}

$changed = Get-ChangedFiles |
  Where-Object { $_ -and $_.Trim() -ne "" } |
  ForEach-Object { $_ -replace "\\", "/" } |
  Where-Object {
    $_ -notmatch "(^|/)node_modules/" -and
    $_ -notmatch "(^|/)(\.next|dist|build|coverage)/"
  } |
  Sort-Object -Unique

if (-not $changed -or $changed.Count -eq 0) {
  Write-Host "[ok] no changed files for auto ownership check"
  Set-GitHubOutput "roles_csv" ""
  Set-GitHubOutput "roles_json" "[]"
  exit 0
}

$common = @(
  "^AGENTS\.md$",
  "^docs/05_agents/",
  "^docs/04_implementation/(team-split-5dev-1pm|test-strategy|module-boundaries|task-split|milestones)\.md$",
  "^docs/04_implementation/one-time-alignment/agent-[a-e]\.md$",
  "^docs/04_implementation/one-time-alignment/agent-pm\.md$",
  "^scripts/",
  "^\.github/",
  "^\.gitignore$"
)

$baselineSkeleton = @(
  "^backend/api/src/modules/(auth|company-recruiting|company-interview|company-profile|candidate|interview|report|ai)/\.gitkeep$",
  "^backend/common/src/(enums|dto|errors)/\.gitkeep$",
  "^frontend/src/features/company-profile/\.gitkeep$",
  "^frontend/package(-lock)?\.json$",
  "^frontend/(eslint\.config\.mjs|next-env\.d\.ts|next\.config\.(js|ts)|tsconfig\.json)$",
  "^backend/(api|common|worker)/package(-lock)?\.json$",
  "^backend/api/(jest\.config\.js|nest-cli\.json|tsconfig(\.build)?\.json)$",
  "^backend/common/tsconfig\.json$",
  "^backend/worker/tsconfig\.json$"
)

$owned = @{
  A = @(
    "^backend/common/",
    "^backend/api/prisma/",
    "^backend/api/src/modules/auth/",
    "^backend/api/src/modules/health/",
    "^backend/api/src/shared/",
    "^backend/api/src/swagger/",
    "^frontend/src/app/(login|signup|password/reset)/",
    "^frontend/src/features/auth/",
    "^infra/",
    "^docs/03_contracts/",
    "^docs/02_architecture/"
  )
  B = @("^frontend/src/features/company-recruiting/", "^frontend/src/app/(layout\.tsx|page\.tsx|company/recruitments/|company/applicants/|company/applications/)", "^frontend/src/styles/", "^frontend/public/logo-init\.png$", "^backend/api/src/modules/company-recruiting/")
  C = @("^frontend/src/features/company-interview-criteria/", "^frontend/src/app/company/interviews/", "^backend/api/src/modules/company-interview/")
  D = @("^frontend/src/features/candidate-application-interview/", "^frontend/src/app/candidate/", "^backend/api/src/modules/(candidate|interview)/")
  E = @("^frontend/src/features/ai-report/", "^backend/worker/", "^backend/api/src/modules/(report|ai)/", "^backend/api/scripts/report-smoke\.ts$", "^docs/04_implementation/ai-golden/")
  PM = @("^docs/", "^assets/", "^design\.md$")
}

$sharedBackend = @("^backend/api/src/modules/app\.module\.ts$", "^backend/api/src/main\.ts$")
$sharedFrontendApi = @("^frontend/src/api/")
$sharedFrontendCompany = @("^frontend/src/app/company/layout\.tsx$")
$allowedCommon = $common + $baselineSkeleton
$impacted = New-Object System.Collections.Generic.HashSet[string]
$blocked = @()

foreach ($file in $changed) {
  if (Test-AnyPattern $file $allowedCommon) {
    [void]$impacted.Add("COMMON")
    continue
  }

  if (Test-AnyPattern $file $sharedBackend) {
    [void]$impacted.Add("A")
    [void]$impacted.Add("B")
    [void]$impacted.Add("C")
    [void]$impacted.Add("D")
    [void]$impacted.Add("E")
    continue
  }

  if (Test-AnyPattern $file $sharedFrontendApi) {
    [void]$impacted.Add("A")
    [void]$impacted.Add("B")
    [void]$impacted.Add("D")
    [void]$impacted.Add("E")
    continue
  }

  if (Test-AnyPattern $file $sharedFrontendCompany) {
    [void]$impacted.Add("A")
    [void]$impacted.Add("B")
    [void]$impacted.Add("C")
    continue
  }

  $matched = $false
  foreach ($role in @("A", "B", "C", "D", "E", "PM")) {
    if (Test-AnyPattern $file $owned[$role]) {
      [void]$impacted.Add($role)
      $matched = $true
    }
  }

  if (-not $matched) {
    $blocked += $file
  }
}

if ($blocked.Count -gt 0) {
  Write-Host "[fail] files outside all known ownership:"
  $blocked | ForEach-Object { Write-Host "  $_" }
  throw "verify-ownership-auto failed"
}

$roles = $impacted | Sort-Object
$harnessRoles = @($roles | Where-Object { $_ -ne "COMMON" })
$rolesCsv = $harnessRoles -join ","
$rolesJson = "[$(($harnessRoles | ForEach-Object { '"' + $_ + '"' }) -join ',')]"

Write-Host "[ok] verify-ownership-auto passed"
Write-Host "impacted roles: $($roles -join ', ')"
Write-Host "harness roles: $rolesCsv"
Set-GitHubOutput "roles_csv" $rolesCsv
Set-GitHubOutput "roles_json" $rolesJson
