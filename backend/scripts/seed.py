"""
AURORA OS / HCROBOT - UNIFIED DATABASE SEEDING ENGINE
=====================================================
File tổng hợp duy nhất thay thế toàn bộ các file seed rời rạc trước đây.
Cung cấp dữ liệu mẫu chuẩn khách sạn 5 sao cho toàn bộ hệ thống:
1. Tài khoản nhân viên & Robot Kiosk (Staff Accounts)
2. Nghiệp vụ phòng: Room Service, Buồng phòng, Bellman, Bảo trì, Chỉ thị điều hành, Tồn kho
3. Phiếu hỗ trợ Lễ tân (Reception Tickets)
4. Phiếu can thiệp song ngữ của nhân viên (Human Support Sessions)
5. Chuông thông báo phòng ban (Department Notifications)
6. Tri thức RAG Vector Store (ChromaDB)
7. Nhật ký vận hành & kiểm toán (Operational Logs & Audit Trails)

CÁCH DÙNG:
  python scripts/seed.py               # Nạp toàn bộ dữ liệu mẫu (an toàn, không xóa bảng)
  python scripts/seed.py --reset       # Reset sạch DB và nạp lại toàn bộ từ đầu
  python scripts/seed.py --with-logs   # Nạp kèm lượng lớn log giả lập chi tiết
"""

import asyncio
import argparse
import datetime
import logging
import os
import sys
import uuid

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Đảm bảo đường dẫn backend nằm trong sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select, func, delete
from app.core.database import engine, AsyncSessionLocal, Base, init_db
from app.core.security import hash_password
from app.models import (
    Staff,
    RoomServiceOrder,
    HousekeepingRequest,
    BellRequest,
    MaintenanceRequest,
    ManagementDirective,
    InventoryStock,
    ReceptionRequest,
    HumanSupportSession,
    Notification,
    LogEvent,
    AuditLog,
    LogLevelEnum,
    LogCategoryEnum,
    ActorTypeEnum,
)
from app.services.rag.chroma import get_concierge_collection

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed")

DEFAULT_PASSWORD = "secret_password"


# ==============================================================================
# 1. STAFF & ROBOT KIOSK ACCOUNTS
# ==============================================================================
STAFF_ACCOUNTS = [
    {
        "username": "admin",
        "code": "ADM",
        "full_name": "System Administrator",
        "role": "Administrator",
        "department": "Executive",
        "default_dashboard": "admin_map",
        "location": "Executive Suite",
        "status": "available",
        "shift": "All Shifts",
    },
    {
        "username": "reception_lead",
        "code": "REC",
        "full_name": "Nguyen Thu Trang",
        "role": "Front Desk Supervisor",
        "department": "Reception",
        "default_dashboard": "reception",
        "location": "Front Desk",
        "status": "available",
        "shift": "Morning Shift (06:00 - 14:00)",
    },
    {
        "username": "fnb_lead",
        "code": "FNB",
        "full_name": "Tran Van Hai",
        "role": "F&B Manager",
        "department": "F&B",
        "default_dashboard": "room_service",
        "location": "Main Kitchen",
        "status": "available",
        "shift": "Morning Shift (06:00 - 14:00)",
    },
    {
        "username": "hk_lead",
        "code": "HKL",
        "full_name": "Pham Thi Mai",
        "role": "Housekeeping Lead",
        "department": "Housekeeping",
        "default_dashboard": "housekeeping",
        "location": "Floor 3 Storage",
        "status": "available",
        "shift": "Morning Shift (06:00 - 14:00)",
    },
    {
        "username": "bell_captain",
        "code": "BEL",
        "full_name": "Le Hoang Nam",
        "role": "Bell Captain",
        "department": "Bell Services",
        "default_dashboard": "bell_services",
        "location": "Main Lobby",
        "status": "available",
        "shift": "Morning Shift (06:00 - 14:00)",
    },
    {
        "username": "maint_lead",
        "code": "MNT",
        "full_name": "Doan Minh Quan",
        "role": "Chief Engineer",
        "department": "Maintenance",
        "default_dashboard": "maintenance",
        "location": "B1 Tech Room",
        "status": "available",
        "shift": "Morning Shift (06:00 - 14:00)",
    },
    # Robot Kiosk Accounts
    {
        "username": "robot_01",
        "code": "R01",
        "full_name": "Robot Kiosk Unit 01",
        "role": "Robot Kiosk",
        "department": "Robot Node",
        "default_dashboard": "robot_display",
        "location": "Main Lobby Kiosk",
        "status": "available",
    },
    {
        "username": "robot_02",
        "code": "R02",
        "full_name": "Robot Kiosk Unit 02",
        "role": "Robot Kiosk",
        "department": "Robot Node",
        "default_dashboard": "robot_display",
        "location": "Floor 4 Kiosk",
        "status": "available",
    },
]


