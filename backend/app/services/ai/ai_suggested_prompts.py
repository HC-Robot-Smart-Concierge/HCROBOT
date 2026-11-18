"""Dynamic quick-reply suggested prompts generator for conversational continuation."""

from typing import List, Optional


def get_dynamic_suggested_prompts(
    prompt: str = "",
    reply: str = "",
    action: str = "conversation",
    destination_key: Optional[str] = None,
    lang_code: str = "vi-VN",
    age_group: Optional[str] = None,
    gender: Optional[str] = None,
) -> List[str]:
    """
    Sinh 2-3 câu hỏi gợi ý mở dạng Quick-Reply Chips theo chủ đề ngữ cảnh của câu thoại vừa diễn ra.
    Hoàn toàn hướng dữ liệu (Data-Driven), bám sát tiện ích khách sạn và hồ sơ nhân khẩu học.
    """
    is_en = (lang_code == "en-US")
    text_check = f"{(prompt or '').lower()} {(reply or '').lower()}"

    # 1. Nhóm Hồ bơi / Infinity Pool (Tầng 5)
    if destination_key == "infinity_pool" or any(k in text_check for k in ["hồ bơi", "ho boi", "bể bơi", "be boi", "pool", "swimming"]):
        return [
            "Chỉ đường lên Hồ bơi Tầng 5",
            "Giờ mở cửa hồ bơi vô cực",
            "Quy định khăn tắm và phao bơi",
        ] if not is_en else [
            "Directions to Pool Level 5",
            "Infinity pool opening hours",
            "Towel & amenity policy",
        ]

    # 2. Nhóm Phòng Gym / Fitness (Tầng 5 - Mở cửa 24/7)
    if destination_key == "gym" or any(k in text_check for k in ["gym", "fitness", "thể hình", "the thao", "chạy bộ", "tập tạ"]):
        return [
            "Chỉ đường phòng Gym Tầng 5",
            "Phòng Gym mở cửa 24/7 phải không",
            "Thiết bị tập tại phòng Gym",
        ] if not is_en else [
            "Directions to Gym Level 5",
            "Is Gym open 24/7?",
            "Gym workout equipment",
        ]

    # 3. Nhóm Thảo Mộc Spa & Massage (Tầng 5 - Giảm 15% cho khách phòng)
    if destination_key == "spa" or any(k in text_check for k in ["spa", "massage", "xông hơi", "chăm sóc da", "wellness", "thảo mộc"]):
        return [
            "Chỉ đường Thảo Mộc Spa Tầng 5",
            "Gói xông hơi đá muối & massage",
            "Khách phòng có được giảm giá Spa không",
        ] if not is_en else [
            "Directions to Herbal Spa Level 5",
            "Salt sauna & massage packages",
            "Spa discount for hotel guests",
        ]

    # 4. Nhóm Ăn uống / Room Service 24/7 (Bếp Tầng 2 - Không có buffet ăn tại chỗ)
    if action in ["room_service", "open_food_menu", "open_room_service_menu"] or destination_key in ["restaurant", "kitchen"] or any(k in text_check for k in ["nhà hàng", "nha hang", "ăn uống", "an uong", "thực đơn", "thuc don", "menu", "đặt món", "bữa sáng", "breakfast", "dining", "food", "room service"]):
        return [
            "Xem thực đơn Room Service 24/7",
            "Cách đặt món ăn lên phòng",
            "Khách sạn có buffet sáng không",
        ] if not is_en else [
            "View 24/7 Room Service menu",
            "How to order food to room",
            "Is breakfast buffet available?",
        ]

    # 5. Nhóm Rooftop Coffee & View (Tầng 6)
    if destination_key == "rooftop_coffee" or any(k in text_check for k in ["rooftop coffee", "cà phê", "cafe", "coffee", "ngắm cảnh"]):
        return [
            "Chỉ đường Rooftop Coffee Tầng 6",
            "Giờ mở cửa quán cà phê",
            "Menu trà thảo mộc & điểm ngắm cảnh",
        ] if not is_en else [
            "Directions to Rooftop Coffee Level 6",
            "Rooftop Coffee operating hours",
            "Herbal tea & scenic views",
        ]

    # 6. Nhóm Sky Lounge Bar (Tầng 6)
    if destination_key == "bar" or any(k in text_check for k in ["sky lounge", "quầy bar", "lounge bar", "cocktail", "craft beer", "rượu"]):
        return [
            "Chỉ đường Sky Lounge Bar Tầng 6",
            "Giờ mở cửa Sky Lounge Bar",
            "Menu cocktail & bia thủ công",
        ] if not is_en else [
            "Directions to Sky Lounge Bar Level 6",
            "Sky Lounge Bar operating hours",
            "Cocktails & craft beer menu",
        ]

    # 7. Nhóm VIP Karaoke (Tầng 6)
    if destination_key == "karaoke" or any(k in text_check for k in ["karaoke", "hát karaoke"]):
        return [
            "Chỉ đường phòng VIP Karaoke Tầng 6",
            "Cách đặt phòng VIP Karaoke",
            "Giờ mở cửa phòng Karaoke",
        ] if not is_en else [
            "Directions to VIP Karaoke Level 6",
            "How to book VIP Karaoke",
            "Karaoke operating hours",
        ]

    # 8. Nhóm Buồng phòng / Housekeeping
    if action in ["housekeeping", "laundry"] or any(k in text_check for k in ["khăn", "dọn phòng", "don phong", "nước suối", "gối", "chăn", "giặt ủi", "towel", "cleaning"]):
        return [
            "Xin thêm khăn tắm",
            "Lấy thêm nước suối miễn phí",
            "Yêu cầu dọn phòng ngay",
        ] if not is_en else [
            "Request extra towels",
            "Complimentary bottled water",
            "Make up room now",
        ]

    # 9. Nhóm Hành lý / Bellman / Taxi
    if action in ["bellman", "book_taxi"] or any(k in text_check for k in ["hành lý", "hanh ly", "vali", "taxi", "sân bay", "luggage", "baggage", "airport"]):
        return [
            "Hỗ trợ chuyển hành lý",
            "Đặt xe taxi ra sân bay",
            "Gửi đồ tại sảnh",
        ] if not is_en else [
            "Luggage assistance",
            "Book an airport taxi",
            "Luggage storage service",
        ]

    # 10. Nhóm Lễ tân / Check-in / Check-out (Tầng Trệt)
    if destination_key in ["front_desk", "reception"] or any(k in text_check for k in ["lễ tân", "le tan", "check-in", "checkin", "check-out", "checkout", "nhận phòng", "trả phòng"]):
        return [
            "Chỉ đường ra Quầy Lễ Tân Tầng Trệt",
            "Quy định giờ check-in và check-out",
            "Hỗ trợ gửi hành lý tại sảnh",
        ] if not is_en else [
            "Directions to Front Desk Ground Level",
            "Check-in & check-out policy",
            "Luggage storage at lobby",
        ]

    # 11. Nhóm Bãi đỗ xe (Hầm B1 & B2)
    if destination_key in ["parking_car", "parking_bike"] or any(k in text_check for k in ["đỗ xe", "do xe", "bãi xe", "bai xe", "gửi xe", "gui xe", "parking"]):
        return [
            "Chỉ đường Bãi đỗ xe ô tô Hầm B2",
            "Chỉ đường Bãi giữ xe máy Hầm B1",
            "Khách sạn có trạm sạc xe điện không",
        ] if not is_en else [
            "Directions to Car Parking B2",
            "Directions to Bike Parking B1",
            "EV charging station info",
        ]

    # 12. Nhóm Wifi
    if any(k in text_check for k in ["wifi", "wi-fi", "mật khẩu", "mat khau", "password", "mạng"]):
        return [
            "Khách sạn có những tiện ích gì?",
            "Xem menu Room Service 24/7",
            "Chỉ đường quầy Lễ tân",
        ] if not is_en else [
            "Hotel amenities & highlights",
            "View 24/7 Room Service menu",
            "Directions to Front Desk",
        ]

    # 13. Gợi ý cá nhân hóa theo Profile nhân khẩu học (Demographics) liên kết 100% với RAG
    age_str = (age_group or "").lower()
    gender_str = (gender or "").lower()

    if "child" in age_str or "kid" in age_str:
        return [
            "Chỉ đường Hồ Bơi Vô Cực Tầng 5",
            "Menu nước ép Room Service 24/7",
            "Cửa Hàng Lưu Niệm Tầng 6",
        ] if not is_en else [
            "Directions to Infinity Pool Level 5",
            "Kids juice & Room Service menu",
            "Gift Shop at Level 6",
        ]

    if gender_str == "female" and ("young" in age_str or "adult" in age_str):
        return [
            "Thảo Mộc Spa & Xông hơi Tầng 5",
            "Rooftop Coffee ngắm hoàng hôn Tầng 6",
            "Hồ Bơi Vô Cực Tầng 5",
        ] if not is_en else [
            "Herbal Spa & Sauna at Level 5",
            "Rooftop Coffee sunset view Level 6",
            "Infinity Pool at Level 5",
        ]

    if gender_str == "male" and ("young" in age_str or "adult" in age_str):
        return [
            "Phòng Gym 24/7 Tầng 5",
            "Sky Lounge Bar Tầng 6",
            "Phòng VIP Karaoke Tầng 6",
        ] if not is_en else [
            "24/7 Fitness Center Level 5",
            "Sky Lounge Bar Level 6",
            "VIP Karaoke Level 6",
        ]

    if "senior" in age_str:
        return [
            "Thảo Mộc Spa trị liệu Tầng 5",
            "Trà thảo mộc thanh tịnh Rooftop Tầng 6",
            "Quầy Lễ Tân hỗ trợ 24/7 Tầng Trệt",
        ] if not is_en else [
            "Herbal Spa therapy Level 5",
            "Herbal tea at Rooftop Coffee Level 6",
            "Front Desk 24/7 assistance Ground Level",
        ]

    # 14. Mặc định tự nhiên (Đồng bộ RAG Aurora Grand Hotel)
    return [
        "Khách sạn có những tiện ích gì?",
        "Xem thực đơn Room Service 24/7",
        "Chỉ đường quầy Lễ tân",
    ] if not is_en else [
        "Hotel amenities & highlights",
        "View 24/7 Room Service menu",
        "Directions to Front Desk",
    ]
