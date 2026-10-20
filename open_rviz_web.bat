@echo off
title HC-Robot - RViz2 Web Streaming (noVNC :6080)
color 0A
echo ===================================================================
echo     KHOI DONG RVIZ2 WEB STREAMING SERVER (SLAM 3D WEB INTEGRATION)
echo ===================================================================
echo  - Che do: Headless Xvfb + noVNC Web Viewer
echo  - Port VNC: 5900 ^| Port Web: 6080
echo  - Web Client URL: http://localhost:6080/vnc.html?autoconnect=true^&resize=scale
echo  - Tich hop truc tiep vao Web Admin: Tab "RViz2 3D View"
echo ===================================================================
echo.
cd /d "%~dp0"
wsl -d Ubuntu-24.04 bash robot/ros2_configs/start_wsl_rviz_web.sh
pause
