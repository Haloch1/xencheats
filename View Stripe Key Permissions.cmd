@echo off
setlocal
cd /d "%~dp0"
title Stripe Restricted-Key Permission Viewer
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or is not available in PATH.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)
if not exist "node_modules\stripe\package.json" (
  echo The Stripe package is missing from this project.
  echo Run npm install in this folder, then run this file again.
  pause
  exit /b 1
)
echo Starting Stripe Permission Viewer at http://127.0.0.1:4400
echo Keep this window open while using the viewer.
echo.
node tools\stripe-permission-viewer\server.mjs
echo.
echo The permission viewer has stopped.
pause
