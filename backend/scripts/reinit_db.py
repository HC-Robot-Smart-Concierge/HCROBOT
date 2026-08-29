import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import engine, AsyncSessionLocal, Base
from app.db.init_db import seed_initial_data
from app.models import Staff, RobotUnit, RoomServiceOrder, HousekeepingRequest, BellRequest, MaintenanceRequest, ManagementDirective, InventoryStock
from scripts.seed_accounts import seed_accounts
from scripts.seed_reception_data import seed_reception_data


async def reinit():
    print("[*] Dropping all tables and re-creating with auth credentials...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("[*] Seeding staff accounts with passwords...")
    async with AsyncSessionLocal() as session:
        await seed_accounts(session)
        await seed_initial_data(session)
        await seed_reception_data(session)
    print("[SUCCESS] Reinitialization complete!")


if __name__ == "__main__":
    asyncio.run(reinit())