async def seed_accounts(session):
    logger.info("👤 [1/7] Seeding Staff & Robot Kiosk accounts...")
    pwd_hash = hash_password(DEFAULT_PASSWORD)
    created = 0
    for acc in STAFF_ACCOUNTS:
        res = await session.execute(
            select(Staff).where((Staff.username == acc["username"]) | (Staff.code == acc["code"]))
        )
        existing = res.scalar_one_or_none()
        if not existing:
            staff = Staff(
                username=acc["username"],
                password_hash=pwd_hash,
                code=acc["code"],
                full_name=acc["full_name"],
                role=acc["role"],
                department=acc["department"],
                default_dashboard=acc.get("default_dashboard", "room_service"),
                location=acc.get("location", "Main Hotel"),
                status=acc.get("status", "available"),
                shift=acc.get("shift", "Morning Shift"),
                current_tasks_count=0,
                is_active=True,
            )
            session.add(staff)
            created += 1
    await session.commit()
    logger.info(f"   ✅ Added {created} new staff/robot accounts.")


# ==============================================================================
# 2. HOTEL OPERATIONS (ROOM SERVICE, HOUSEKEEPING, BELL, MAINTENANCE, STOCKS)
# ==============================================================================
async def seed_operations(session):
    logger.info("🛎️ [2/7] Seeding Hotel Operations (F&B, Buồng phòng, Bellman, Kỹ thuật, Kho)...")
    res = await session.execute(select(func.count(RoomServiceOrder.id)))
    if res.scalar_one() > 0:
        logger.info("   ℹ️ Operations data already exists. Skipping.")
        return

    # Room Service Orders
    orders = [
        RoomServiceOrder(
            order_number="1042",
            room_number="ROOM 412",
            status="Pending",
            items=[{"name": "Club Sandwich & Truffle Fries", "qty": 2}, {"name": "Artisan Cola (Ice)", "qty": 2}],
            note="Note: No mayo on one sandwich, please.",
            progress=0,
            assigned_robot_id="robot_01",
            assigned_staff_name="HCRobot Unit 01",
        ),
        RoomServiceOrder(
            order_number="1041",
            room_number="ROOM 208",
            status="Cooking",
            items=[{"name": "Grand Breakfast Set for Two", "qty": 1}],
            est_completion="4 mins",
            progress=60,
            assigned_robot_id="robot_01",
            assigned_staff_name="HCRobot Unit 01",
        ),
        RoomServiceOrder(
            order_number="1040",
            room_number="ROOM 512",
            status="Pending",
            items=[{"name": "Extra Tableware & Wine Glasses", "qty": "Set of 4"}],
            note="Service Request - No food prep required",
            is_service_request=True,
            progress=0,
        ),
    ]
    session.add_all(orders)

    # Housekeeping Requests
    hk = [
        HousekeepingRequest(
            ticket_code="HK-1042",
            source="From HCRobot",
            time_label="10:15 AM",
            title="Spill cleanup required",
            room_number="502",
            description="Wine spill on carpet. Guest requested immediate attention.",
            guest_name="Mr. John Smith",
            status="Unassigned",
        ),
        HousekeepingRequest(
            ticket_code="HK-1043",
            source="From HCRobot",
            time_label="10:22 AM",
            title="Extra Towels",
            room_number="314",
            description="Guest requested 4 extra bath towels.",
            guest_name="Mrs. Alena Croft",
            status="Unassigned",
        ),
    ]
    session.add_all(hk)

    # Bell Requests
    bell = [
        BellRequest(
            ticket_code="BS-501",
            title="Luggage Pickup",
            location="Room 402",
            guest_name="Mr. Aris Thorne",
            description="Guest is departing early for an international flight. 4 suitcases.",
            status="Pending",
            request_type="luggage",
        ),
        BellRequest(
            ticket_code="BS-502",
            title="Room Move Assistance",
            location="Room 215 to 510",
            guest_name="Mrs. Elena Rostova",
            description="Guest requested upgrade. Move luggage to Room 510.",
            status="Pending",
            request_type="room_move",
        ),
        BellRequest(
            ticket_code="BS-503",
            title="Lost & Found Retrieval",
            location="Lobby Lounge",
            reporter="Staff (J. Doe)",
            description="A leather briefcase was left near the grand piano.",
            status="In Progress",
            request_type="lost_found",
        ),
    ]
    session.add_all(bell)

    # Maintenance Requests
    maint = [
        MaintenanceRequest(
            ticket_code="MN-401",
            title="Plumbing Leak",
            category="plumbing",
            reported_time_label="10 mins ago",
            location="Room 412",
            description="Guest reported water pooling near bathroom sink.",
            source="RECEIVED FROM HCROBOT",
            status="Pending",
        ),
        MaintenanceRequest(
            ticket_code="MN-402",
            title="Air Conditioner Issue",
            category="hvac",
            reported_time_label="45 mins ago",
            location="Room 305",
            description="Unit making rattling noise on high.",
            source="RECEIVED FROM HCROBOT",
            status="In Progress",
            assigned_to="James D.",
        ),
    ]
    session.add_all(maint)

    # Management Directives
    dirs = [
        ManagementDirective(
            code="M-101",
            title="Spill in Lobby",
            department="Housekeeping",
            priority="URGENT",
            location="Main Entrance",
            reported_time_label="Reported 2m ago",
            status="Unassigned",
            type="spill",
        ),
        ManagementDirective(
            code="M-102",
            title="Room Make-up",
            department="Housekeeping",
            priority="PENDING",
            location="Suite 402",
            reported_time_label="Guest Requested",
            status="Unassigned",
            type="room_service",
        ),
    ]
    session.add_all(dirs)

    # Inventory Stocks
    stocks = [
        InventoryStock(name="Artisan Cola", category="beverage", count_label="6 left", quantity=6, level="danger"),
        InventoryStock(name="Sparkling Water (L)", category="beverage", count_label="2 left", quantity=2, level="danger"),
        InventoryStock(name="Truffle Oil", category="condiment", count_label="1 btl", quantity=1, level="warning"),
        InventoryStock(name="Premium Bath Towel", category="toiletries", count_label="24 left", quantity=24, level="normal"),
    ]
    session.add_all(stocks)

    await session.commit()
    logger.info("   ✅ Operations seed completed.")


