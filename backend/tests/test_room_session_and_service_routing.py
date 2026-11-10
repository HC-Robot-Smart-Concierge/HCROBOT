import pytest
from unittest.mock import AsyncMock, patch
from app.services.ai.session_manager import session_manager, extract_room_number
from app.services.ai.concierge_graph import concierge_graph, intent_router_node, service_fsm_node
from app.services.ai.ai_ticket_service import auto_create_ticket, background_extract_and_create_ticket
from app.core.database import AsyncSessionLocal
from app.models.hotel import Room
from sqlalchemy import select


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

    # --- LƯỢT 2: Khách trả lời số phòng "304" ---
    state_turn2 = {
        "session_id": sid,
        "prompt": "304 nha em",
        "room_number": None,  # Client chưa kịp cập nhật, harness tự lấy từ session
        "chat_history": [],
    }
    res_turn2 = await concierge_graph.ainvoke(state_turn2, config=config)

    # Session phải được lưu số phòng 304
    assert session_manager.get_room_number(sid) == "304"
    # Robot phải xác nhận dịch vụ cho phòng 304
    assert res_turn2["missing_room_number"] is False
    assert "304" in res_turn2["response"]
    assert "buồng phòng" in res_turn2["response"].lower() or "housekeeping" in res_turn2["response"].lower()
    # Pending intent phải được xóa sạch sau khi giải quyết
    assert session_manager.get_pending_intent(sid) is None

    # --- LƯỢT 3: Khách tiếp tục yêu cầu đồ ăn trong cùng session ---
    # Robot ĐÃ NHỚ phòng 304, không được hỏi lại số phòng nữa!
    state_turn3 = {
        "session_id": sid,
        "prompt": "Mang cho anh 1 đĩa cơm chiên hải sản",
        "room_number": session_manager.get_room_number(sid),
        "chat_history": [],
    }
    res_turn3 = await concierge_graph.ainvoke(state_turn3, config=config)

    assert res_turn3["missing_room_number"] is False
    assert "304" in res_turn3["response"]
    assert "ẩm thực" in res_turn3["response"].lower() or "f&b" in res_turn3["response"].lower() or "room service" in res_turn3["response"].lower() or "đặt món" in res_turn3["response"].lower() or "phục vụ" in res_turn3["response"].lower()
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
    async with AsyncSessionLocal() as db:
        res_r = await db.execute(select(Room).where(Room.room_number == "304"))
        r304 = res_r.scalars().first()
        if r304:
            r304.status = "OCCUPIED"
            await db.commit()

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
    assert "phòng" in res1["response"].lower()
    assert session_manager.get_pending_intent(sid)["action"] == "cancel_service"

    # Lượt 2: Cung cấp số phòng 304 (phòng hợp lệ trong RAG) -> Robot giải quyết yêu cầu hủy cho phòng 304
    res2 = await concierge_graph.ainvoke({
        "session_id": sid,
        "prompt": "Phòng 304 em ơi",
        "room_number": None,
        "chat_history": [],
    }, config=config)

    assert res2["missing_room_number"] is False
    assert "304" in res2["response"]
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



@pytest.mark.asyncio
async def test_query_order_status_without_pin_flow():
    """Kiểm tra luồng hỏi trạng thái món ăn/dịch vụ: Hỏi số phòng nếu chưa có, KHÔNG hỏi mã PIN và KHÔNG mở bản đồ."""
    sid = "test_query_order_status_session_99"
    session_manager.reset_session(sid)
    config = {"configurable": {"thread_id": sid}}

    # 1. Khách hỏi tiến độ món ăn nhưng CHƯA nói số phòng
    res1 = await concierge_graph.ainvoke({
        "session_id": sid,
        "prompt": "Món ăn của tôi làm tới đâu rồi em?",
        "room_number": None,
        "chat_history": [],
    }, config=config)

    assert res1["missing_room_number"] is True
    assert res1.get("require_room_pin", False) is False
    assert res1.get("destination_key") is None
    assert "phòng" in res1["response"].lower()

    # 2. Khách trả lời số phòng: "phòng 401"
    res2 = await concierge_graph.ainvoke({
        "session_id": sid,
        "prompt": "Phòng 401 nha em",
        "room_number": None,
        "chat_history": [],
    }, config=config)

    assert res2["missing_room_number"] is False
    assert res2.get("require_room_pin", False) is False
    assert res2.get("destination_key") is None
    assert "401" in res2["response"]

    session_manager.reset_session(sid)

    # 3. Khách hỏi thẳng kèm số phòng: "món ăn phòng 305 làm xong chưa?"
    res3 = await concierge_graph.ainvoke({
        "session_id": sid,
        "prompt": "Món ăn phòng 305 làm xong chưa em ơi?",
        "room_number": None,
        "chat_history": [],
    }, config=config)

    assert res3["missing_room_number"] is False
    assert res3.get("require_room_pin", False) is False
    assert res3.get("destination_key") is None
    assert "305" in res3["response"]

    session_manager.reset_session(sid)


