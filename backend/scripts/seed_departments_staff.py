"""
AURORA OS / HCROBOT - DEDICATED DEPARTMENT STAFF SEED ENGINE
============================================================
Tạo các tài khoản nhân sự chuẩn cho từng phòng ban:
Tên tài khoản & hiển thị thể hiện đúng tên phòng ban.
Tất cả mật khẩu mặc định là: 123456
"""

import asyncio
import os
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Đảm bảo import được module backend app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.department import Department
from app.models.staff import Staff

DEFAULT_PASSWORD = "123456"

DEPARTMENTS_DATA = [
    {
        "id": "DEP-EXECUTIVE",
        "code": "EXECUTIVE",
        "name": "Executive & Management",
        "description": "Ban Quản trị và Điều hành hệ thống khách sạn",
    },
    {
        "id": "DEP-RECEPTION",
        "code": "RECEPTION",
        "name": "Front Desk & Reception",
        "description": "Bộ phận Lễ tân & Tiếp đón khách hàng",
    },
    {
        "id": "DEP-HOUSEKEEPING",
        "code": "HOUSEKEEPING",
        "name": "Housekeeping",
        "description": "Bộ phận Buồng phòng & Vệ sinh",
    },
    {
        "id": "DEP-ROOMSERVICE",
        "code": "ROOMSERVICE",
        "name": "Room Service",
        "description": "Bộ phận Phục vụ phòng (Room Service)",
    },
    {
        "id": "DEP-BELL",
        "code": "BELL",
        "name": "Bell Services",
        "description": "Bộ phận Hành lý & Tiền sảnh",
    },
    {
        "id": "DEP-MAINTENANCE",
        "code": "MAINTENANCE",
        "name": "Maintenance & Engineering",
        "description": "Bộ phận Kỹ thuật & Bảo trì sự cố",
    },
    {
        "id": "DEP-KITCHEN",
        "code": "KITCHEN",
        "name": "Kitchen",
        "description": "Bộ phận Bếp & Chế biến ẩm thực (Kitchen Operations)",
    },
    {
        "id": "DEP-TAXI",
        "code": "TAXI",
        "name": "Taxi & Transportation",
        "description": "Bộ phận Đặt xe & Vận chuyển đưa đón khách",
    },
    {
        "id": "DEP-CONCIERGE",
        "code": "CONCIERGE",
        "name": "Concierge & Live Support",
        "description": "Bộ phận Trợ lý Concierge & Live Call Robot Kiosk",
    },
]

STAFF_BY_DEPARTMENT = [
    {
        "username": "admin",
        "code": "ADM",
        "full_name": "Bộ phận Quản trị",
        "role": "Operations Admin",
        "department": "Executive",
        "department_id": "DEP-EXECUTIVE",
        "default_dashboard": "admin_portal",
        "location": "Phòng Điều hành Trung tâm",
        "status": "available",
        "shift": "Toàn thời gian",
    },
    {
        "username": "reception",
        "code": "REC",
        "full_name": "Bộ phận Lễ tân",
        "role": "Front Desk Staff",
        "department": "Reception",
        "department_id": "DEP-RECEPTION",
        "default_dashboard": "reception",
        "location": "Quầy Lễ tân Sảnh chính",
        "status": "available",
        "shift": "Ca sáng (06:00 - 14:00)",
    },
    {
        "username": "housekeeping",
        "code": "HKP",
        "full_name": "Bộ phận Buồng phòng",
        "role": "Housekeeping Staff",
        "department": "Housekeeping",
        "department_id": "DEP-HOUSEKEEPING",
        "default_dashboard": "housekeeping",
        "location": "Kho Buồng phòng Tầng 3",
        "status": "available",
        "shift": "Ca sáng (06:00 - 14:00)",
    },
    {
        "username": "roomservice",
        "code": "RSV",
        "full_name": "Bộ phận Phục vụ phòng",
        "role": "Room Service Staff",
        "department": "Room Service",
        "department_id": "DEP-ROOMSERVICE",
        "default_dashboard": "room_service",
        "location": "Khu chế biến Bếp Trung tâm",
        "status": "available",
        "shift": "Ca sáng (06:00 - 14:00)",
    },
    {
        "username": "bellman",
        "code": "BEL",
        "full_name": "Bộ phận Hành lý",
        "role": "Bellman Staff",
        "department": "Bell Services",
        "department_id": "DEP-BELL",
        "default_dashboard": "bell_services",
        "location": "Quầy Bellman Tiền sảnh",
        "status": "available",
        "shift": "Ca sáng (06:00 - 14:00)",
    },
    {
        "username": "maintenance",
        "code": "MNT",
        "full_name": "Bộ phận Kỹ thuật",
        "role": "Maintenance Engineer",
        "department": "Maintenance",
        "department_id": "DEP-MAINTENANCE",
        "default_dashboard": "maintenance",
        "location": "Phòng Kỹ thuật Tầng hầm B1",
        "status": "available",
        "shift": "Ca sáng (06:00 - 14:00)",
    },
    {
        "username": "kitchen",
        "code": "KIT",
        "full_name": "Bộ phận Bếp",
        "role": "Kitchen Staff",
        "department": "Kitchen",
        "department_id": "DEP-KITCHEN",
        "default_dashboard": "restaurant",
        "location": "Nhà hàng Tầng 1",
        "status": "available",
        "shift": "Ca sáng (06:00 - 14:00)",
    },
    {
        "username": "taxi",
        "code": "TXI",
        "full_name": "Bộ phận Đặt xe Taxi (Concierge)",
        "role": "Transportation & Concierge Staff",
        "department": "Concierge",
        "department_id": "DEP-CONCIERGE",
        "default_dashboard": "concierge",
        "location": "Bàn Concierge & Sảnh chờ Xe Khách",
        "status": "available",
        "shift": "Ca sáng (06:00 - 14:00)",
    },
    {
        "username": "concierge",
        "code": "CCG",
        "full_name": "Bộ phận Trợ lý Concierge & Đặt xe",
        "role": "Concierge & Transportation Specialist",
        "department": "Concierge",
        "department_id": "DEP-CONCIERGE",
        "default_dashboard": "concierge",
        "location": "Bàn Trợ lý Concierge Kiosk & Đặt xe",
        "status": "available",
        "shift": "Ca sáng (06:00 - 14:00)",
    },
]

