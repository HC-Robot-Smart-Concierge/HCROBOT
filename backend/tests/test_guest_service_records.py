from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.api.v1.endpoints.operations.admin_ops import (
    get_guest_service_records,
    _normalize_room_key,
)


def _mock_db_scalars(rooms=None, feedbacks=None, support_sessions=None, chat_sessions=None):
    """Tạo AsyncSession mock trả về dữ liệu tuần tự cho Room, Feedback, HumanSupportSession, ChatSession."""
    db = AsyncMock()
    datasets = [
        rooms or [],
        feedbacks or [],
        support_sessions or [],
        chat_sessions or [],
    ]
    call_idx = {"i": 0}

    async def fake_execute(_stmt):
        idx = call_idx["i"]
        call_idx["i"] += 1
        items = datasets[idx] if idx < len(datasets) else []
        res = MagicMock()
        res.scalars.return_value.all.return_value = items
        return res

    db.execute.side_effect = fake_execute
    return db


def _sample_raw_requests():
    return [
        {
            "id": "REQ-RS-101",
            "raw_id": "sr-1",
            "ticket_code": "ORD-101",
            "department": "Room Service",
            "table_type": "room_service",
            "title": "Phở Bò & Nước cam",
            "location": "ROOM 402",
            "room_number": "402",
            "guestName": "Nguyen Van A",
            "guest_name": "Nguyen Van A",
            "guestPhone": "0901234567",
            "guest_phone": "0901234567",
            "roomPhone": "Ext 402",
            "room_phone": "Ext 402",
            "status": "Completed",
            "assignedTo": "Staff Lan",
            "assigned_to": "Staff Lan",
            "assigned_robot": "RC-001",
            "notes": "Ít hành",
            "description": "Ít hành",
            "source": "From HCRobot",
            "created_at": datetime(2026, 11, 15, 10, 30, 0),
            "items": [{"name": "Phở Bò", "qty": 1, "unit_price": 120000, "subtotal": 120000}],
            "total_amount": 120000,
            "progress": 100,
            "is_service_request": True,
        },
        {
            "id": "REQ-HK-202",
            "raw_id": "sr-2",
            "ticket_code": "HK-202",
            "department": "Housekeeping",
            "table_type": "housekeeping",
            "title": "Thêm 2 khăn tắm",
            "location": "ROOM 402",
            "room_number": "402",
            "guestName": "Nguyen Van A",
            "guest_name": "Nguyen Van A",
            "status": "Pending",
            "assigned_robot": None,
            "notes": "Giao sớm",
            "description": "Giao sớm",
            "source": "Guest App",
            "created_at": datetime(2026, 11, 16, 8, 15, 0),
            "items": [],
            "total_amount": 0,
            "progress": 0,
            "is_service_request": False,
        },
        {
            "id": "REQ-TX-303",
            "raw_id": "sr-3",
            "ticket_code": "TX-303",
            "department": "Taxi",
            "table_type": "taxi",
            "title": "Đặt xe ra sân bay",
            "location": "Main Lobby",
            "room_number": "Main Lobby",
            "guestName": "Ms. Elena",
            "guest_name": "Ms. Elena",
            "status": "Cancelled",
            "assigned_robot": None,
            "notes": "Khách đổi giờ bay",
            "description": "Khách đổi giờ bay",
            "source": "Front Desk",
            "created_at": datetime(2026, 11, 14, 14, 0, 0),
            "items": [],
            "total_amount": 0,
            "progress": 0,
            "is_service_request": False,
        },
        {
            # Chỉ thị nội bộ -> PHẢI bị loại bỏ khỏi Guest Service Records
            "id": "REQ-OP-999",
            "raw_id": "dir-1",
            "ticket_code": "OP-999",
            "department": "Housekeeping",
            "table_type": "directive",
            "title": "Kiểm tra kho tầng 3",
            "location": "Main Hotel",
            "guestName": "Operations Directive",
            "guest_name": "Operations Directive",
            "status": "Unassigned",
            "source": "Admin (System Administrator)",
            "created_at": datetime(2026, 11, 16, 9, 0, 0),
        },
    ]


def test_normalize_room_key():
    assert _normalize_room_key("Room 402") == "402"
    assert _normalize_room_key("Phòng 305") == "305"
    assert _normalize_room_key("Main Lobby Kiosk") == "Main Lobby"
    assert _normalize_room_key(None) == "Main Lobby"


