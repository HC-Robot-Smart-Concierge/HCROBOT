import asyncio
import os
import sys

from sqlalchemy import select

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.staff import Staff


DEFAULT_PASSWORD = "123456"

ROBOT_ACCOUNTS = [
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


async def seed_robot_accounts(password: str = DEFAULT_PASSWORD) -> tuple[int, int]:
    """Create or update only Robot Kiosk accounts."""
    password_hash = hash_password(password)
    created = 0
    updated = 0

    async with AsyncSessionLocal() as session:
        for account in ROBOT_ACCOUNTS:
            result = await session.execute(
                select(Staff).where(Staff.username == account["username"])
            )
            existing = result.scalar_one_or_none()

            if existing:
                existing.password_hash = password_hash
                for field, value in account.items():
                    if field != "username":
                        setattr(existing, field, value)
                updated += 1
            else:
                session.add(
                    Staff(
                        password_hash=password_hash,
                        current_tasks_count=0,
                        avatar_url=None,
                        **account,
                    )
                )
                created += 1

        await session.commit()

    return created, updated


async def main():
    created, updated = await seed_robot_accounts()
    print(f"Robot account seed completed: {created} created, {updated} updated.")


if __name__ == "__main__":
    asyncio.run(main())
