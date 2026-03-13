@echo off
echo =============================================
echo  DineAura - Starting Backend Server
echo =============================================
cd /d "%~dp0"
where node >nul 2>&1 && node server.js || "C:\Program Files\nodejs\node.exe" server.js
pause
