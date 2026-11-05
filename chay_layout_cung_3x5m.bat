@echo off
title HC-Robot - Khoi Tao va Chay Layout Cung 3x5m (Fog of War)
color 0B
echo ===================================================================
echo     HC-ROBOT: KHOI TAO LAYOUT CUNG 3M x 5M CHUAN XAC
echo ===================================================================
echo  - Kich thuoc phong: Chieu ngang 3.0m (X) x Chieu doc 5.0m (Y)
echo  - 4 buc tuong co dinh 100%%: Khong bi xoa de, khong bi lech tuong
echo  - Vung xam ben ngoai: Khong bi mo rong them nua
echo  - Co che: Robot di den dau mo map trang den do (Fog of War)
echo ===================================================================
echo.
cd /d "%~dp0"

if exist "backend\venv\Scripts\python.exe" (
    "backend\venv\Scripts\python.exe" tao_layout_3x5m.py phong_3x5m
) else (
    python tao_layout_3x5m.py phong_3x5m
)

echo.
echo ===================================================================
echo  Ban co the chay tiep cac lenh sau:
echo   - chay_navigation_map_tinh.bat phong_3x5m (Chay Navigation tren WSL2)
echo   - open_rviz_web.bat phong_3x5m            (Xem RViz 3D tren trinh duyet)
echo   - Mo giao dien Web Admin: http://localhost:3000
echo ===================================================================
echo.
pause
