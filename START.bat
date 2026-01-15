@echo off
title PsyPro - Starting...

echo ========================================
echo    PsyPro - Full System Startup
echo ========================================
echo.

echo [1/5] Checking Docker...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)
echo [OK] Docker is running

echo [2/5] Starting PostgreSQL...
cd /d "%~dp0"
docker-compose up -d >nul 2>&1
echo [OK] PostgreSQL started
timeout /t 3 /nobreak >nul

echo [3/5] Starting Backend (port 3000)...
cd /d "%~dp0alpaka"
start "alpaka-backend" cmd /k "title alpaka-backend && npm run start"
timeout /t 5 /nobreak >nul

echo [4/5] Starting Frontend (port 4000)...
cd /d "%~dp0AlpakaUI"
start "AlpakaUI-frontend" cmd /k "title AlpakaUI-frontend && npm run start"
timeout /t 10 /nobreak >nul

echo [5/5] Starting Workers via PM2...
cd /d "%~dp0alpaka"
call npx pm2 delete all >nul 2>&1
call npx pm2 start ecosystem.config.windows.js

echo.
echo ========================================
echo    PsyPro Started Successfully!
echo ========================================
echo.
echo Frontend:  http://localhost:4000
echo Backend:   http://localhost:3000
echo Admin:     http://localhost:3000/admin
echo.
echo Workers running via PM2.
echo.
pause
