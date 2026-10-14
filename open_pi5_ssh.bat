@echo off
title Ket Noi SSH Raspberry Pi 5 - HC-Robot
color 0B
echo ========================================================
echo   DANG KET NOI SSH VAO RASPBERRY PI 5 (TAILSCALE VPN)...
echo   Host: 100.99.72.51 (User: phuc)
echo ========================================================
echo.
echo Neu dung mang Wi-Fi noi bo, co the sua IP thanh IP cuc bo.
echo Nhan Ctrl+C neu muon huy ket noi.
echo.
ssh phuc@100.99.72.51
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [CANH BAO] Khong ket noi duoc qua Tailscale IP 100.99.72.51!
    echo Dang thu ket noi qua Hostname LAN: raspberrypi.local...
    ssh phuc@raspberrypi.local
)
pause
