@echo off
set PYTHONPATH=.
echo ==============================================
echo  Starting HCROBOT Backend Server on port 8000
echo ==============================================
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
