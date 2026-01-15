@echo off
title PsyPro - Installation
chcp 65001 >nul

echo ========================================
echo    PsyPro - First Time Setup
echo ========================================
echo.

echo [1/6] Checking Docker...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)
echo [OK] Docker is running

echo [2/6] Starting PostgreSQL...
cd /d "%~dp0"
docker-compose up -d
echo [OK] PostgreSQL started
timeout /t 5 /nobreak >nul

echo [3/6] Installing Backend dependencies...
cd /d "%~dp0alpaka"
call npm install
echo [OK] Backend dependencies installed

echo [4/6] Generating Prisma client (Backend)...
call npx prisma generate
echo [OK] Prisma client generated (Backend)

echo [5/6] Installing Frontend dependencies...
cd /d "%~dp0AlpakaUI"
call npm install
echo [OK] Frontend dependencies installed

echo [6/6] Generating Prisma client (Frontend)...
call npx prisma generate
echo [OK] Prisma client generated (Frontend)

echo.
echo ========================================
echo    Installation Complete!
echo ========================================
echo.
echo Now run START.bat to launch the system.
echo.
pause
