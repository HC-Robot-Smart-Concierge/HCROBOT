@echo off
title HC-Robot - RViz2 3D Viewer
color 0B
echo ===================================================================
echo     DANG KHOI CHAY RVIZ2 3D TRUC QUAN HOA ROBOT & LIDAR
echo ===================================================================
echo  - Distro: Ubuntu-24.04 (ROS 2 Jazzy)
echo  - File cau hinh: robot/ros2_configs/nav2/lidar_view.rviz
echo  - Hien thi: URDF Model 3D, Occupancy Grid Map, /scan Laser, /robot_path
echo ===================================================================
echo.
cd /d "%~dp0"
wsl -d Ubuntu-24.04 bash -c "source /opt/ros/jazzy/setup.bash && rviz2 -d robot/ros2_configs/nav2/lidar_view.rviz"
pause
