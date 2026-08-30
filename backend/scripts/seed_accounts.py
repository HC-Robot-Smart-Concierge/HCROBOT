import argparse
import asyncio
import os
import sys

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.db.init_db import init_db
from app.models import Staff


DEFAULT_PASSWORD = "123456"

SEED_ACCOUNTS = [
    {
        "username": "reception",
        "code": "RCP",
        "full_name": "Nhân viên Lễ tân (Reception)",
        "role": "Front Desk / Receptionist",
        "department": "Reception",
        "default_dashboard": "reception",
        "location": "Main Lobby Reception",
        "status": "available",
        "current_tasks_count": 0,
        "avatar_url": None,
    },
    {
        "username": "roomservice",
        "code": "FB",
        "full_name": "Nhân viên Phục vụ phòng (F&B)",
        "role": "F&B Room Service Staff",
        "department": "F&B",
        "default_dashboard": "room_service",
        "location": "Main Hotel Kitchen",
        "status": "available",
        "current_tasks_count": 0,
        "avatar_url": None,
    },
    {
        "username": "housekeeping",
        "code": "HK",
        "full_name": "Nhân viên Buồng phòng (Housekeeping)",
        "role": "Housekeeping Staff",
        "department": "Housekeeping",
        "default_dashboard": "housekeeping",
        "location": "Floor 3",
        "status": "available",
        "current_tasks_count": 0,
        "avatar_url": None,
    },
    {
        "username": "bellman",
        "code": "BEL",
        "full_name": "Nhân viên Vận chuyển hành lý (Bellman)",
        "role": "Bellman / Luggage Staff",
        "department": "Bell Services",
        "default_dashboard": "bell_services",
        "location": "Lobby",
        "status": "available",
        "current_tasks_count": 0,
        "avatar_url": None,
    },
    {
        "username": "maintenance",
        "code": "MNT",
        "full_name": "Nhân viên Kỹ thuật & Bảo trì",
        "role": "Maintenance Technician",
        "department": "Maintenance",
        "default_dashboard": "maintenance",
        "location": "Floor 5",
        "status": "available",
        "current_tasks_count": 0,
        "avatar_url": None,
    },
    {
        "username": "manager",
        "code": "MGR",
        "full_name": "Ban Quản lý Khách sạn (Manager)",
        "role": "General Manager",
        "department": "Executive",
        "default_dashboard": "manager_hub",
        "location": "Executive Office",
        "status": "available",
        "current_tasks_count": 0,
        "avatar_url": None,
    },
    {
        "username": "admin",
        "code": "ADM",
        "full_name": "Quản trị Hệ thống (Admin)",
        "role": "Operations Admin",
        "department": "Executive",
        "default_dashboard": "manager_hub",
        "location": "Command Center",
        "status": "available",
        "current_tasks_count": 0,
        "avatar_url": None,
    },
]


async def seed_accounts(
    session: AsyncSession, password: str = DEFAULT_PASSWORD
) -> tuple[int, int]:
    """Seed or update supported department staff accounts."""
    password_hash = hash_password(password)
    created = 0
    updated = 0

    for account in SEED_ACCOUNTS:
        res = await session.execute(select(Staff).where(Staff.username == account["username"]))
        existing = res.scalar_one_or_none()

        if existing:
            existing.password_hash = password_hash
            existing.full_name = account["full_name"]
            existing.role = account["role"]
            existing.department = account["department"]
            existing.default_dashboard = account["default_dashboard"]
            updated += 1
        else:
            new_staff = Staff(password_hash=password_hash, **account)
            session.add(new_staff)
            created += 1

    await session.commit()
    return (created, updated)


async def main(password: str):
    await init_db()
    async with AsyncSessionLocal() as session:
        created, updated = await seed_accounts(session, password)

    print(
        f"Seed accounts completed: {created} created, {updated} updated with default password '{password}'."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed department staff accounts explicitly.")
    parser.add_argument(
        "--password",
        default=DEFAULT_PASSWORD,
        help="Password assigned to staff accounts (default: 123456).",
    )
    args = parser.parse_args()
    asyncio.run(main(args.password))
