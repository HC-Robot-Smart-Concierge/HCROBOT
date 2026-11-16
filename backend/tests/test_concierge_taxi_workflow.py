import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime
from app.models.support_request import SupportRequest
from app.schemas.operations import TaxiRequestStatusUpdate
from app.api.v1.endpoints.operations.taxi import update_taxi_request_status, get_taxi_dashboard


@pytest.mark.asyncio
async def test_concierge_receive_taxi_request_transitions_to_calling():
    """
    Khi Concierge nhan yeu cau dat taxi:
    - Status chuyen thanh 'Calling' (Dang goi).
    - Progress duoc gan bang 50%.
    """
    mock_req = SupportRequest(
        id="SR-TX-001",
        ticket_code="TX-10001",
        guest_name="Mr. David Miller",
        room_number="301",
        description="Điểm đến: Sân bay Đà Nẵng | Thời gian đón: Immediate | Loại xe: 4-Seater Sedan",
        status="Pending",
        progress=0,
        department_id="DEP-CONCIERGE",
        service_type_id="ST-TAXI",
        created_at=datetime.utcnow(),
    )

    mock_repo = AsyncMock()
    mock_repo.get_by_id_or_code.return_value = mock_req

    mock_db = AsyncMock()

    update_payload = TaxiRequestStatusUpdate(status="Calling")
    res = await update_taxi_request_status(
        request_id="SR-TX-001",
        update_in=update_payload,
        sr_repo=mock_repo,
        db=mock_db,
    )

    assert res.status == "Calling"
    assert mock_req.status == "Calling"
    assert mock_req.progress == 50
    mock_repo.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_concierge_complete_taxi_request_transitions_to_completed():
    """
    Sau khi Concierge da goi hang taxi xong cho khach:
    - Concierge bam xac nhan -> Status chuyen thanh 'Completed' (Thanh cong).
    - Progress duoc gan bang 100%.
    """
    mock_req = SupportRequest(
        id="SR-TX-002",
        ticket_code="TX-10002",
        guest_name="Ms. Linh",
        room_number="402",
        description="Điểm đến: Hội An | Thời gian đón: Immediate | Loại xe: 7-Seater SUV",
        status="Calling",
        progress=50,
        department_id="DEP-CONCIERGE",
        service_type_id="ST-TAXI",
        created_at=datetime.utcnow(),
    )

    mock_repo = AsyncMock()
    mock_repo.get_by_id_or_code.return_value = mock_req

    mock_db = AsyncMock()

    update_payload = TaxiRequestStatusUpdate(status="Completed")
    res = await update_taxi_request_status(
        request_id="SR-TX-002",
        update_in=update_payload,
        sr_repo=mock_repo,
        db=mock_db,
    )

    assert res.status == "Completed"
    assert mock_req.status == "Completed"
    assert mock_req.progress == 100
    mock_repo.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_taxi_dashboard_kpis_reflect_concierge_calling_workflow():
    """
    Kiem tra cac chi so KPI tren Concierge Dashboard cho mang Taxi:
    - pendingRequests: So yeu cau cho tiep nhan
    - callingRequests / activeTrips: So yeu cau dang duoc Concierge goi xe
    - completedTrips: So yeu cau da goi thanh cong
    """
    req1 = SupportRequest(id="1", ticket_code="TX-1", status="Pending", department_id="DEP-CONCIERGE", service_type_id="ST-TAXI", created_at=datetime.utcnow())
    req2 = SupportRequest(id="2", ticket_code="TX-2", status="Calling", department_id="DEP-CONCIERGE", service_type_id="ST-TAXI", created_at=datetime.utcnow())
    req3 = SupportRequest(id="3", ticket_code="TX-3", status="Completed", department_id="DEP-CONCIERGE", service_type_id="ST-TAXI", created_at=datetime.utcnow())

    mock_sr_repo = AsyncMock()
    mock_sr_repo.get_recent_by_department.return_value = [req1, req2, req3]

    mock_staff_repo = AsyncMock()
    mock_staff_repo.list_staff.return_value = []

    res = await get_taxi_dashboard(sr_repo=mock_sr_repo, staff_repo=mock_staff_repo)
    kpis = res["kpis"]

    assert kpis["totalRequests"] == 3
    assert kpis["pendingRequests"] == 1
    assert kpis["callingRequests"] == 1
    assert kpis["activeTrips"] == 1
    assert kpis["completedTrips"] == 1


@pytest.mark.asyncio
async def test_robot_inquiry_for_taxi_calling_status():
    """
    Khi khach hoi Robot ve tinh trang xe taxi khi Concierge dang goi (Calling):
    Robot phai thong bao Concierge da tiep nhan va dang goi xe cho khach.
    """
    from app.services.ai.concierge_graph import service_fsm_node

    mock_info = {
        "exists": True,
        "is_occupied": True,
        "room_number": "301",
        "service_orders": [
            {
                "id": "SR-TX-301",
                "order_number": "TX-30101",
                "title": "Taxi: Phòng 301 -> Sân bay Đà Nẵng",
                "items_summary": "Điểm đến: Sân bay | Loại xe: 4 chỗ",
                "status": "Calling",
            }
        ],
        "food_orders": [],
    }

    with patch("app.services.ai.concierge_graph.query_room_order_status_db", return_value=mock_info):
        state = {
            "prompt": "kiểm tra trạng thái đặt taxi phòng 301",
            "action": "query_order_status",
            "current_room": "301",
            "target_room_number": "301",
            "room_number": "301",
            "is_authenticated": True,
            "language": "vi",
        }
        res = await service_fsm_node(state)
        resp_text = res.get("response", "")

        assert "Concierge" in resp_text
        assert "đang gọi" in resp_text or "tiếp nhận" in resp_text


@pytest.mark.asyncio
async def test_robot_inquiry_for_taxi_completed_status():
    """
    Khi khach hoi Robot ve tinh trang xe taxi khi Concierge da goi thanh cong (Completed):
    Robot phai thong bao Concierge da goi xe taxi thanh cong va huong dan khach ra sanh don.
    """
    from app.services.ai.concierge_graph import service_fsm_node

    mock_info = {
        "exists": True,
        "is_occupied": True,
        "room_number": "301",
        "service_orders": [
            {
                "id": "SR-TX-301",
                "order_number": "TX-30102",
                "title": "Taxi: Phòng 301 -> Sân bay",
                "items_summary": "Điểm đến: Sân bay | Loại xe: 4 chỗ",
                "status": "Completed",
            }
        ],
        "food_orders": [],
    }

    with patch("app.services.ai.concierge_graph.query_room_order_status_db", return_value=mock_info):
        state = {
            "prompt": "taxi phòng 301 tới chưa vậy",
            "action": "query_order_status",
            "current_room": "301",
            "target_room_number": "301",
            "room_number": "301",
            "is_authenticated": True,
            "language": "vi",
        }
        res = await service_fsm_node(state)
        resp_text = res.get("response", "")

        assert "Concierge" in resp_text
        assert "thành công" in resp_text or "sảnh" in resp_text
