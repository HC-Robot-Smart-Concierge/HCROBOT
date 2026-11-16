import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db, AsyncSessionLocal
from app.models.hotel import Room
from app.services.ai.concierge_graph import service_fsm_node, ConciergeState
from sqlalchemy import select


@pytest.mark.asyncio
async def test_maintenance_pin_verification_and_ticket_routing():
    await init_db()

    # Ensure a room exists for testing
    async with AsyncSessionLocal() as session:
        stmt = select(Room).where(Room.room_number == "301")
        res = await session.execute(stmt)
        room = res.scalars().first()
        if not room:
            room = Room(
                room_number="301",
                room_type="DELUXE",
                floor=3,
                status="OCCUPIED",
                pin_code="1234",
                current_guest_name="Test Guest",
            )
            session.add(room)
            await session.commit()
        else:
            room.status = "OCCUPIED"
            room.pin_code = "1234"
            await session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Verify PIN with skip_ticket_creation=True (used by UI screen before custom submit)
        res_skip = await ac.post(
            "/api/v1/operations/rooms/verify-pin",
            json={
                "room_number": "301",
                "pin": "1234",
                "action": "maintenance",
                "skip_ticket_creation": True,
            },
        )
        assert res_skip.status_code == 200
        data_skip = res_skip.json()
        assert data_skip["verified"] is True
        assert data_skip["room_number"] == "301"

        # 2. Verify PIN with ticket creation (used by Voice AI flow)
        res_create = await ac.post(
            "/api/v1/operations/rooms/verify-pin",
            json={
                "room_number": "301",
                "pin": "1234",
                "action": "maintenance",
                "items": "Hỏng điều hòa",
                "skip_ticket_creation": False,
            },
        )
        assert res_create.status_code == 200
        data_create = res_create.json()
        assert data_create["verified"] is True
        assert data_create["ticket_code"].startswith("MN-")


@pytest.mark.asyncio
async def test_maintenance_graph_pin_requirement_by_session():
    # Case A: Unauthenticated session -> requires room PIN
    state_unauth: ConciergeState = {
        "current_query": "tôi muốn báo sửa bóng đèn phòng 301",
        "prompt": "tôi muốn báo sửa bóng đèn phòng 301",
        "session_id": "sess_mnt_unauth",
        "language_code": "vi-VN",
        "action": "maintenance",
        "room_number": "301",
        "is_room_authenticated": False,
        "chat_history": [],
        "context": {},
    }
    res_unauth = await service_fsm_node(state_unauth)
    assert res_unauth.get("require_room_pin") is True
    assert "mã pin" in res_unauth.get("response", "").lower()

    # Case B: Authenticated session -> does NOT require room PIN
    state_auth: ConciergeState = {
        "current_query": "tôi muốn báo sửa bóng đèn phòng 301",
        "prompt": "tôi muốn báo sửa bóng đèn phòng 301",
        "session_id": "sess_mnt_auth",
        "language_code": "vi-VN",
        "action": "maintenance",
        "room_number": "301",
        "is_room_authenticated": True,
        "chat_history": [],
        "context": {},
    }
    res_auth = await service_fsm_node(state_auth)
    assert res_auth.get("require_room_pin") is False
    assert "tiếp nhận" in res_auth.get("response", "").lower() or "received" in res_auth.get("response", "").lower()

