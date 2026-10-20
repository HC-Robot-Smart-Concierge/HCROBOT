import pytest
from unittest.mock import AsyncMock, patch
from app.services.ai.session_manager import session_manager, extract_room_number
from app.services.ai.concierge_graph import concierge_graph, intent_router_node, service_fsm_node
from app.services.ai.ai_ticket_service import auto_create_ticket, background_extract_and_create_ticket


def test_extract_room_number():
    """Kiểm tra bóc tách số phòng đa dạng các trường hợp."""
    # 1. Câu trả lời số phòng trực tiếp / ngắn gọn
    assert extract_room_number("402") == "402"
    assert extract_room_number("dạ 402") == "402"
    assert extract_room_number("402 ạ") == "402"
    assert extract_room_number("402 em") == "402"
    assert extract_room_number("dạ 402 ạ") == "402"
    assert extract_room_number("402 nha em") == "402"
    assert extract_room_number("là 402") == "402"

    # 2. Tiền tố 'phòng', 'p.', 'room', 'số phòng'
    assert extract_room_number("phòng 305") == "305"
    assert extract_room_number("phong 305") == "305"
    assert extract_room_number("p.502") == "502"
    assert extract_room_number("p402") == "402"
    assert extract_room_number("room 405") == "405"
    assert extract_room_number("số phòng của tôi là 402") == "402"
    assert extract_room_number("phòng em là 301") == "301"

    # 3. Mẫu khẳng định nơi ở
    assert extract_room_number("tôi ở phòng 402") == "402"
    assert extract_room_number("anh ở 402") == "402"
    assert extract_room_number("chị ở 305 em ơi") == "305"
    assert extract_room_number("em ở phòng 408") == "408"
    assert extract_room_number("mình ở 501") == "501"
    assert extract_room_number("i am in room 402") == "402"

    # 4. Lồng ghép trong câu yêu cầu dịch vụ
    assert extract_room_number("cho anh 2 khăn tắm phòng 402") == "402"
    assert extract_room_number("phòng 301 điều hòa bị hỏng") == "301"
    assert extract_room_number("mang cho tôi 1 đĩa cơm lên phòng 502") == "502"

    # 5. Các trường hợp không phải số phòng
    assert extract_room_number("12 giờ trưa") is None
    assert extract_room_number("khách sạn thành lập năm 2026") is None
    assert extract_room_number("xin chào robot") is None


def test_session_memory_room_persistence():
    """Kiểm tra session_manager ghi nhớ số phòng và pending intent suốt phiên."""
    sid = "test_persistence_session_99"
    session_manager.reset_session(sid)

    # Ban đầu chưa có số phòng
    assert session_manager.get_room_number(sid) is None

    # Lưu số phòng 402
    session_manager.set_room_number(sid, "402")
    assert session_manager.get_room_number(sid) == "402"

    # Lưu pending intent
    session_manager.set_pending_intent(sid, {"action": "housekeeping", "items": "2 khăn tắm"})
    pending = session_manager.get_pending_intent(sid)
    assert pending is not None
    assert pending["action"] == "housekeeping"
    assert pending["items"] == "2 khăn tắm"

    # Số phòng vẫn được giữ nguyên
    assert session_manager.get_room_number(sid) == "402"

    # Xóa pending intent
    session_manager.clear_pending_intent(sid)
    assert session_manager.get_pending_intent(sid) is None
    # Số phòng vẫn nguyên vẹn
    assert session_manager.get_room_number(sid) == "402"

    session_manager.reset_session(sid)
    assert session_manager.get_room_number(sid) is None


