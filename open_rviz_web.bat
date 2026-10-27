@echo off
title HC-Robot - RViz2 Web Streaming (noVNC :6080)
color 0A
echo ===================================================================
echo     KHOI DONG RVIZ2 WEB - NAVIGATION TREN BAN DO TINH
echo ===================================================================
echo  - Che do: Headless Xvfb + noVNC Web Viewer
echo  - Port VNC: 5900 ^| Port Web: 6080
echo  - Web Client URL: http://localhost:6080/vnc.html?autoconnect=true^&resize=scale
echo  - Map nen KHONG bi ghi de boi LaserScan khi robot di chuyen
echo  - Map mac dinh: phong_lam_viec (co the truyen ten map lam tham so 1)
echo ===================================================================
echo.
cd /d "%~dp0"
set MAP_NAME=phong_lam_viec
if not "%~1"=="" set MAP_NAME=%~1
wsl -d Ubuntu-24.04 bash robot/ros2_configs/start_wsl_rviz_web.sh navigation %MAP_NAME%
pause
