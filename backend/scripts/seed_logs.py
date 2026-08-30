import asyncio
import sys
import os
import datetime

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import engine, Base, AsyncSessionLocal
from app.models.logging import LogEvent, AuditLog, LogLevelEnum, LogCategoryEnum, ActorTypeEnum
from sqlalchemy import select, func, delete

async def seed_logs_and_audit():
    print("[*] Initializing Logging & Audit Trail Database Tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        try:
            # Check existing count
            existing_count = (await session.execute(select(func.count(LogEvent.id)))).scalar_one()
            if existing_count > 0:
                print(f"[*] Found {existing_count} existing log events. Resetting for clean seed...")
                await session.execute(delete(LogEvent))
                await session.execute(delete(AuditLog))
                await session.commit()

            print("[*] Seeding realistic operational logs & audit trails...")
            now = datetime.datetime.now(datetime.timezone.utc)

            logs_to_insert = []
            audits_to_insert = []

            # =========================================================================
            # 1. LIFECYCLE TRACE 1: Buồng Phòng (Extra Towels) — SR-20260830-4102
            # =========================================================================
            c_id_1 = "SR-20260830-4102"
            t0 = now - datetime.timedelta(minutes=35)
            logs_to_insert.extend([
                LogEvent(
                    timestamp=t0,
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.AI_VOICE,
                    event_type="VOICE_INPUT_RECEIVED",
                    module="app.services.ai.stt",
                    message="Khách phòng 412 gửi yêu cầu giọng nói tại Kiosk: 'Cho tôi xin thêm 2 khăn tắm lớn và bộ bàn chải'",
                    actor_type=ActorTypeEnum.GUEST,
                    actor_id="guest_room_412",
                    robot_id="RC-001",
                    correlation_id=c_id_1,
                    metadata_payload={"room": "412", "audio_length_s": 3.4, "channel": "Kiosk_Mic_Array"},
                ),
                LogEvent(
                    timestamp=t0 + datetime.timedelta(seconds=1),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.AI_VOICE,
                    event_type="STT_COMPLETED",
                    module="app.services.ai.whisper",
                    message="Chuyển đổi âm thanh sang văn bản thành công (Độ tin cậy 98.4%, tiếng Việt)",
                    actor_type=ActorTypeEnum.AI,
                    actor_id="whisper_small_vi",
                    robot_id="RC-001",
                    correlation_id=c_id_1,
                    metadata_payload={"confidence": 0.984, "language": "vi", "latency_ms": 380},
                ),
                LogEvent(
                    timestamp=t0 + datetime.timedelta(seconds=2),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.AI_VOICE,
                    event_type="RAG_SEARCH",
                    module="app.services.rag.chromadb",
                    message="Truy vấn Vector RAG tìm kiếm tiện ích phòng và chính sách đồ dùng buồng phòng",
                    actor_type=ActorTypeEnum.AI,
                    actor_id="chroma_rag",
                    robot_id="RC-001",
                    correlation_id=c_id_1,
                    metadata_payload={"doc_ids": ["amenities_housekeeping_01", "room_supplies_policy"], "score": 0.94},
                ),
                LogEvent(
                    timestamp=t0 + datetime.timedelta(seconds=3),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.AI_VOICE,
                    event_type="AI_REQUEST_RESOLVED",
                    module="app.services.ai.llm",
                    message="AI hoàn tất phân tích ý định: Tự động khởi tạo phiếu dịch vụ chuyển tiếp cho Bộ phận Buồng phòng",
                    actor_type=ActorTypeEnum.AI,
                    actor_id="qwen2.5_7b",
                    robot_id="RC-001",
                    correlation_id=c_id_1,
                    metadata_payload={"intent": "housekeeping_towels_request", "priority": "normal", "latency_ms": 720},
                ),
                LogEvent(
                    timestamp=t0 + datetime.timedelta(seconds=4),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.DISPATCH,
                    event_type="SERVICE_REQUEST_CREATED",
                    module="app.api.v1.operations.housekeeping",
                    message="Đã tạo phiếu yêu cầu Buồng phòng #HK-891: Khăn tắm bổ sung & Tiện nghi phòng 412",
                    actor_type=ActorTypeEnum.SYSTEM,
                    actor_id="dispatch_engine",
                    robot_id="RC-001",
                    service_request_id="HK-891",
                    correlation_id=c_id_1,
                    metadata_payload={"department": "Housekeeping", "items": ["2x Bath Towel", "1x Dental Kit"]},
                ),
                LogEvent(
                    timestamp=t0 + datetime.timedelta(seconds=12),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.DISPATCH,
                    event_type="SERVICE_REQUEST_ASSIGNED",
                    module="app.api.v1.operations.housekeeping",
                    message="Tự động phân công nhiệm vụ cho nhân viên Buồng phòng: Sarah Jenkins (SJ - Tầng 4)",
                    actor_type=ActorTypeEnum.SYSTEM,
                    actor_id="dispatch_engine",
                    staff_id=2,
                    robot_id="RC-001",
                    service_request_id="HK-891",
                    correlation_id=c_id_1,
                    metadata_payload={"staff_name": "Sarah Jenkins", "floor": 4},
                ),
                LogEvent(
                    timestamp=t0 + datetime.timedelta(seconds=45),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.DISPATCH,
                    event_type="SERVICE_REQUEST_ACCEPTED",
                    module="app.api.v1.operations.housekeeping",
                    message="Nhân viên Sarah Jenkins đã bấm Tiếp Nhận trên Tablet Staff Console",
                    actor_type=ActorTypeEnum.STAFF,
                    actor_id="sarah_j",
                    staff_id=2,
                    robot_id="RC-001",
                    service_request_id="HK-891",
                    correlation_id=c_id_1,
                    metadata_payload={"response_time_s": 33},
                ),
                LogEvent(
                    timestamp=t0 + datetime.timedelta(minutes=4, seconds=20),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.DISPATCH,
                    event_type="SERVICE_REQUEST_COMPLETED",
                    module="app.api.v1.operations.housekeeping",
                    message="Phiếu #HK-891 đã được giao tận phòng 412 và đánh dấu Hoàn Tất (Tổng thời gian: 4m20s)",
                    actor_type=ActorTypeEnum.STAFF,
                    actor_id="sarah_j",
                    staff_id=2,
                    robot_id="RC-001",
                    service_request_id="HK-891",
                    correlation_id=c_id_1,
                    metadata_payload={"total_duration_s": 260, "sla_status": "EXCELLENT"},
                ),
            ])

            # =========================================================================
            # 2. LIFECYCLE TRACE 2: Phục Vụ Phòng (F&B Room Service) — SR-20260830-5819
            # =========================================================================
            c_id_2 = "SR-20260830-5819"
            t1 = now - datetime.timedelta(minutes=22)
            logs_to_insert.extend([
                LogEvent(
                    timestamp=t1,
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.AI_VOICE,
                    event_type="VOICE_INPUT_RECEIVED",
                    module="app.services.ai.stt",
                    message="Khách phòng 705 yêu cầu: 'Tôi muốn đặt 1 phần Wagyu Burger và 1 nước cam ép'",
                    actor_type=ActorTypeEnum.GUEST,
                    actor_id="guest_room_705",
                    robot_id="RC-001",
                    correlation_id=c_id_2,
                    metadata_payload={"room": "705", "audio_length_s": 2.8},
                ),
                LogEvent(
                    timestamp=t1 + datetime.timedelta(seconds=2),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.AI_VOICE,
                    event_type="RAG_SEARCH",
                    module="app.services.rag.chromadb",
                    message="Truy vấn Menu Thực đơn Nhà hàng Grand Gourmet & Bảng giá Room Service",
                    actor_type=ActorTypeEnum.AI,
                    actor_id="chroma_rag",
                    robot_id="RC-001",
                    correlation_id=c_id_2,
                    metadata_payload={"doc_ids": ["menu_grand_gourmet_fnb", "room_service_pricing"]},
                ),
                LogEvent(
                    timestamp=t1 + datetime.timedelta(seconds=4),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.DISPATCH,
                    event_type="SERVICE_REQUEST_CREATED",
                    module="app.api.v1.operations.room_service",
                    message="Đã tạo đơn gọi món Room Service #RS-2041 (Tổng tiền: 450,000 VNĐ)",
                    actor_type=ActorTypeEnum.SYSTEM,
                    actor_id="dispatch_engine",
                    robot_id="RC-001",
                    service_request_id="RS-2041",
                    correlation_id=c_id_2,
                    metadata_payload={"department": "F&B", "total_price": 450000, "items": ["Wagyu Beef Burger", "Fresh Orange Juice"]},
                ),
                LogEvent(
                    timestamp=t1 + datetime.timedelta(seconds=30),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.DISPATCH,
                    event_type="SERVICE_REQUEST_ACCEPTED",
                    module="app.api.v1.operations.room_service",
                    message="Bếp trưởng Bếp nóng (F&B) đã xác nhận đơn hàng #RS-2041 và đang chuẩn bị món",
                    actor_type=ActorTypeEnum.STAFF,
                    actor_id="roomservice",
                    staff_id=3,
                    robot_id="RC-001",
                    service_request_id="RS-2041",
                    correlation_id=c_id_2,
                    metadata_payload={"estimated_prep_minutes": 15},
                ),
                LogEvent(
                    timestamp=t1 + datetime.timedelta(minutes=14),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.ROBOT,
                    event_type="NAVIGATION_STARTED",
                    module="app.services.hardware.navigation",
                    message="Robot RC-001 nhận khay thức ăn từ bếp Tầng 2, bắt đầu di chuyển thang máy lên Phòng 705",
                    actor_type=ActorTypeEnum.ROBOT,
                    actor_id="RC-001",
                    robot_id="RC-001",
                    service_request_id="RS-2041",
                    correlation_id=c_id_2,
                    metadata_payload={"target_floor": 7, "target_room": "705", "speed_ms": 0.45},
                ),
                LogEvent(
                    timestamp=t1 + datetime.timedelta(minutes=18),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.DISPATCH,
                    event_type="SERVICE_REQUEST_COMPLETED",
                    module="app.api.v1.operations.room_service",
                    message="Khách phòng 705 nhập mã PIN 4821 mở ngăn tủ Robot, nhận món thành công. Đơn hàng #RS-2041 Hoàn Tất",
                    actor_type=ActorTypeEnum.GUEST,
                    actor_id="guest_room_705",
                    robot_id="RC-001",
                    service_request_id="RS-2041",
                    correlation_id=c_id_2,
                    metadata_payload={"delivery_method": "Robot_Compartment_PIN", "auth_status": "SUCCESS"},
                ),
            ])

            # =========================================================================
            # 3. HARDWARE & LIDAR EVENTS (COM9, Obstacle, Battery, SLAM)
            # =========================================================================
            logs_to_insert.extend([
                LogEvent(
                    timestamp=now - datetime.timedelta(hours=2, minutes=15),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.ROBOT,
                    event_type="LIDAR_CONNECTED",
                    module="app.services.hardware.rplidar",
                    message="Kết nối cảm biến RPLiDAR A2 qua cổng Serial COM9 (Baudrate 115200) thành công",
                    actor_type=ActorTypeEnum.ROBOT,
                    actor_id="RC-001",
                    robot_id="RC-001",
                    metadata_payload={"port": "COM9", "baudrate": 115200, "sample_rate_hz": 8000, "model": "RPLiDAR_A2M8"},
                ),
                LogEvent(
                    timestamp=now - datetime.timedelta(hours=2, minutes=14),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.ROBOT,
                    event_type="SLAM_STARTED",
                    module="app.services.hardware.slam",
                    message="Tải bản đồ 2D LiDAR SLAM: 'Main_Lobby_Floor_1.yaml' (Độ phân giải 0.05m/pixel)",
                    actor_type=ActorTypeEnum.ROBOT,
                    actor_id="RC-001",
                    robot_id="RC-001",
                    metadata_payload={"map_id": "MAP_LOBBY_01", "origin": [-10.0, -10.0, 0.0]},
                ),
                LogEvent(
                    timestamp=now - datetime.timedelta(minutes=18),
                    level=LogLevelEnum.WARNING,
                    category=LogCategoryEnum.ROBOT,
                    event_type="OBSTACLE_DETECTED",
                    module="app.services.hardware.navigation",
                    message="Cảnh báo vật cản động tại cự ly gần (Khoảng cách 22cm, góc 15 độ) — Robot tự động giảm tốc né tránh",
                    actor_type=ActorTypeEnum.ROBOT,
                    actor_id="RC-001",
                    robot_id="RC-001",
                    metadata_payload={"distance_cm": 22, "angle_deg": 15, "pose": {"x": 2.15, "y": 4.82, "yaw": 88.2}},
                ),
                LogEvent(
                    timestamp=now - datetime.timedelta(minutes=17, seconds=45),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.ROBOT,
                    event_type="OBSTACLE_CLEARED",
                    module="app.services.hardware.navigation",
                    message="Vật cản đã thông thoáng. Robot RC-001 tiếp tục quỹ đạo định vị thông thường",
                    actor_type=ActorTypeEnum.ROBOT,
                    actor_id="RC-001",
                    robot_id="RC-001",
                    metadata_payload={"speed_ms": 0.45},
                ),
                LogEvent(
                    timestamp=now - datetime.timedelta(minutes=8),
                    level=LogLevelEnum.WARNING,
                    category=LogCategoryEnum.ROBOT,
                    event_type="LOW_BATTERY",
                    module="app.services.hardware.power",
                    message="Cảnh báo mức pin thấp (Pin hiện tại 14.8% < 15%) — Kích hoạt quy trình tự động về Dock sạc",
                    actor_type=ActorTypeEnum.ROBOT,
                    actor_id="RC-001",
                    robot_id="RC-001",
                    metadata_payload={"battery_pct": 14.8, "voltage_v": 23.4, "current_a": 1.8},
                ),
                LogEvent(
                    timestamp=now - datetime.timedelta(minutes=5),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.ROBOT,
                    event_type="DOCKING_COMPLETED",
                    module="app.services.hardware.docking",
                    message="Robot RC-001 đã tiếp xúc chính xác chấu sạc tại Trạm Dock A (Sảnh chính), bắt đầu sạc nhanh",
                    actor_type=ActorTypeEnum.ROBOT,
                    actor_id="RC-001",
                    robot_id="RC-001",
                    metadata_payload={"dock_station_id": "DOCK_LOBBY_A", "charging_status": "FAST_CHARGING"},
                ),
            ])

            # =========================================================================
            # 4. AUDIT LOGS (Security, Settings, Knowledge Base, Auth)
            # =========================================================================
            a1 = AuditLog(
                timestamp=now - datetime.timedelta(hours=1, minutes=10),
                actor_type=ActorTypeEnum.ADMIN,
                actor_id="admin",
                actor_name="System Administrator",
                action="LOGIN",
                resource_type="SESSION",
                resource_id="session_admin_982",
                after_state={"role": "Admin", "ip": "192.168.1.45"},
                ip_address="192.168.1.45",
            )
            audits_to_insert.append(a1)
            logs_to_insert.append(
                LogEvent(
                    timestamp=now - datetime.timedelta(hours=1, minutes=10),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.AUDIT,
                    event_type="AUDIT_LOGIN",
                    module="app.core.audit",
                    message="[ADMIN] Quản trị viên 'admin' đã đăng nhập thành công vào Admin Portal",
                    actor_type=ActorTypeEnum.ADMIN,
                    actor_id="admin",
                    ip_address="192.168.1.45",
                    metadata_payload={"ip": "192.168.1.45", "auth_method": "JWT_PASSWORD"},
                )
            )

            a2 = AuditLog(
                timestamp=now - datetime.timedelta(minutes=45),
                actor_type=ActorTypeEnum.ADMIN,
                actor_id="admin",
                actor_name="System Administrator",
                action="CONFIG_CHANGED",
                resource_type="SYSTEM_SETTING",
                resource_id="PMS_INTEGRATION",
                before_state={"pms_provider": "Cloudbeds PMS"},
                after_state={"pms_provider": "Oracle OPERA Cloud", "status": "CONNECTED"},
                ip_address="192.168.1.45",
            )
            audits_to_insert.append(a2)
            logs_to_insert.append(
                LogEvent(
                    timestamp=now - datetime.timedelta(minutes=45),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.AUDIT,
                    event_type="AUDIT_CONFIG_CHANGED",
                    module="app.core.audit",
                    message="[ADMIN] Đã cập nhật cấu hình hệ thống PMS từ 'Cloudbeds' sang 'Oracle OPERA Cloud'",
                    actor_type=ActorTypeEnum.ADMIN,
                    actor_id="admin",
                    ip_address="192.168.1.45",
                    metadata_payload={"field": "pms_provider", "new_value": "Oracle OPERA Cloud"},
                )
            )

            a3 = AuditLog(
                timestamp=now - datetime.timedelta(minutes=25),
                actor_type=ActorTypeEnum.STAFF,
                actor_id="reception",
                actor_name="Lễ Tân Sảnh Chính",
                action="KNOWLEDGE_UPDATED",
                resource_type="KNOWLEDGE_DOCUMENT",
                resource_id="danh_sach_co_so_vat_chat.md",
                before_state={"version": "1.0", "lines": 25},
                after_state={"version": "1.1", "lines": 31, "updated_section": "Dịch vụ giặt ủi & Quầy lưu niệm"},
                ip_address="192.168.1.52",
            )
            audits_to_insert.append(a3)
            logs_to_insert.append(
                LogEvent(
                    timestamp=now - datetime.timedelta(minutes=25),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.AUDIT,
                    event_type="AUDIT_KNOWLEDGE_UPDATED",
                    module="app.core.audit",
                    message="[STAFF] Lễ tân đã cập nhật tài liệu cơ sở tri thức 'danh_sach_co_so_vat_chat.md' vào Vector Database",
                    actor_type=ActorTypeEnum.STAFF,
                    actor_id="reception",
                    ip_address="192.168.1.52",
                    metadata_payload={"file": "danh_sach_co_so_vat_chat.md", "embeddings_updated": True},
                )
            )

            # =========================================================================
            # 5. SYSTEM & API MONITORING LOGS
            # =========================================================================
            logs_to_insert.extend([
                LogEvent(
                    timestamp=now - datetime.timedelta(minutes=15),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.SYSTEM,
                    event_type="API_REQUEST",
                    module="app.api.v1.auth",
                    message="HTTP POST /api/v1/auth/login - 200 OK (Độ trễ 16ms)",
                    actor_type=ActorTypeEnum.SYSTEM,
                    actor_id="fastapi_gateway",
                    ip_address="192.168.1.45",
                    metadata_payload={"method": "POST", "path": "/api/v1/auth/login", "status_code": 200, "latency_ms": 16},
                ),
                LogEvent(
                    timestamp=now - datetime.timedelta(minutes=12),
                    level=LogLevelEnum.INFO,
                    category=LogCategoryEnum.SYSTEM,
                    event_type="DATABASE_HEALTHCHECK",
                    module="app.core.database",
                    message="PostgreSQL Connection Pool hoạt động ổn định (Active: 4, Idle: 16, Max: 20)",
                    actor_type=ActorTypeEnum.SYSTEM,
                    actor_id="postgres_pool",
                    metadata_payload={"active_connections": 4, "idle_connections": 16},
                ),
                LogEvent(
                    timestamp=now - datetime.timedelta(minutes=2),
                    level=LogLevelEnum.WARNING,
                    category=LogCategoryEnum.SYSTEM,
                    event_type="WEBSOCKET_LATENCY_SPIKE",
                    module="app.services.realtime.ws",
                    message="Cảnh báo độ trễ kênh truyền WebSocket tăng nhẹ (Ping 145ms)",
                    actor_type=ActorTypeEnum.SYSTEM,
                    actor_id="ws_hub",
                    metadata_payload={"ping_ms": 145, "threshold_ms": 100},
                ),
            ])

            # Add all items
            session.add_all(audits_to_insert)
            session.add_all(logs_to_insert)
            await session.commit()

            total_logs = (await session.execute(select(func.count(LogEvent.id)))).scalar_one()
            total_audits = (await session.execute(select(func.count(AuditLog.id)))).scalar_one()
            print(f"[SUCCESS] Successfully seeded {total_logs} Log Events and {total_audits} Audit Logs in PostgreSQL!")

        except Exception as e:
            await session.rollback()
            print(f"[ERROR] Error seeding logs: {e}")
            raise e

if __name__ == "__main__":
    asyncio.run(seed_logs_and_audit())
