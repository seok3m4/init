param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("A", "B", "C", "D", "E", "PM")]
    [string]$Role
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$hooksDir = Join-Path $root ".git/hooks"
$hookPath = Join-Path $hooksDir "pre-commit"

if (-not (Test-Path -LiteralPath $hooksDir)) {
    throw "Git hooks directory not found: $hooksDir"
}

$hook = @"
#!/bin/sh
powershell -ExecutionPolicy Bypass -File scripts/check-local.ps1 -Role $Role
"@

Set-Content -Encoding ASCII -LiteralPath $hookPath -Value $hook
Write-Host "Installed pre-commit hook for role $Role at $hookPath" -ForegroundColor Green

