import pytest
from app.services.ai.scenario_service import scenario_service
from app.models.support_request import SupportRequest
from app.schemas.operations import TaxiRequestCreate
from app.api.v1.endpoints.operations.taxi import _format_taxi_request


def test_scenario_service_taxi_fast_path_and_status_check_bypass():
    """
    Kiem tra Fast-Path cho yeu cau goi xe taxi:
    1. Cau hoi dat taxi thong thuong phai kich hoat action 'book_taxi' (hoac scn-airport-shuttle).
    2. Cau hoi tra cuu trang thai taxi ('kiem tra trang thai dat taxi', 'taxi toi chua')
       phai bypass qua Fast-Path goi xe de he thong tra cuu dung don.
    """
    # 1. Dat taxi thong thuong -> Fast-Path book_taxi
    match_booking = scenario_service.match_fast_path("Dat taxi giup toi", lang_code="vi-VN")
    assert match_booking is not None
    assert match_booking[3] == "book_taxi"

    # 2. Hoi trang thai taxi -> Phai bypass scn-airport-shuttle
    match_status1 = scenario_service.match_fast_path("Kiem tra trang thai dat taxi", lang_code="vi-VN")
    assert match_status1 is None or match_status1[3] != "book_taxi"

    match_status2 = scenario_service.match_fast_path("Taxi toi chua", lang_code="vi-VN")
    assert match_status2 is None or match_status2[3] != "book_taxi"

    match_status3 = scenario_service.match_fast_path("Da dat taxi chua vay", lang_code="vi-VN")
    assert match_status3 is None or match_status3[3] != "book_taxi"


def test_format_taxi_request_with_room_number():
    """
    Kiem tra format SupportRequest thanh TaxiRequestResponse co day du room_number va thong tin chuyen di.
    """
    req = SupportRequest(
        id="SR-TEST-001",
        ticket_code="TX-99887",
        guest_name="Khach Phong 301",
        room_number="301",
        description="Diem den: San bay Da Nang | Thoi gian don: Immediate | So luong khach: 3 | Loai xe: 7-Seater SUV.",
        status="Driver Assigned",
        assigned_staff_name="Nguyen Van A",
    )
    formatted = _format_taxi_request(req)
    assert formatted.ticket_code == "TX-99887"
    assert formatted.room_number == "301"
    assert formatted.destination == "San bay Da Nang"
    assert formatted.party_size == 3
    assert formatted.vehicle_type == "7-Seater SUV"
    assert formatted.status == "Driver Assigned"
    assert formatted.assigned_driver == "Nguyen Van A"


@pytest.mark.asyncio
async def test_taxi_request_unauthenticated_prompts_for_pin():
    """
    Khi khach noi 'toi muon dat taxi cho phong 301' ma chua trong session (chua nhap PIN):
    - He thong phai nhan dien dung action 'book_taxi' (khong bi nham sang 'room_service').
    - target_room_number phai la '301'.
    - require_room_pin phai la True.
    - pending_service_action phai la 'book_taxi'.
    """
    from app.services.ai.concierge_graph import concierge_graph
    
    sid = "test-taxi-unauth-test"
    res = await concierge_graph.ainvoke(
        {
            "prompt": "tôi muốn đặt taxi cho phòng 301",
            "session_id": sid,
            "language": "vi",
        },
        config={"configurable": {"thread_id": sid}}
    )
    assert res.get("action") == "book_taxi"
    assert res.get("target_room_number") == "301"
    assert res.get("require_room_pin") is True
    assert res.get("pending_service_action") == "book_taxi"
    assert "mã PIN" in res.get("response", "") or "ma PIN" in res.get("response", "")


@pytest.mark.asyncio
async def test_taxi_request_authenticated_provides_2_options_without_pin():
    """
    Khi khach noi 'toi muon dat taxi cho phong 301' va da trong session (da xac thuc PIN):
    - He thong khong hoi lai ma PIN (require_room_pin = False).
    - action phai la 'book_taxi'.
    - response phai hoi 2 option: tu goi xe hay nho Concierge dat giup.
    """
    from app.services.ai.concierge_graph import concierge_graph
    from app.services.ai.session_manager import session_manager
    
    sid = "test-taxi-auth-test"
    session_manager.set_room_authenticated(sid, "301")
    session_manager.set_room_number(sid, "301")
    
    res = await concierge_graph.ainvoke(
        {
            "prompt": "tôi muốn đặt taxi cho phòng 301",
            "session_id": sid,
            "language": "vi",
            "room_number": "301",
            "is_room_authenticated": True,
        },
        config={"configurable": {"thread_id": sid}}
    )
    assert res.get("action") == "book_taxi"
    assert res.get("target_room_number") == "301"
    assert res.get("require_room_pin") is False
    assert "tự gọi" in res.get("response", "") or "tu goi" in res.get("response", "")
    assert "Concierge" in res.get("response", "")


@pytest.mark.asyncio
async def test_verify_room_pin_for_taxi_does_not_create_ticket():
    """
    Khi Kiosk goi verify_room_pin voi action='book_taxi' hoac 'taxi':
    - He thong chi xac thuc phong, TUYET DOI KHONG tu dong tao SupportRequest chuyen den Concierge.
    - Chi khi khach chon Option 2 tren giao dien thi ticket moi duoc tao.
    """
    from app.api.v1.endpoints.operations.reception import verify_room_pin
    from app.schemas.operations import RoomPinVerifyRequest
    from unittest.mock import AsyncMock, MagicMock
    from app.models.hotel import Room

    mock_room = Room(
        id="room-301",
        room_number="301",
        status="OCCUPIED",
        hotel_id="HOTEL-1",
        pin_code="1234",
        current_guest_name="Nguyen Van A",
        tag_code="TAG-301"
    )

    mock_db = AsyncMock()
    mock_execute = MagicMock()
    mock_execute.scalars.return_value.first.return_value = mock_room
    mock_db.execute.return_value = mock_execute

    payload = RoomPinVerifyRequest(
        room_number="301",
        pin="1234",
        action="book_taxi",
        items="Yêu cầu đặt xe Taxi",
    )

    res = await verify_room_pin(payload, db=mock_db)
    assert res.verified is True
    assert res.room_number == "301"
    # Khong duoc co ticket_code vi day la book_taxi, khach chua chon option 2
    assert res.ticket_code is None
    assert "Xác thực phòng 301 thành công!" in res.message
    assert "chuyển tới bộ phận liên quan" not in res.message
    # db.add khong duoc goi voi SupportRequest
    assert mock_db.add.call_count == 0
