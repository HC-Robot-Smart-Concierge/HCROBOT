@echo off
title HC-Robot Master Launcher

echo ============================================================
echo      KHOI CHAY HE THONG HC-ROBOT (BACKEND & FRONTEND)
echo ============================================================
echo.

echo [+] Dang khoi chay Backend FastAPI Server (Port 8000)...
start "HC-Robot Backend" cmd /k "cd /d %~dp0backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo [+] Dang khoi chay Frontend React App (Port 3000)...
start "HC-Robot Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ============================================================
echo [SUCCESS] Da bat ca 2 server trong 2 cua so Terminal rieng!
echo - Backend API Docs: http://localhost:8000/docs
echo - Frontend Robot UI: http://localhost:3000
echo ============================================================
pause
