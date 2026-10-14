@echo off
title HC-Robot - Tu Hanh Quet Phong va Luu Ban Do Tu Dong
color 0B
echo ===================================================================
echo     HC-ROBOT: 1 LENH TU HANH - TU QUET VAT CAN - TU LUU MAP
echo ===================================================================
echo  1. Ket noi voi he thong Pi 5 va RPLiDAR A1M8 qua Tailscale/WiFi
echo  2. Kich hoat thuat toan Frontier Exploration (Tim duong bien)
echo  3. Xe tu dong lan banh kham pha moi ngoc ngach, tu ne vat can
echo  4. Khi hoan tat, tu dong luu map (.json, .yaml, .pgm)
echo ===================================================================
echo.

set PI5_IP=100.99.72.51
if not "%~1"=="" set PI5_IP=%~1

set MAP_NAME=ban_do_khach_san_tu_dong
if not "%~2"=="" set MAP_NAME=%~2

python "%~dp0robot\scripts\auto_explore_and_map.py" --ip %PI5_IP% --map-name %MAP_NAME%

echo.
pause