@pytest.mark.asyncio
async def test_multi_turn_service_flow():
    """
    Kiểm tra trọn vẹn luồng tương tác đa lượt (Multi-turn):
    - Lượt 1: Khách yêu cầu dịch vụ không kèm số phòng -> Robot hỏi số phòng.
    - Lượt 2: Khách cung cấp số phòng -> Robot ghi nhớ số phòng vào session và xác nhận yêu cầu.
    - Lượt 3: Khách yêu cầu dịch vụ khác -> Robot đã nhớ số phòng, không hỏi lại nữa.
    """
    sid = "multi_turn_session_test_01"
    session_manager.reset_session(sid)

    # --- LƯỢT 1: Yêu cầu khăn tắm, chưa có số phòng ---
    state_turn1 = {
        "session_id": sid,
        "prompt": "Cho anh xin 2 cái khăn tắm",
        "room_number": None,
        "chat_history": [],
    }
    config = {"configurable": {"thread_id": sid}}
    res_turn1 = await concierge_graph.ainvoke(state_turn1, config=config)

    # Robot phải nhận diện intent housekeeping và hỏi số phòng
    assert res_turn1["missing_room_number"] is True
    assert "số phòng" in res_turn1["response"].lower()
    # Kiểm tra pending intent đã được lưu vào session_manager
    pending = session_manager.get_pending_intent(sid)
    assert pending is not None
    assert pending["action"] == "housekeeping"
    assert "khăn tắm" in pending["items"]

    # --- LƯỢT 2: Khách trả lời số phòng "402" ---
    state_turn2 = {
        "session_id": sid,
        "prompt": "402 nha em",
        "room_number": None,  # Client chưa kịp cập nhật, harness tự lấy từ session
        "chat_history": [],
    }
    res_turn2 = await concierge_graph.ainvoke(state_turn2, config=config)

    # Session phải được lưu số phòng 402
    assert session_manager.get_room_number(sid) == "402"
    # Robot phải xác nhận dịch vụ cho phòng 402
    assert res_turn2["missing_room_number"] is False
    assert "402" in res_turn2["response"]
    assert "buồng phòng" in res_turn2["response"].lower() or "housekeeping" in res_turn2["response"].lower()
    # Pending intent phải được xóa sạch sau khi giải quyết
    assert session_manager.get_pending_intent(sid) is None

    # --- LƯỢT 3: Khách tiếp tục yêu cầu đồ ăn trong cùng session ---
    # Robot ĐÃ NHỚ phòng 402, không được hỏi lại số phòng nữa!
    state_turn3 = {
        "session_id": sid,
        "prompt": "Mang cho anh 1 đĩa cơm chiên hải sản",
        "room_number": session_manager.get_room_number(sid),
        "chat_history": [],
    }
    res_turn3 = await concierge_graph.ainvoke(state_turn3, config=config)

    assert res_turn3["missing_room_number"] is False
    assert "402" in res_turn3["response"]
    assert "ẩm thực" in res_turn3["response"].lower() or "f&b" in res_turn3["response"].lower() or "room service" in res_turn3["response"].lower()
    assert "số phòng của mình là bao nhiêu" not in res_turn3["response"].lower()

    session_manager.reset_session(sid)


@pytest.mark.asyncio
async def test_direct_service_with_room():
    """Kiểm tra khách đưa luôn số phòng trong câu đầu tiên: 'Cho anh 2 chai nước lên phòng 304'."""
    sid = "direct_room_session_02"
    session_manager.reset_session(sid)

    state = {
        "session_id": sid,
        "prompt": "Cho anh 2 chai nước lên phòng 304",
        "room_number": None,
        "chat_history": [],
    }
    config = {"configurable": {"thread_id": sid}}
    res = await concierge_graph.ainvoke(state, config=config)

    assert session_manager.get_room_number(sid) == "304"
    assert res["missing_room_number"] is False
    assert "304" in res["response"]

    session_manager.reset_session(sid)


@pytest.mark.asyncio
async def test_ticket_creation_validation():
    """Kiểm tra auto_create_ticket không được tạo ticket khi thiếu số phòng."""
    # Khi không có room_number -> Bắt buộc bỏ qua, không tạo ticket rác hay gán số phòng giả
    code_no_room = await auto_create_ticket(None, "housekeeping", "", "2 khăn tắm")
    assert code_no_room == ""

    code_none_room = await auto_create_ticket(None, "housekeeping", None, "2 khăn tắm")
    assert code_none_room == ""


