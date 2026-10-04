import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.api.v1.router import api_router
from app.services.rag.obsidian_service import obsidian_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("app.main")


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
        logger.info(f"[OK] Initial Obsidian sync completed ({res.get('chunks_upserted', 0)} chunks) tai {vault_dir}")
    except Exception as e:
        logger.error(f"Loi khi dong bo Obsidian ban dau: {e}")

    # 2. Lắng nghe và đồng bộ định kỳ mỗi 10 giây
    while True:
        try:
            await asyncio.sleep(10)
            await asyncio.to_thread(obsidian_service.sync_vault_to_chroma)
        except asyncio.CancelledError:
            logger.info("Obsidian Auto-Watcher da dung.")
            break
        except Exception as e:
            logger.error(f"Loi khi auto-sync Obsidian: {e}")



@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.services.hardware.rplidar_service import rplidar_service
    from app.core.database import init_db

    # 1. Initialize tables only. Seed data is loaded explicitly from scripts/.
    try:
        await init_db()
        logger.info("[OK] Database connection & schema verified.")
    except Exception as e:
        logger.warning(f"[WARN] Could not auto-initialize DB on startup (is PostgreSQL running?): {e}")

    # 2. Start Obsidian watcher
    watcher_task = asyncio.create_task(watch_obsidian_vault())

    # 3. Thông báo sẵn sàng kèm link truy cập Swagger / Redoc
    logger.info("=" * 60)
    logger.info("[INFO] %s DA KHOI DONG THANH CONG!", settings.PROJECT_NAME)
    logger.info("Swagger UI (Test API): http://localhost:8000/docs")
    logger.info("ReDoc (Tai lieu):     http://localhost:8000/redoc")
    logger.info("Health Check:          http://localhost:8000/health")
    logger.info("=" * 60)

    yield
    watcher_task.cancel()
    rplidar_service.stop()


tags_metadata = [
    {"name": "00. Trạng thái Máy chủ (System Health)"},
    {"name": "01. Xác thực Hệ thống & JWT (Authentication)"},
    {"name": "02. Trợ lý Giọng nói AI (Ollama Voice Engine)"},
    {"name": "03. Định vị & Bản đồ LiDAR SLAM (Robot Navigation)"},
    {"name": "04. Cơ sở Tri thức & RAG Lễ tân (Knowledge Base & RAG)"},
    {"name": "05. Bộ phận Lễ tân & Đặt phòng (Front Desk & Reception)"},
    {"name": "06. Bộ phận Buồng phòng (Housekeeping Operations)"},
    {"name": "07. Bộ phận Hành lý & Tiền sảnh (Bell Services)"},
    {"name": "08. Bộ phận Kỹ thuật & Bảo trì (Facility Maintenance)"},
    {"name": "09. Bộ phận Phục vụ phòng (Room Service)"},
    {"name": "10. Bộ phận Bếp & Ẩm thực (Kitchen Operations & Menus)"},
    {"name": "11. Quản lý Chung & Điều phối Nghiệp vụ (Operations & Directives)"},
    {"name": "12. Trung tâm Điều hành & Quản trị (Admin & Human Support)"},
    {"name": "13. Thông báo Hệ thống (Notifications)"},
    {"name": "14. Nhật ký Vận hành & Audit Trail (Logging & Trace)"},
    {"name": "15. Quản lý Phòng ban & Nhân sự (Departments & Staff)"},
    {"name": "16. Bộ phận Đặt xe & Vận chuyển (Taxi & Transportation)"},
    {"name": "17. Bộ phận Trợ lý Concierge & Live Call (Concierge & Live Support)"},
]


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Central Backend Server cho Hệ thống Robot Trợ lý Dịch vụ Khách sạn (HCRobot) dùng Ollama LLM Local & FastAPI",
    version="1.0.0",
    openapi_tags=tags_metadata,
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


@app.get("/health", tags=["00. Trạng thái Máy chủ (System Health)"], summary="Kiểm tra trạng thái kết nối máy chủ (Health)")
async def health_check():
    return {
        "status": "online",
        "system": settings.PROJECT_NAME,
        "ollama_host": settings.OLLAMA_HOST,
        "ollama_model": settings.OLLAMA_MODEL,
    }



