import re
import pytest
from app.services.ai.scenario_service import scenario_service, DEFAULT_SEED_SCENARIOS
from app.services.ai.constants import SERVICE_KEYWORDS


def test_scn_lost_keycard_not_in_seed_scenarios():
    # 1. scn-lost-keycard phai bi loai bo hoan toan khoi DEFAULT_SEED_SCENARIOS
    seed_ids = [s.get("id") for s in DEFAULT_SEED_SCENARIOS]
    assert "scn-lost-keycard" not in seed_ids


def test_scn_lost_keycard_not_in_scenario_cache():
    # 2. In-Memory cache khong duoc chua scn-lost-keycard
    cache_ids = [s.get("id") for s in scenario_service._cache]
    assert "scn-lost-keycard" not in cache_ids


def test_fastpath_does_not_match_keycard_issuance():
    # 3. Cac cau hoi ve mat the phong, the tu khong duoc tra ve phan hoi cap the phong moi
    queries = [
        "tôi bị mất thẻ phòng",
        "mất thẻ",
        "quên thẻ phòng",
        "thẻ phòng",
        "làm lại thẻ",
        "lost key card",
        "replace key card",
        "the phong",
    ]
    for q in queries:
        hit = scenario_service.match_fast_path(q)
        if hit is not None:
            # Neu co match, tuyet doi khong duoc la scn-lost-keycard hay hua hen cap the moi
            resp = hit[0].lower()
            assert "cấp lại thẻ mới" not in resp
            assert "replacement card" not in resp


def test_lost_key_routes_to_pin_or_front_desk():
    # 4. Cac cau hoi mat chia khoa phong huong dan den le tan de xac minh ma pin
    hit = scenario_service.match_fast_path("tôi bị mất chìa khóa phòng")
    assert hit is not None
    assert hit[3] == "show_map"
    assert hit[4].get("destination_key") == "front_desk"
    assert "mã pin" in hit[0].lower()


def test_reception_service_keywords_no_the_phong():
    # 5. SERVICE_KEYWORDS['reception'] khong chua tu khoa the phong
    reception_kws = SERVICE_KEYWORDS.get("reception", [])
    assert "thẻ phòng" not in reception_kws


def test_no_emojis_in_modified_backend_files():
    # 6. Dam bao 0 emoji trong cac file backend da sua
    files = [
        "backend/app/services/ai/scenario_service.py",
        "backend/app/services/ai/constants.py",
        "backend/knowledge_vault/hotel_facilities_floor_layout_rag.md",
        "backend/knowledge_vault/hotel_room_distribution_by_floor.md",
    ]
    emoji_regex = re.compile(
        r"[\U0001F300-\U0001F6FF\U0001F900-\U0001F9FF\U00002600-\U000026FF\U00002700-\U000027BF]"
    )
    for file_path in files:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            assert not emoji_regex.search(content), f"Found emoji in {file_path}"
