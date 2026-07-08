@echo off
REM One-click launcher for the UP SSSA Portal (Windows).
REM Checks prerequisites, installs dependencies, and starts the dev server.

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed. Opening the download page...
    echo Install the LTS version, then run this script again.
    start https://nodejs.org
    pause
    exit /b 1
)

if not exist .env (
    echo Creating .env from .env.example...
    copy .env.example .env >nul
)

if not exist node_modules (
    echo Installing dependencies - this takes a few minutes the first time...
    call npm install
    if errorlevel 1 (
        echo.
        echo npm install failed. Check the error above, then run this script again.
        pause
        exit /b 1
    )
)

echo.
echo Starting the portal at http://localhost:3000 ...
echo Keep this window open. Press Ctrl+C to stop the server.
echo.

REM Open the browser once the server has had time to boot.
start "" cmd /c "timeout /t 12 >nul & start http://localhost:3000"

call npm run dev
