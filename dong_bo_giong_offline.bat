@echo off
chcp 65001 > nul
title HC-Robot - Đồng Bộ Giọng Nói Offline Vào Backend Folder
echo =====================================================================
echo Đang đồng bộ toàn bộ giọng nói kịch bản vào thư mục backend...
echo =====================================================================
python scripts\pre_cache_voices.py
echo.
pause
