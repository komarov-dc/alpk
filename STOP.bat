@echo off
title PsyPro - Stopping...

echo ========================================
echo    PsyPro - Stopping All Components
echo ========================================
echo.

echo [1/4] Stopping PM2 workers...
cd /d "%~dp0alpaka"
call npx pm2 delete all >nul 2>&1
echo [OK] PM2 workers stopped

echo [2/4] Stopping servers...
taskkill /FI "WINDOWTITLE eq alpaka-backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq AlpakaUI-frontend*" /F >nul 2>&1

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo [OK] Servers stopped

echo [3/4] Stopping PostgreSQL...
cd /d "%~dp0"
docker-compose stop >nul 2>&1
echo [OK] PostgreSQL stopped

echo [4/4] Stopping PM2 daemon...
cd /d "%~dp0alpaka"
call npx pm2 kill >nul 2>&1
echo [OK] PM2 daemon stopped

echo.
echo ========================================
echo    All Components Stopped!
echo ========================================
echo.
pause
