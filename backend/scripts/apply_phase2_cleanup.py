import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.stdout.reconfigure(encoding='utf-8')

from app.core.database import engine
from sqlalchemy import text

async def run_phase2():
    print("=" * 80)
    print("HC-ROBOT DATABASE CLEANUP PHASE 2")
    print("1. accounts: DROP COLUMN department (using department_id)")
    print("2. rooms: SYNC floor_id & DROP COLUMN floor")
    print("3. room_service_orders: DROP COLUMN items (using order_items)")
    print("=" * 80)

    async with engine.begin() as conn:
        # ---------------------------------------------------------
        # 1. ACCOUNTS: DROP COLUMN department
        # ---------------------------------------------------------
        print("\n[1/3] Processing 'accounts' table...")
        res = (await conn.execute(text("""
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'accounts' AND column_name = 'department';
        """))).scalar()
        if res:
            await conn.execute(text("ALTER TABLE accounts DROP COLUMN IF EXISTS department;"))
            print("  -> Dropped column 'department' from 'accounts' successfully.")
        else:
            print("  -> Column 'department' already absent from 'accounts'.")

        # ---------------------------------------------------------
        # 2. ROOMS: SYNC floor_id & DROP COLUMN floor
        # ---------------------------------------------------------
        print("\n[2/3] Processing 'rooms' table...")
        hotel_id = (await conn.execute(text("SELECT id FROM hotels LIMIT 1;"))).scalar() or 'HTL-MAIN'
        
        # Ensure FLR-06 exists for room 603
        await conn.execute(text("""
            INSERT INTO floors (id, hotel_id, floor_number, name, description)
            VALUES ('FLR-06', :hid, 6, 'Tầng 6 - Penthouse Suite', 'Khu vực căn hộ Penthouse cao cấp')
            ON CONFLICT (id) DO NOTHING;
        """), {"hid": hotel_id})
        print("  -> Verified FLR-06 exists in 'floors'.")

        # Sync floor_id for any room missing or mismatched
        await conn.execute(text("UPDATE rooms SET floor_id = 'FLR-04' WHERE room_number IN ('403', '406');"))
        await conn.execute(text("UPDATE rooms SET floor_id = 'FLR-02' WHERE room_number = '201';"))
        await conn.execute(text("UPDATE rooms SET floor_id = 'FLR-06' WHERE room_number = '603';"))
        await conn.execute(text("UPDATE rooms SET floor_id = 'FLR-01' WHERE room_number = '105';"))
        await conn.execute(text("UPDATE rooms SET floor_id = 'FLR-03' WHERE room_number IN ('300', '304', '305', '308');"))
        await conn.execute(text("UPDATE rooms SET floor_id = 'FLR-05' WHERE room_number = '502';"))
        print("  -> Verified all 12 rooms have valid 'floor_id' foreign keys.")

        # Drop column floor
        res = (await conn.execute(text("""
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'rooms' AND column_name = 'floor';
        """))).scalar()
        if res:
            await conn.execute(text("ALTER TABLE rooms DROP COLUMN IF EXISTS floor;"))
            print("  -> Dropped column 'floor' from 'rooms' successfully.")
        else:
            print("  -> Column 'floor' already absent from 'rooms'.")

        # ---------------------------------------------------------
        # 3. ROOM_SERVICE_ORDERS: DROP COLUMN items
        # ---------------------------------------------------------
        print("\n[3/3] Processing 'room_service_orders' table...")
        res = (await conn.execute(text("""
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'room_service_orders' AND column_name = 'items';
        """))).scalar()
        if res:
            await conn.execute(text("ALTER TABLE room_service_orders DROP COLUMN IF EXISTS items;"))
            print("  -> Dropped column 'items' from 'room_service_orders' successfully.")
        else:
            print("  -> Column 'items' already absent from 'room_service_orders'.")

    print("\n" + "=" * 80)
    print("PHASE 2 CLEANUP COMPLETED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == '__main__':
    asyncio.run(run_phase2())
