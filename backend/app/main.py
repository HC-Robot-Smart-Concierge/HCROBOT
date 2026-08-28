import asyncio
import logging
import os
from contextlib import asynccontextmanager
import watchfiles

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.router import api_router
from app.services.rag.obsidian_service import obsidian_service

logger = logging.getLogger(__name__)


async def watch_obsidian_vault():
    """
    Background Task lắng nghe sự kiện thay đổi file .md trong thư mục Obsidian Vault
    và tự động nạp vào ChromaDB tức thì.
    """
    vault_dir = os.path.abspath(settings.OBSIDIAN_VAULT_DIR)
    os.makedirs(vault_dir, exist_ok=True)
    
    # 1. Đồng bộ ban đầu khi khởi động Server
    try:
        res = obsidian_service.sync_vault_to_chroma()
        logger.info(f"✅ Initial Obsidian sync completed ({res.get('chunks_upserted', 0)} chunks) tại {vault_dir}")
    except Exception as e:
        logger.error(f"Lỗi khi đồng bộ Obsidian ban đầu: {e}")

    # 2. Lắng nghe thay đổi thời gian thực
    logger.info(f"👀 Đã bật Auto-Watcher theo dõi Obsidian Vault tại: {vault_dir}")
    try:
        async for changes in watchfiles.awatch(vault_dir):
            logger.info(f"🔄 Phát hiện thay đổi trong Obsidian Vault ({len(changes)} files). Tự động cập nhật ChromaDB...")
            obsidian_service.sync_vault_to_chroma()
    except asyncio.CancelledError:
        logger.info("Obsidian Auto-Watcher đã dừng.")
    except Exception as e:
        logger.error(f"Lỗi trong vòng lặp Obsidian Auto-Watcher: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.services.hardware.rplidar_service import rplidar_service
    watcher_task = asyncio.create_task(watch_obsidian_vault())
    yield
    watcher_task.cancel()
    rplidar_service.stop()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Central Backend Server cho Hệ thống Robot Trợ lý Dịch vụ Khách sạn (HCRobot) dùng Ollama LLM Local",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)


# CORS Configuration - Cho phép Pi 5, Web Admin & Mobile App trong mạng Local kết nối
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Hỗ trợ mở rộng cho các IP local
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach Routers
app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["Health Check"])
async def root():
    return {
        "status": "online",
        "system": settings.PROJECT_NAME,
        "ollama_host": settings.OLLAMA_HOST,
        "ollama_model": settings.OLLAMA_MODEL
    }
