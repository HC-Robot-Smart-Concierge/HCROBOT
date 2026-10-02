@echo off
title HC-Robot Master 1-Click Launcher

echo ============================================================
echo      KHOI CHAY TOAN BO HE THONG HC-ROBOT (1-CLICK ALL)
echo ============================================================
echo.

echo [1/3] Khoi chay Backend FastAPI Server (Port 8000)...
start "HC-Robot [Backend :8000]" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo [2/3] Khoi chay Frontend React App (Port 3000)...
start "HC-Robot [Frontend :3000]" cmd /k "cd /d %~dp0frontend && npm run dev"

echo [3/3] Khoi chay ROS 2 SLAM & Rosbridge tren WSL2 (Port 9090)...
start "HC-Robot [ROS 2 SLAM WSL2 :9090]" wsl -d Ubuntu-24.04 bash /mnt/f/DoAn/HC-Robot/robot/ros2_configs/start_wsl_slam.sh

echo.
echo ============================================================
echo [HOAN TAT] Toan bo 3 service tren Laptop da khoi dong!
echo - Web Admin SLAM: http://localhost:3000/admin
echo - Backend API Docs: http://localhost:8000/docs
echo - ROS 2 Rosbridge: ws://127.0.0.1:9090
echo ============================================================
echo.
timeout /t 3 >nul
start http://localhost:3000/admin

