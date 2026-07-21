@echo off
setlocal
cd /d "%~dp0"
title Stripe Restricted-Key Permission Viewer
echo Starting the local Stripe Restricted-Key Permission Viewer...
echo This tool performs read-only Stripe API checks and does not save the key.
echo.
node tools\stripe-permission-viewer\server.mjs
echo.
echo The permission viewer has stopped.
pause
