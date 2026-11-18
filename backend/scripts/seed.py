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

import argparse
import asyncio
import logging
import os
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Đảm bảo đường dẫn backend nằm trong sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal, Base, engine, init_db
from app.core.security import hash_password
from app.models import Department, ServiceType, Staff
from scripts.seed_hotel_ops import (
    seed_chroma,
    seed_notifications,
    seed_operations,
    seed_reception,
    seed_support,
    seed_waypoints_and_workflows,
)
from scripts.seed_robot_and_logs import seed_logs, seed_robot_unit

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed")

DEFAULT_PASSWORD = "secret_password"

STAFF_ACCOUNTS = [
    {
        "username": "admin",
        "code": "ADM",
        "full_name": "System Administrator",
        "role": "Administrator",
        "department": "Executive",
        "default_dashboard": "admin_portal",
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
    {
        "username": "concierge",
        "code": "CCG01",
        "full_name": "Elena Rossi",
        "role": "Concierge Specialist",
        "department": "Concierge & Live Support",
        "department_id": "DEP-CONCIERGE",
        "default_dashboard": "concierge",
        "location": "Concierge Lounge",
        "status": "available",
        "shift": "Morning Shift (06:00 - 14:00)",
    },
    {
        "username": "concierge_lead",
        "code": "CCG",
        "full_name": "Elena Rossi (Lead)",
        "role": "Concierge Specialist",
        "department": "Concierge & Live Support",
        "department_id": "DEP-CONCIERGE",
        "default_dashboard": "concierge",
        "location": "Concierge Lounge",
        "status": "available",
        "shift": "Morning Shift (06:00 - 14:00)",
    },
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


async def seed_departments_and_services(session):
    logger.info("🏢 [0/7] Seeding Hotel Departments & Service Types...")
    deps = [
        ("DEP-RECEPTION", "RECEPTION", "Reception", "Bộ phận Lễ tân & Tiền sảnh, thủ tục check-in/out, đặt phòng và thông tin lưu trú"),
        ("DEP-CONCIERGE", "CONCIERGE", "Concierge", "Bộ phận Trợ lý Concierge, tổng đài hỗ trợ trực tuyến và live call video từ Robot"),
        ("DEP-HOUSEKEEPING", "HOUSEKEEPING", "Housekeeping", "Dịch vụ buồng phòng và dọn dẹp"),
        ("DEP-BELL", "BELL", "Bell Services", "Vận chuyển hành lý và hỗ trợ sảnh"),
        ("DEP-TAXI", "TAXI", "Taxi", "Điều phối taxi và đưa đón di chuyển"),
        ("DEP-ROOMSERVICE", "ROOMSERVICE", "Room Service", "Bộ phận Phục vụ phòng (Room Service)"),
        ("DEP-MAINTENANCE", "MAINTENANCE", "Maintenance", "Kỹ thuật và bảo trì trang thiết bị"),
        ("DEP-EXECUTIVE", "EXECUTIVE", "Executive", "Ban quản trị và điều hành khách sạn"),
        ("DEP-KITCHEN", "KITCHEN", "Kitchen", "Bộ phận Bếp & Chế biến ẩm thực (Kitchen Operations)"),
    ]
    for d_id, d_code, d_name, d_desc in deps:
        d = await session.get(Department, d_id)
        if not d:
            session.add(Department(id=d_id, code=d_code, name=d_name, description=d_desc, is_active=True))
        else:
            d.name = d_name
            d.description = d_desc

    services = [
        ("ST-RECEPTION", "RECEPTION", "Dịch vụ Lễ tân & Đặt phòng", "DEP-RECEPTION", "Hỗ trợ đặt phòng, check-in, check-out, đổi phòng và thủ tục tiền sảnh", "NORMAL"),
        ("ST-CONCIERGE", "CONCIERGE", "Dịch vụ Concierge & Live Call Hỗ trợ", "DEP-CONCIERGE", "Tiếp nhận cuộc gọi trực tiếp, giải cứu robot và hỗ trợ khách hàng từ xa", "HIGH"),
        ("ST-HOUSEKEEPING", "HOUSEKEEPING", "Dịch vụ Buồng phòng", "DEP-HOUSEKEEPING", "Dọn dẹp phòng nghỉ hoặc xử lý vết tràn đổ", "NORMAL"),
        ("ST-BELL", "BELL_SERVICE", "Dịch vụ Bellman & Hành lý", "DEP-BELL", "Khuân vác hành lý check-in / check-out", "NORMAL"),
        ("ST-TAXI", "TAXI", "Dịch vụ Đặt xe & Taxi", "DEP-TAXI", "Gọi xe taxi hoặc đưa đón sân bay", "NORMAL"),
        ("ST-MAINTENANCE", "MAINTENANCE", "Dịch vụ Kỹ thuật & Bảo trì", "DEP-MAINTENANCE", "Bảo trì điều hòa nhiệt độ, điện nước", "HIGH"),
        ("ST-ROOM-SERVICE", "ROOM_SERVICE", "Dịch vụ Ẩm thực & Phục vụ phòng", "DEP-ROOMSERVICE", "Phục vụ đồ ăn thức uống tại phòng", "NORMAL"),
    ]
    for s_id, s_code, s_name, s_dep, s_desc, _ in services:
        s = await session.get(ServiceType, s_id)
        if not s:
            session.add(ServiceType(id=s_id, code=s_code, name=s_name, department_id=s_dep, description=s_desc, is_active=True))
        else:
            s.name = s_name
            s.department_id = s_dep
            s.description = s_desc

    await session.commit()
    logger.info("   ✅ Departments & Service Types seeded successfully.")


async def seed_accounts(session):
    logger.info("👤 [1/7] Seeding Staff & Robot Kiosk accounts...")
    pwd_hash = hash_password(DEFAULT_PASSWORD)
    created = 0
    for acc in STAFF_ACCOUNTS:
        res = await session.execute(
            select(Staff).where((Staff.username == acc["username"]) | (Staff.code == acc["code"]))
        )
        if not res.scalar_one_or_none():
            session.add(
                Staff(
                    username=acc["username"],
                    password_hash=pwd_hash,
                    code=acc["code"],
                    full_name=acc["full_name"],
                    role=acc["role"],
                    department=acc["department"],
                    department_id=acc.get("department_id"),
                    default_dashboard=acc.get("default_dashboard", "room_service"),
                    location=acc.get("location", "Main Hotel"),
                    status=acc.get("status", "available"),
                    is_active=True,
                )
            )
            created += 1
    await session.commit()
    logger.info(f"   ✅ Added {created} new staff/robot accounts.")


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
        await init_db()

    async with AsyncSessionLocal() as session:
        await seed_departments_and_services(session)
        await seed_accounts(session)
        await seed_operations(session)
        await seed_reception(session)
        await seed_support(session)
        await seed_notifications(session)
        await seed_waypoints_and_workflows(session)
        await seed_robot_unit(session)
        if args.with_logs or args.reset:
            await seed_logs(session)

    seed_chroma()

    print("=" * 70)
    print("🎉 ALL SEED DATA INITIALIZED SUCCESSFULLY!")
    print(f"   Default Login: admin / {DEFAULT_PASSWORD}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
