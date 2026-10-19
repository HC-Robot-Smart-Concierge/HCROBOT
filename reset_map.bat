@echo off
chcp 65001 >nul
echo ========================================================
echo       HC-ROBOT: XOA BAN DO SLAM VA RESET VE GOC (0,0)
echo ========================================================
echo.
echo [1/2] Dang xoa sach ban do SLAM Toolbox tren ROS 2 (WSL2)...
wsl -d Ubuntu-24.04 bash -c "source /opt/ros/jazzy/setup.bash && python3 /mnt/f/DoAn/HC-Robot/robot/ros2_configs/reset_slam.py"

echo.
echo [2/2] Dang xoa OccupancyGrid noi tai tren Raspberry Pi 5...
curl.exe -s -X POST http://100.99.72.51:8000/api/v1/map/reset_map

echo.
echo ========================================================
echo   DA RESET XOA SACH BAN DO THANH CONG!
echo   Robot da ve toa do goc (0, 0), san sang quet moi.
echo ========================================================
pause
