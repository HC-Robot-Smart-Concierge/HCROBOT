import asyncio
import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8')
from app.core.database import engine

from sqlalchemy import text

async def check():
    async with engine.connect() as conn:
        print("=== 1. ACCOUNTS COLUMNS CHECK ===")
        res = await conn.execute(text("""
            SELECT id, username, department, department_id, current_tasks_count, shift, assigned_floors, notification_channels 
            FROM accounts LIMIT 5;
        """))
        for r in res.fetchall():
            print(dict(r._mapping))

        print("\n=== 2. MANAGEMENT_DIRECTIVES COLUMNS CHECK ===")
        res = await conn.execute(text("""
            SELECT id, code, account_id, assigned_account_id, created_by_account_id, assigned_staff_name, created_by 
            FROM management_directives LIMIT 5;
        """))
        for r in res.fetchall():
            print(dict(r._mapping))

        print("\n=== 3. LOG_EVENTS STAFF_ID VS ACCOUNT_ID ===")
        res = await conn.execute(text("""
            SELECT count(*) as total, 
                   count(staff_id) as non_null_staff_id, 
                   count(account_id) as non_null_account_id,
                   count(robot_id) as non_null_robot_id
            FROM log_events;
        """))
        print(dict(res.fetchone()._mapping))

        print("\n=== 4. SUPPORT_REQUESTS & ROOM_SERVICE_ORDERS PRIORITY ===")
        res = await conn.execute(text("""
            SELECT count(*) as total, count(priority) as non_null_priority FROM support_requests;
        """))
        print("support_requests:", dict(res.fetchone()._mapping))
        res = await conn.execute(text("""
            SELECT count(*) as total, count(priority) as non_null_priority FROM room_service_orders;
        """))
        print("room_service_orders:", dict(res.fetchone()._mapping))
        res = await conn.execute(text("""
            SELECT count(*) as total, count(default_priority) as non_null_def_priority FROM service_types;
        """))
        print("service_types:", dict(res.fetchone()._mapping))

        print("\n=== 5. ROOMS: FLOOR VS FLOOR_ID ===")
        res = await conn.execute(text("""
            SELECT id, room_number, floor, floor_id FROM rooms LIMIT 5;
        """))
        for r in res.fetchall():
            print(dict(r._mapping))

        print("\n=== 6. MENU_ITEMS: CACHED COLUMNS CHECK ===")
        res = await conn.execute(text("""
            SELECT count(*) as total,
                   count(name) as has_name,
                   count(price) as has_price,
                   count(category) as has_cat,
                   count(image_url) as has_img,
                   count(food_item_id) as has_food_id
            FROM menu_items;
        """))
        print("menu_items:", dict(res.fetchone()._mapping))

        print("\n=== 7. ORDER_ITEMS: FOOD_ITEM_ID VS MENU_ITEM_ID ===")
        res = await conn.execute(text("""
            SELECT count(*) as total,
                   count(menu_item_id) as has_menu_item_id,
                   count(food_item_id) as has_food_item_id
            FROM order_items;
        """))
        print("order_items:", dict(res.fetchone()._mapping))

        print("\n=== 8. ZONES & ENDPOINTS: MAP_ID ===")
        res = await conn.execute(text("SELECT id, name, map_id, floor FROM endpoints;"))
        for r in res.fetchall():
            print("endpoint:", dict(r._mapping))
        res = await conn.execute(text("SELECT id, name, map_id, floor FROM zones;"))
        for r in res.fetchall():
            print("zone:", dict(r._mapping))

if __name__ == '__main__':
    asyncio.run(check())
