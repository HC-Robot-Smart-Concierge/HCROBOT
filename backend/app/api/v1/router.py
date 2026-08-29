from fastapi import APIRouter
from app.api.v1.endpoints import ai, rag, map, operations, auth

api_router = APIRouter()

# Swagger UI API Docs organized by Department
api_router.include_router(auth.router, prefix="/auth", tags=["1. Xác thực Hệ thống & JWT (Authentication)"])
api_router.include_router(rag.router, prefix="/rag", tags=["2. Bộ phận Lễ tân & Reception (RAG Knowledge Base)"])
api_router.include_router(ai.router, prefix="/ai", tags=["3. Trợ lý Giọng nói AI (Ollama Voice Engine)"])
api_router.include_router(map.router, prefix="/map", tags=["4. Định vị & Bản đồ LiDAR SLAM (Robot Navigation)"])
api_router.include_router(operations.router, prefix="/operations")