# ==============================================================================
# 3. RECEPTION TICKETS
# ==============================================================================
async def seed_reception(session):
    logger.info("🏢 [3/7] Seeding Reception Front Desk Requests...")
    ticket_code = "REQ-8942A"
    res = await session.execute(select(ReceptionRequest).where(ReceptionRequest.ticket_code == ticket_code))
    if res.scalar_one_or_none():
        logger.info("   ℹ️ Reception sample already exists. Skipping.")
        return

    req = ReceptionRequest(
        ticket_code=ticket_code,
        title="Yêu cầu Đổi Phòng & Đặt Xe Sân Bay",
        created_label="10 mins ago",
        location="Front Desk / Room 402",
        location_details={"source": "Robot Concierge Terminal 01", "floor": "Floor 4"},
        guest_name="Mr. Alexander Wright",
        guest_tier="VIP Diamond",
        guest_stay_details="Room 402 • 3 nights • Checkout 14:00 Today",
        status="Pending Action",
        description="Khách yêu cầu hỗ trợ đổi sang phòng có ban công view biển và đặt xe limousine tiễn sân bay lúc 15:30.",
        attached_media=[{"name": "passport_scan.jpg", "type": "image", "size": "1.2MB"}],
        transcript=[
            {"speaker": "guest", "text": "Can I arrange an airport transfer for 3:30 PM?", "time": "10:12 AM"},
            {"speaker": "robot", "text": "Dạ em đã kết nối ngay tới Lễ tân để điều xe limousine hỗ trợ quý khách ạ!", "time": "10:12 AM"},
        ],
        assistance_status="Connected",
        assigned_to="Nguyen Thu Trang",
        assigned_role="Front Desk Supervisor",
        notes=[{"author": "Robot Concierge", "text": "Khách cần xe khoang hành lý rộng.", "time": "10:13 AM"}],
        activity_log=[{"event": "Ticket Created", "timestamp": "10:12 AM", "by": "Robot Terminal"}],
        escalated=False,
    )
    session.add(req)
    await session.commit()
    logger.info("   ✅ Reception ticket seed completed.")


