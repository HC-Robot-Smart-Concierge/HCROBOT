@echo off
title Khoi Chay Gazebo 11 - HC-Robot Simulation
echo ========================================================
echo   DANG MO GAZEBO 11 TREN WSL 2 (UBUNTU 22.04 LTS)...
echo   Tu dong nap can phong: hotel_room.world
echo   Meo: Dung tab [Insert] ben trai de dat them ban ghe vao phong!
echo ========================================================
wsl -d Ubuntu-22.04 -u root bash -i -c "gazebo /mnt/d/Learning/Ki_9/SEP490/HCROBOT/robot/worlds/hotel_room.world"
pause
