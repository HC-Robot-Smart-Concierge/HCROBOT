"""Hotel operations, reception, human support, notifications, and ChromaDB seeding steps."""

import importlib
import logging

from sqlalchemy import func, select

from app.models import (
    BellRequest,
    HousekeepingRequest,
    HumanSupportSession,
    MaintenanceRequest,
    ManagementDirective,
    Notification,
    RoomServiceOrder,
    SupportRequest,
)
from app.services.rag.chroma import get_concierge_collection

logger = logging.getLogger("seed")


async def seed_operations(session):
    logger.info("🛎️ [2/7] Seeding Hotel Operations (F&B, Buồng phòng, Bellman, Kỹ thuật, Kho)...")
    res = await session.execute(select(func.count(RoomServiceOrder.id)))
    if res.scalar_one() > 0:
        logger.info("   ℹ️ Operations data already exists. Skipping.")
        return

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

    hk = [
        SupportRequest(
            ticket_code="RS-1042",
            source="From HCRobot",
            time_label="10:15 AM",
            title="Spill cleanup required",
            room_number="502",
            description="Wine spill on carpet. Guest requested immediate attention.",
            guest_name="Mr. John Smith",
            department_id="DEP-ROOMSERVICE",
            service_type_id="ST-ROOM-SERVICE",
            status="Pending",
            extra_data={"is_service_request": True},
        ),
        SupportRequest(
            ticket_code="RS-1043",
            source="From HCRobot",
            time_label="10:22 AM",
            title="Extra Towels",
            room_number="314",
            description="Guest requested 4 extra bath towels.",
            guest_name="Mrs. Alena Croft",
            department_id="DEP-ROOMSERVICE",
            service_type_id="ST-ROOM-SERVICE",
            status="Pending",
            extra_data={"is_service_request": True},
        ),
    ]
    session.add_all(hk)

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

    dirs = [
        ManagementDirective(
            code="M-101",
            title="Spill in Lobby",
            department="Room Service",
            priority="URGENT",
            location="Main Entrance",
            reported_time_label="Reported 2m ago",
            status="Unassigned",
            type="spill",
        ),
        ManagementDirective(
            code="M-102",
            title="Room Make-up",
            department="Room Service",
            priority="PENDING",
            location="Suite 402",
            reported_time_label="Guest Requested",
            status="Unassigned",
            type="room_service",
        ),
    ]
    session.add_all(dirs)

    InventoryStock = getattr(importlib.import_module("app.models.stock"), "InventoryStock", None)

    if InventoryStock is not None:
        stocks = [
            InventoryStock(name="Artisan Cola", category="beverage", count_label="6 left", quantity=6, level="danger"),
            InventoryStock(name="Sparkling Water (L)", category="beverage", count_label="2 left", quantity=2, level="danger"),
            InventoryStock(name="Truffle Oil", category="condiment", count_label="1 btl", quantity=1, level="warning"),
            InventoryStock(name="Premium Bath Towel", category="toiletries", count_label="24 left", quantity=24, level="normal"),
        ]
        session.add_all(stocks)

    await session.commit()
    logger.info("   ✅ Operations seed completed.")


