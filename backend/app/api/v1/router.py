from fastapi import APIRouter
from app.api.v1.endpoints import ai, rag, map, operations, auth, logs

api_router = APIRouter()

# Swagger UI API Docs organized by Department
api_router.include_router(auth.router, prefix="/auth", tags=["1. Xác thực Hệ thống & JWT (Authentication)"])
api_router.include_router(ai.router, prefix="/ai", tags=["2. Trợ lý Giọng nói AI (Ollama Voice Engine)"])
api_router.include_router(map.router, prefix="/map", tags=["3. Định vị & Bản đồ LiDAR SLAM (Robot Navigation)"])
api_router.include_router(rag.router, prefix="/rag", tags=["4. Bộ phận Lễ tân & Reception (RAG Knowledge Base)"])
api_router.include_router(operations.router, prefix="/operations")
api_router.include_router(logs.router, tags=["5. Nhật ký Vận hành & Audit Trail (Logging & Trace)"])
