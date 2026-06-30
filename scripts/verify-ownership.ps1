param(
  [ValidateSet("A", "B", "C", "D", "E", "PM")]
  [string]$Role = "A"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $root
try {
  $changed = @()
  $changed += git diff --name-only
  $changed += git diff --cached --name-only
  $changed += git ls-files --others --exclude-standard
  $changed = $changed |
    Where-Object { $_ -and $_.Trim() -ne "" } |
    Where-Object {
      $normalized = $_ -replace "\\", "/"
      $normalized -notmatch "(^|/)node_modules/" -and
      $normalized -notmatch "(^|/)(\.next|dist|build|coverage)/"
    } |
    Sort-Object -Unique
} finally {
  Pop-Location
}

if (-not $changed -or $changed.Count -eq 0) {
  Write-Host "[ok] no changed files for ownership check"
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
  "^frontend/(eslint\.config\.mjs|next\.config\.js|tsconfig\.json)$",
  "^backend/(api|common|worker)/package(-lock)?\.json$",
  "^backend/api/(jest\.config\.js|nest-cli\.json|tsconfig(\.build)?\.json)$",
  "^backend/common/tsconfig\.json$",
  "^backend/worker/tsconfig\.json$"
)

$allowed = @{
  A = $common + $baselineSkeleton + @("^backend/common/", "^backend/api/(src|prisma)/", "^frontend/src/api/", "^frontend/src/features/auth/", "^infra/", "^docs/03_contracts/", "^docs/02_architecture/")
  B = $common + $baselineSkeleton + @("^frontend/src/features/company-recruiting/", "^frontend/src/app/company/layout\.tsx$", "^backend/api/src/", "^docs/03_contracts/", "^docs/02_architecture/")
  C = $common + $baselineSkeleton + @("^frontend/src/features/company-interview-criteria/", "^frontend/src/app/company/layout\.tsx$", "^frontend/src/app/company/interviews/", "^backend/api/src/", "^docs/03_contracts/", "^docs/02_architecture/")
  D = $common + $baselineSkeleton + @("^frontend/src/features/candidate-application-interview/", "^frontend/src/app/candidate/", "^backend/api/src/", "^docs/03_contracts/", "^docs/02_architecture/")
  E = $common + $baselineSkeleton + @("^frontend/src/features/ai-report/", "^backend/worker/", "^backend/api/src/", "^docs/04_implementation/ai-golden/", "^docs/03_contracts/", "^docs/02_architecture/")
  PM = $common + $baselineSkeleton + @("^docs/", "^assets/", "^design\.md$")
}

$blocked = @()
foreach ($file in $changed) {
  $normalized = $file -replace "\\", "/"
  $match = $false
  foreach ($pattern in $allowed[$Role]) {
    if ($normalized -match $pattern) {
      $match = $true
      break
    }
  }
  if (-not $match) {
    $blocked += $normalized
  }
}

if ($blocked.Count -gt 0) {
  Write-Host "[fail] files outside role $Role ownership:"
  $blocked | ForEach-Object { Write-Host "  $_" }
  throw "verify-ownership failed"
}

Write-Host "[ok] verify-ownership passed for role $Role"
