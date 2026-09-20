param(
  [string]$NodePath = "node",
  [string]$BridgeScript = (Join-Path $PSScriptRoot "xen-reinvestment-bridge.mjs")
)
$ErrorActionPreference = "Stop"
$taskName = "Xen Reinvestment Bridge"
$action = New-ScheduledTaskAction -Execute $NodePath -Argument ('"' + $BridgeScript + '"') -WorkingDirectory (Split-Path -Parent $BridgeScript)
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Days 7) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -Hidden
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Output "Registered $taskName for $env:USERNAME."
