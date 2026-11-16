import os
import re
import logging
from typing import Dict, Any, List
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.hotel import Hotel, Floor, Room

logger = logging.getLogger(__name__)


def parse_rooms_from_rag_files(vault_dir: str = None) -> List[Dict[str, Any]]:
    """
    Phân tích file RAG hotel_facilities_floor_layout_rag.md hoặc _vi.md
    để trích xuất danh sách các phòng hợp lệ của khách sạn.

    Quy tắc nghiệp vụ:
    - Tầng 3 (FLR-03): Phòng 301 đến 310 (Standard Guest Rooms / Phòng Tiêu Chuẩn)
    - Tầng 4 (FLR-04): Phòng 401 đến 410 (Deluxe Guest Rooms / Phòng Cao Cấp)
    """
    base_dir = vault_dir or getattr(settings, 'resolved_obsidian_vault_dir', settings.OBSIDIAN_VAULT_DIR)
    rag_en_path = os.path.join(base_dir, "hotel_facilities_floor_layout_rag.md")
    rag_vi_path = os.path.join(base_dir, "hotel_facilities_floor_layout_vi.md")

    target_path = rag_en_path if os.path.exists(rag_en_path) else rag_vi_path

    # Danh sách chuẩn phòng 301-310 và 401-410
    floor3_rooms = [str(r) for r in range(301, 311)]
    floor4_rooms = [str(r) for r in range(401, 411)]

    if os.path.exists(target_path):
        try:
            with open(target_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()

            matches_3xx = re.findall(r"\b(30[1-9]|31[0-9])\b", content)
            if matches_3xx:
                floor3_rooms = sorted(list(set(matches_3xx)))

            matches_4xx = re.findall(r"\b(40[1-9]|41[0-9])\b", content)
            if matches_4xx:
                floor4_rooms = sorted(list(set(matches_4xx)))
        except Exception as e:
            logger.warning(f"Không thể đọc file RAG để bóc tách phòng ({e}), sử dụng cấu hình mặc định 301-310, 401-410")

    result = []
    for rn in floor3_rooms:
        result.append({
            "room_number": rn,
            "floor_id": "FLR-03",
            "room_type": "Phòng Tiêu Chuẩn (Standard)",
            "floor_number": 3,
            "floor_name": "Tầng 3 - Phòng nghỉ (301-310)",
        })
    for rn in floor4_rooms:
        result.append({
            "room_number": rn,
            "floor_id": "FLR-04",
            "room_type": "Phòng Tiêu Chuẩn (Standard)",
            "floor_number": 4,
            "floor_name": "Tầng 4 - Phòng nghỉ (401-410)",
        })
    return result


async def sync_rooms_with_rag(db: AsyncSession) -> Dict[str, Any]:
    """
    Đồng bộ danh sách phòng trong CSDL PostgreSQL với file RAG hệ thống (301-310, 401-410):
    1. Đảm bảo Hotel tồn tại.
    2. Đảm bảo Floors (FLR-03, FLR-04) tồn tại.
    3. Thêm mới / cập nhật các phòng 301-310 và 401-410 (giữ nguyên thông tin check-in nếu có).
    4. Dọn sạch các phòng rác/giả lập không có trong file RAG (unlinking foreign keys trước khi xóa).
    """
    rooms_config = parse_rooms_from_rag_files()
    valid_room_numbers = {r["room_number"] for r in rooms_config}

    # 1. Đảm bảo Hotel tồn tại
    hotel_res = await db.execute(select(Hotel).limit(1))
    hotel = hotel_res.scalars().first()
    if not hotel:
        hotel = Hotel(
            id="HTL-MAIN",
            name="Aurora Grand Hotel",
            address="123 Vo Nguyen Giap, Da Nang",
            phone="02363999999",
            email="contact@aurorahotel.com",
        )
        db.add(hotel)
        await db.flush()

    hotel_id = hotel.id

    # 2. Đảm bảo Floors FLR-03 và FLR-04 tồn tại
    for flr_id, num, name in [
        ("FLR-03", 3, "Tầng 3 - Phòng nghỉ (301-310)"),
        ("FLR-04", 4, "Tầng 4 - Phòng nghỉ (401-410)"),
    ]:
        flr_res = await db.execute(select(Floor).where(Floor.id == flr_id))
        flr = flr_res.scalars().first()
        if not flr:
            new_flr = Floor(
                id=flr_id,
                hotel_id=hotel_id,
                floor_number=num,
                name=name,
                description=f"Khu vực phòng lưu trú {name}",
            )
            db.add(new_flr)
        else:
            flr.name = name
    await db.flush()

    # 3. Lấy tất cả phòng hiện có trong CSDL
    existing_rooms_res = await db.execute(select(Room))
    existing_rooms = {r.room_number: r for r in existing_rooms_res.scalars().all()}

    created_count = 0
    updated_count = 0

    for cfg in rooms_config:
        rn = cfg["room_number"]
        if rn in existing_rooms:
            room = existing_rooms[rn]
            room.floor_id = cfg["floor_id"]
            room.room_type = cfg["room_type"]
            room.hotel_id = hotel_id
            if not room.tag_code:
                room.tag_code = f"TAG-{rn}"
            # Chuẩn hóa mã PIN: Chỉ giữ đúng 4 số cuối (tạo từ 4 số cuối CCCD), loại bỏ mã PIN 6 số cũ nếu có
            if room.pin_code:
                clean_pin = room.pin_code.strip()
                if len(clean_pin) > 4:
                    room.pin_code = clean_pin[-4:]
            updated_count += 1
        else:
            new_room = Room(
                id=f"ROOM-{rn}",
                hotel_id=hotel_id,
                floor_id=cfg["floor_id"],
                room_number=rn,
                room_type=cfg["room_type"],
                status="AVAILABLE",
                tag_code=f"TAG-{rn}",
            )
            db.add(new_room)
            created_count += 1

    # 4. Xóa / dọn dẹp các phòng cũ không nằm trong danh sách RAG (105, 201, 300, 502, 603, Txxx)
    obsolete_rooms = [r for rn, r in existing_rooms.items() if rn not in valid_room_numbers]
    deleted_count = 0
    if obsolete_rooms:
        obsolete_ids = [r.id for r in obsolete_rooms]
        await db.execute(
            text("UPDATE support_requests SET room_id = NULL WHERE room_id = ANY(:ids)"),
            {"ids": obsolete_ids},
        )
        await db.execute(
            text("UPDATE room_service_orders SET room_id = NULL WHERE room_id = ANY(:ids)"),
            {"ids": obsolete_ids},
        )
        for obs_room in obsolete_rooms:
            await db.delete(obs_room)
            deleted_count += 1

    await db.commit()
    logger.info(
        f"Đồng bộ phòng RAG thành công: {created_count} tạo mới, {updated_count} cập nhật, {deleted_count} dọn dẹp phòng cũ."
    )
    return {
        "status": "success",
        "total_rooms": len(rooms_config),
        "created": created_count,
        "updated": updated_count,
        "deleted_obsolete": deleted_count,
        "rooms": sorted(list(valid_room_numbers)),
    }

