@echo off
title Remove hvix64.exe & hvax64.exe
echo.
echo =========================================
echo   Removing Hyper-V Related Executables
echo =========================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo This script must be run as Administrator.
    echo Right-click the file and choose "Run as administrator".
    pause
    exit /b
)

echo Taking ownership of files...
takeown /F "C:\Windows\System32\hvix64.exe"
takeown /F "C:\Windows\System32\hvax64.exe"

echo.
echo Granting full control to Administrators...
icacls "C:\Windows\System32\hvix64.exe" /grant Administrators:(F)
icacls "C:\Windows\System32\hvax64.exe" /grant Administrators:(F)

echo.
echo Deleting files...
del "C:\Windows\System32\hvix64.exe"
del "C:\Windows\System32\hvax64.exe"

echo.
echo Operation complete.
echo Your PC will restart in 10 seconds...
timeout /t 10 /nobreak

shutdown /r /t 0
