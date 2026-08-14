# Disables the Windows hypervisor at the next startup.
# Run from an elevated PowerShell window, then restart Windows.

$isAdministrator = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $isAdministrator) {
    Write-Error 'Administrator privileges are required. Open PowerShell as Administrator and run this script again.'
    exit 1
}

& "$env:SystemRoot\System32\bcdedit.exe" /set hypervisorlaunchtype off
if ($LASTEXITCODE -ne 0) {
    Write-Error "bcdedit failed with exit code $LASTEXITCODE."
    exit $LASTEXITCODE
}

Write-Host 'Hyper-V hypervisor launch is disabled for the next boot.'
Write-Host 'Restart Windows for the change to take effect.'
