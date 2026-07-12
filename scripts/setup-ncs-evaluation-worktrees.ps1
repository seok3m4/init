param(
  [string]$BaseRef = "HEAD",
  [string]$WorktreeRoot = "",
  [switch]$Apply
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $WorktreeRoot) {
  $WorktreeRoot = Join-Path (Split-Path $root -Parent) "ncs-evaluation-worktrees"
}
$baseCommit = (& git -C $root rev-parse --verify "$BaseRef^{commit}").Trim()
if ($LASTEXITCODE -ne 0 -or -not $baseCommit) {
  throw "BaseRef does not resolve to a commit: $BaseRef"
}

& git -C $root cat-file -e "$baseCommit`:docs/04_implementation/ncs-evaluation-m0/README.md"
if ($LASTEXITCODE -ne 0) {
  throw "BaseRef does not contain committed M0 assets: $BaseRef"
}

$strategies = @(
  @{ Branch = "experiment/ncs-eval-common-rubric"; Directory = "common-rubric" },
  @{ Branch = "experiment/ncs-eval-evidence-state"; Directory = "evidence-state" },
  @{ Branch = "experiment/ncs-eval-pairwise"; Directory = "pairwise" },
  @{ Branch = "experiment/ncs-eval-hybrid"; Directory = "hybrid" }
)

Write-Host "Base commit: $baseCommit"
Write-Host "Worktree root: $WorktreeRoot"
Write-Host "Mode: $(if ($Apply) { 'APPLY' } else { 'DRY-RUN' })"

foreach ($strategy in $strategies) {
  $branch = $strategy.Branch
  $target = Join-Path $WorktreeRoot $strategy.Directory
  & git -C $root check-ref-format --branch $branch | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Invalid branch name: $branch"
  }
  if (Test-Path -LiteralPath $target) {
    throw "Target path already exists: $target"
  }
  & git -C $root show-ref --verify --quiet "refs/heads/$branch"
  $branchExists = $LASTEXITCODE -eq 0
  $command = if ($branchExists) {
    "git worktree add `"$target`" $branch"
  } else {
    "git worktree add -b $branch `"$target`" $baseCommit"
  }
  Write-Host $command
  if ($Apply) {
    if ($branchExists) {
      & git -C $root worktree add $target $branch
    } else {
      & git -C $root worktree add -b $branch $target $baseCommit
    }
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to create worktree for $branch"
    }
  }
}

if (-not $Apply) {
  Write-Host "[ok] dry-run complete; rerun with -Apply to create worktrees"
} else {
  Write-Host "[ok] NCS evaluation worktrees created"
}
