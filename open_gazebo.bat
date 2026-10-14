@echo off
title Khoi Chay Gazebo - HC-Robot Simulation
echo ========================================================
echo   DANG MO GAZEBO SIM (HARMONIC / ROS 2 JAZZY) TREN WSL 2...
echo   Distro: Ubuntu-24.04
echo   Can phong mo phong: hotel_room.world
echo ========================================================
wsl -d Ubuntu-24.04 bash /mnt/d/do_an_fptu/HCROBOT/robot/scripts/launch_gazebo.sh
pause
