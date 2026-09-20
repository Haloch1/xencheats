$ErrorActionPreference = "Stop"
Unregister-ScheduledTask -TaskName "Xen Reinvestment Bridge" -Confirm:$false -ErrorAction SilentlyContinue
Write-Output "Removed Xen Reinvestment Bridge."
