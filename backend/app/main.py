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

    # 2. Lắng nghe và đồng bộ định kỳ mỗi 10 giây
    while True:
        try:
            await asyncio.sleep(10)
            await asyncio.to_thread(obsidian_service.sync_vault_to_chroma)
        except asyncio.CancelledError:
            logger.info("Obsidian Auto-Watcher đã dừng.")
            break
        except Exception as e:
            logger.error(f"Lỗi khi auto-sync Obsidian: {e}")



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



tags_metadata = [
    {
        "name": "00. Trạng thái Máy chủ (System Health)",
        "description": "Kiểm tra tình trạng hoạt động và kết nối giữa Backend Server và Ollama AI Engine.",
    },
    {
        "name": "01. Xác thực Hệ thống & JWT (Authentication)",
        "description": "Đăng nhập nhân sự, giải mã JWT token, xem thông tin tài khoản và đổi mật khẩu.",
    },
    {
        "name": "02. Trợ lý Giọng nói AI (Ollama Voice Engine)",
        "description": "Hội thoại thông minh đa ngôn ngữ, nhận diện ý định (Intent Extraction) cho Concierge Robot.",
    },
    {
        "name": "03. Định vị & Bản đồ LiDAR SLAM (Robot Navigation)",
        "description": "Dữ liệu Occupancy Grid Map 2D, danh sách tọa độ Waypoints và lệnh điều hướng robot tự hành.",
    },
    {
        "name": "04. Cơ sở Tri thức & RAG Lễ tân (Knowledge Base & RAG)",
        "description": "Tra cứu vector ChromaDB, đồng bộ tự động Obsidian Vault và tài liệu nghiệp vụ khách sạn.",
    },
    {
        "name": "05. Bộ phận Lễ tân & Tiền sảnh (Reception Operations)",
        "description": "Quản lý Dashboard Lễ tân, theo dõi yêu cầu khách hàng và cuộc gọi hỗ trợ trực tuyến.",
    },
    {
        "name": "06. Bộ phận Phục vụ phòng (F&B / Room Service)",
        "description": "Dashboard Bếp & Ẩm thực, danh sách đơn gọi món, cập nhật chế biến và giao đồ bằng Robot.",
    },
    {
        "name": "07. Bộ phận Buồng phòng (Housekeeping Operations)",
        "description": "Dashboard Buồng phòng, quản lý yêu cầu dọn phòng, giặt ủi, vật tư và phân công nhân viên.",
    },
    {
        "name": "08. Bộ phận Hành lý & Tiền sảnh (Bell Services)",
        "description": "Dashboard Bellman, tiếp nhận yêu cầu chuyển hành lý, hỗ trợ đổi phòng và tìm đồ thất lạc.",
    },
    {
        "name": "09. Bộ phận Kỹ thuật & Bảo trì (Facility Maintenance)",
        "description": "Dashboard Kỹ thuật, xử lý sự cố HVAC điều hòa, điện, nước và sửa chữa hạ tầng phòng.",
    },
    {
        "name": "10. Bộ phận Nhà hàng (Restaurant - Đặt bàn & Đặt món)",
        "description": "Quản lý đặt bàn ăn trước, thực đơn gọi món và chuẩn bị nguyên liệu nhà hàng.",
    },
    {
        "name": "11. Quản lý Chung & Điều phối Nghiệp vụ (Operations & Directives)",
        "description": "Cập nhật trạng thái tác vụ tổng hợp, phát chỉ thị quản lý, theo dõi kho vật tư và danh sách nhân sự.",
    },
    {
        "name": "12. Trung tâm Điều hành & Quản trị (Admin & Human Support)",
        "description": "Cổng quản trị tối cao (Admin Portal), thống kê tổng quan, điều phối tác vụ và giám sát hội thoại robot.",
    },
    {
        "name": "13. Thông báo Hệ thống (Notifications)",
        "description": "Quản lý thông báo thời gian thực theo từng bộ phận nghiệp vụ và đánh dấu đã đọc.",
    },
    {
        "name": "14. Nhật ký Vận hành & Audit Trail (Logging & Trace)",
        "description": "Tra cứu nhật ký phân tích sự kiện, kiểm toán bảo mật hành vi và xuất báo cáo CSV/JSON.",
    },
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


@app.get("/", tags=["00. Trạng thái Máy chủ (System Health)"], summary="Kiểm tra trạng thái máy chủ")
async def root():
    return {
        "status": "online",
        "system": settings.PROJECT_NAME,
        "ollama_host": settings.OLLAMA_HOST,
        "ollama_model": settings.OLLAMA_MODEL
    }



