import asyncio
import logging
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, Base, engine
from app.models import Notification

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

INITIAL_NOTIFICATIONS = [
    # Bell Services
    {
        "id": "NOTIF-BS01",
        "department": "Bell Services",
        "title": "Yêu cầu Bellman mới: Luggage Pickup",
        "description": "Mr. Aris Thorne tại Room 402 yêu cầu vận chuyển 4 vali lớn.",
        "request_id": "BS-501",
        "request_type": "bell_service",
        "type": "Request",
        "is_read": False,
    },
    {
        "id": "NOTIF-BS02",
        "department": "Bell Services",
        "title": "Yêu cầu Bellman mới: Room Move Assistance",
        "description": "Mrs. Elena Rostova chuyển phòng từ Room 215 sang 510.",
        "request_id": "BS-502",
        "request_type": "bell_service",
        "type": "Request",
        "is_read": False,
    },
    {
        "id": "NOTIF-BS03",
        "department": "Bell Services",
        "title": "Đồ thất lạc: Lost & Found Retrieval",
        "description": "Staff J. Doe phát hiện cặp da tại Lobby Lounge gần đại sảnh.",
        "request_id": "BS-503",
        "request_type": "bell_service",
        "type": "Request",
        "is_read": True,
    },
    # F&B / Room Service
    {
        "id": "NOTIF-FB01",
        "department": "F&B",
        "title": "Đơn Room Service mới #1042",
        "description": "ROOM 412: 2x Club Sandwich & Truffle Fries, 2x Artisan Cola.",
        "request_id": "1042",
        "request_type": "room_service",
        "type": "Request",
        "is_read": False,
    },
    {
        "id": "NOTIF-FB02",
        "department": "F&B",
        "title": "Cảnh báo mức tồn kho thấp: Artisan Cola",
        "description": "Mặt hàng Artisan Cola còn 6 lon trong kho tầng 2, cần nhập bổ sung.",
        "request_id": "STK-01",
        "request_type": "stock",
        "type": "Warning",
        "is_read": False,
    },
    {
        "id": "NOTIF-FB03",
        "department": "F&B",
        "title": "Robot Unit 02 giao hàng thành công",
        "description": "Đơn phòng #1041 tại ROOM 208 đã được khách xác nhận nhận món.",
        "request_id": "1041",
        "request_type": "room_service",
        "type": "Robot",
        "is_read": True,
    },
    # Housekeeping
    {
        "id": "NOTIF-HK01",
        "department": "Housekeeping",
        "title": "Sự cố tràn nước khẩn cấp tại Phòng 502",
        "description": "Phát hiện sự cố tràn rượu vang trên thảm qua Camera AI của HCRobot.",
        "request_id": "HK-1042",
        "request_type": "housekeeping",
        "type": "Request",
        "is_read": False,
    },
    {
        "id": "NOTIF-HK02",
        "department": "Housekeeping",
        "title": "Yêu cầu buồng phòng mới: Extra Towels",
        "description": "Phòng 314: Mrs. Alena Croft yêu cầu 4 khăn tắm bổ sung.",
        "request_id": "HK-1043",
        "request_type": "housekeeping",
        "type": "Request",
        "is_read": False,
    },
    # Maintenance
    {
        "id": "NOTIF-MN01",
        "department": "Maintenance",
        "title": "Yêu cầu bảo trì mới: Plumbing Leak",
        "description": "Room 412: Rò rỉ nước tại bồn rửa phòng tắm cần kỹ thuật viên hỗ trợ.",
        "request_id": "MN-401",
        "request_type": "maintenance",
        "type": "Request",
        "is_read": False,
    },
    {
        "id": "NOTIF-MN02",
        "department": "Maintenance",
        "title": "Sự cố điều hòa: Air Conditioner Issue",
        "description": "Room 305: Quạt gió kêu to bất thường khi bật mức cao.",
        "request_id": "MN-402",
        "request_type": "maintenance",
        "type": "Request",
        "is_read": False,
    },
    # Reception
    {
        "id": "NOTIF-RC01",
        "department": "Reception",
        "title": "Yêu cầu hỗ trợ lễ tân mới #REQ-8942A",
        "description": "Room 402: Guest Michael Ross gọi từ trợ lý ảo In-Room HCRobot.",
        "request_id": "REQ-8942A",
        "request_type": "reception",
        "type": "Request",
        "is_read": False,
    },
    # System / Directives (All)
    {
        "id": "NOTIF-SYS01",
        "department": "All",
        "title": "Chỉ thị điều hành mới từ Ban Quản Trị",
        "description": "Chỉ thị #M-101: Tăng cường nhân sự hỗ trợ khu vực sảnh Lobby trong khung giờ 10:00 - 12:00.",
        "request_id": "M-101",
        "request_type": "directive",
        "type": "Directive",
        "is_read": True,
    },
    {
        "id": "NOTIF-SYS02",
        "department": "All",
        "title": "HCRobot Unit 03 đã kết nối trạm sạc Dock 2",
        "description": "Dung lượng pin đạt 84%, tự động kích hoạt chế độ sạc nhanh và sẵn sàng nhận lệnh.",
        "request_id": "U3",
        "request_type": "robot",
        "type": "Robot",
        "is_read": True,
    },
]


async def seed_notifications():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        for notif_data in INITIAL_NOTIFICATIONS:
            existing = await session.execute(
                select(Notification).where(Notification.id == notif_data["id"])
            )
            if not existing.scalar_one_or_none():
                notif = Notification(**notif_data)
                session.add(notif)

        await session.commit()
        logger.info(f"✅ Đã khởi tạo {len(INITIAL_NOTIFICATIONS)} thông báo mẫu phân theo từng phòng ban thành công!")


if __name__ == "__main__":
    asyncio.run(seed_notifications())
