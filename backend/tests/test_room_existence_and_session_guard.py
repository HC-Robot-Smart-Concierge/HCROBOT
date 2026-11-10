import pytest
from app.services.ai.session_manager import is_valid_hotel_room, session_manager, VALID_HOTEL_ROOMS
from app.services.ai.scenario_service import scenario_service
from app.services.ai.ai_chat_service import _detect_destination_poi


def test_is_valid_hotel_room():
    assert len(VALID_HOTEL_ROOMS) == 20
    # Valid rooms: 301-310 and 401-410
    for r in range(301, 311):
        assert is_valid_hotel_room(str(r)) is True
    for r in range(401, 411):
        assert is_valid_hotel_room(str(r)) is True

    # Invalid rooms
    invalid_rooms = ["101", "201", "202", "300", "311", "400", "411", "501", "601", "701", "801", "999", "0", "", None]
    for r in invalid_rooms:
        assert is_valid_hotel_room(r) is False


def test_session_manager_refuses_invalid_room():
    sid = "test_guard_sid_123"
    session_manager.reset_session(sid)

    # Refuse setting invalid room
    success = session_manager.set_room_number(sid, "501")
    assert success is False
    assert session_manager.get_room_number(sid) is None

    success_999 = session_manager.set_room_number(sid, "999")
    assert success_999 is False
    assert session_manager.get_room_number(sid) is None

    # Accept setting valid room
    success_305 = session_manager.set_room_number(sid, "305")
    assert success_305 is True
    assert session_manager.get_room_number(sid) == "305"


@pytest.mark.parametrize(
    "query,invalid_room",
    [
        ("chỉ đường đến phòng 501", "501"),
        ("phòng 501 ở đâu", "501"),
        ("đường lên phòng 202", "202"),
        ("thông tin phòng 999", "999"),
        ("phòng 201 có ban công không", "201"),
        ("where is room 501", "501"),
        ("phòng 102 giá bao nhiêu", "102"),
    ],
)
def test_fast_path_intercepts_non_existent_room_query(query, invalid_room):
    match = scenario_service.match_fast_path(query)
    assert match is not None, f"Expected fast path intercept for '{query}'"
    reply, lang_name, lang_code, action_type, payload = match
    assert action_type == "conversation"
    assert isinstance(payload, dict)
    assert payload.get("destination_key") is None
    assert payload.get("invalid_room") == invalid_room
    assert f"không có phòng {invalid_room}" in reply or f"does not have room {invalid_room}" in reply


@pytest.mark.parametrize(
    "query,valid_room",
    [
        ("chỉ đường đến phòng 301", "room_301"),
        ("phòng 402 ở đâu", "room_402"),
        ("phòng 310 ở đâu", "room_310"),
        ("chỉ đường đến phòng 410", "room_410"),
    ],
)
def test_fast_path_allows_valid_rooms_with_map(query, valid_room):
    match = scenario_service.match_fast_path(query)
    assert match is not None, f"Expected fast path match for '{query}'"
    reply, lang_name, lang_code, action_type, payload = match
    assert action_type == "show_map"
    assert isinstance(payload, dict)
    assert payload.get("destination_key") == valid_room


def test_detect_destination_poi_guards_invalid_rooms():
    # Invalid room query must return None
    assert _detect_destination_poi("chỉ đường đến phòng 501") is None
    assert _detect_destination_poi("phòng 999 ở đâu") is None
    assert _detect_destination_poi("đường lên phòng 202") is None

    # Explanation about non-existent room must return None
    explanation = "Dạ khách sạn Aurora Grand hiện không có phòng 501 ạ. Khách sạn chỉ có các phòng lưu trú từ 301 đến 310 tại Tầng 3 và từ 401 đến 410 tại Tầng 4."
    assert _detect_destination_poi("phòng 501", explanation) is None

    # Valid room queries must return proper POI
    assert _detect_destination_poi("chỉ đường đến phòng 301") == "room_301"
    assert _detect_destination_poi("chỉ đường đến phòng 310") == "room_310"
    assert _detect_destination_poi("chỉ đường đến phòng 402") == "room_402"
    assert _detect_destination_poi("chỉ đường đến phòng 410") == "room_410"

