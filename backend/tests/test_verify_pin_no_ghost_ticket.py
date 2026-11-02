import pytest
from sqlalchemy import select, func
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import AsyncSessionLocal
from app.models.hotel import Room
from app.models.support_request import SupportRequest


@pytest.mark.asyncio
async def test_verify_pin_skip_ticket_creation_prevents_duplicate_requests():
    """Đảm bảo khi verify PIN với cờ skip_ticket_creation hoặc action verify_only, hệ thống không tạo SupportRequest ma."""
    test_room_num = "302"
    async with AsyncSessionLocal() as db:
        stmt = select(Room).where(Room.room_number == test_room_num)
        res = await db.execute(stmt)
        room = res.scalars().first()
        assert room is not None
        room.status = "OCCUPIED"
        room.current_guest_name = "Kha Test"
        room.pin_code = "1234"
        await db.commit()

        # Đếm số ticket trước khi verify
        count_stmt = select(func.count()).select_from(SupportRequest).where(SupportRequest.room_number == test_room_num)
        count_before = (await db.execute(count_stmt)).scalar() or 0

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Case 1: Kiosk Food Menu verify PIN trước khi submit order
        res1 = await ac.post("/api/v1/operations/rooms/verify-pin", json={
            "room_number": test_room_num,
            "pin": "1234",
            "action": "verify_only",
            "skip_ticket_creation": True,
            "items": "1x Sake chiên giòn",
        })
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["verified"] is True
        assert data1["ticket_code"] is None

        # Case 2: Kiosk Room Service Menu với action room_service và skip_ticket_creation=True
        res2 = await ac.post("/api/v1/operations/rooms/verify-pin", json={
            "room_number": test_room_num,
            "pin": "1234",
            "action": "room_service",
            "skip_ticket_creation": True,
            "items": "2x Khăn tắm",
        })
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["verified"] is True
        assert data2["ticket_code"] is None

    # Kiểm tra trong DB: Tuyệt đối không sinh thêm SupportRequest rác
    async with AsyncSessionLocal() as db:
        count_stmt = select(func.count()).select_from(SupportRequest).where(SupportRequest.room_number == test_room_num)
        count_after = (await db.execute(count_stmt)).scalar() or 0
        assert count_after == count_before, "Số lượng ticket không được tăng lên khi verify PIN có cờ skip_ticket_creation"
