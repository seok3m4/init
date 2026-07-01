param(
  [ValidateSet('All', 'Infra', 'Api', 'Frontend', 'Worker')]
  [string] $Only = 'All',

  [switch] $SkipDocker,
  [switch] $UseExampleEnv,
  [switch] $Help
)

$ErrorActionPreference = 'Stop'

function Show-Help {
  Write-Host @'
Usage:
  powershell -ExecutionPolicy Bypass -File .\start-local.ps1
  powershell -ExecutionPolicy Bypass -File .\start-local.ps1 -Only Frontend
  powershell -ExecutionPolicy Bypass -File .\start-local.ps1 -Only Api -SkipDocker
  powershell -ExecutionPolicy Bypass -File .\start-local.ps1 -Only Worker -SkipDocker

Options:
  -Only All       Start local Docker infra, API, frontend, and worker. Default.
  -Only Infra     Start only PostgreSQL, Redis, Mailpit, and LocalStack.
  -Only Api       Start only the NestJS API server.
  -Only Frontend  Start only the Next.js frontend server.
  -Only Worker    Start only the AI worker.
  -SkipDocker     Do not start Docker infra when -Only All is used.
  -UseExampleEnv  Load .env.example even when .env exists.
  -Help           Show this help.

Local URLs:
  Frontend  http://localhost:3000/login
  API       http://localhost:3001
  Swagger   http://localhost:3001/api-docs
  Mailpit   http://localhost:8025
  LocalStack http://localhost:14566
'@
}

if ($Help) {
  Show-Help
  exit 0
}

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $Root '.env'
$ExampleEnvFile = Join-Path $Root '.env.example'

if ($UseExampleEnv -or -not (Test-Path -LiteralPath $EnvFile)) {
  $EnvFile = $ExampleEnvFile
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "Environment file not found: $EnvFile"
}

function Convert-EnvFileToCommand {
  param([string] $Path)

  $lines = Get-Content -Encoding UTF8 -LiteralPath $Path
  $commands = @()

  foreach ($line in $lines) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#') -or -not $trimmed.Contains('=')) {
      continue
    }

    $name, $value = $trimmed -split '=', 2
    $name = $name.Trim()
    $value = $value.Trim().Trim('"').Trim("'")

    if ($name) {
      $escapedValue = $value.Replace("'", "''")
      $commands += "`$env:$name = '$escapedValue'"
    }
  }

  return ($commands -join '; ')
}

function Start-DevWindow {
  param(
    [string] $Title,
    [string] $WorkingDirectory,
    [string] $Command,
    [int] $Port = 0
  )

  if ($Port -gt 0 -and (Test-PortInUse -Port $Port)) {
    Write-Host "[local] $Title already appears to be running on port $Port. Skipping."
    return
  }

  $windowCommand = @"
`$Host.UI.RawUI.WindowTitle = '$Title'
Set-Location -LiteralPath '$WorkingDirectory'
$Command
"@

  Start-Process powershell.exe -ArgumentList @(
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-Command', $windowCommand
  )
}

function Test-PortInUse {
  param([int] $Port)

  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
    $listener.Start()
    return $false
  } catch {
    return $true
  } finally {
    if ($listener) {
      $listener.Stop()
    }
  }
}

function Start-Infra {
  Write-Host '[local] Starting Docker infra: PostgreSQL, Redis, Mailpit, LocalStack'
  docker compose -f (Join-Path $Root 'infra/local/docker-compose.yml') up -d
}

$envCommand = Convert-EnvFileToCommand -Path $EnvFile
$apiDir = Join-Path $Root 'backend/api'
$frontendDir = Join-Path $Root 'frontend'
$workerDir = Join-Path $Root 'backend/worker'
$workerEnvCommand = @"
if (-not `$env:AI_SQS_QUEUE_URL) { `$env:AI_SQS_QUEUE_URL = `$env:SQS_QUEUE_URL }
if (-not `$env:AI_PROVIDER_API_KEY) { `$env:AI_PROVIDER_API_KEY = `$env:OPENAI_API_KEY }
if (-not `$env:AI_PROVIDER_API_KEY) { `$env:AI_PROVIDER_API_KEY = 'local-dev-placeholder' }
if (-not `$env:S3_BUCKET_NAME) { `$env:S3_BUCKET_NAME = `$env:S3_BUCKET }
if (-not `$env:WORKER_REPOSITORY_MODE) { `$env:WORKER_REPOSITORY_MODE = 'prisma' }
"@

if ($Only -eq 'All' -and -not $SkipDocker) {
  Start-Infra
}

if ($Only -eq 'Infra') {
  Start-Infra
  exit 0
}

if ($Only -eq 'All' -or $Only -eq 'Api') {
  Start-DevWindow `
    -Title 'Final Weapon API :3001' `
    -WorkingDirectory $apiDir `
    -Command "$envCommand; npm run dev" `
    -Port 3001
}

if ($Only -eq 'All' -or $Only -eq 'Frontend') {
  Start-DevWindow `
    -Title 'Final Weapon Frontend :3000' `
    -WorkingDirectory $frontendDir `
    -Command "$envCommand; `$env:PORT = '3000'; `$env:NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3001'; npm run dev -- -p 3000" `
    -Port 3000
}

if ($Only -eq 'All' -or $Only -eq 'Worker') {
  Start-DevWindow `
    -Title 'Final Weapon Worker' `
    -WorkingDirectory $workerDir `
    -Command "$envCommand; $workerEnvCommand; npm run start:dev"
}

Write-Host '[local] Requested services have been started.'
Write-Host '[local] Frontend: http://localhost:3000/login'
Write-Host '[local] API:      http://localhost:3001'
Write-Host '[local] Mailpit:  http://localhost:8025'
Write-Host '[local] LocalStack: http://localhost:14566'
Write-Host '[local] Worker:   backend/worker npm run start:dev'
