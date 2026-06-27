param([string]$BaseUrl = $env:SMOKE_BASE_URL)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

if (-not $BaseUrl) {
  Write-Host "[skip] SMOKE_BASE_URL is not set"
  exit 0
}

$base = $BaseUrl.TrimEnd("/")
$url = "$base/health"
$response = Invoke-WebRequest -UseBasicParsing -Uri $url -Method GET -TimeoutSec 10
if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
  throw "health check failed: $($response.StatusCode)"
}

Write-Host "[ok] smoke-local passed: $url"