@pytest.mark.asyncio
async def test_guest_service_records_excludes_directives_and_aggregates_dossiers():
    rooms = [
        SimpleNamespace(
            room_number="402",
            room_type="Deluxe",
            status="OCCUPIED",
            current_guest_name="Nguyen Van A",
            current_guest_phone="0901234567",
            room_phone="Ext 402",
        )
    ]
    feedbacks = [
        SimpleNamespace(
            id="FB-1",
            room_number="402",
            guest_name="Nguyen Van A",
            rating=5,
            category="F&B",
            comment="Đồ ăn nóng hổi, robot giao nhanh",
            created_at=datetime(2026, 11, 15, 11, 0, 0),
        )
    ]
    support_sessions = [SimpleNamespace(room_number="Room 402")]
    chat_sessions = [SimpleNamespace(room_number="402"), SimpleNamespace(room_number="402")]

    db = _mock_db_scalars(rooms, feedbacks, support_sessions, chat_sessions)

    with patch(
        "app.api.v1.endpoints.operations.admin_ops._fetch_all_raw_requests",
        new=AsyncMock(return_value=_sample_raw_requests()),
    ):
        res = await get_guest_service_records(db=db)

    # Directive OP-999 phải bị loại trừ -> còn 3 guest service records
    assert res["metrics"]["total_records"] == 3
    assert res["metrics"]["completed_records"] == 1
    assert res["metrics"]["active_records"] == 1
    assert res["metrics"]["cancelled_records"] == 1
    assert res["metrics"]["total_revenue"] == 120000
    assert res["metrics"]["robot_assisted_count"] == 1
    assert res["metrics"]["avg_rating"] == 5.0
    assert res["metrics"]["total_rooms_served"] == 2
    assert all(r.get("table_type") != "directive" for r in res["records"])

    # Kiểm tra Dossier của phòng 402 (đang lưu trú)
    prof_402 = next(p for p in res["guest_profiles"] if p["room_key"] == "402")
    assert prof_402["guest_name"] == "Nguyen Van A"
    assert prof_402["guest_type"] == "registered"
    assert prof_402["stay_status"] == "CURRENT_STAY"
    assert prof_402["room_status"] == "OCCUPIED"
    assert prof_402["total_services"] == 2
    assert prof_402["completed_services"] == 1
    assert prof_402["active_services"] == 1
    assert prof_402["total_spend"] == 120000
    assert prof_402["avg_rating"] == 5.0
    assert prof_402["video_call_count"] == 1
    assert prof_402["chat_session_count"] == 2

    # Kiểm tra Dossier khách vãng lai ở Sảnh
    prof_walkin = next(p for p in res["guest_profiles"] if p["guest_type"] == "walkin")
    assert prof_walkin["guest_name"] == "Ms. Elena"
    assert prof_walkin["stay_status"] == "WALK_IN"


@pytest.mark.asyncio
async def test_guest_service_records_separates_different_guests_in_same_room():
    """Đảm bảo cùng 1 phòng (402) nhưng đổi khách (khách cũ vs khách mới) phải tách thành 2 hồ sơ riêng."""
    rooms = [
        SimpleNamespace(
            room_number="402",
            room_type="Deluxe",
            status="OCCUPIED",
            current_guest_name="Tran Thi B",
            current_guest_phone="0911222333",
            room_phone="Ext 402",
        )
    ]
    raw_requests = _sample_raw_requests() + [
        {
            "id": "REQ-RS-405",
            "raw_id": "sr-4",
            "ticket_code": "ORD-405",
            "department": "Room Service",
            "table_type": "room_service",
            "title": "Cà phê sữa đá",
            "location": "ROOM 402",
            "room_number": "402",
            "guestName": "Tran Thi B",
            "guest_name": "Tran Thi B",
            "status": "Completed",
            "source": "From HCRobot",
            "created_at": datetime(2026, 11, 16, 12, 0, 0),
            "items": [],
            "total_amount": 55000,
        }
    ]
    db = _mock_db_scalars(rooms=rooms)

    with patch(
        "app.api.v1.endpoints.operations.admin_ops._fetch_all_raw_requests",
        new=AsyncMock(return_value=raw_requests),
    ):
        res = await get_guest_service_records(db=db)

    room_402_dossiers = [p for p in res["guest_profiles"] if p["room_key"] == "402"]
    assert len(room_402_dossiers) == 2

    old_guest = next(p for p in room_402_dossiers if p["guest_name"] == "Nguyen Van A")
    new_guest = next(p for p in room_402_dossiers if p["guest_name"] == "Tran Thi B")

    assert old_guest["stay_status"] == "PAST_STAY"
    assert old_guest["total_spend"] == 120000
    assert new_guest["stay_status"] == "CURRENT_STAY"
    assert new_guest["total_spend"] == 55000


@pytest.mark.asyncio
async def test_guest_service_records_filters_by_dept_source_date_and_search():
    db = _mock_db_scalars()

    with patch(
        "app.api.v1.endpoints.operations.admin_ops._fetch_all_raw_requests",
        new=AsyncMock(return_value=_sample_raw_requests()),
    ):
        # Filter theo source = robot
        res_robot = await get_guest_service_records(source="robot", db=db)
        assert res_robot["metrics"]["total_records"] == 1
        assert res_robot["records"][0]["ticket_code"] == "ORD-101"

        # Filter theo date range
        db2 = _mock_db_scalars()
        res_date = await get_guest_service_records(start_date="2026-11-16", end_date="2026-11-16", db=db2)
        assert res_date["metrics"]["total_records"] == 1
        assert res_date["records"][0]["ticket_code"] == "HK-202"

        # Filter theo status = Cancelled
        db3 = _mock_db_scalars()
        res_cancel = await get_guest_service_records(status="Cancelled", db=db3)
        assert res_cancel["metrics"]["total_records"] == 1
        assert res_cancel["records"][0]["ticket_code"] == "TX-303"

