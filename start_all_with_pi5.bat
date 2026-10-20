@echo off
title HC-Robot Master 1-Click Launcher (With Pi 5 SSH)
color 0A

echo ============================================================
echo      KHOI CHAY TOAN BO HE THONG HC-ROBOT (KEM SSH PI 5)
echo ============================================================
echo.

echo [1/4] Khoi chay Backend FastAPI Server (Port 8000)...
start "HC-Robot [Backend :8000]" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo [2/4] Khoi chay Frontend React App (Port 3000)...
start "HC-Robot [Frontend :3000]" cmd /k "cd /d %~dp0frontend && npm run dev"

echo [3/4] Khoi chay ROS 2 SLAM & Rosbridge tren WSL2 (Port 9090)...
start "HC-Robot [ROS 2 SLAM WSL2 :9090]" cmd /k "cd /d %~dp0 && wsl -d Ubuntu-24.04 bash robot/ros2_configs/start_wsl_slam.sh"

echo [4/4] Mo ket noi SSH vao Raspberry Pi 5...
start "HC-Robot [Raspberry Pi 5 SSH]" cmd /k "%~dp0open_pi5_ssh.bat"

echo.
echo ============================================================
echo [HOAN TAT] Toan bo 4 thanh phan da khoi dong!
echo - Web Admin SLAM: http://localhost:3000/admin
echo - Backend API Docs: http://localhost:8000/docs
echo - ROS 2 Rosbridge: ws://127.0.0.1:9090
echo - Raspberry Pi 5 SSH: phuc@100.99.72.51
echo ============================================================
echo.
timeout /t 3 >nul
start http://localhost:3000/admin
