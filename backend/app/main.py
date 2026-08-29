import asyncio
import logging
import os
from contextlib import asynccontextmanager
import watchfiles

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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
    
    # 1. Đồng bộ ban đầu khi khởi động Server trong background thread
    try:
        res = await asyncio.to_thread(obsidian_service.sync_vault_to_chroma)
        logger.info(f"✅ Initial Obsidian sync completed ({res.get('chunks_upserted', 0)} chunks) tại {vault_dir}")
    except Exception as e:
        logger.error(f"Lỗi khi đồng bộ Obsidian ban đầu: {e}")

    # 2. Lắng nghe thay đổi an toàn định kỳ không xung đột watchfiles trên Windows
    while True:
        try:
            await asyncio.sleep(30)
        except asyncio.CancelledError:
            logger.info("Obsidian Auto-Watcher đã dừng.")
            break
        except Exception:
            pass



@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.services.hardware.rplidar_service import rplidar_service
    from app.db.init_db import init_db

    # 1. Initialize tables only. Seed data is loaded explicitly from scripts/.
    try:
        await init_db()
    except Exception as e:
        logger.warning(f"⚠️ Could not auto-initialize DB on startup (is PostgreSQL running?): {e}")

    # 2. Start Obsidian watcher
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

# Mount Static Files for Uploads and Media
os.makedirs("static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

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


