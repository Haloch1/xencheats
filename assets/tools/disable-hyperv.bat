@echo off
setlocal
title XenCheats Hyper-V Toggle
echo This helper disables the Windows hypervisor at boot for compatibility testing.
echo It does not delete Windows system files.
echo.
net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Please right-click this file and choose "Run as administrator".
  pause
  exit /b 1
)

bcdedit /set hypervisorlaunchtype off
if errorlevel 1 (
  echo Failed to update the boot setting.
  pause
  exit /b 1
)

echo Hyper-V will be disabled after the next restart.
echo To restore it later, run: bcdedit /set hypervisorlaunchtype auto
choice /M "Restart now"
if errorlevel 2 exit /b 0
shutdown /r /t 10
endlocal
