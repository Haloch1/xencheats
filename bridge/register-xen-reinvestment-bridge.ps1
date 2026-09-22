param(
  [string]$NodePath = "node",
  [string]$BridgeScript = (Join-Path $PSScriptRoot "xen-reinvestment-bridge.mjs"),
  [string]$LauncherScript = (Join-Path $PSScriptRoot "start-xen-reinvestment-bridge.ps1")
)
$ErrorActionPreference = "Stop"
$taskName = "Xen Reinvestment Bridge"
if ($NodePath -eq "node") {
  $NodePath = (Get-Command node -ErrorAction Stop).Source
}
$workingDirectory = Split-Path -Parent $PSScriptRoot
$powershellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
$browserArguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $LauncherScript + '" -BrowserOnly'
$browserAction = New-ScheduledTaskAction -Execute $powershellPath -Argument $browserArguments -WorkingDirectory $workingDirectory
# Task Scheduler must own the Node process directly. A PowerShell wrapper can
# be stopped while its Node child survives, creating two competing bridges.
$action = New-ScheduledTaskAction -Execute $NodePath -Argument ('"' + $BridgeScript + '"') -WorkingDirectory $workingDirectory
$browserTrigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$browserTrigger.Delay = "PT5S"
$bridgeTrigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$bridgeTrigger.Delay = "PT15S"
# Keep the persistent Coinbase UI process and bridge quiet, including on battery.
# The interactive logon principal is required for Chrome's authenticated profile.
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Seconds 0) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew -Hidden -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName "Xen Coinbase Browser" -Action $browserAction -Trigger $browserTrigger -Settings $settings -Principal $principal -Force | Out-Null
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $bridgeTrigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Output "Registered $taskName and Xen Coinbase Browser for $env:USERNAME."
