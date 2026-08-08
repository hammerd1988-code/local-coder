# Local Code - desktop launcher
# Starts the app if needed, then opens it in the browser.

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Url = 'http://localhost:3000/'
$ApiHealth = 'http://localhost:3001/api/health'
$LogDir = Join-Path $Root 'data'
$LogFile = Join-Path $LogDir 'launcher.log'

function Write-Log($msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
  Add-Content -Path $LogFile -Value $line -ErrorAction SilentlyContinue
}

function Test-Url([string]$uri) {
  try {
    Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Show-Msg([string]$text, [string]$icon = 'Error') {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show($text, 'Local Code', 'OK', $icon) | Out-Null
}

if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

Set-Location $Root

if ((Test-Url $Url) -and (Test-Url $ApiHealth)) {
  Write-Log 'App already running - opening browser'
  Start-Process $Url
  exit 0
}

Write-Log 'Starting Local Code...'

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) {
  Show-Msg "npm was not found. Install Node.js, then try again.`n`nhttps://nodejs.org"
  exit 1
}

# cmd.exe keeps the PATH / npm shim behavior Windows expects
$stdout = Join-Path $LogDir 'app-stdout.log'
$stderr = Join-Path $LogDir 'app-stderr.log'
$proc = Start-Process -FilePath 'cmd.exe' `
  -ArgumentList '/c', 'npm start' `
  -WorkingDirectory $Root `
  -WindowStyle Minimized `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr `
  -PassThru

Write-Log "Started npm start (PID $($proc.Id))"

$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
  if ((Test-Url $Url) -and (Test-Url $ApiHealth)) {
    Write-Log 'Ready - opening browser'
    Start-Process $Url
    exit 0
  }
  if ($proc.HasExited) {
    Write-Log "npm start exited early with code $($proc.ExitCode)"
    $tail = ''
    if (Test-Path $stderr) { $tail = (Get-Content $stderr -Tail 20) -join "`n" }
    Show-Msg "Local Code failed to start.`n`n$tail`n`nSee data\launcher.log"
    exit 1
  }
  Start-Sleep -Milliseconds 500
}

Write-Log 'Timed out waiting for server'
Show-Msg "Local Code is taking too long to start.`nA minimized terminal may still be loading - try opening $Url in a moment." 'Warning'
Start-Process $Url
exit 1
