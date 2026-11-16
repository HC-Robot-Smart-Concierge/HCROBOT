import pytest
from app.services.ai.scenario_service import scenario_service
from app.services.ai.ai_chat_service import _detect_destination_poi


@pytest.mark.parametrize(
    "query,expected_dest",
    [
        ("nhà vệ sinh ở đâu", "restroom_ground"),
        ("toilet ở đâu", "restroom_ground"),
        ("tolet ở đâu", "restroom_ground"),
        ("toa lét ở đâu", "restroom_ground"),
        ("to lét ở đâu", "restroom_ground"),
        ("toilét ở đâu", "restroom_ground"),
        ("toalet ở đâu", "restroom_ground"),
        ("where is the toilet", "restroom_ground"),
        ("where is toilet", "restroom_ground"),
        ("toilet", "restroom_ground"),
        ("cho hỏi toilet ở đâu", "restroom_ground"),
        ("toilet tầng 2", "restroom_f2"),
        ("vệ sinh tầng 2", "restroom_f2"),
    ],
)
def test_scenario_service_toilet_fast_path(query, expected_dest):
    match = scenario_service.match_fast_path(query)
    assert match is not None, f"Expected fast path match for '{query}'"
    reply, lang_name, lang_code, action_type, payload = match
    assert action_type == "show_map"
    assert isinstance(payload, dict)
    assert payload.get("destination_key") == expected_dest


@pytest.mark.parametrize(
    "query,expected_dest",
    [
        ("nhà vệ sinh ở đâu", "restroom_ground"),
        ("toilet ở đâu", "restroom_ground"),
        ("tolet ở đâu", "restroom_ground"),
        ("toa lét ở đâu", "restroom_ground"),
        ("to lét ở đâu", "restroom_ground"),
        ("toilét ở đâu", "restroom_ground"),
        ("toalet ở đâu", "restroom_ground"),
        ("toilet", "restroom_ground"),
        ("đi tolet", "restroom_ground"),
        ("đi toa lét", "restroom_ground"),
        ("chỗ rửa tay ở đâu", "restroom_ground"),
        ("toilet tầng 2", "restroom_f2"),
        ("vệ sinh tầng 2", "restroom_f2"),
    ],
)
def test_detect_destination_poi_toilet_variants(query, expected_dest):
    dest = _detect_destination_poi(query, "Dạ nhà vệ sinh ở sảnh chính tầng 1 ạ.")
    assert dest == expected_dest

