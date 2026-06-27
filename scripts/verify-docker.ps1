param([switch]$Build)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dockerfiles = Get-ChildItem -LiteralPath $root -Recurse -File -Filter "Dockerfile*" | Where-Object { $_.FullName -notmatch "node_modules|\.git" }

if (-not $dockerfiles -or $dockerfiles.Count -eq 0) {
  Write-Host "[skip] no Dockerfile found"
  exit 0
}

foreach ($file in $dockerfiles) {
  $text = Get-Content -Encoding UTF8 -LiteralPath $file.FullName -Raw
  if ($text -notmatch "(?m)^FROM\s+") {
    throw "$($file.FullName) does not contain FROM"
  }
  Write-Host "[ok] Dockerfile syntax baseline: $($file.FullName)"
}

if ($Build) {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "docker command is not available"
  }
  foreach ($file in $dockerfiles) {
    $context = Split-Path -Parent $file.FullName
    $tag = "init-local-" + ($file.Directory.Name.ToLower() -replace "[^a-z0-9_.-]", "-")
    docker build -f $file.FullName -t $tag $context
  }
}

Write-Host "[ok] verify-docker passed"
