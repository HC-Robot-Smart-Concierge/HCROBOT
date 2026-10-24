import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.api.v1.router import api_router
from app.middlewares import register_middlewares
from app.schemas.response import GLOBAL_RESPONSES, setup_openapi_response_schemas

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.services.hardware.rplidar_service import rplidar_service
    from app.core.database import init_db

    # 1. Initialize tables only. Seed data is loaded explicitly from scripts/.
    try:
        await init_db()
        logger.info("[OK] Database connection & schema verified.")
        from app.core.database import AsyncSessionLocal
        from app.services.ai.scenario_service import scenario_service
        from app.services.ai.tts_service import tts_service
        async with AsyncSessionLocal() as db_session:
            await scenario_service.initialize_cache(db_session)
        asyncio.create_task(tts_service.warm_up_common_phrases())
    except Exception as e:
        logger.warning(f"[WARN] Could not auto-initialize DB on startup (is PostgreSQL running?): {e}")

    # 2. Thông báo sẵn sàng kèm link truy cập Swagger / Redoc
    logger.info("=" * 60)
    logger.info("[INFO] %s DA KHOI DONG THANH CONG!", settings.PROJECT_NAME)
    logger.info("Swagger UI (Test API): http://localhost:8000/docs")
    logger.info("ReDoc (Tai lieu):     http://localhost:8000/redoc")
    logger.info("Health Check:          http://localhost:8000/health")
    logger.info("=" * 60)

    yield
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
    {"name": "11. Bộ phận Đặt xe & Vận chuyển (Taxi & Transportation)"},
    {"name": "12. Bộ phận Trợ lý Concierge & Live Call (Concierge & Live Support)"},
    {"name": "13. Quản lý Phòng ban & Tài khoản (Departments & Accounts)"},
    {"name": "14. Quản lý Chung & Điều phối Nghiệp vụ (Operations & Directives)"},
    {"name": "15. Trung tâm Điều hành & Quản trị (Admin & Human Support)"},
    {"name": "16. Thông báo Hệ thống (Notifications)"},
    {"name": "17. Nhật ký Vận hành & Audit Trail (Logging & Trace)"},
]


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Central Backend Server cho Hệ thống Robot Trợ lý Dịch vụ Khách sạn (HCRobot) dùng Ollama LLM Local & FastAPI",
    version="1.0.0",
    openapi_tags=tags_metadata,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
    responses=GLOBAL_RESPONSES,
)


# Đăng ký hệ thống Middleware (Security Headers, Latency Tracking, Error Handling, Tracing, CORS)
register_middlewares(app)

# Mount Static Files for Uploads and Media
os.makedirs("static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Attach Routers
app.include_router(api_router, prefix="/api/v1")

# Chuẩn hóa toàn bộ OpenAPI Response Schemas (400, 401, 403, 404, 500)
setup_openapi_response_schemas(app)


@app.get("/health", tags=["00. Trạng thái Máy chủ (System Health)"], summary="Kiểm tra trạng thái kết nối máy chủ (Health)")
async def health_check():
    return {
        "status": "online",
        "system": settings.PROJECT_NAME,
        "llm_provider": settings.LLM_PROVIDER,
        "active_llm_model": settings.active_llm_model,
        "gemini_active": settings.is_gemini_active,
        "ollama_host": settings.OLLAMA_HOST,
        "ollama_model": settings.OLLAMA_MODEL,
    }



