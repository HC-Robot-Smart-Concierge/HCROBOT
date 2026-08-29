import asyncio
import sys
import io
import os

# Reconfigure stdout for UTF-8 encoding on Windows terminal if needed
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass

# Set root backend path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.staff import Staff


async def seed_department_accounts():
    """
    Seeds or updates default Department & Robot Node accounts in PostgreSQL database.
    Default Password for all accounts: '123456'
    """
    print("=" * 60)
    print("HCROBOT - DEPARTMENT & ROBOT ACCOUNTS SEEDING SCRIPT")
    print("=" * 60)

    default_pwd_hash = hash_password("123456")

    accounts_data = [
        {
            "username": "reception",
            "code": "RCP",
            "full_name": "Nhan vien Le tan (Reception)",
            "role": "Front Desk / Receptionist",
            "department": "Reception",
            "default_dashboard": "manager_hub",
            "location": "Main Lobby Reception",
            "status": "available",
        },
        {
            "username": "roomservice",
            "code": "FB",
            "full_name": "Nhan vien Phuc vu phong (F&B)",
            "role": "F&B Room Service Staff",
            "department": "F&B",
            "default_dashboard": "room_service",
            "location": "Main Hotel Kitchen",
            "status": "available",
        },
        {
            "username": "housekeeping",
            "code": "HK",
            "full_name": "Nhan vien Buong phong (Housekeeping)",
            "role": "Housekeeping Staff",
            "department": "Housekeeping",
            "default_dashboard": "housekeeping",
            "location": "Floor 3",
            "status": "available",
        },
        {
            "username": "bellman",
            "code": "BEL",
            "full_name": "Nhan vien Van chuyen hanh ly (Bellman)",
            "role": "Bellman / Luggage Staff",
            "department": "Bell Services",
            "default_dashboard": "bell_services",
            "location": "Lobby",
            "status": "available",
        },
        {
            "username": "maintenance",
            "code": "MNT",
            "full_name": "Nhan vien Ky thuat & Bao tri",
            "role": "Maintenance Technician",
            "department": "Maintenance",
            "default_dashboard": "maintenance",
            "location": "Floor 5",
            "status": "available",
        },
        {
            "username": "manager",
            "code": "MGR",
            "full_name": "Ban Quan ly Khach san (Manager)",
            "role": "General Manager",
            "department": "Executive",
            "default_dashboard": "manager_hub",
            "location": "Executive Office",
            "status": "available",
        },
        {
            "username": "admin",
            "code": "ADM",
            "full_name": "Quan tri He thong (Admin)",
            "role": "Operations Admin",
            "department": "Executive",
            "default_dashboard": "manager_hub",
            "location": "Command Center",
            "status": "available",
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

    async with AsyncSessionLocal() as session:
        try:
            for item in accounts_data:
                res = await session.execute(
                    select(Staff).where(Staff.username == item["username"])
                )
                existing = res.scalar_one_or_none()

                if existing:
                    existing.password_hash = default_pwd_hash
                    existing.full_name = item["full_name"]
                    existing.role = item["role"]
                    existing.department = item["department"]
                    existing.default_dashboard = item["default_dashboard"]
                    print(f"[UPDATED] Account '{item['username']}' updated ({item['full_name']})!")
                else:
                    new_staff = Staff(
                        username=item["username"],
                        password_hash=default_pwd_hash,
                        code=item["code"],
                        full_name=item["full_name"],
                        role=item["role"],
                        department=item["department"],
                        default_dashboard=item["default_dashboard"],
                        location=item["location"],
                        status=item["status"],
                        current_tasks_count=0,
                        avatar_url=None,
                    )
                    session.add(new_staff)
                    print(f"[CREATED] Account '{item['username']}' created ({item['full_name']})!")

            await session.commit()
            print("\n" + "=" * 60)
            print("ALL DEPARTMENT ACCOUNTS SEEDED SUCCESSFULLY!")
            print("Default Password for all accounts: 123456")
            print("=" * 60)

        except Exception as e:
            await session.rollback()
            print(f"[ERROR] Failed to seed accounts: {e}")
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(seed_department_accounts())
