"""
Script nạp toàn bộ 59 món ăn vào food_items và liên kết với Menu Phục Vụ Tại Phòng (MENU-ROOMSERVICE) trong menu_items.
"""

import os
import re
import asyncio
import sys
from pathlib import Path
from sqlalchemy import select, func

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from app.core.database import AsyncSessionLocal
from app.models.menu import FoodItem, Menu, MenuItem


def parse_menu_from_jsx():
    jsx_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "components" / "robot" / "RobotFoodMenuScreen.jsx"
    if not jsx_path.exists():
        raise FileNotFoundError(f"Không tìm thấy file: {jsx_path}")

    with open(jsx_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Parse Categories map
    category_map = {}
    cat_match = re.search(r"export const INITIAL_MENU_CATEGORIES = \[(.*?)\];", content, re.DOTALL)
    if cat_match:
        cat_blocks = re.findall(r"\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)'", cat_match.group(1))
        for cat_id, cat_name in cat_blocks:
            category_map[cat_id] = cat_name

    # 2. Parse Food Items
    item_section = re.search(r"export const INITIAL_FOOD_ITEMS = \[(.*?)\];\s*export const", content, re.DOTALL)
    if not item_section:
        raise ValueError("Không tìm thấy INITIAL_FOOD_ITEMS trong RobotFoodMenuScreen.jsx")

    blocks = re.findall(r"\{\s*id:\s*'([^']+)'.*?\}", item_section.group(1), re.DOTALL)
    raw_blocks = re.findall(r"\{\s*id:\s*'[^']+'.*?\n\s*\},?", item_section.group(1), re.DOTALL)

    items = []
    for b in raw_blocks:
        def get_field(k):
            m = re.search(rf"{k}:\s*'([^']*)'", b)
            return m.group(1) if m else ""

        def get_number(k):
            m = re.search(rf"{k}:\s*(\d+)", b)
            return int(m.group(1)) if m else 0

        item_id = get_field("id")
        if not item_id:
            continue

        category_id = get_field("category")
        category_name = category_map.get(category_id, "Món chính")

        item = {
            "id": item_id,
            "name": get_field("name"),
            "category_id": category_id,
            "category_name": category_name,
            "price": get_number("price"),
            "portion": get_field("portion"),
            "badge": get_field("badge"),
            "prep_time": get_number("prep_time") or 15,
            "description": get_field("description"),
            "image_url": get_field("image_url"),
        }
        items.append(item)

    return category_map, items


async def seed_room_service_menu():
    category_map, items = parse_menu_from_jsx()
    print(f"[*] Đã đọc được {len(items)} món ăn từ frontend/RobotFoodMenuScreen.jsx.")

    async with AsyncSessionLocal() as session:
        # 1. Đảm bảo Menu "Menu Phục Vụ Tại Phòng" tồn tại
        menu_id = "MENU-ROOMSERVICE"
        menu = await session.get(Menu, menu_id)
        if not menu:
            # Tìm theo tên nếu có
            stmt_menu = select(Menu).where(func.lower(Menu.name) == "menu phục vụ tại phòng".lower())
            menu_res = await session.execute(stmt_menu)
            menu = menu_res.scalars().first()

        if not menu:
            menu = Menu(
                id=menu_id,
                name="Menu Phục Vụ Tại Phòng",
                category="Room Service",
                description="Thực đơn gọi món phục vụ tận nơi tại phòng qua Robot Concierge & PWA",
                is_active=True,
            )
            session.add(menu)
            await session.flush()
            print(f"[+] Đã tạo mới Menu: {menu.id} - {menu.name}")
        else:
            menu_id = menu.id
            menu.is_active = True
            print(f"[*] Sử dụng Menu hiện có: {menu.id} - {menu.name}")

        # 2. Xử lý từng món ăn vào food_items và menu_items
        created_food_count = 0
        updated_food_count = 0
        created_item_count = 0
        updated_item_count = 0

        for idx, it in enumerate(items, start=1):
            target_food_id = f"FOOD-{it['id']}"

            # Tìm food_item theo ID hoặc tên
            food = await session.get(FoodItem, target_food_id)
            if not food:
                stmt_food = select(FoodItem).where(func.lower(FoodItem.name) == it["name"].strip().lower())
                f_res = await session.execute(stmt_food)
                food = f_res.scalars().first()

            if not food:
                food = FoodItem(
                    id=target_food_id,
                    name=it["name"].strip(),
                    category=it["category_name"],
                    description=it["description"],
                    image_url=it["image_url"],
                    prep_time_minutes=it["prep_time"],
                    is_available=True,
                )
                session.add(food)
                await session.flush()
                created_food_count += 1
            else:
                # Cập nhật thông tin mới nhất
                food.category = it["category_name"]
                food.description = it["description"]
                food.image_url = it["image_url"]
                food.prep_time_minutes = it["prep_time"]
                food.is_available = True
                updated_food_count += 1

            # 3. Liên kết vào menu_items với menu_id = MENU-ROOMSERVICE
            stmt_item = select(MenuItem).where(
                MenuItem.menu_id == menu_id,
                MenuItem.food_item_id == food.id,
            )
            item_res = await session.execute(stmt_item)
            menu_item = item_res.scalars().first()

            if not menu_item:
                target_item_id = f"ITEM-RS-{it['id']}"
                # Kiểm tra ID đã trùng chưa
                dup_item = await session.get(MenuItem, target_item_id)
                if dup_item:
                    import uuid
                    target_item_id = f"ITEM-RS-{uuid.uuid4().hex[:6].upper()}"

                menu_item = MenuItem(
                    id=target_item_id,
                    menu_id=menu_id,
                    food_item_id=food.id,
                    price=float(it["price"]),
                    display_order=idx,
                    is_available=True,
                    name=it["name"].strip(),
                    currency="VND",
                    image_url=it["image_url"],
                    category=it["category_name"],
                    description=it["description"],
                )
                session.add(menu_item)
                created_item_count += 1
            else:
                menu_item.price = float(it["price"])
                menu_item.display_order = idx
                menu_item.is_available = True
                menu_item.name = it["name"].strip()
                menu_item.image_url = it["image_url"]
                menu_item.category = it["category_name"]
                menu_item.description = it["description"]
                updated_item_count += 1

        await session.commit()
        print("\n" + "=" * 60)
        print(f"[THÀNH CÔNG] Đã đồng bộ toàn bộ {len(items)} món ăn:")
        print(f" - Bảng food_items: {created_food_count} món tạo mới, {updated_food_count} món cập nhật.")
        print(f" - Bảng menu_items (Menu: {menu.name}): {created_item_count} món liên kết mới, {updated_item_count} món cập nhật.")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed_room_service_menu())
