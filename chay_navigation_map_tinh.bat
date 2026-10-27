@echo off
title HC-Robot - Navigation map tinh
color 0A
set MAP_NAME=phong_lam_viec
if not "%~1"=="" set MAP_NAME=%~1
echo ================================================================
echo   MODE NAVIGATION: MAP=%MAP_NAME%
echo   LaserScan chi dung de dinh vi va tranh vat can, KHONG sua map.
echo ================================================================
cd /d "%~dp0"
wsl -d Ubuntu-24.04 bash robot/ros2_configs/start_wsl_rviz_web.sh navigation %MAP_NAME%
pause