# ==============================================================================
# 4. HUMAN SUPPORT SESSIONS (DUAL-TRACK REALTIME)
# ==============================================================================
async def seed_support(session):
    logger.info("🎧 [4/7] Seeding Human Support Sessions...")
    res = await session.execute(select(func.count(HumanSupportSession.id)))
    if res.scalar_one() > 0:
        logger.info("   ℹ️ Support sessions already exist. Skipping.")
        return

    sessions = [
        HumanSupportSession(
            session_code="SES-302",
            room_number="Room 302",
            guest_name="Alexander Chen",
            category="Luggage Assist",
            origin_robot_code="RC-001 (Main Lobby)",
            sentiment="Impatient",
            wait_time_label="08m 10s",
            status="Active",
            linked_request_id="REQ-1042",
            messages=[
                {
                    "id": "msg-302-1",
                    "speaker": "guest",
                    "speaker_name": "Alexander Chen",
                    "raw_transcript": "Can you help me with my luggage? I'm at the elevator bank.",
                    "translations": {
                        "vi": "Bạn có thể giúp tôi chuyển hành lý không? Tôi đang ở cụm thang máy.",
                        "en": "Can you help me with my luggage? I'm at the elevator bank."
                    },
                    "sentiment": "Impatient",
                    "timestamp": "10:42 AM"
                },
                {
                    "id": "msg-302-2",
                    "speaker": "robot",
                    "speaker_name": "RC-001",
                    "raw_transcript": "I am alerting our bellman to assist you immediately!",
                    "translations": {
                        "vi": "Em đang báo cho nhân viên bellman đến hỗ trợ quý khách ngay ạ!",
                        "en": "I am alerting our bellman to assist you immediately!"
                    },
                    "sentiment": "Helpful",
                    "timestamp": "10:42 AM"
                },
            ]
        ),
        HumanSupportSession(
            session_code="SES-402",
            room_number="Room 402",
            guest_name="Elena Rostova",
            category="Room Transfer",
            origin_robot_code="RC-002 (Floor 4)",
            sentiment="Neutral",
            wait_time_label="02m 30s",
            status="Active",
            messages=[
                {
                    "id": "msg-402-1",
                    "speaker": "guest",
                    "speaker_name": "Elena Rostova",
                    "raw_transcript": "I would like to check if my upgraded suite is ready.",
                    "translations": {
                        "vi": "Tôi muốn kiểm tra xem phòng suite mới đã sẵn sàng chưa.",
                        "en": "I would like to check if my upgraded suite is ready."
                    },
                    "sentiment": "Neutral",
                    "timestamp": "10:50 AM"
                }
            ]
        ),
    ]
    session.add_all(sessions)
    await session.commit()
    logger.info("   ✅ Human Support sessions seed completed.")


