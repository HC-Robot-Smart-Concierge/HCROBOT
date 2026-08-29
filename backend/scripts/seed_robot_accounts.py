import asyncio
import sys
import os

# Set root backend path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.staff import Staff


async def seed_robot_accounts():
    """
    Seeds or updates default Robot Node accounts in PostgreSQL database.
    Default Password: '123456'
    """
    print("=" * 60)
    print("HCROBOT - ROBOT ACCOUNTS SEEDING SCRIPT")
    print("=" * 60)

    default_pwd_hash = hash_password("123456")

    robot_accounts_data = [
        {
            "username": "robot_01",
            "code": "R01",
            "full_name": "HCRobot Unit 01",
            "role": "Robot Kiosk",
            "department": "Robot Node",
            "default_dashboard": "robot_display",
            "location": "Main Lobby Kiosk",
            "status": "available",
        },
        {
            "username": "robot_02",
            "code": "R02",
            "full_name": "HCRobot Unit 02",
            "role": "Robot Kiosk",
            "department": "Robot Node",
            "default_dashboard": "robot_display",
            "location": "Floor 4 Kiosk",
            "status": "available",
        },
    ]

    async with AsyncSessionLocal() as session:
        try:
            for item in robot_accounts_data:
                res = await session.execute(
                    select(Staff).where(Staff.username == item["username"])
                )
                existing = res.scalar_one_or_none()

                if existing:
                    existing.password_hash = default_pwd_hash
                    existing.role = item["role"]
                    existing.default_dashboard = item["default_dashboard"]
                    print(f"[UPDATED] Account '{item['username']}' updated successfully!")
                else:
                    new_robot = Staff(
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
                    session.add(new_robot)
                    print(f"[CREATED] Account '{item['username']}' created successfully!")

            await session.commit()
            print("\n" + "=" * 60)
            print("ROBOT ACCOUNTS SEEDED SUCCESSFULLY!")
            print("Username: robot_01 | Password: 123456")
            print("Username: robot_02 | Password: 123456")
            print("=" * 60)

        except Exception as e:
            await session.rollback()
            print(f"[ERROR] Failed to seed robot accounts: {e}")
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(seed_robot_accounts())
