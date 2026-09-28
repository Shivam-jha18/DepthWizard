@echo off
TITLE DepthWizard - 1-Click Standalone Desktop Launcher
echo ========================================================
echo        🚀 DepthWizard - Standalone Launcher
echo  High-Precision Elevation Estimation & 3D Reconstruction
echo ========================================================
echo.

REM 1. Check Python virtual environment
IF NOT EXIST "venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found at .\venv\
    echo Please ensure dependencies are installed via requirements.txt
    pause
    exit /b 1
)

REM 2. Start Backend API Server
echo [1/3] Starting Local FastAPI Inference Server (Port 8000)...
start "DepthWizard Backend" /min "venv\Scripts\python.exe" backend/main.py

REM 3. Start Frontend React Server
echo [2/3] Starting Standalone Web GUI (Port 3000)...
cd frontend-react
start "DepthWizard Frontend" /min cmd /c "npm start"
cd ..

REM 4. Wait for servers to spin up and launch default browser
echo [3/3] Opening DepthWizard in your default browser...
timeout /t 5 /nobreak >nul
start http://localhost:3000

echo.
echo ========================================================
echo  DepthWizard is running locally (Air-Gapped & Offline)!
echo  - Web GUI:     http://localhost:3000
echo  - REST API:    http://localhost:8000/docs
echo.
echo  Keep this window open while using DepthWizard.
echo  To shut down, close the terminal windows.
echo ========================================================
pause
