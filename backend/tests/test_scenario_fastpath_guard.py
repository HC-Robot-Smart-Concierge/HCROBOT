import pytest
from app.services.ai.scenario_service import scenario_service
from app.services.ai.ai_chat_service import _detect_destination_poi


def test_fastpath_bypasses_general_knowledge_and_entities():
    # 1. Các câu hỏi về nhân vật, vận động viên, thực thể ngoài khách sạn -> TUYỆT ĐỐI không bị Fast-Path chặn
    assert scenario_service.match_fast_path("vận động viên bơi lội nổi tiếng nhất hiện nay là ai") is None
    assert scenario_service.match_fast_path("ai là người bơi giỏi nhất thế giới") is None
    assert scenario_service.match_fast_path("Michael Phelps là ai") is None
    assert scenario_service.match_fast_path("cầu thủ bóng đá nào đạt nhiều quả bóng vàng nhất") is None
    assert scenario_service.match_fast_path("ca sĩ nào hát bài này") is None
    assert scenario_service.match_fast_path("tại sao nước biển lại mặn") is None
    assert scenario_service.match_fast_path("công thức nấu súp kem bí đỏ là gì") is None
    assert scenario_service.match_fast_path("lịch sử hình thành trái đất") is None


def test_fastpath_prevents_substring_false_positives():
    # 2. Không được dính bẫy chuỗi con (substring) như pool trong Liverpool, spa trong spaghetti, bar trong barcelona, hát trong phát triển
    assert scenario_service.match_fast_path("Tôi là fan hâm mộ của câu lạc bộ Liverpool") is None
    assert scenario_service.match_fast_path("Trận đấu của Barcelona hôm nay mấy giờ") is None
    assert scenario_service.match_fast_path("Hôm nay ăn món spaghetti") is None
    assert scenario_service.match_fast_path("Làm thế nào để phát triển sự nghiệp") is None


def test_fastpath_matches_genuine_hotel_facilities():
    # 3. Các câu hỏi thực sự tìm tiện ích khách sạn -> Vẫn phải khớp chính xác
    pool_hit = scenario_service.match_fast_path("Cho tôi hỏi hồ bơi ở đâu")
    assert pool_hit is not None
    assert pool_hit[3] == "show_map"
    assert pool_hit[4].get("destination_key") == "infinity_pool"

    pool_hours_hit = scenario_service.match_fast_path("Hồ bơi vô cực mở cửa lúc mấy giờ")
    assert pool_hours_hit is not None
    assert pool_hours_hit[3] == "show_map"

    gym_hit = scenario_service.match_fast_path("Chỉ đường lên phòng gym")
    assert gym_hit is not None
    assert gym_hit[3] == "show_map"
    assert gym_hit[4].get("destination_key") == "gym"

    room_hit = scenario_service.match_fast_path("Phòng 401 ở đâu")
    assert room_hit is not None
    assert room_hit[3] == "show_map"
    assert room_hit[4].get("destination_key") == "room_401"


def test_detect_destination_poi_general_knowledge_guard():
    # 4. _detect_destination_poi cũng phải bỏ qua mọi câu hỏi kiến thức chung
    assert _detect_destination_poi("vận động viên bơi lội nổi tiếng nhất hiện nay là ai") is None
    assert _detect_destination_poi("ai là người bơi giỏi nhất", "Michael Phelps là kình ngư vĩ đại.") is None
    assert _detect_destination_poi("cầu thủ bóng đá xuất sắc nhất hiện nay") is None

