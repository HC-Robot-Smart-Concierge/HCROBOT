import pytest
import random
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.core.database import AsyncSessionLocal
from app.models.hotel import Hotel, Floor, Room
from app.services.rag.room_sync_service import parse_rooms_from_rag_files, sync_rooms_with_rag


@pytest.mark.asyncio
async def test_parse_rooms_from_rag_files():
    """Kiểm tra hàm parse_rooms_from_rag_files trích xuất chuẩn 301-310 và 401-410."""
    rooms = parse_rooms_from_rag_files()
    assert len(rooms) == 20

    room_numbers = [r["room_number"] for r in rooms]
    expected_floor3 = [str(r) for r in range(301, 311)]
    expected_floor4 = [str(r) for r in range(401, 411)]

    for r3 in expected_floor3:
        assert r3 in room_numbers
    for r4 in expected_floor4:
        assert r4 in room_numbers

    # Kiểm tra floor_id
    floor3_items = [r for r in rooms if r["room_number"].startswith("3")]
    floor4_items = [r for r in rooms if r["room_number"].startswith("4")]
    assert all(r["floor_id"] == "FLR-03" for r in floor3_items)
    assert all(r["floor_id"] == "FLR-04" for r in floor4_items)


@pytest.mark.asyncio
async def test_sync_rooms_with_rag_in_db():
    """Kiểm tra đồng bộ CSDL với file RAG mà không cần seed script."""
    async with AsyncSessionLocal() as db:
        # Thêm 1 phòng rác bất kỳ để kiểm tra cơ chế tự động dọn dẹp
        dummy_num = "999"
        dummy_room = Room(
            id=f"ROOM-{dummy_num}",
            hotel_id="HTL-MAIN",
            room_number=dummy_num,
            status="AVAILABLE",
        )
        db.add(dummy_room)
        await db.commit()

        # Thực thi sync
        res = await sync_rooms_with_rag(db)
        assert res["status"] == "success"
        assert res["total_rooms"] == 20

        # Kiểm tra CSDL sau sync: Chỉ còn đúng 20 phòng 301-310 và 401-410
        rooms_stmt = select(Room).order_by(Room.room_number)
        db_rooms = (await db.execute(rooms_stmt)).scalars().all()
        assert len(db_rooms) == 20
        room_nums = [r.room_number for r in db_rooms]
        assert "999" not in room_nums
        assert all(str(n) in room_nums for n in range(301, 311))
        assert all(str(n) in room_nums for n in range(401, 411))


@pytest.mark.asyncio
async def test_api_reception_rooms_and_sync_rag():
    """Kiểm tra API /api/v1/operations/rooms trả về đúng 20 phòng chuẩn."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Gọi endpoint sync-rag
        sync_res = await ac.post("/api/v1/operations/rooms/sync-rag")
        assert sync_res.status_code == 200
        sync_data = sync_res.json()
        assert sync_data["message"] == "Đồng bộ phòng từ file RAG thành công!"

        # 2. Gọi GET /api/v1/operations/rooms
        get_res = await ac.get("/api/v1/operations/rooms")
        assert get_res.status_code == 200
        rooms = get_res.json()
        assert len(rooms) == 20

        room_map = {r["room_number"]: r for r in rooms}
        assert "301" in room_map
        assert "310" in room_map
        assert "401" in room_map
        assert "410" in room_map

        # Kiểm tra hiển thị floor: Tầng 3 và Tầng 4
        assert room_map["305"]["floor"] == "Tầng 3"
        assert room_map["405"]["floor"] == "Tầng 4"

