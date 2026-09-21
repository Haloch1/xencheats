param(
  [string]$NodePath = "node",
  [string]$BridgeScript = (Join-Path $PSScriptRoot "xen-reinvestment-bridge.mjs")
)
$ErrorActionPreference = "Stop"
$taskName = "Xen Reinvestment Bridge"
if ($NodePath -eq "node") {
  $NodePath = (Get-Command node -ErrorAction Stop).Source
}
$workingDirectory = Split-Path -Parent $PSScriptRoot
$action = New-ScheduledTaskAction -Execute $NodePath -Argument ('"' + $BridgeScript + '"') -WorkingDirectory $workingDirectory
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Days 7) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -Hidden
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Output "Registered $taskName for $env:USERNAME."
