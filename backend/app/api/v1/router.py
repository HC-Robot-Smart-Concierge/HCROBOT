from fastapi import APIRouter
from app.api.v1.endpoints import ai, rag, map, operations, auth

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Staff Authentication & JWT"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Engine (Ollama)"])
api_router.include_router(rag.router, prefix="/rag", tags=["RAG Knowledge Base (ChromaDB)"])
api_router.include_router(map.router, prefix="/map", tags=["LiDAR Map & Navigation"])
api_router.include_router(operations.router, prefix="/operations", tags=["Hotel Operations & Aurora OS Dashboards"])



