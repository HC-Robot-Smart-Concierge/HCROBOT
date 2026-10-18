import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.stdout.reconfigure(encoding='utf-8')

from app.core.database import engine, AsyncSessionLocal
from sqlalchemy import text, select
from app.models.room_service import RoomServiceOrder
from app.models.account import Account
from app.models.hotel import Room
from sqlalchemy.orm import selectinload

async def check():
    async with engine.connect() as conn:
        print("=== 1. ACCOUNTS COLUMNS ===")
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts';"))
        acc_cols = [r[0] for r in res.fetchall()]
        print("   - Has 'department' column in DB?", 'department' in acc_cols)
        print(f"   - Total columns in accounts: {len(acc_cols)}")

        print("\n=== 2. ROOMS COLUMNS & FLOOR_ID ===")
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'rooms';"))
        room_cols = [r[0] for r in res.fetchall()]
        print("   - Has 'floor' column in DB?", 'floor' in room_cols)
        print(f"   - Total columns in rooms: {len(room_cols)}")
        res = await conn.execute(text("SELECT room_number, floor_id FROM rooms ORDER BY room_number;"))
        for r in res.fetchall():
            print(f"     * Room {r[0]}: floor_id = {r[1]}")

        print("\n=== 3. ROOM_SERVICE_ORDERS COLUMNS ===")
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'room_service_orders';"))
        rso_cols = [r[0] for r in res.fetchall()]
        print("   - Has 'items' column in DB?", 'items' in rso_cols)
        print(f"   - Total columns in room_service_orders: {len(rso_cols)}")

    async with AsyncSessionLocal() as session:
        # Check Account.department property
        acc = (await session.execute(select(Account).options(selectinload(Account.department_rel)).limit(1))).scalar()
        print(f"\nAccount Model Property Check: id={acc.id}, department='{acc.department}', department_id='{acc.department_id}'")

        # Check Room.floor property
        room = (await session.execute(select(Room).options(selectinload(Room.floor_rel)).limit(1))).scalar()
        print(f"Room Model Property Check: room_number={room.room_number}, floor='{room.floor}', floor_id='{room.floor_id}'")

        # Check RoomServiceOrder.items property
        rso = (await session.execute(select(RoomServiceOrder).options(selectinload(RoomServiceOrder.order_items)).limit(1))).scalar()
        print(f"Order Model Property Check: order_number={rso.order_number}, synthesized items count={len(rso.items)}")
        if rso.items:
            print(f"   First item synthesized: {rso.items[0]}")

    print("\n" + "=" * 80)
    print("VERIFICATION PHASE 2 FINISHED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == '__main__':
    asyncio.run(check())
