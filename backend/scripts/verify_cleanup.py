import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.stdout.reconfigure(encoding='utf-8')

from app.core.database import engine
from sqlalchemy import text

async def verify():
    print("=" * 80)
    print("VERIFICATION OF DATABASE CLEANUP & REFACTOR")
    print("=" * 80)

    async with engine.connect() as conn:
        # 1. Obsolete tables check
        print("\n1. Obsolete Tables Existence Check:")
        for tbl in ['facilities', 'robot_units', 'robot_waypoints']:
            r = await conn.execute(text(f"SELECT to_regclass('public.{tbl}');"))
            status = "EXISTS (FAIL)" if r.scalar() else "NOT FOUND (SUCCESS - DROPPED)"
            print(f"   - {tbl}: {status}")

        # 2. Maps table check
        print("\n2. 'maps' Table Check:")
        r = await conn.execute(text("SELECT to_regclass('public.maps');"))
        maps_exists = bool(r.scalar())
        print(f"   - public.maps exists: {maps_exists}")
        if maps_exists:

            cnt = (await conn.execute(text("SELECT count(*) FROM maps;"))).scalar()
            rows = await conn.execute(text("SELECT id, name, floor, hotel_id, floor_id FROM maps;"))
            print(f"   - Row count: {cnt}")
            for row in rows.fetchall():
                print(f"     * {dict(row._mapping)}")

        # 3. Accounts columns check
        print("\n3. 'accounts' Table Columns Check:")
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts' ORDER BY ordinal_position;"))
        cols = [r[0] for r in res.fetchall()]
        print(f"   - Remaining columns ({len(cols)}): {cols}")
        for c in ['current_tasks_count', 'shift', 'assigned_floors', 'notification_channels']:
            print(f"   - Was '{c}' removed? {'YES (SUCCESS)' if c not in cols else 'NO (FAIL)'}")

        # 4. Priority columns check
        print("\n4. 'priority' Columns Check:")
        for tbl, col in [('support_requests', 'priority'), ('room_service_orders', 'priority'), ('service_types', 'default_priority')]:
            res = await conn.execute(text(f"SELECT 1 FROM information_schema.columns WHERE table_name = '{tbl}' AND column_name = '{col}';"))
            is_present = bool(res.scalar())
            print(f"   - {tbl}.{col} present? {'YES (FAIL)' if is_present else 'NO (SUCCESS - REMOVED)'}")

        # 5. log_events.staff_id check
        print("\n5. 'log_events.staff_id' Check:")
        res = await conn.execute(text("SELECT 1 FROM information_schema.columns WHERE table_name = 'log_events' AND column_name = 'staff_id';"))
        print(f"   - log_events.staff_id present? {'YES (FAIL)' if res.scalar() else 'NO (SUCCESS - REMOVED)'}")

        # 6. management_directives.account_id check
        print("\n6. 'management_directives.account_id' Check:")
        res = await conn.execute(text("SELECT 1 FROM information_schema.columns WHERE table_name = 'management_directives' AND column_name = 'account_id';"))
        print(f"   - management_directives.account_id present? {'YES (FAIL)' if res.scalar() else 'NO (SUCCESS - REMOVED)'}")

        # 7. menu_items constraints check
        print("\n7. 'menu_items' Foreign Key Constraints Check:")
        res = await conn.execute(text("""
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            WHERE conrelid = 'menu_items'::regclass AND contype = 'f';
        """))
        fks = res.fetchall()
        print(f"   - Foreign keys count: {len(fks)}")
        for fk in fks:
            print(f"     * {fk[0]}: {fk[1]}")

        # 8. Endpoints and Zones map_id link check
        print("\n8. Endpoints and Zones map_id Foreign Keys:")
        res = await conn.execute(text("""
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            WHERE conname IN ('fk_endpoints_map_id', 'fk_zones_map_id');
        """))
        for fk in res.fetchall():
            print(f"     * {fk[0]}: {fk[1]}")

    print("\n" + "=" * 80)
    print("ALL VERIFICATIONS COMPLETED!")
    print("=" * 80)

if __name__ == '__main__':
    asyncio.run(verify())
