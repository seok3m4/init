param(
  [ValidateSet("A", "B", "C", "D", "E", "PM")]
  [string]$Role = "A"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$gitHooks = Join-Path $root ".git/hooks"
if (-not (Test-Path -LiteralPath $gitHooks)) {
  throw ".git/hooks not found"
}

$hookPath = Join-Path $gitHooks "pre-commit"
$script = @"
#!/usr/bin/env sh
set -eu

if command -v pwsh >/dev/null 2>&1; then
  exec pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/check-local.ps1 -Role $Role
fi

if command -v powershell >/dev/null 2>&1; then
  exec powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-local.ps1 -Role $Role
fi

echo "[fail] PowerShell is required for local harness"
exit 1
"@

Set-Content -Encoding UTF8 -LiteralPath $hookPath -Value $script

$isCoreNonWindows = ($PSVersionTable.PSEdition -eq "Core" -and -not $IsWindows)
if ($isCoreNonWindows) {
  $chmod = Get-Command chmod -ErrorAction SilentlyContinue
  if ($chmod) {
    & $chmod +x $hookPath
  }
}

Write-Host "[ok] installed pre-commit hook for role $Role"
