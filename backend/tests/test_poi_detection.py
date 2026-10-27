import pytest
from app.services.ai.ai_chat_service import _detect_destination_poi


def test_detect_destination_poi_nav_intent():
    # 1. Các câu hỏi hỏi đường rõ ràng -> Phải trả về destination_key chính xác
    assert _detect_destination_poi("Nhà vệ sinh ở đâu ạ?", "Dạ nhà vệ sinh ở sảnh tầng 1 bên tay phải.") == "restroom_ground"
    assert _detect_destination_poi("Cho tôi hỏi hồ bơi ở đâu?", "Dạ hồ bơi vô cực tại tầng 5.") == "infinity_pool"
    assert _detect_destination_poi("Phòng 403 ở đâu vậy em?", "Dạ phòng 403 tại tầng 4, mời quý khách đi thang máy.") == "room_403"
    assert _detect_destination_poi("Đi vệ sinh", "Dạ lối đi vệ sinh phía bên kia sảnh ạ.") == "restroom_ground"
    assert _detect_destination_poi("Chỉ đường cho tôi lên phòng gym", "Dạ phòng gym tại tầng 6 ạ.") == "gym"
    assert _detect_destination_poi("Where is the swimming pool?", "The pool is located on the 5th floor.") == "infinity_pool"


def test_detect_destination_poi_non_nav_queries():
    # 2. Các câu hỏi dịch vụ thông thường, dù câu trả lời nhắc đến lễ tân hay nhà hàng -> TUYỆT ĐỐI không bật bản đồ (None)
    assert _detect_destination_poi(
        "Chính sách hủy phòng hoặc đổi ngày như thế nào?",
        "Dạ quý khách vui lòng báo trước 24 giờ cho quầy lễ tân để được hỗ trợ làm thủ tục miễn phí ạ."
    ) is None

    assert _detect_destination_poi(
        "Khách sạn có dịch vụ giặt ủi không?",
        "Dạ khách sạn có dịch vụ giặt ủi, quý khách để đồ vào giỏ hoặc liên hệ quầy lễ tân nhé."
    ) is None

    assert _detect_destination_poi(
        "Bữa sáng mấy giờ mở cửa và gồm những món gì?",
        "Dạ buffet sáng phục vụ tại nhà hàng Aurora từ 6:00 đến 10:00 sáng ạ."
    ) is None

    assert _detect_destination_poi(
        "Khách sạn có cho phép nuôi thú cưng không?",
        "Dạ khách sạn hiện chưa hỗ trợ mang thú cưng vào khuôn viên theo quy định chung ạ."
    ) is None

    assert _detect_destination_poi(
        "Cho tôi mượn thêm bàn ủi được không?",
        "Dạ nhân viên sẽ mang bàn ủi lên phòng cho quý khách ngay ạ."
    ) is None


def test_detect_destination_poi_external_places():
    # 3. Địa điểm ngoài khách sạn -> Không bật bản đồ trong nhà
    assert _detect_destination_poi("Đường ra sân bay Nội Bài đi hướng nào?", "Dạ sân bay cách đây khoảng 30km.") is None
    assert _detect_destination_poi("Bắt taxi ra chợ đêm ở đâu?", "Dạ quý khách có thể đón taxi trước cổng khách sạn.") is None
