import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.core.database import AsyncSessionLocal
from app.models.hotel import Room


@pytest.mark.asyncio
async def test_checkin_identity_number_digits_only_validation():
    """
    Kiem tra validation truong identity_number (CCCD / Ho chieu) o Reception Check-in:
    1. Chi chap nhan chuoi chi chua chu so (0-9).
    2. Tu choi (HTTP 400) khi nhap chu hoac ky tu dac biet.
    3. Tu choi (HTTP 400) khi so luong chu so it hon 4.
    """
    test_room_num = "302"
    async with AsyncSessionLocal() as db:
        stmt = select(Room).where(Room.room_number == test_room_num)
        res = await db.execute(stmt)
        room = res.scalars().first()
        assert room is not None
        room_id = room.id
        room.status = "AVAILABLE"
        room.current_guest_name = None
        room.pin_code = None
        room.identity_number = None
        await db.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Nhap chu vao truong CCCD / Ho chieu -> Bi tu choi 400 hoac 422
        res_letters = await ac.post(f"/api/v1/operations/rooms/{room_id}/check-in", json={
            "guest_name": "Test Guest",
            "identity_number": "CCCD12345ABC",
        })
        assert res_letters.status_code in (400, 422)
        assert "chữ số" in str(res_letters.json())

        # 2. Nhap ky tu dac biet -> Bi tu choi 400 hoac 422
        res_special = await ac.post(f"/api/v1/operations/rooms/{room_id}/check-in", json={
            "guest_name": "Test Guest",
            "identity_number": "123-456-789",
        })
        assert res_special.status_code in (400, 422)

        # 3. Nhap it hon 4 chu so -> Bi tu choi 400 hoac 422
        res_short = await ac.post(f"/api/v1/operations/rooms/{room_id}/check-in", json={
            "guest_name": "Test Guest",
            "identity_number": "123",
        })
        assert res_short.status_code in (400, 422)
        assert "4 chữ số" in str(res_short.json())

        # 4. Nhap chu so hop le (12 so CCCD chuan) -> Thanh cong 200 va ma PIN tu sinh tu 4 so cuoi
        res_valid = await ac.post(f"/api/v1/operations/rooms/{room_id}/check-in", json={
            "guest_name": "Nguyen Van B",
            "identity_number": "079201019988",
        })
        assert res_valid.status_code == 200
        data = res_valid.json()
        assert data["pin_code"] == "9988"
        assert data["status"] == "OCCUPIED"

