@echo off
title Dung Toan Bo He Thong HC-Robot

echo ============================================================
echo      DUNG TOAN BO CAC TIEN TRINH HC-ROBOT TREN LAPTOP
echo ============================================================
echo.

echo [+] Tat Backend Uvicorn / Python...
taskkill /F /IM uvicorn.exe >nul 2>&1
taskkill /F /IM python.exe /FI "WINDOWTITLE eq HC-Robot*" >nul 2>&1

echo [+] Tat Frontend Node.js / Vite...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq HC-Robot*" >nul 2>&1

echo [+] Tat WSL2 SLAM Stack...
wsl -t Ubuntu-24.04 >nul 2>&1

echo.
echo ============================================================
echo [XONG] Da tat sach se toan bo service Backend, Frontend va WSL2!
echo ============================================================
timeout /t 2 >nul