@pytest.mark.asyncio
async def test_authenticated_room_session_skips_pin():
    """Kiểm tra khi phòng đã được xác thực mã PIN (is_room_authenticated=True): Robot nhận đơn ngay, require_room_pin=False."""
    sid = "test_auth_room_session_skips_pin"
    session_manager.reset_session(sid)
    config = {"configurable": {"thread_id": sid}}

    # Khách đã xác thực phòng 301 từ trước trong session
    res = await concierge_graph.ainvoke({
        "session_id": sid,
        "prompt": "Cho tôi thêm 2 cái khăn tắm",
        "room_number": "301",
        "is_room_authenticated": True,
        "chat_history": [],
    }, config=config)

    assert res["missing_room_number"] is False
    assert res.get("require_room_pin", False) is False
    assert "301" in res["response"]
    assert "tiếp nhận" in res["response"].lower() or "received" in res["response"].lower()

    session_manager.reset_session(sid)


@pytest.mark.asyncio
async def test_order_status_preserves_session_room_number_single_ask():
    """
    Kịch bản: Khách mới đặt món cho phòng 301.
    Sau khi đặt món xong, khách hỏi 'trạng thái món tới đâu'.
    Robot phải nhớ phòng 301 từ session, KHÔNG được hỏi lại số phòng lần 2.
    Sau khi trả lời, session vẫn phải lưu số phòng 301.
    """
    sid = "test_order_status_single_ask_session"
    session_manager.reset_session(sid)
    config = {"configurable": {"thread_id": sid}}

    # Giả lập: Khách vừa đặt món xong cho phòng 301 -> session đã có room_number 301
    session_manager.set_room_number(sid, "301")
    assert session_manager.get_room_number(sid) == "301"

    # Khách hỏi tiếp bằng giọng nói: "trạng thái món tới đâu" (câu hỏi không nhắc lại số 301)
    res = await concierge_graph.ainvoke({
        "session_id": sid,
        "prompt": "trạng thái món tới đâu rồi",
        "room_number": "301",
        "chat_history": [],
    }, config=config)

    # Robot KHÔNG được báo thiếu số phòng
    assert res.get("missing_room_number") is False, "Robot không được hỏi lại số phòng khi session đã có số phòng"
    assert res.get("room_number") == "301"
    assert "phòng bao nhiêu" not in res["response"].lower()
    assert "xin số phòng" not in res["response"].lower()

    # Session vẫn phải ghi nhớ số phòng 301 cho các câu hỏi tiếp theo
    assert session_manager.get_room_number(sid) == "301", "Session manager phải duy trì số phòng 301"

    session_manager.reset_session(sid)

@pytest.mark.asyncio
async def test_spa_wayfinding_does_not_trigger_room_service_or_ask_pin():
    """
    Kịch bản: Khách nói 'đi tới spa', 'chỉ đường tới spa', 'tôi muốn đi tới spa', 'đến spa'.
    Robot phải phân loại chính xác là Chỉ đường / Wayfinding (action='show_map', destination_key='spa'),
    TUYỆT ĐỐI KHÔNG mở Room Service menu, không hỏi xin số phòng và không bắt nhập mã PIN buồng phòng.
    """
    sid = "test_spa_wayfinding_session"
    session_manager.reset_session(sid)
    config = {"configurable": {"thread_id": sid}}

    prompts = [
        "đi tới spa",
        "tôi muốn đi tới spa",
        "chỉ đường tới spa",
        "đến spa",
        "tới spa",
        "spa ở đâu",
    ]

    for p in prompts:
        res = await concierge_graph.ainvoke({
            "session_id": sid,
            "prompt": p,
            "room_number": None,
            "chat_history": [],
        }, config=config)

        assert res.get("action") == "show_map", f"Prompt '{p}' phải có action='show_map', nhận được: {res.get('action')}"
        assert res.get("destination_key") == "spa", f"Prompt '{p}' phải có destination_key='spa', nhận được: {res.get('destination_key')}"
        assert res.get("missing_room_number") is not True, f"Prompt '{p}' không được yêu cầu số phòng"
        assert res.get("require_room_pin") is not True, f"Prompt '{p}' không được yêu cầu mã PIN"
        assert res.get("trigger_menu") != "room_service", f"Prompt '{p}' không được trigger room_service"
        assert "xin số phòng" not in (res.get("response") or "").lower()

    session_manager.reset_session(sid)

