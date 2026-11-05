import pytest
from sqlalchemy import select
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import AsyncSessionLocal
from app.models.hotel import Room


@pytest.mark.asyncio
async def test_room_checkin_requires_cccd_and_generates_4_digit_pin_from_cccd():
    """Kiểm tra check-in bắt buộc CCCD và tự động tạo mã PIN 4 số từ 4 số cuối CCCD."""
    test_room_num = "305"
    async with AsyncSessionLocal() as db:
        stmt = select(Room).where(Room.room_number == test_room_num)
        res = await db.execute(stmt)
        room = res.scalars().first()
        assert room is not None, f"Phòng {test_room_num} phải tồn tại trong 20 phòng chuẩn RAG"
        room_id = room.id
        room.status = "AVAILABLE"
        room.current_guest_name = None
        room.pin_code = None
        if hasattr(room, 'identity_number'):
            room.identity_number = None
        await db.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Gọi xác thực khi phòng chưa check-in -> Bị từ chối và hướng dẫn qua quầy lễ tân
        uncheckin_res = await ac.post("/api/v1/operations/rooms/verify-pin", json={
            "room_number": test_room_num,
            "pin": "8899",
        })
        assert uncheckin_res.status_code == 400
        uncheckin_data = uncheckin_res.json()["detail"]
        assert uncheckin_data["not_checked_in"] is True
        assert uncheckin_data["destination_key"] == "front_desk"
        assert "Lễ tân để check-in" in uncheckin_data["message"]

        # 2. Check-in thiếu CCCD -> Bị từ chối 400
        fail_checkin_res = await ac.post(f"/api/v1/operations/rooms/{room_id}/check-in", json={
            "guest_name": "Nguyen Van A",
        })
        assert fail_checkin_res.status_code == 400
        assert "CCCD" in fail_checkin_res.json()["detail"]

        # 3. Check-in hợp lệ với CCCD 12 số -> Mã PIN tự động tạo bằng 4 số cuối CCCD
        test_cccd = "079201018899"
        checkin_res = await ac.post(f"/api/v1/operations/rooms/{room_id}/check-in", json={
            "guest_name": "Nguyen Van A",
            "identity_number": test_cccd,
        })
        assert checkin_res.status_code == 200
        checkin_data = checkin_res.json()
        pin_code = checkin_data.get("pin_code")
        assert pin_code == "8899"
        assert len(pin_code) == 4
        assert pin_code.isdigit()

        # 4. Xác thực bằng mã PIN 4 số vừa tạo từ CCCD -> Thành công
        verify_res = await ac.post("/api/v1/operations/rooms/verify-pin", json={
            "room_number": test_room_num,
            "pin": pin_code,
            "action": "room_service",
            "items": "2 Phở Bò Tái Nạm",
        })
        assert verify_res.status_code == 200
        verify_data = verify_res.json()
        assert verify_data["success"] is True
        assert verify_data["room_number"] == test_room_num

        # 5. Xác thực sai mã PIN -> Báo lỗi
        wrong_res = await ac.post("/api/v1/operations/rooms/verify-pin", json={
            "room_number": test_room_num,
            "pin": "0000",
        })
        assert wrong_res.status_code == 400
        assert "Mã PIN phòng không chính xác" in wrong_res.json()["detail"] or "4 số cuối CCCD" in wrong_res.json()["detail"]
