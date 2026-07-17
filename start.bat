@echo off
title PM Flow Copilot Launcher
echo ===================================================
echo             PM Flow Copilot Launcher
echo ===================================================
echo.
echo Launching local server and web application...
echo.

:: Launch Backend in a new window
echo [1/2] Starting Express Backend...
start "PM Flow Copilot - Backend" cmd /c "cd backend && npm run dev"

:: Launch Frontend in a new window
echo [2/2] Starting React Vite Frontend...
start "PM Flow Copilot - Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo ===================================================
echo PM Assistant is running!
echo - Frontend: http://localhost:5173
echo - Backend: http://localhost:5000
echo.
echo You can now load the Chrome Extension:
echo 1. Open chrome://extensions
echo 2. Enable "Developer mode"
echo 3. Click "Load unpacked"
echo 4. Choose: C:\Users\Администратор\.gemini\antigravity\scratch\pm-assistant\chrome-extension
echo ===================================================
echo.
pause
