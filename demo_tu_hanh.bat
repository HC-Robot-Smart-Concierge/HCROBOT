@echo off
title HC-Robot - Demo Tu Hanh Thong Minh (Layout 3x5m)
color 0A
echo ===================================================================
echo     HC-ROBOT: DEMO TU HANH TRONG LAYOUT 3x5m (KHONG NGUOI)
echo ===================================================================
echo  1. Mo phong Gazebo Sim can phong khach san 3x5m
echo  2. Robot HC-Robot (Banh xe, LiDAR 360, Camera, Man hinh)
echo  3. He thong Bridge ROS 2 dieu khien toc do va phan tich tia laser
echo  4. Tu hanh tuan tra qua cac diem (Tiep tan, Sofa, Cua, Tram sac)
echo     va tu dong ne vat can thoi gian thuc!
echo ===================================================================
echo.
wsl -d Ubuntu-24.04 bash /mnt/f/DoAn/HC-Robot/robot/scripts/launch_autonomous_demo.sh
pause
