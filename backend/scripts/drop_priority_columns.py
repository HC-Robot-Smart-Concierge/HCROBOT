import asyncio
import sys
sys.path.insert(0, '.')
from app.core.database import engine
from sqlalchemy import text

sys.stdout.reconfigure(encoding='utf-8')

async def drop_priority_columns():
    async with engine.begin() as conn:
        print("[INFO] Starting drop of priority columns...")
        
        # 1. support_requests -> priority
        res = await conn.execute(text("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'support_requests' AND column_name = 'priority';
        """))
        if res.fetchone():
            print("[DROPPING] Dropping 'priority' from 'support_requests'...")
            await conn.execute(text("ALTER TABLE support_requests DROP COLUMN IF EXISTS priority;"))
            print("  -> Dropped 'priority' from 'support_requests'.")
        else:
            print("[SKIP] Column 'priority' not in 'support_requests'.")

        # 2. room_service_orders -> priority
        res = await conn.execute(text("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'room_service_orders' AND column_name = 'priority';
        """))
        if res.fetchone():
            print("[DROPPING] Dropping 'priority' from 'room_service_orders'...")
            await conn.execute(text("ALTER TABLE room_service_orders DROP COLUMN IF EXISTS priority;"))
            print("  -> Dropped 'priority' from 'room_service_orders'.")
        else:
            print("[SKIP] Column 'priority' not in 'room_service_orders'.")

        # 3. service_types -> default_priority
        res = await conn.execute(text("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'service_types' AND column_name = 'default_priority';
        """))
        if res.fetchone():
            print("[DROPPING] Dropping 'default_priority' from 'service_types'...")
            await conn.execute(text("ALTER TABLE service_types DROP COLUMN IF EXISTS default_priority;"))
            print("  -> Dropped 'default_priority' from 'service_types'.")
        else:
            print("[SKIP] Column 'default_priority' not in 'service_types'.")

        print("[SUCCESS] All requested priority columns have been dropped from PostgreSQL.")

if __name__ == "__main__":
    asyncio.run(drop_priority_columns())
