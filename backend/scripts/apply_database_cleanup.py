import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.stdout.reconfigure(encoding='utf-8')

from app.core.database import engine
from sqlalchemy import text

async def run_cleanup():
    print("=" * 80)
    print("HC-ROBOT DATABASE CLEANUP & REFACTOR SCRIPT")
    print("=" * 80)

    async with engine.begin() as conn:
        # ---------------------------------------------------------
        # 1. DROP OBSOLETE TABLES (facilities, robot_units, robot_waypoints)
        # ---------------------------------------------------------
        print("\n[1/7] Dropping obsolete zombie tables...")
        for tbl in ['facilities', 'robot_units', 'robot_waypoints']:
            exists = (await conn.execute(text(f"SELECT to_regclass('public.{tbl}');"))).scalar()
            if exists:
                await conn.execute(text(f"DROP TABLE IF EXISTS {tbl} CASCADE;"))
                print(f"  -> Dropped table '{tbl}' successfully.")
            else:
                print(f"  -> Table '{tbl}' does not exist (skipped).")

        # ---------------------------------------------------------
        # 2. CREATE 'maps' TABLE & SEED DEFAULT MAP IF EMPTY
        # ---------------------------------------------------------
        print("\n[2/7] Ensuring 'maps' table exists and is linked...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS maps (
                id VARCHAR(50) PRIMARY KEY,
                hotel_id VARCHAR(50) NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
                floor_id VARCHAR(50) REFERENCES floors(id) ON DELETE SET NULL,
                name VARCHAR(100) NOT NULL,
                floor VARCHAR(50) NOT NULL DEFAULT 'Sảnh Tầng 1',
                resolution DOUBLE PRECISION NOT NULL DEFAULT 0.05,
                width INTEGER NOT NULL DEFAULT 200,
                height INTEGER NOT NULL DEFAULT 200,
                origin_x DOUBLE PRECISION NOT NULL DEFAULT -5.0,
                origin_y DOUBLE PRECISION NOT NULL DEFAULT -5.0,
                image_url VARCHAR(255),
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_maps_hotel_id ON maps(hotel_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_maps_floor_id ON maps(floor_id);"))
        print("  -> Table 'maps' created/verified.")

        # Seed default map if table is empty
        map_count = (await conn.execute(text("SELECT count(*) FROM maps;"))).scalar()
        if map_count == 0:
            hotel_id = (await conn.execute(text("SELECT id FROM hotels LIMIT 1;"))).scalar()
            floor_id = (await conn.execute(text("SELECT id FROM floors WHERE floor_number = 1 LIMIT 1;"))).scalar() or 'FLR-01'
            if hotel_id:
                await conn.execute(text("""
                    INSERT INTO maps (id, hotel_id, floor_id, name, floor, resolution, width, height, origin_x, origin_y, image_url, is_active)
                    VALUES ('MAP-01', :hotel_id, :floor_id, 'Bản đồ Sảnh Tầng 1 Main Lobby', 'Sảnh Tầng 1', 0.05, 200, 200, -5.0, -5.0, '/maps/lobby_floorplan.png', TRUE)
                    ON CONFLICT (id) DO NOTHING;
                """), {"hotel_id": hotel_id, "floor_id": floor_id})
                print("  -> Seeded default map 'MAP-01' for Lobby.")

                # Link existing endpoints and zones to MAP-01
                await conn.execute(text("UPDATE endpoints SET map_id = 'MAP-01' WHERE map_id IS NULL;"))
                await conn.execute(text("UPDATE zones SET map_id = 'MAP-01' WHERE map_id IS NULL;"))
                print("  -> Linked existing endpoints and zones to 'MAP-01'.")

        # Add foreign key constraints to endpoints.map_id and zones.map_id
        await conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_endpoints_map_id') THEN
                    ALTER TABLE endpoints ADD CONSTRAINT fk_endpoints_map_id FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE SET NULL;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_zones_map_id') THEN
                    ALTER TABLE zones ADD CONSTRAINT fk_zones_map_id FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE SET NULL;
                END IF;
            END $$;
        """))
        print("  -> Foreign keys for endpoints.map_id and zones.map_id configured.")

        # ---------------------------------------------------------
        # 3. DROP UNUSED COLUMNS IN 'accounts'
        # ---------------------------------------------------------
        print("\n[3/7] Dropping unused columns from 'accounts'...")
        account_cols = ['current_tasks_count', 'shift', 'assigned_floors', 'notification_channels']
        for col in account_cols:
            res = (await conn.execute(text(f"""
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'accounts' AND column_name = '{col}';
            """))).scalar()
            if res:
                await conn.execute(text(f"ALTER TABLE accounts DROP COLUMN IF EXISTS {col};"))
                print(f"  -> Dropped column '{col}' from 'accounts'.")
            else:
                print(f"  -> Column '{col}' already absent from 'accounts'.")

        # ---------------------------------------------------------
        # 4. DROP 'priority' / 'default_priority' COLUMNS
        # ---------------------------------------------------------
        print("\n[4/7] Dropping unmapped 'priority' columns...")
        # support_requests.priority
        res = (await conn.execute(text("SELECT 1 FROM information_schema.columns WHERE table_name = 'support_requests' AND column_name = 'priority';"))).scalar()
        if res:
            await conn.execute(text("ALTER TABLE support_requests DROP COLUMN IF EXISTS priority;"))
            print("  -> Dropped 'priority' from 'support_requests'.")
        else:
            print("  -> 'priority' already absent from 'support_requests'.")

        # room_service_orders.priority
        res = (await conn.execute(text("SELECT 1 FROM information_schema.columns WHERE table_name = 'room_service_orders' AND column_name = 'priority';"))).scalar()
        if res:
            await conn.execute(text("ALTER TABLE room_service_orders DROP COLUMN IF EXISTS priority;"))
            print("  -> Dropped 'priority' from 'room_service_orders'.")
        else:
            print("  -> 'priority' already absent from 'room_service_orders'.")

        # service_types.default_priority
        res = (await conn.execute(text("SELECT 1 FROM information_schema.columns WHERE table_name = 'service_types' AND column_name = 'default_priority';"))).scalar()
        if res:
            await conn.execute(text("ALTER TABLE service_types DROP COLUMN IF EXISTS default_priority;"))
            print("  -> Dropped 'default_priority' from 'service_types'.")
        else:
            print("  -> 'default_priority' already absent from 'service_types'.")

        # ---------------------------------------------------------
        # 5. DROP 'staff_id' FROM 'log_events'
        # ---------------------------------------------------------
        print("\n[5/7] Dropping unused 'staff_id' from 'log_events'...")
        res = (await conn.execute(text("SELECT 1 FROM information_schema.columns WHERE table_name = 'log_events' AND column_name = 'staff_id';"))).scalar()
        if res:
            await conn.execute(text("ALTER TABLE log_events DROP COLUMN IF EXISTS staff_id;"))
            print("  -> Dropped 'staff_id' from 'log_events'.")
        else:
            print("  -> 'staff_id' already absent from 'log_events'.")

        # ---------------------------------------------------------
        # 6. DROP 'account_id' FROM 'management_directives'
        # ---------------------------------------------------------
        print("\n[6/7] Dropping redundant 'account_id' from 'management_directives'...")
        # Drop constraint first if exists
        await conn.execute(text("ALTER TABLE management_directives DROP CONSTRAINT IF EXISTS fk_mgmt_directives_account_id;"))
        res = (await conn.execute(text("SELECT 1 FROM information_schema.columns WHERE table_name = 'management_directives' AND column_name = 'account_id';"))).scalar()
        if res:
            await conn.execute(text("ALTER TABLE management_directives DROP COLUMN IF EXISTS account_id;"))
            print("  -> Dropped column 'account_id' from 'management_directives'.")
        else:
            print("  -> 'account_id' already absent from 'management_directives'.")

        # ---------------------------------------------------------
        # 7. DROP DUPLICATE CONSTRAINTS FROM 'menu_items'
        # ---------------------------------------------------------
        print("\n[7/7] Removing duplicate foreign key constraints from 'menu_items'...")
        await conn.execute(text("ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS fk_menu_items_food_item_id;"))
        print("  -> Dropped duplicate constraint 'fk_menu_items_food_item_id'.")
        await conn.execute(text("ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS menu_items_menu_id_fkey;"))
        print("  -> Dropped duplicate constraint 'menu_items_menu_id_fkey'.")

    print("\n" + "=" * 80)
    print("DATABASE CLEANUP COMPLETED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == '__main__':
    asyncio.run(run_cleanup())
