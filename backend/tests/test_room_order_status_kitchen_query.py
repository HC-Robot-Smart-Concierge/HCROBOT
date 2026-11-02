import pytest
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.hotel import Room
from app.models.room_service import RoomServiceOrder, OrderItem
from app.schemas.ai import ChatRequest
from app.services.ai.ai_chat_service import process_chat_request
from app.services.ai.session_manager import session_manager


@pytest.mark.asyncio
async def test_no_pins_exceed_4_digits_in_database():
    """Đảm bảo trong database không còn bất kỳ phòng nào lưu mã PIN vượt quá 4 số."""
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Room))
        rooms = res.scalars().all()
        for r in rooms:
            if r.pin_code:
                assert len(r.pin_code) == 4, f"Phòng {r.room_number} có PIN {r.pin_code} không đúng 4 số"


@pytest.mark.asyncio
async def test_order_status_inquiry_requires_room_and_no_map():
    """Khi khách hỏi món ăn xong chưa: phải hỏi số phòng, action='query_order_status', không trả destination_key."""
    sid = "test_kitchen_inquiry_step1"
    session_manager.reset_session(sid)

    async with AsyncSessionLocal() as db:
        req = ChatRequest(prompt="món ăn của tôi xong chưa", session_id=sid, language="Tiếng Việt")
        res = await process_chat_request(db, req)

        assert res.action == "query_order_status"
        assert res.missing_room_number is True
        assert res.destination_key is None
        assert "phòng bao nhiêu" in res.response or "số phòng" in res.response


@pytest.mark.asyncio
async def test_order_status_kitchen_progress_reporting():
    """Khi khách trả lời số phòng có đơn trong bếp: báo đúng tiến độ chế biến, không chỉ đường lên phòng."""
    sid = "test_kitchen_inquiry_step2"
    session_manager.reset_session(sid)

    async with AsyncSessionLocal() as db:
        # Đảm bảo phòng 305 ở trạng thái OCCUPIED
        res_r = await db.execute(select(Room).where(Room.room_number == "305"))
        room_305 = res_r.scalars().first()
        prev_status = room_305.status if room_305 else "AVAILABLE"
        if room_305:
            room_305.status = "OCCUPIED"
            room_305.current_guest_name = "Khách Test"

        # Chuẩn bị dữ liệu đơn bếp (order_number <= 20 ký tự)
        ord = RoomServiceOrder(
            order_number="ORD-KIT-305",
            room_number="305",
            status="Cooking",
            total_amount=120000
        )
        db.add(ord)
        await db.flush()
        item = OrderItem(order_id=ord.id, item_name="Sake chiên giòn", quantity=1, unit_price=120000)
        db.add(item)
        await db.commit()

        try:
            # Lượt 1: Hỏi tiến độ
            await process_chat_request(db, ChatRequest(prompt="đồ ăn tới đâu rồi", session_id=sid, language="Tiếng Việt"))
            # Lượt 2: Trả lời phòng 305
            res2 = await process_chat_request(db, ChatRequest(prompt="Phòng 305", session_id=sid, language="Tiếng Việt"))

            assert res2.action == "query_order_status"
            assert res2.destination_key is None
            assert res2.missing_room_number is False
            assert "đầu bếp trực tiếp chế biến" in res2.response or "chế biến" in res2.response
            assert "305" in res2.response
        finally:
            await db.delete(item)
            await db.delete(ord)
            if room_305:
                room_305.status = prev_status
                if prev_status == "AVAILABLE":
                    room_305.current_guest_name = None
            await db.commit()


@pytest.mark.asyncio
async def test_order_status_when_no_active_kitchen_order():
    """Khi phòng không có đơn trong bếp: thông báo không có đơn, không đọc SupportRequest."""
    sid = "test_kitchen_inquiry_no_order"
    session_manager.reset_session(sid)

    async with AsyncSessionLocal() as db:
        res_r = await db.execute(select(Room).where(Room.room_number == "401"))
        room_401 = res_r.scalars().first()
        prev_status = room_401.status if room_401 else "AVAILABLE"
        if room_401:
            room_401.status = "OCCUPIED"
            room_401.current_guest_name = "Khách Test 401"
            await db.commit()

        try:
            await process_chat_request(db, ChatRequest(prompt="kiểm tra món ăn", session_id=sid, language="Tiếng Việt"))
            res = await process_chat_request(db, ChatRequest(prompt="401", session_id=sid, language="Tiếng Việt"))

            assert res.action == "query_order_status"
            assert res.destination_key is None
            assert "không có đơn đặt món nào trong nhà bếp" in res.response or "không có đơn đặt món" in res.response
        finally:
            if room_401:
                room_401.status = prev_status
                if prev_status == "AVAILABLE":
                    room_401.current_guest_name = None
                await db.commit()


@pytest.mark.asyncio
async def test_massage_and_drinks_status_queries():
    """Kiểm tra câu hỏi 'mát xa đã tới phòng chưa' và 'nước uống đã tới phòng chưa' nhận diện đúng query_order_status."""
    sid_massage = "test_massage_inquiry"
    session_manager.reset_session(sid_massage)

    async with AsyncSessionLocal() as db:
        # 1. Mát xa đã tới phòng chưa -> action == query_order_status, type == service
        res_massage = await process_chat_request(db, ChatRequest(prompt="mát xa đã tới phòng chưa", session_id=sid_massage, language="Tiếng Việt"))
        assert res_massage.action == "query_order_status"
        assert res_massage.missing_room_number is True
        assert res_massage.status_query_type == "service"
        assert res_massage.destination_key is None

        # 2. Nước uống đã tới phòng chưa -> action == query_order_status, type == food
        sid_drink = "test_drink_inquiry"
        session_manager.reset_session(sid_drink)
        res_drink = await process_chat_request(db, ChatRequest(prompt="nước uống đã tới phòng chưa", session_id=sid_drink, language="Tiếng Việt"))
        assert res_drink.action == "query_order_status"
        assert res_drink.missing_room_number is True
        assert res_drink.status_query_type == "food"
        assert res_drink.destination_key is None
