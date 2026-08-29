import argparse
import asyncio
import os
import sys

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.db.init_db import init_db
from app.models import Staff


DEFAULT_PASSWORD = "123456"

SEED_ACCOUNTS = [
    {
        "username": "roomservice",
        "code": "ER",
        "full_name": "Elena Rossi",
        "role": "Shift Leader / F&B Lead",
        "department": "F&B",
        "default_dashboard": "room_service",
        "location": "Main Hotel",
        "status": "available",
        "current_tasks_count": 0,
        "avatar_url": None,
    },
    {
        "username": "housekeeping",
        "code": "MS",
        "full_name": "Maria Santos",
        "role": "Housekeeping Lead",
        "department": "Housekeeping",
        "default_dashboard": "housekeeping",
        "location": "Floor 3",
        "status": "available",
        "current_tasks_count": 0,
        "avatar_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80",
    },
    {
        "username": "maintenance",
        "code": "JD",
        "full_name": "James Doe",
        "role": "HVAC Tech & Maintenance",
        "department": "Maintenance",
        "default_dashboard": "maintenance",
        "location": "Floor 5",
        "status": "busy",
        "current_tasks_count": 1,
        "avatar_url": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80",
    },
    {
        "username": "bellman",
        "code": "MT",
        "full_name": "Marcus T.",
        "role": "Bell Captain",
        "department": "Bell Services",
        "default_dashboard": "bell_services",
        "location": "Lobby",
        "status": "available",
        "current_tasks_count": 0,
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
    },
    {
        "username": "admin",
        "code": "ADM",
        "full_name": "System Administrator",
        "role": "Operations Admin",
        "department": "Administration",
        "default_dashboard": "admin_map",
        "location": "Command Center",
        "status": "available",
        "current_tasks_count": 0,
        "avatar_url": None,
    },
    {
        "username": "sarah_j",
        "code": "SJ",
        "full_name": "Sarah J.",
        "role": "Attendant",
        "department": "Bell Services",
        "default_dashboard": "bell_services",
        "location": "Lobby",
        "status": "busy",
        "current_tasks_count": 1,
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
    },
]


async def seed_accounts(
    session: AsyncSession, password: str = DEFAULT_PASSWORD
) -> tuple[int, int, int, int]:
    """Reconcile supported staff accounts and remove the retired manager role."""
    removed_result = await session.execute(
        delete(Staff).where(Staff.username == "manager")
    )
    redirected_result = await session.execute(
        update(Staff)
        .where(Staff.default_dashboard == "manager_hub")
        .values(default_dashboard="admin_map")
    )
    await session.execute(
        update(Staff)
        .where(Staff.username == "admin")
        .values(department="Administration", default_dashboard="admin_map")
    )

    existing_result = await session.execute(select(Staff.username))
    existing_usernames = set(existing_result.scalars().all())
    password_hash = hash_password(password)

    missing_accounts = [
        Staff(password_hash=password_hash, **account)
        for account in SEED_ACCOUNTS
        if account["username"] not in existing_usernames
    ]

    if missing_accounts:
        session.add_all(missing_accounts)
    await session.commit()

    return (
        len(missing_accounts),
        len(SEED_ACCOUNTS) - len(missing_accounts),
        removed_result.rowcount or 0,
        redirected_result.rowcount or 0,
    )


async def main(password: str):
    await init_db()
    async with AsyncSessionLocal() as session:
        created, skipped, removed, redirected = await seed_accounts(session, password)

    print(
        "Seed accounts completed: "
        f"{created} created, {skipped} already existed, "
        f"{removed} retired manager account(s) removed, "
        f"{redirected} legacy dashboard assignment(s) updated."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Aurora OS staff accounts explicitly.")
    parser.add_argument(
        "--password",
        default=DEFAULT_PASSWORD,
        help="Password assigned only to newly created accounts (default: 123456).",
    )
    args = parser.parse_args()
    asyncio.run(main(args.password))
