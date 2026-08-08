# Recreate the Desktop + Start Menu shortcuts for Local Code.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Icon = Join-Path $PSScriptRoot 'local-code.ico'
$Vbs = Join-Path $PSScriptRoot 'Local Code.vbs'

if (-not (Test-Path $Icon)) {
  & (Join-Path $PSScriptRoot 'make-icon.ps1')
}

$WshShell = New-Object -ComObject WScript.Shell
$targets = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Local Code.lnk'),
  (Join-Path (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs') 'Local Code.lnk')
)

foreach ($lnkPath in $targets) {
  $sc = $WshShell.CreateShortcut($lnkPath)
  $sc.TargetPath = $Vbs
  $sc.WorkingDirectory = $Root
  $sc.IconLocation = "$Icon,0"
  $sc.Description = 'Launch Local Code - local AI code editor'
  $sc.Save()
  Write-Host "Installed: $lnkPath"
}

Write-Host 'Done. Double-click "Local Code" on your Desktop to run the app.'
