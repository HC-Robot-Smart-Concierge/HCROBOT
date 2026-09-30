import uvicorn

if __name__ == "__main__":
    print("============================================================")
    print("  Starting HC-Robot Backend Server...")
    print("  Swagger UI : http://localhost:8000/docs")
    print("  ReDoc      : http://localhost:8000/redoc")
    print("============================================================")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