@pytest.mark.asyncio
async def test_cancel_service_flow():
    """Kiểm tra luồng HỦY YÊU CẦU: Khách yêu cầu hủy -> hỏi số phòng nếu thiếu, xác nhận nếu đã có."""
    sid = "cancel_service_test_session"
    session_manager.reset_session(sid)
    config = {"configurable": {"thread_id": sid}}

    # Lượt 1: Chưa có số phòng mà đòi hủy -> Robot phải hỏi số phòng
    res1 = await concierge_graph.ainvoke({
        "session_id": sid,
        "prompt": "Hủy yêu cầu giúp anh",
        "room_number": None,
        "chat_history": [],
    }, config=config)

    assert res1["missing_room_number"] is True
    assert "số phòng" in res1["response"].lower()
    assert session_manager.get_pending_intent(sid)["action"] == "cancel_service"

    # Lượt 2: Cung cấp số phòng 502 -> Robot giải quyết yêu cầu hủy cho phòng 502
    res2 = await concierge_graph.ainvoke({
        "session_id": sid,
        "prompt": "Phòng 502 em ơi",
        "room_number": None,
        "chat_history": [],
    }, config=config)

    assert res2["missing_room_number"] is False
    assert "502" in res2["response"]
    assert "hủy" in res2["response"].lower()

    session_manager.reset_session(sid)


@pytest.mark.asyncio
async def test_laundry_and_wake_up_flow():
    """Kiểm tra dịch vụ Giặt ủi và Báo thức bắt buộc hỏi số phòng."""
    sid = "laundry_wakeup_test_session"
    session_manager.reset_session(sid)
    config = {"configurable": {"thread_id": sid}}

    # Giặt ủi chưa có phòng
    res_laundry = await concierge_graph.ainvoke({
        "session_id": sid,
        "prompt": "Lấy đồ giặt ủi giúp anh",
        "room_number": None,
        "chat_history": [],
    }, config=config)
    assert res_laundry["missing_room_number"] is True
    assert "số phòng" in res_laundry["response"].lower()

    # Báo thức chưa có phòng
    session_manager.reset_session(sid)
    res_wakeup = await concierge_graph.ainvoke({
        "session_id": sid,
        "prompt": "Đặt báo thức cho anh lúc 7h sáng",
        "room_number": None,
        "chat_history": [],
    }, config=config)
    assert res_wakeup["missing_room_number"] is True
    assert "số phòng" in res_wakeup["response"].lower()

    session_manager.reset_session(sid)


@pytest.mark.asyncio
async def test_faq_menu_protection_does_not_ask_room():
    """Kiểm tra câu hỏi thông tin FAQ (thực đơn, menu, giá, wifi, bể bơi) TUYỆT ĐỐI KHÔNG ĐƯỢC HỎI SỐ PHÒNG."""
    sid = "faq_no_room_test_session"
    session_manager.reset_session(sid)
    config = {"configurable": {"thread_id": sid}}

    prompts = [
        "Thực đơn có những món gì?",
        "Menu gồm những gì em ơi?",
        "Hồ bơi ở tầng mấy?",
        "Mật khẩu wifi là gì?",
        "Giá phòng một đêm bao nhiêu?",
    ]

    for p in prompts:
        res = await concierge_graph.ainvoke({
            "session_id": sid,
            "prompt": p,
            "room_number": None,
            "chat_history": [],
        }, config=config)

        # Tuyệt đối không được đánh dấu là missing_room_number hay đòi hỏi số phòng
        assert res.get("missing_room_number", False) is False, f"Prompt '{p}' should not require room number!"
        assert "số phòng của mình là bao nhiêu" not in res["response"].lower(), f"Prompt '{p}' should not ask room number!"

    session_manager.reset_session(sid)

