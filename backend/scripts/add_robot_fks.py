import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.stdout.reconfigure(encoding='utf-8')

from app.core.database import engine
from sqlalchemy import text

async def add_robot_fks():
    print("=" * 80)
    print("ADDING FOREIGN KEYS TO ROBOTS(ID)")
    print("1. support_requests.assigned_robot_id -> robots(id)")
    print("2. room_service_orders.assigned_robot_id -> robots(id)")
    print("=" * 80)

    async with engine.begin() as conn:
        # Check robot in DB
        robot_res = await conn.execute(text("SELECT id, code, name FROM robots LIMIT 1;"))
        robot = robot_res.fetchone()
        if robot:
            print(f"Current Robot in DB: ID='{robot[0]}', Code='{robot[1]}', Name='{robot[2]}'")
        else:
            print("WARNING: No robot found in 'robots' table!")

        # 1. support_requests -> robots
        print("\n[1/2] Adding Foreign Key for support_requests.assigned_robot_id...")
        await conn.execute(text("""
            DO $$
            BEGIN
                -- Clean any invalid robot_id before adding constraint
                UPDATE support_requests 
                SET assigned_robot_id = NULL 
                WHERE assigned_robot_id IS NOT NULL 
                  AND assigned_robot_id NOT IN (SELECT id FROM robots);

                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_support_requests_assigned_robot_id') THEN
                    ALTER TABLE support_requests ADD CONSTRAINT fk_support_requests_assigned_robot_id
                    FOREIGN KEY (assigned_robot_id) REFERENCES robots(id) ON DELETE SET NULL;
                END IF;
            END $$;
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_support_requests_assigned_robot_id ON support_requests(assigned_robot_id);"))
        print("  -> Constraint 'fk_support_requests_assigned_robot_id' and index created successfully.")

        # 2. room_service_orders -> robots
        print("\n[2/2] Adding Foreign Key for room_service_orders.assigned_robot_id...")
        await conn.execute(text("""
            DO $$
            BEGIN
                -- Clean any invalid robot_id before adding constraint
                UPDATE room_service_orders 
                SET assigned_robot_id = NULL 
                WHERE assigned_robot_id IS NOT NULL 
                  AND assigned_robot_id NOT IN (SELECT id FROM robots);

                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_room_service_orders_assigned_robot_id') THEN
                    ALTER TABLE room_service_orders ADD CONSTRAINT fk_room_service_orders_assigned_robot_id
                    FOREIGN KEY (assigned_robot_id) REFERENCES robots(id) ON DELETE SET NULL;
                END IF;
            END $$;
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_room_service_orders_assigned_robot_id ON room_service_orders(assigned_robot_id);"))
        print("  -> Constraint 'fk_room_service_orders_assigned_robot_id' and index created successfully.")

    print("\n" + "=" * 80)
    print("ALL FOREIGN KEY CONSTRAINTS ADDED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == '__main__':
    asyncio.run(add_robot_fks())