async def seed_departments_and_staff():
    print("[INFO] Bat dau seed phong ban va tai khoan nhan su...")
    async with AsyncSessionLocal() as session:
        # 1. Dam bao cac phong ban ton tai
        for dep_info in DEPARTMENTS_DATA:
            res = await session.execute(select(Department).where(Department.id == dep_info["id"]))
            dep = res.scalar_one_or_none()
            if not dep:
                # Kiem tra theo code
                res_code = await session.execute(select(Department).where(Department.code == dep_info["code"]))
                dep = res_code.scalar_one_or_none()
            
            if not dep:
                dep = Department(
                    id=dep_info["id"],
                    code=dep_info["code"],
                    name=dep_info["name"],
                    description=dep_info["description"],
                    is_active=True,
                )
                session.add(dep)
                print(f"[OK] Them moi phong ban: {dep_info['name']} ({dep_info['id']})")
            else:
                dep.name = dep_info["name"]
                dep.description = dep_info["description"]
                dep.is_active = True
                print(f"[OK] Cap nhat phong ban: {dep_info['name']}")

        await session.commit()

        # 2. Tao hoac cap nhat tai khoan nhan su theo tung phong ban
        pwd_hash = hash_password(DEFAULT_PASSWORD)
        for staff_info in STAFF_BY_DEPARTMENT:
            res = await session.execute(
                select(Staff).where(Staff.username == staff_info["username"])
            )
            staff = res.scalar_one_or_none()
            if not staff:
                # Neu chua co theo username thi kiem tra theo code
                res_code = await session.execute(select(Staff).where(Staff.code == staff_info["code"]))
                staff = res_code.scalar_one_or_none()

            if not staff:
                staff = Staff(
                    username=staff_info["username"],
                    password_hash=pwd_hash,
                    code=staff_info["code"],
                    full_name=staff_info["full_name"],
                    role=staff_info["role"],
                    department=staff_info["department"],
                    department_id=staff_info["department_id"],
                    default_dashboard=staff_info["default_dashboard"],
                    location=staff_info["location"],
                    status=staff_info["status"],
                    shift=staff_info["shift"],
                    current_tasks_count=0,
                    is_active=True,
                )
                session.add(staff)
                print(f"[OK] Tao moi tai khoan: {staff_info['username']} - {staff_info['full_name']} (Pass: {DEFAULT_PASSWORD})")
            else:
                staff.password_hash = pwd_hash
                staff.full_name = staff_info["full_name"]
                staff.role = staff_info["role"]
                staff.department = staff_info["department"]
                staff.department_id = staff_info["department_id"]
                staff.default_dashboard = staff_info["default_dashboard"]
                staff.location = staff_info["location"]
                staff.status = staff_info["status"]
                staff.shift = staff_info["shift"]
                staff.is_active = True
                print(f"[OK] Cap nhat tai khoan: {staff_info['username']} - {staff_info['full_name']} (Pass: {DEFAULT_PASSWORD})")

        await session.commit()
    print("[INFO] Hoan tat seed phong ban va tai khoan nhan su!")

if __name__ == "__main__":
    asyncio.run(seed_departments_and_staff())