# ==============================================================================
# 5. DEPARTMENT NOTIFICATIONS
# ==============================================================================
async def seed_notifications(session):
    logger.info("🔔 [5/7] Seeding Department Notifications...")
    res = await session.execute(select(func.count(Notification.id)))
    if res.scalar_one() > 0:
        logger.info("   ℹ️ Notifications already exist. Skipping.")
        return

    notifs = [
        Notification(
            department="Bell Services",
            title="Yêu cầu Bellman mới: Luggage Pickup",
            description="Mr. Aris Thorne tại Room 402 yêu cầu vận chuyển hành lý.",
            request_id="BS-501",
            request_type="bell_service",
            type="Request",
            is_read=False,
        ),
        Notification(
            department="F&B",
            title="Đơn Room Service mới #1042",
            description="ROOM 412: 2x Club Sandwich & Truffle Fries, 2x Artisan Cola.",
            request_id="1042",
            request_type="room_service",
            type="Request",
            is_read=False,
        ),
        Notification(
            department="Maintenance",
            title="Sự cố Kỹ thuật #MN-401",
            description="Phòng 412 rò rỉ nước bồn rửa mặt.",
            request_id="MN-401",
            request_type="maintenance",
            type="Warning",
            is_read=False,
        ),
        Notification(
            department="Housekeeping",
            title="Yêu cầu dọn vết tràn sảnh chính #M-101",
            description="Khu vực sảnh chính có vết tràn cần xử lý gấp.",
            request_id="M-101",
            request_type="directive",
            type="Directive",
            is_read=False,
        ),
    ]
    session.add_all(notifs)
    await session.commit()
    logger.info("   ✅ Notifications seed completed.")


# ==============================================================================
# 6. CHROMADB VECTOR KNOWLEDGE BASE
# ==============================================================================
def seed_chroma():
    logger.info("🧠 [6/7] Seeding ChromaDB Vector Store with Hotel Knowledge...")
    try:
        collection = get_concierge_collection("concierge_kb")
        docs = [
            {
                "id": "kb_wifi_001",
                "document": "Mạng wifi khách sạn Aurora Grand là 'Aurora_Guest_5G'. Mật khẩu truy cập là 'aurora2026'. Tốc độ cao miễn phí tại mọi phòng và khu vực công cộng.",
                "metadata": {"title": "Wifi & Internet", "category": "General", "facility": "wifi", "floor": "All"}
            },
            {
                "id": "kb_pool_001",
                "document": "Hồ bơi vô cực nằm ở tầng 4 (Khu Wellness) của khách sạn Aurora Grand. Thời gian mở cửa từ 06:00 đến 22:00 hàng ngày. Khăn tắm và nước khoáng phục vụ miễn phí.",
                "metadata": {"title": "Hồ Bơi Vô Cực", "category": "Facilities", "facility": "swimming_pool", "floor": "Tầng 4"}
            },
            {
                "id": "kb_spa_001",
                "document": "Aurora Serenity Spa & Massage nằm tại tầng 4, mở cửa từ 09:00 đến 22:00. Dịch vụ cung cấp xông hơi đá muối, massage đá nóng, chăm sóc da mặt cao cấp.",
                "metadata": {"title": "Aurora Serenity Spa", "category": "Wellness", "facility": "spa", "floor": "Tầng 4"}
            },
            {
                "id": "kb_gym_001",
                "document": "Phòng tập thể hình Aurora Fitness nằm ở tầng 4, mở cửa 24/7 cho khách lưu trú. Trang bị đầy đủ máy chạy bộ Technogym, tạ đơn, máy tập đa năng.",
                "metadata": {"title": "Phòng Gym 24/7", "category": "Facilities", "facility": "gym", "floor": "Tầng 4"}
            },
            {
                "id": "kb_checkout_001",
                "document": "Giờ nhận phòng (Check-in) là 14:00 và giờ trả phòng (Check-out) tiêu chuẩn là 12:00 trưa. Khách cần trả phòng muộn vui lòng báo trước với Lễ tân.",
                "metadata": {"title": "Quy Định Nhận/Trả Phòng", "category": "Policy", "facility": "reception", "floor": "Tầng 1"}
            },
        ]
        collection.upsert(
            ids=[d["id"] for d in docs],
            documents=[d["document"] for d in docs],
            metadatas=[d["metadata"] for d in docs],
        )
        logger.info(f"   ✅ Seeded {len(docs)} documents into ChromaDB collection 'concierge_kb'.")
    except Exception as e:
        logger.warning(f"   ⚠️ Could not seed ChromaDB: {e}")


