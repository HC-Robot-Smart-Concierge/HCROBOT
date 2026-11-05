@echo off
title HC-Robot Master 1-Click Launcher

set MAP_NAME=phong_lam_viec
if not "%~1"=="" set MAP_NAME=%~1

echo ============================================================
echo      KHOI CHAY TOAN BO HE THONG HC-ROBOT (1-CLICK ALL)
echo ============================================================
echo.

echo [1/3] Khoi chay Backend FastAPI Server (Port 8000)...
start "HC-Robot [Backend :8000]" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo [2/3] Khoi chay Frontend React App (Port 3000)...
start "HC-Robot [Frontend :3000]" cmd /k "cd /d %~dp0frontend && npm run dev"

echo [3/3] Khoi chay ROS 2 Navigation map tinh ^(%MAP_NAME%^) va Rosbridge ^(Port 9090^)...
start "HC-Robot [Navigation Map Tinh :9090]" cmd /k "cd /d %~dp0 && wsl -d Ubuntu-24.04 bash robot/ros2_configs/start_wsl_navigation.sh %MAP_NAME%"

echo.
echo ============================================================
echo [HOAN TAT] Toan bo 3 service tren Laptop da khoi dong!
echo - Web Admin Navigation: http://localhost:3000/admin
echo - Backend API Docs: http://localhost:8000/docs
echo - ROS 2 Rosbridge: ws://127.0.0.1:9090
echo - Static map: %MAP_NAME% ^(LaserScan khong sua map goc^)
echo - Quet map moi: dung quet_map_mot_lan.bat
echo ============================================================
echo.
timeout /t 3 >nul
start http://localhost:3000/admin