async def seed_reception(session):
    logger.info("🏢 [3/7] Seeding Reception & Concierge Requests...")
    ticket_code = "REC-8942"
    res = await session.execute(select(SupportRequest).where(SupportRequest.ticket_code == ticket_code))
    if not res.scalar_one_or_none():
        session.add(
            SupportRequest(
                ticket_code=ticket_code,
                title="Yêu cầu Đổi Phòng & Đặt Phòng Hướng Biển",
                room_number="Room 402",
                guest_name="Mr. Alexander Wright",
                status="Pending",
                description="Khách yêu cầu hỗ trợ đổi sang phòng Executive Suite có ban công hướng biển và gia hạn lưu trú thêm 2 ngày.",
                department_id="DEP-RECEPTION",
                service_type_id="ST-RECEPTION",
                source="From HCRobot",
                assigned_staff_name="Nguyen Thu Trang",
            )
        )

    ccg_code = "CCG-881"
    res_ccg = await session.execute(select(SupportRequest).where(SupportRequest.ticket_code == ccg_code))
    if not res_ccg.scalar_one_or_none():
        session.add(
            SupportRequest(
                ticket_code=ccg_code,
                title="Cuộc gọi video hỗ trợ trực tiếp từ Robot",
                room_number="Main Lobby Kiosk",
                guest_name="Mr. A. Sterling",
                status="Pending",
                description="Khách cần nhân viên Concierge tư vấn trực tiếp về dịch vụ tour du thuyền và tiện ích VIP.",
                department_id="DEP-CONCIERGE",
                service_type_id="ST-CONCIERGE",
                source="Robot Voice Assistant",
                assigned_staff_name="Elena Rossi",
            )
        )

    await session.commit()
    logger.info("   ✅ Reception & Concierge requests seed completed.")


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
                        "en": "Can you help me with my luggage? I'm at the elevator bank.",
                    },
                    "sentiment": "Impatient",
                    "timestamp": "10:42 AM",
                },
                {
                    "id": "msg-302-2",
                    "speaker": "robot",
                    "speaker_name": "RC-001",
                    "raw_transcript": "I am alerting our bellman to assist you immediately!",
                    "translations": {
                        "vi": "Em đang báo cho nhân viên bellman đến hỗ trợ quý khách ngay ạ!",
                        "en": "I am alerting our bellman to assist you immediately!",
                    },
                    "sentiment": "Helpful",
                    "timestamp": "10:42 AM",
                },
            ],
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
                        "en": "I would like to check if my upgraded suite is ready.",
                    },
                    "sentiment": "Neutral",
                    "timestamp": "10:50 AM",
                }
            ],
        ),
    ]
    session.add_all(sessions)
    await session.commit()
    logger.info("   ✅ Human Support sessions seed completed.")


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
            department="Room Service",
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


def seed_chroma():
    logger.info("🧠 [6/7] Seeding ChromaDB Vector Store with Hotel Knowledge...")
    try:
        collection = get_concierge_collection("concierge_kb")
        docs = [
            {
                "id": "kb_wifi_001",
                "document": "Mạng wifi khách sạn Aurora Grand là 'Aurora_Guest_5G'. Mật khẩu truy cập là 'aurora2026'. Tốc độ cao miễn phí tại mọi phòng và khu vực công cộng.",
                "metadata": {"title": "Wifi & Internet", "category": "General", "facility": "wifi", "floor": "All"},
            },
            {
                "id": "kb_pool_001",
                "document": "Hồ bơi vô cực nằm ở tầng 4 (Khu Wellness) của khách sạn Aurora Grand. Thời gian mở cửa từ 06:00 đến 22:00 hàng ngày. Khăn tắm và nước khoáng phục vụ miễn phí.",
                "metadata": {"title": "Hồ Bơi Vô Cực", "category": "Facilities", "facility": "swimming_pool", "floor": "Tầng 4"},
            },
            {
                "id": "kb_spa_001",
                "document": "Aurora Serenity Spa & Massage nằm tại tầng 4, mở cửa từ 09:00 đến 22:00. Dịch vụ cung cấp xông hơi đá muối, massage đá nóng, chăm sóc da mặt cao cấp.",
                "metadata": {"title": "Aurora Serenity Spa", "category": "Wellness", "facility": "spa", "floor": "Tầng 4"},
            },
            {
                "id": "kb_gym_001",
                "document": "Phòng tập thể hình Aurora Fitness nằm ở tầng 4, mở cửa 24/7 cho khách lưu trú. Trang bị đầy đủ máy chạy bộ Technogym, tạ đơn, máy tập đa năng.",
                "metadata": {"title": "Phòng Gym 24/7", "category": "Facilities", "facility": "gym", "floor": "Tầng 4"},
            },
            {
                "id": "kb_checkout_001",
                "document": "Giờ nhận phòng (Check-in) là 14:00 và giờ trả phòng (Check-out) tiêu chuẩn là 12:00 trưa. Khách cần trả phòng muộn vui lòng báo trước với Lễ tân.",
                "metadata": {"title": "Quy Định Nhận/Trả Phòng", "category": "Policy", "facility": "reception", "floor": "Tầng 1"},
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


async def seed_waypoints_and_workflows(session):
    logger.info("📍 [6b/7] Skipping default map waypoints (Clean slate for custom mapping).")
