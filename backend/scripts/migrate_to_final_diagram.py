import asyncio
import sys
sys.path.insert(0, '.')
from app.core.database import engine
from sqlalchemy import text

sys.stdout.reconfigure(encoding='utf-8')

async def run_statements(conn, statements):
    for stmt in statements:
        stmt = stmt.strip()
        if stmt:
            await conn.execute(text(stmt))

async def migrate():
    async with engine.begin() as conn:
        print("[1/6] Creating 'floors' table...")
        await run_statements(conn, [
            """
            CREATE TABLE IF NOT EXISTS floors (
                id VARCHAR(50) PRIMARY KEY,
                hotel_id VARCHAR(50) NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
                floor_number INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_floors_hotel_id ON floors(hotel_id)",
            "CREATE INDEX IF NOT EXISTS ix_floors_floor_number ON floors(floor_number)",
        ])

        print("[2/6] Seeding default floors for existing hotels if empty...")
        hotel_res = await conn.execute(text("SELECT id FROM hotels LIMIT 1;"))
        hotel_row = hotel_res.fetchone()
        if hotel_row:
            hotel_id = hotel_row[0]
            floor_count = (await conn.execute(text("SELECT count(*) FROM floors WHERE hotel_id = :hid;"), {"hid": hotel_id})).scalar()
            if floor_count == 0:
                floors_data = [
                    ("FLR-01", hotel_id, 1, "Tầng 1 - Sảnh chính & Tiếp đón", "Khu vực Sảnh Lễ tân, Concierge, Quầy thủ tục"),
                    ("FLR-02", hotel_id, 2, "Tầng 2 - Hội nghị & Bếp ẩm thực", "Khu vực Hội trường sự kiện và Bếp trung tâm"),
                    ("FLR-03", hotel_id, 3, "Tầng 3 - Phòng nghỉ Deluxe", "Khu vực phòng lưu trú Tầng 3 (301 - 320)"),
                    ("FLR-04", hotel_id, 4, "Tầng 4 - Phòng nghỉ Suite", "Khu vực phòng lưu trú Tầng 4 (401 - 420)"),
                    ("FLR-05", hotel_id, 5, "Tầng 5 - Executive Suite & Spa", "Khu vực phòng Tổng thống, Sky Bar, Spa"),
                ]
                for fid, hid, fnum, fname, fdesc in floors_data:
                    await conn.execute(text("""
                        INSERT INTO floors (id, hotel_id, floor_number, name, description)
                        VALUES (:id, :hid, :fnum, :name, :desc)
                        ON CONFLICT (id) DO NOTHING
                    """), {"id": fid, "hid": hid, "fnum": fnum, "name": fname, "desc": fdesc})
                print("  -> Seeded 5 standard floors (FLR-01 to FLR-05).")

        print("[3/6] Adding 'floor_id' foreign key to 'rooms' and 'maps'...")
        await run_statements(conn, [
            "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS floor_id VARCHAR(50)",
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_rooms_floor_id') THEN
                    ALTER TABLE rooms ADD CONSTRAINT fk_rooms_floor_id FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE SET NULL;
                END IF;
            END $$;
            """,
            "CREATE INDEX IF NOT EXISTS ix_rooms_floor_id ON rooms(floor_id)",
            "ALTER TABLE maps ADD COLUMN IF NOT EXISTS floor_id VARCHAR(50)",
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_maps_floor_id') THEN
                    ALTER TABLE maps ADD CONSTRAINT fk_maps_floor_id FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE SET NULL;
                END IF;
            END $$;
            """,
            "CREATE INDEX IF NOT EXISTS ix_maps_floor_id ON maps(floor_id)",
            "UPDATE rooms SET floor_id = 'FLR-03' WHERE floor_id IS NULL AND (room_number LIKE '3%' OR floor ILIKE '%3%')",
            "UPDATE rooms SET floor_id = 'FLR-04' WHERE floor_id IS NULL AND (room_number LIKE '4%' OR floor ILIKE '%4%')",
            "UPDATE rooms SET floor_id = 'FLR-05' WHERE floor_id IS NULL AND (room_number LIKE '5%' OR floor ILIKE '%5%')",
            "UPDATE rooms SET floor_id = 'FLR-01' WHERE floor_id IS NULL",
            "UPDATE maps SET floor_id = 'FLR-01' WHERE floor_id IS NULL",
        ])

        print("[4/6] Creating 'amenities' table (synced from 'facilities') with 'floor_id'...")
        await run_statements(conn, [
            """
            CREATE TABLE IF NOT EXISTS amenities (
                id VARCHAR(50) PRIMARY KEY,
                hotel_id VARCHAR(50) NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
                floor_id VARCHAR(50) REFERENCES floors(id) ON DELETE SET NULL,
                name VARCHAR(100) NOT NULL,
                category VARCHAR(50) NOT NULL,
                location VARCHAR(100) NOT NULL,
                open_time VARCHAR(20) NOT NULL,
                close_time VARCHAR(20) NOT NULL,
                description TEXT,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """,
            "CREATE INDEX IF NOT EXISTS ix_amenities_hotel_id ON amenities(hotel_id)",
            "CREATE INDEX IF NOT EXISTS ix_amenities_floor_id ON amenities(floor_id)",
            "ALTER TABLE facilities ADD COLUMN IF NOT EXISTS floor_id VARCHAR(50)",
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_facilities_floor_id') THEN
                    ALTER TABLE facilities ADD CONSTRAINT fk_facilities_floor_id FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE SET NULL;
                END IF;
            END $$;
            """,
        ])

        amenity_count = (await conn.execute(text("SELECT count(*) FROM amenities;"))).scalar()
        if amenity_count == 0:
            await conn.execute(text("""
                INSERT INTO amenities (id, hotel_id, floor_id, name, category, location, open_time, close_time, description, is_active, created_at, updated_at)
                SELECT id, hotel_id, 'FLR-01', name, category, location, open_time, close_time, description, is_active, created_at, updated_at
                FROM facilities
                ON CONFLICT (id) DO NOTHING
            """))
            print("  -> Synced data from facilities into amenities.")

        print("[5/6] Updating 'room_service_orders' with 'support_request_id'...")
        await run_statements(conn, [
            "ALTER TABLE room_service_orders ADD COLUMN IF NOT EXISTS support_request_id VARCHAR(50)",
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_room_service_orders_support_request_id') THEN
                    ALTER TABLE room_service_orders ADD CONSTRAINT fk_room_service_orders_support_request_id 
                    FOREIGN KEY (support_request_id) REFERENCES support_requests(id) ON DELETE SET NULL;
                END IF;
            END $$;
            """,
            "CREATE INDEX IF NOT EXISTS ix_rso_support_request_id ON room_service_orders(support_request_id)",
        ])

        print("[6/6] Verifying robot foreign key in log_events and directive accounts...")
        await run_statements(conn, [
            "ALTER TABLE management_directives ADD COLUMN IF NOT EXISTS account_id VARCHAR(50)",
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mgmt_directives_account_id') THEN
                    ALTER TABLE management_directives ADD CONSTRAINT fk_mgmt_directives_account_id 
                    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;
                END IF;
            END $$;
            """,
            "CREATE INDEX IF NOT EXISTS ix_mgmt_directives_account_id ON management_directives(account_id)",
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_log_events_robot_id') THEN
                    UPDATE log_events SET robot_id = NULL WHERE robot_id NOT IN (SELECT id FROM robots);
                    ALTER TABLE log_events ADD CONSTRAINT fk_log_events_robot_id 
                    FOREIGN KEY (robot_id) REFERENCES robots(id) ON DELETE SET NULL;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END $$;
            """,
        ])

        print("[DONE] Database migration executed successfully!")

if __name__ == '__main__':
    asyncio.run(migrate())
