import pytest
from app.services.ai.session_manager import extract_room_number
from app.services.ai.ai_chat_service import process_chat_request, ChatRequest
from app.core.database import get_db

def test_extract_room_number_spoken_vietnamese():
    # Digits
    assert extract_room_number("order đồ ăn vô phòng 301") == "301"
    assert extract_room_number("Tôi muốn order đồ ăn lên phòng 301") == "301"
    assert extract_room_number("đặt món vào phòng 402") == "402"
    assert extract_room_number("cho phòng 503") == "503"

    # Spoken Vietnamese words
    assert extract_room_number("Tôi muốn order đồ ăn lên phòng ba lẻ một") == "301"
    assert extract_room_number("Tôi muốn order đồ ăn lên phòng ba lẻ 1") == "301"
    assert extract_room_number("order đồ ăn lên phòng 3 lẻ 1") == "301"
    assert extract_room_number("vô phòng ba không một") == "301"
    assert extract_room_number("phòng ba trăm lẻ một") == "301"
    assert extract_room_number("đặt dịch vụ lên phòng bốn lẻ hai") == "402"
    assert extract_room_number("phòng năm lẻ ba") == "503"

@pytest.mark.asyncio
async def test_food_menu_prefills_room_number_in_chat_response():
    async for db in get_db():
        # Test case 1: Spoken digits
        req1 = ChatRequest(prompt="order đồ ăn vô phòng 301", session_id="test_sess_food_1")
        res1 = await process_chat_request(db, req1)
        assert res1.action == "open_food_menu"
        assert res1.current_room_number == "301"
        assert res1.target_room_number == "301"
        assert res1.trigger_menu == "food_menu"
        assert "301" in res1.response

        # Test case 2: Spoken words
        req2 = ChatRequest(prompt="Tôi muốn order đồ ăn lên phòng ba lẻ một", session_id="test_sess_food_2")
        res2 = await process_chat_request(db, req2)
        assert res2.action == "open_food_menu"
        assert res2.current_room_number == "301"
        assert res2.target_room_number == "301"
        assert res2.trigger_menu == "food_menu"
        assert "301" in res2.response
        break

