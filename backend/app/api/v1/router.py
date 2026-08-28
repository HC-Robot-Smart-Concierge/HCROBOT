from fastapi import APIRouter
from app.api.v1.endpoints import ai, rag, map

api_router = APIRouter()
api_router.include_router(ai.router, prefix="/ai", tags=["AI Engine (Ollama)"])
api_router.include_router(rag.router, prefix="/rag", tags=["RAG Knowledge Base (ChromaDB)"])
api_router.include_router(map.router, prefix="/map", tags=["LiDAR Map & Navigation"])

