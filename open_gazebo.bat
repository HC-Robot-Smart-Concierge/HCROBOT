@echo off
title Khoi Chay Gazebo - HC-Robot Simulation
echo ========================================================
echo   DANG MO GAZEBO SIM (HARMONIC / ROS 2 JAZZY) TREN WSL 2...
echo   Distro: Ubuntu-24.04
echo   Can phong mo phong: hotel_room.world
echo ========================================================
cd /d "%~dp0"
wsl -d Ubuntu-24.04 bash robot/scripts/launch_gazebo.sh
pause
