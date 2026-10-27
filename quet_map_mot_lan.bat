@echo off
title HC-Robot - Mapping mot lan
color 0B
echo ================================================================
echo   MODE MAPPING: QUET MOT LAN, SAU DO LUU MAP
echo ================================================================
echo Sau khi quet xong, chay:
echo   wsl -d Ubuntu-24.04 bash /mnt/d/do_an_fptu/HCROBOT/robot/ros2_configs/save_ros2_map.sh ten_map
echo ================================================================
cd /d "%~dp0"
wsl -d Ubuntu-24.04 bash robot/ros2_configs/start_wsl_rviz_web.sh mapping
pause
