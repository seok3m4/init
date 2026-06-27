param()

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dir = Join-Path $root "docs/04_implementation/ai-golden"

if (-not (Test-Path -LiteralPath $dir)) {
  Write-Host "[skip] ai-golden directory not found"
  exit 0
}

$files = Get-ChildItem -LiteralPath $dir -File -Filter "*.json"
if (-not $files -or $files.Count -eq 0) {
  Write-Host "[skip] no ai golden JSON files found"
  exit 0
}

foreach ($file in $files) {
  $json = Get-Content -Encoding UTF8 -LiteralPath $file.FullName -Raw | ConvertFrom-Json
  if ($null -eq $json.input) {
    throw "$($file.Name) missing input"
  }
  if ($null -eq $json.expected) {
    throw "$($file.Name) missing expected"
  }
  if ($null -eq $json.expected.outputShape) {
    throw "$($file.Name) missing expected.outputShape"
  }
  Write-Host "[ok] $($file.Name)"
}

Write-Host "[ok] verify-ai-golden passed"
