param(
    [string]$BaseUrl = $env:SMOKE_BASE_URL,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

if (-not $BaseUrl) {
    if (-not $Quiet) {
        Write-Host "Smoke harness skipped: SMOKE_BASE_URL or -BaseUrl is not set." -ForegroundColor Yellow
    }
    exit 0
}

$healthUrl = "$($BaseUrl.TrimEnd('/'))/health"
try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
        Write-Host "Smoke harness failed: $healthUrl returned $($response.StatusCode)." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Smoke harness failed: $healthUrl is not reachable. $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if (-not $Quiet) {
    Write-Host "Smoke harness passed: $healthUrl" -ForegroundColor Green
}

