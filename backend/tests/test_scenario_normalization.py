import pytest
from collections import defaultdict
from app.services.ai.scenario_service import scenario_service, DEFAULT_SEED_SCENARIOS


def test_no_duplicate_exact_keywords_in_seed_scenarios():
    """
    Kiem tra khong co bat ky tu khoa nao bi trung lap chinh xac giua cac kich ban Fast-Path.
    Moi tu khoa phai tro den duy nhat mot kich ban ro rang.
    """
    kw_map = defaultdict(list)
    for scn in DEFAULT_SEED_SCENARIOS:
        if not scn.get("is_active", True):
            continue
        s_id = scn.get("id")
        for kw in scn.get("match_keywords", []):
            kw_clean = kw.strip().lower()
            kw_map[kw_clean].append(s_id)

    duplicates = {k: v for k, v in kw_map.items() if len(v) > 1}
    assert len(duplicates) == 0, f"Phat hien tu khoa bi trung lap: {duplicates}"


def test_pool_and_gym_scenarios_are_distinct():
    """
    Kiem tra ho boi va phong gym duoc phan dinh ranh roi, khong bi dan duong nham:
    - 'ho boi' -> infinity_pool (Tang 5)
    - 'phong gym' -> gym (Tang 5)
    """
    res_pool = scenario_service.match_fast_path("Hồ bơi ở đâu", lang_code="vi-VN")
    assert res_pool is not None
    assert res_pool[3] == "show_map"
    assert res_pool[4].get("destination_key") == "infinity_pool"

    res_gym = scenario_service.match_fast_path("Phòng gym ở đâu", lang_code="vi-VN")
    assert res_gym is not None
    assert res_gym[3] == "show_map"
    assert res_gym[4].get("destination_key") == "gym"


def test_gift_shop_prioritized_over_night_market():
    """
    Kiem tra khi khach hoi 'mua qua' / 'mua qua luu niem', he thong uu tien gioi thieu Gift Shop cua khach san:
    - 'mua qua' -> gift_shop (Tang 6)
    - 'cho dem' -> Night Market
    """
    res_gift = scenario_service.match_fast_path("Tôi muốn mua quà lưu niệm", lang_code="vi-VN")
    assert res_gift is not None
    assert res_gift[3] == "show_map"
    assert res_gift[4].get("destination_key") == "gift_shop"

    res_night = scenario_service.match_fast_path("Chợ đêm Sơn Trà", lang_code="vi-VN")
    assert res_night is not None
    assert "chợ đêm" in res_night[0].lower() or "cho dem" in res_night[0].lower()


def test_front_desk_and_video_call_intent_separation():
    """
    Kiem tra tach biet giua chi duong ra Quay le tan va Goi video call nhan vien:
    - 'gap le tan' / 'le tan o dau' -> chi duong front_desk
    - 'goi video le tan' / 'video call' -> trigger_video_call
    """
    res_fd = scenario_service.match_fast_path("Tôi muốn gặp lễ tân", lang_code="vi-VN")
    assert res_fd is not None
    assert res_fd[3] == "show_map"
    assert res_fd[4].get("destination_key") == "front_desk"

    res_vc = scenario_service.match_fast_path("Gọi video lễ tân giúp tôi", lang_code="vi-VN")
    assert res_vc is not None
    assert res_vc[3] == "trigger_video_call"


def test_food_menu_vs_robot_chitchat():
    """
    Kiem tra hoi 'an gi' mo thuc don mon an phong, con 'robot an gi' tro chuyen voi robot:
    - 'an gi' -> open_food_menu (scn-room-service-menu)
    - 'robot an gi' -> chitchat ve nap pin (scn-robot-food)
    """
    res_menu = scenario_service.match_fast_path("Ăn gì", lang_code="vi-VN")
    assert res_menu is not None
    assert res_menu[3] == "open_food_menu"

    res_robot = scenario_service.match_fast_path("Robot ăn gì", lang_code="vi-VN")
    assert res_robot is not None
    assert res_robot[3] == "none"
    assert "điện năng" in res_robot[0].lower() or "dien nang" in res_robot[0].lower()

