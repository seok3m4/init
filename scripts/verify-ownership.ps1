param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("A", "B", "C", "D", "E", "PM")]
    [string]$Role,

    [switch]$IncludeUntracked,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = Resolve-Path (Join-Path $PSScriptRoot "..")

function Normalize-PathText {
    param([string]$PathText)
    return ($PathText -replace "\\", "/").Trim()
}

function Get-ChangedFiles {
    $files = New-Object System.Collections.Generic.List[string]

    $tracked = git -C $root diff --name-only
    foreach ($file in $tracked) {
        if ($file.Trim()) {
            $files.Add((Normalize-PathText $file)) | Out-Null
        }
    }

    $staged = git -C $root diff --cached --name-only
    foreach ($file in $staged) {
        if ($file.Trim()) {
            $normalized = Normalize-PathText $file
            if (-not $files.Contains($normalized)) {
                $files.Add($normalized) | Out-Null
            }
        }
    }

    if ($IncludeUntracked) {
        $untracked = git -C $root ls-files --others --exclude-standard
        foreach ($file in $untracked) {
            if ($file.Trim()) {
                $normalized = Normalize-PathText $file
                if (-not $files.Contains($normalized)) {
                    $files.Add($normalized) | Out-Null
                }
            }
        }
    }

    return $files
}

$sharedPatterns = @(
    "^AGENTS\.md$",
    "^docs/05_agents/",
    "^docs/04_implementation/team-split-5dev-1pm\.md$",
    "^scripts/",
    "^\.gitignore$"
)

$rolePatterns = @{
    "A" = @(
        "^backend/common/",
        "^backend/api/",
        "^infra/",
        "^\.github/",
        "^docs/05_agents/agent-a-auth-infra\.md$",
        "^docs/03_contracts/",
        "^docs/02_architecture/",
        "^docs/04_implementation/",
        "^frontend/src/features/auth/"
    )
    "B" = @(
        "^backend/api/",
        "^frontend/src/features/company-recruiting/",
        "^docs/05_agents/agent-b-company-recruiting\.md$",
        "^docs/01_product/",
        "^docs/03_contracts/",
        "^docs/02_architecture/",
        "^docs/04_implementation/"
    )
    "C" = @(
        "^backend/api/",
        "^frontend/src/features/company-interview-criteria/",
        "^docs/05_agents/agent-c-company-interview-criteria\.md$",
        "^docs/01_product/",
        "^docs/03_contracts/",
        "^docs/02_architecture/",
        "^docs/04_implementation/"
    )
    "D" = @(
        "^backend/api/",
        "^frontend/src/features/candidate-application-interview/",
        "^docs/05_agents/agent-d-candidate-application-interview\.md$",
        "^docs/01_product/",
        "^docs/03_contracts/",
        "^docs/02_architecture/",
        "^docs/04_implementation/"
    )
    "E" = @(
        "^backend/worker/",
        "^backend/api/",
        "^frontend/src/features/ai-report/",
        "^docs/05_agents/agent-e-ai-report-pipeline\.md$",
        "^docs/03_contracts/",
        "^docs/02_architecture/",
        "^docs/04_implementation/"
    )
    "PM" = @(
        "^docs/",
        "^assets/",
        "^design\.md$",
        "^frontend/src/styles/",
        "^frontend/src/components/"
    )
}

function Test-Allowed {
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

$changedFiles = Get-ChangedFiles
$allowedPatterns = @($sharedPatterns + $rolePatterns[$Role])
$violations = New-Object System.Collections.Generic.List[string]

foreach ($file in $changedFiles) {
    if (-not (Test-Allowed -File $file -Patterns $allowedPatterns)) {
        $violations.Add($file) | Out-Null
    }
}

if ($violations.Count -gt 0) {
    Write-Host "Ownership check failed for role $Role." -ForegroundColor Red
    Write-Host "Files outside allowed ownership:" -ForegroundColor Red
    foreach ($file in $violations) {
        Write-Host " - $file" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "If this is intentional, mention the cross-owner review in your final report or PR note." -ForegroundColor Yellow
    exit 1
}

if (-not $Quiet) {
    Write-Host "Ownership check passed for role $Role." -ForegroundColor Green
}