# ==============================================================================
# 7. LOGS & AUDIT TRAILS (OPTIONAL VIA --with-logs)
# ==============================================================================
async def seed_logs(session):
    logger.info("📊 [7/7] Seeding Operational Logs & Audit Trails...")
    now = datetime.datetime.now(datetime.timezone.utc)
    logs = [
        LogEvent(
            timestamp=now - datetime.timedelta(minutes=30),
            level=LogLevelEnum.INFO,
            category=LogCategoryEnum.AI_VOICE,
            event_type="VOICE_INTENT_DETECTED",
            module="app.services.ai.ollama",
            message="User requested extra towels in room 314",
            actor_type=ActorTypeEnum.GUEST,
            actor_id="GUEST-314",
            metadata_payload={"room": "314", "action": "housekeeping"},
        ),
        LogEvent(
            timestamp=now - datetime.timedelta(minutes=15),
            level=LogLevelEnum.INFO,
            category=LogCategoryEnum.DISPATCH,
            event_type="ORDER_ASSIGNED",
            module="app.api.v1.operations",
            message="Assigned Order #1042 to robot unit robot_01",
            actor_type=ActorTypeEnum.SYSTEM,
            actor_id="SYSTEM",
            metadata_payload={"order_id": "1042", "robot": "robot_01"},
        ),
    ]
    session.add_all(logs)

    audits = [
        AuditLog(
            timestamp=now - datetime.timedelta(minutes=45),
            actor_type=ActorTypeEnum.STAFF,
            actor_id="STF-ADMIN",
            actor_name="System Administrator",
            action="LOGIN",
            resource_type="STAFF",
            resource_id="admin",
        )
    ]
    session.add_all(audits)
    await session.commit()
    logger.info("   ✅ Operational logs seed completed.")


# ==============================================================================
# MASTER RUNNER
# ==============================================================================
async def main():
    parser = argparse.ArgumentParser(description="Aurora OS - Master Database Seeder")
    parser.add_argument("--reset", action="store_true", help="Xóa sạch toàn bộ bảng và tạo lại trước khi seed")
    parser.add_argument("--with-logs", action="store_true", help="Nạp thêm log vận hành chi tiết")
    args = parser.parse_args()

    print("\n" + "=" * 70)
    print("      AURORA OS / HCROBOT - UNIFIED DATABASE SEED ENGINE")
    print("=" * 70)

    if args.reset:
        logger.warning("🚨 --reset flag detected: Dropping all tables on Supabase...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ All tables freshly recreated!")
    else:
        # Đảm bảo bảng tồn tại
        await init_db()

    async with AsyncSessionLocal() as session:
        await seed_accounts(session)
        await seed_operations(session)
        await seed_reception(session)
        await seed_support(session)
        await seed_notifications(session)
        if args.with_logs or args.reset:
            await seed_logs(session)

    # Nạp Vector Store
    seed_chroma()

    print("=" * 70)
    print("🎉 ALL SEED DATA INITIALIZED SUCCESSFULLY!")
    print(f"   Default Login: admin / {DEFAULT_PASSWORD}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
