from typing import Dict, List

# Tập trung toàn bộ từ khóa phân loại ý định dịch vụ khách sạn (DRY Principle)
SERVICE_KEYWORDS: Dict[str, List[str]] = {
    "cancel_service": [
        "hủy", "huy", "hủy yêu cầu", "huy yeu cau", "hủy phòng", "huy phong",
        "hủy đơn", "huy don", "hủy món", "huy mon", "không cần nữa", "khong can nua",
        "thôi không cần", "thoi khong can", "không lấy nữa", "khong lay nua",
        "bỏ yêu cầu", "bo yeu cau", "cancel", "cancellation", "cancel request",
        "cancel order"
    ],
    "laundry": [
        "giặt", "giat", "giặt ủi", "giat ui", "giặt là", "giat la",
        "giặt sấy", "giat say", "ủi đồ", "ui do", "ủi quần áo", "giặt hấp",
        "laundry", "dry cleaning", "giặt áo", "giặt quần", "là quần áo"
    ],
    "wake_up": [
        "báo thức", "bao thuc", "gọi dậy", "goi day", "đánh thức", "danh thuc",
        "wake up", "wake-up", "wake up call"
    ],
    "housekeeping": [
        "khăn", "khan", "dọn phòng", "don phong", "gối", "goi", "chăn", "chan",
        "nệm", "nem", "dọn dẹp", "dọn vệ sinh", "vệ sinh phòng", "làm vệ sinh",
        "towel", "clean room", "cleaning", "bàn ủi", "máy sấy", "dao cạo", "kem đánh răng",
        "bàn chải", "dầu gội", "sữa tắm", "giấy vệ sinh", "nước suối trong phòng"
    ],
    "room_service": [
        "cơm", "com", "nước", "nuoc", "ăn", "an", "uống", "uong", "đồ ăn", "do an",
        "trà", "tra", "cà phê", "ca phe", "pizza", "phở", "pho", "bánh", "banh",
        "food", "drink", "bữa sáng", "gọi món", "đặt món", "nước ngọt", "bia", "trái cây"
    ],
    "bellman": [
        "hành lý", "hanh ly", "vali", "túi", "tui", "chuyển phòng", "chuyen phong",
        "mang đồ", "xách đồ", "luggage", "bag", "mang hành lý", "gửi hành lý"
    ],
    "maintenance": [
        "hỏng", "hong", "sửa", "sua", "điều hòa", "dieu hoa", "bóng đèn", "bong den",
        "nước rò", "nuoc ro", "máy lạnh", "may lanh", "tủ lạnh", "tu lanh", "kẹt", "ket",
        "fix", "repair", "vòi sen", "vòi nước", "bồn cầu", "tắc", "mất điện", "không lạnh", "cháy bóng"
    ],
    "restaurant": [
        "đặt bàn", "dat ban", "bàn ăn", "ban an", "nhà hàng", "table", "restaurant"
    ],
    "taxi": [
        "taxi", "đặt xe", "dat xe", "gọi xe", "goi xe", "sân bay", "cab", "ride", "xe đón", "grab"
    ],
    "concierge": [
        "concierge", "gặp người", "trợ giúp trực tiếp", "nhân viên hỗ trợ",
        "live call", "video call", "tổng đài", "gọi cho nhân viên",
        "gọi nhân viên", "gặp nhân viên", "kết nối nhân viên", "nói chuyện với nhân viên",
        "cho tôi gặp nhân viên", "gặp người thật", "nói chuyện với người thật", "kết nối người thật",
        "gọi tổng đài", "gọi hỗ trợ", "hỗ trợ viên", "gọi video",
        "gọi cho lễ tân", "gặp trực tiếp", "kết nối trực tiếp", "human support",
        "nhân viên tư vấn", "cho tôi gặp lễ tân", "gặp trực ban", "gọi trực ban", "gọi can thiệp",
        "call staff", "call human", "talk to human", "speak to human",
        "connect staff", "video call support", "talk to staff", "call receptionist",
        "human agent", "live agent", "talk to a person", "speak to a person", "live support"
    ],
    "reception": [
        "lễ tân", "check out", "checkout", "check in", "checkin",
        "đổi phòng", "doi phong", "trả phòng", "tra phong", "front desk", "reception",
        "gia hạn phòng", "thẻ phòng", "mất chìa khóa", "khóa phòng"
    ],
}
