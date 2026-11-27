"""Destination POI extraction helper for interactive robot navigation responses."""

import re

from app.services.ai.session_manager import (
    extract_room_number,
    is_valid_hotel_room,
    session_manager,
)


def _detect_destination_poi(prompt: str, reply: str = "", room_number: str | None = None, session_id: str | None = None) -> str | None:
    """
    Nhận diện mã điểm đến POI để đồng bộ bản đồ 8 tầng.
    Chỉ kích hoạt khi câu hỏi của người dùng (prompt) thực sự có ý định hỏi đường/vị trí.
    Tuyệt đối không tự tiện bật bản đồ khi người dùng chỉ hỏi thông tin dịch vụ thông thường
    mà câu trả lời của AI có nhắc đến quầy lễ tân hoặc tiện ích.
    Hỗ trợ kế thừa POI từ câu hỏi gợi ý ở lượt trước qua Session Memory.
    """
    p_lower = (prompt or "").lower().strip()
    r_lower = (reply or "").lower().strip()

    # Neu cau hoi nhac toi phong khong ton tai hoac phan hoi thong bao phong khong ton tai -> Tuyet doi khong bat ban do
    cand_room = extract_room_number(p_lower)
    if cand_room and not is_valid_hotel_room(cand_room):
        return None

    if any(neg in r_lower for neg in ["không có phòng", "does not have room", "không tồn tại"]):
        return None

    # Nếu khách hỏi đường tới các địa điểm bên ngoài khách sạn -> Tuyệt đối KHÔNG bật bản đồ trong nhà
    external_places = [
        "sân bay", "airport", "nội bài", "tân sơn nhất", "ga tàu", "ga hà nội",
        "bến xe", "bãi biển", "ra biển", "chợ", "chợ đêm", "bến thành",
        "phố cổ", "hồ gươm", "trung tâm thương mại", "vincom", "bệnh viện",
        "bảo tàng", "ngoài khách sạn", "địa điểm du lịch", "tour", "bắt taxi", "bắt xe", "grab"
    ]
    if any(k in p_lower for k in external_places):
        return None

    # Khong bat ban do voi cau hoi ve nhan vat, kien thuc chung, van dong vien, thuc the ngoai khach san
    is_general_knowledge = bool(re.search(
        r'\b(vận động viên|van dong vien|cầu thủ|cau thu|ca sĩ|ca si|diễn viên|dien vien|nhạc sĩ|nhac si|tác giả|tac gia|nhà văn|nha van|nhà thơ|nha tho|tổng thống|tong thong|thủ tướng|thu tuong|chủ tịch|chu tich|người nổi tiếng|nguoi noi tieng|nhân vật|nhan vat|ông là ai|bà là ai|anh là ai|chị là ai|họ là ai|là ai|ai là|ai thế|ai vậy|who is|who are|who was|bài hát|bai hat|bài thơ|bai tho|bộ phim|bo phim|cuốn sách|cuon sach|lịch sử|lich su|tiểu sử|tieu su|nguồn gốc|nguon goc|định nghĩa|dinh nghia|khái niệm|khai niem|thế nào là|the nao la|ý nghĩa là|công thức|cong thuc|tại sao|tai sao|vì sao|vi sao|lý do gì|ly do gi)\b',
        p_lower,
        re.IGNORECASE
    ))
    if is_general_knowledge:
        return None

    # Danh mục từ khóa biểu thị ý định hỏi đường / điều hướng / tìm vị trí
    nav_intent_phrases = [
        "ở đâu", "o dau", "chỗ nào", "cho nao", "nơi nào", "noi nao",
        "tầng mấy", "tang may", "ở tầng", "o tang", "tầng 1", "tầng 2", "tầng 3", "tầng 4", "tầng 5", "tầng 6", "lầu 1", "lầu 2", "tang 1", "tang 2", "floor 1", "floor 2", "floor 3", "floor 4", "floor 5", "floor 6", "f1", "f2", "f3", "f4", "f5", "f6", "hướng nào", "huong nao",
        "đường đi", "duong di", "đường đến", "duong den", "đường ra", "duong ra",
        "chỉ đường", "chi duong", "dẫn đường", "dan duong", "hướng dẫn đường",
        "lối đi", "loi di", "lối lên", "loi len", "lối xuống", "loi xuong",
        "làm sao để đến", "lam sao de den", "cách đi", "cach di", "cách đến", "cach den",
        "đi đến", "di den", "đi tới", "di toi", "đi ra", "di ra", "đi lên", "di len", "đi xuống", "di xuong",
        "dẫn tôi", "dan toi", "dắt tôi", "cho tôi đến", "cho toi den",
        "tôi muốn đến", "toi muon den", "tôi muốn đi", "toi muon di",
        "đưa tôi", "dua toi", "tìm đường", "tim duong", "vị trí", "vi tri", "chỉ tôi", "chi toi",
        "where is", "where are", "where's", "which floor", "how to get", "how do i get",
        "way to", "directions to", "show me the way", "take me to", "lead me to", "navigate to"
    ]

    # Danh mục cụm từ đi tới địa điểm trực tiếp (dù không có chữ 'ở đâu')
    direct_loc_phrases = [
        "đi vệ sinh", "di ve sinh", "đi toilet", "di toilet", "đi tolet", "đi toa lét", "đi to lét", "đi wc", "di wc",
        "ra lễ tân", "ra quầy", "lên hồ bơi", "ra hồ bơi", "xuống bãi xe",
        "vào thang máy", "lên phòng gym", "đi massage", "đi spa", "đi tới spa", "đi đến spa", "đến spa", "tới spa", "lên spa", "chỉ đường tới spa"
    ]

    # Kiểm tra xem câu hỏi có chứa số phòng cụ thể cần tìm (3xx hoặc 4xx)
    room_4xx_match = re.search(r'\b(?:phòng|p\.?|phong)?\s*(?:số\s*)?(40[1-9]|410)\b', p_lower)
    room_3xx_match = re.search(r'\b(?:phòng|p\.?|phong)?\s*(?:số\s*)?(30[1-9]|310)\b', p_lower)

    # Cụm từ hỏi đường lên phòng nghỉ chung chung
    general_room_phrases = [
        "phòng của tôi", "phong cua toi", "phòng tôi", "phong toi",
        "đến phòng", "den phong", "lên phòng", "len phong", "về phòng", "ve phong",
        "ra phòng", "ra phong", "tìm phòng", "tim phong", "hướng dẫn phòng",
        "hướng dẫn lên phòng", "hướng dẫn về phòng", "lối lên phòng", "loi len phong",
        "đường lên phòng", "duong len phong", "đường về phòng", "duong ve phong",
        "chỉ đường phòng", "chi duong phong", "chỉ đường đến phòng", "chỉ đường về phòng",
        "cho tôi lên phòng", "cho toi len phong", "cho tôi về phòng", "dẫn tôi lên phòng",
        "phòng ở đâu", "phòng nghỉ", "khu phòng", "dãy phòng",
        "my room", "to my room", "to the room", "guest room", "hotel room"
    ]
    is_general_room_query = any(k in p_lower for k in general_room_phrases) or (
        any(k in p_lower for k in ["phòng", "phong", "room"]) and any(k in p_lower for k in nav_intent_phrases)
    )

    # Khách nói cộc lốc tên địa điểm (<= 4 từ) hoặc có ý định hỏi đường rõ ràng
    p_words = p_lower.split()
    is_short_location_utterance = len(p_words) <= 6 and any(
        k in p_lower for k in [
            "toilet", "tolet", "toa lét", "to lét", "toilét", "toalet", "tô lét", "toilette", "vệ sinh", "wc", "restroom", "washroom", "hồ bơi", "pool", "gym", "spa",
            "lễ tân", "reception", "bãi xe", "phòng", "bar", "quầy bar", "sky bar", "quán bar", "quầy ba", "sky ba", "rooftop ba", "quán ba", "lên ba", "đi ba", "ba ở đâu"
        ]
    )

    # Phân biệt yêu cầu dịch vụ / đặt món (có kèm số phòng) với câu hỏi đường lên phòng
    service_order_indicators = [
        "đặt", "dat", "gọi", "goi", "order", "mang", "giao", "lấy", "lay",
        "đem", "gửi", "gui", "chuyển", "chuyen", "thêm", "them", "mượn", "muon",
        "dọn", "don", "sửa", "sua", "hỏng", "hong", "báo thức", "cần", "can",
        "làm phiền", "phục vụ", "phuc vu",
        # Danh từ vật phẩm, tiện ích phòng và F&B
        "nước", "nuoc", "chai nước", "nước suối", "nước khoáng", "nước lọc",
        "khăn", "khan", "khăn tắm", "khăn mặt", "gối", "goi", "chăn", "chan", "mền", "men",
        "nệm", "nem", "ga giường", "dép", "dep", "bàn ủi", "ban ui", "bàn là", "ban la",
        "máy sấy", "may say", "bàn chải", "ban chai", "kem đánh răng", "dao cạo", "dao cao",
        "dầu gội", "dau goi", "sữa tắm", "sua tam", "áo choàng", "ao choang",
        "đồ ăn", "do an", "thức ăn", "thuc an", "món ăn", "mon an", "cơm", "phở", "pho", "mì", "mi",
        "pizza", "bánh mì", "cà phê", "cafe", "trà", "tra", "đá lạnh", "da lanh",
        "ly", "cốc", "coc", "chén", "chen", "bát", "bat", "dĩa", "dia", "đĩa", "muỗng", "muong", "thìa", "thia"
    ]
    explicit_nav_phrases = [
        "ở đâu", "o dau", "chỗ nào", "cho nao", "nơi nào", "noi nao",
        "tầng mấy", "tang may", "ở tầng", "o tang", "vị trí", "vi tri",
        "hướng nào", "huong nao", "lối nào", "loi nao", "đường nào", "duong nao",
        "đi hướng nào", "đi lối nào", "đi đường nào",
        "chỉ đường", "chi duong", "dẫn đường", "dan duong", "hướng dẫn đường",
        "lối đi", "loi di", "lối lên", "loi len", "lối xuống", "loi xuong",
        "đường đến", "duong den", "đường đi", "duong di", "đường lên", "duong len", "đường về", "duong ve",
        "cách đi", "cach di", "cách đến", "cach den", "làm sao để đến", "lam sao de den",
        "đi đến", "di den", "đi tới", "di toi", "đi lên", "di len",
        "dẫn tôi", "dan toi", "đưa tôi", "dua toi",
        "tìm phòng", "tim phong", "tìm đường", "tim duong",
        "where is", "where are", "where's", "which way", "which floor", "how do i get", "how to get", "show me the way", "directions to", "lead me to", "take me to", "navigate"
    ]

    has_item_order_pattern = bool(re.search(
        r'(?:cho|gửi|mang|đem|giao)\s+(?:tôi|toi|em|anh|chị|chi|mình|minh)\s+(?:xin|mượn|muon|\d+|một|hai|ba|bốn|năm|vài|chai|ly|cốc|đĩa|bát|tô|phần|suất|khăn|gối|chăn|mền|bàn|máy|nước|đồ|cơm|phở)',
        p_lower
    ))
    is_service_order_context = has_item_order_pattern or any(w in p_lower for w in service_order_indicators)
    has_explicit_nav = any(w in p_lower for w in explicit_nav_phrases)

    # Khi có yêu cầu dịch vụ hoặc mang đồ lên phòng mà không có cụm từ hỏi đường tường minh -> Tuyệt đối không coi là Navigation tới phòng
    if (room_4xx_match or room_3xx_match or is_general_room_query) and is_service_order_context and not has_explicit_nav:
        return None

    # Câu hỏi về thông tin chi tiết dịch vụ (chương trình, khuyến mãi, ưu đãi, giờ mở cửa, menu, giá, giới thiệu...) mà không hỏi đường tường minh -> Không bật bản đồ chỉ đường
    detail_info_phrases = [
        "chương trình", "chuong trinh", "sự kiện", "su kien", "hoạt động", "hoat dong",
        "khuyến mãi", "khuyen mai", "ưu đãi", "uu dai", "giảm giá", "giam gia",
        "giới thiệu", "gioi thieu", "thông tin", "thong tin", "chi tiết", "chi tiet",
        "mở cửa", "mo cua", "đóng cửa", "dong cua", "giờ mở", "gio mo", "giờ đóng", "gio dong", "mấy giờ", "may gio",
        "bán gì", "ban gi", "phục vụ gì", "phuc vu gi", "có bán", "co ban", "có phục vụ", "co phuc vu",
        "miễn phí", "mien phi", "tốn phí", "ton phi", "mất phí", "mat phi",
        "menu", "bảng giá", "bang gia", "giá cả", "gia ca", "bao nhiêu tiền", "bao nhieu tien",
        "có gì", "co gi", "gì không", "gi khong", "đặc biệt", "dac biet", "nổi bật", "noi bat",
        "promotion", "promo", "event", "events", "offer", "offers", "discount", "program", "programs",
        "introduce", "tell me about", "info", "information", "detail", "details",
        "service", "services", "price", "pricing", "opening hours", "hours", "free"
    ]
    if any(k in p_lower for k in detail_info_phrases) and not has_explicit_nav:
        return None

    room_nav_match = (room_4xx_match is not None or room_3xx_match is not None or is_general_room_query) and (not is_service_order_context or has_explicit_nav)

    has_explicit_map_request = bool(
        re.search(r'(?:^|\b)(?:bản đồ|ban do|sơ đồ|so do|map)(?:\b|$)', p_lower)
    ) and not is_service_order_context

    has_nav_intent = (
        room_nav_match or
        any(k in p_lower for k in nav_intent_phrases) or
        any(k in p_lower for k in direct_loc_phrases) or
        is_short_location_utterance or
        has_explicit_map_request
    )

    # Bỏ qua các câu hỏi tổng quan về dịch vụ / tiện ích của khách sạn (không nhắm đến 1 địa điểm cụ thể)
    general_overview_queries = [
        "dịch vụ về khách sạn", "dịch vụ của khách sạn", "dịch vụ khách sạn",
        "các dịch vụ", "tiện ích khách sạn", "các tiện ích", "tiện ích của khách sạn",
        "cơ sở vật chất", "khách sạn có gì", "khách sạn có những gì", "khách sạn có những dịch vụ gì",
        "khách sạn có những tiện ích gì", "giới thiệu khách sạn", "giới thiệu về khách sạn",
        "thông tin về khách sạn", "thông tin khách sạn", "hotel amenities", "hotel facilities",
        "all services", "ở đây có gì", "có những dịch vụ gì", "có những tiện ích gì"
    ]
    if any(k in p_lower for k in general_overview_queries) and not is_general_room_query:
        return None

    # NẾU KHÔNG CÓ Ý ĐỊNH HỎI ĐƯỜNG -> TUYỆT ĐỐI KHÔNG BẬT BẢN ĐỒ CHỈ ĐƯỜNG
    if not has_nav_intent:
        return None

    # 1. Nhận diện các phòng Tầng 4 (401 -> 409) khi có ý định hỏi đường
    if room_nav_match and room_4xx_match:
        return f"room_{room_4xx_match.group(1)}"

    # 2. Nhận diện các phòng Tầng 3 (301 -> 309) khi có ý định hỏi đường
    if room_nav_match and room_3xx_match:
        return f"room_{room_3xx_match.group(1)}"

    # 2b. Kiểm tra phản hồi của AI nếu có chứa số phòng cụ thể (không áp dụng khi hỏi chung chung hoặc trong ngữ cảnh yêu cầu dịch vụ)
    if not is_general_room_query and not is_service_order_context and r_lower:
        if "từ phòng" not in r_lower and "đến phòng" not in r_lower:
            if "từ 401" not in r_lower and "từ 301" not in r_lower:
                r_4xx = re.search(r'\b(?:phòng|p\.?|phong)?\s*(?:số\s*)?(40[1-9]|410)\b', r_lower)
                if r_4xx:
                    return f"room_{r_4xx.group(1)}"
                r_3xx = re.search(r'\b(?:phòng|p\.?|phong)?\s*(?:số\s*)?(30[1-9]|310)\b', r_lower)
                if r_3xx:
                    return f"room_{r_3xx.group(1)}"

    # 3. Khu vực Vệ Sinh (Toilet / WC / Restroom toàn khách sạn)
    # Phân định rõ ràng: Chỉ nhận diện là Toilet khi khách thực sự tìm nhà vệ sinh / đi vệ sinh,
    # tuyệt đối loại trừ các câu hỏi về đồ dùng cá nhân (băng vệ sinh, đồ vệ sinh cá nhân, dọn vệ sinh phòng...)
    is_toilet_query = any(k in p_lower for k in [
        "nhà vệ sinh", "nha ve sinh", "phòng vệ sinh", "phong ve sinh",
        "đi vệ sinh", "di ve sinh", "toilet", "tolet", "toa lét", "to lét", "toilét", "toalet", "tô lét", "toilette",
        "wc", "restroom", "rest room", "washroom",
        "đi toilet", "đi tolet", "đi toa lét", "đi to lét", "chỗ rửa tay", "nơi rửa tay", "chỗ đi vệ sinh", "nơi đi vệ sinh"
    ]) or (
        ("vệ sinh" in p_lower or "ve sinh" in p_lower)
        and any(w in p_lower for w in ["đi", "di", "lối", "loi", "hướng", "huong", "tầng", "tang", "lầu", "lau", "ở đâu", "o dau", "chỗ", "cho", "nơi", "noi"])
        and not any(neg in p_lower for neg in ["băng", "bang", "đồ", "do", "dọn", "don", "mua", "bán", "ban", "cá nhân", "ca nhan", "tạp hóa", "siêu thị", "tampon", "tiện ích", "giấy"])
    )
    if is_toilet_query:
        if any(f in p_lower for f in ["tầng 2", "tang 2", "lầu 2", "lau 2", "f2", "floor 2", "nhà hàng", "bếp", "kho"]):
            return "restroom_f2"
        if any(f in p_lower for f in ["sảnh", "tầng 1", "trệt", "lễ tân", "ground"]):
            return "restroom_ground"
        return "restroom_ground"

    # 4. Khu vực Tầng 2 (Bếp, Nhận món, Kho, Sơ chế, Nhà hàng)
    if any(k in p_lower for k in ["nhà bếp", "nha bep", "khu bếp", "bếp chính", "kitchen"]):
        return "kitchen"
    if any(k in p_lower for k in ["sơ chế", "so che", "chuẩn bị món", "preparation"]):
        return "preparation_area"
    if any(k in p_lower for k in ["kho hàng", "kho hang", "kho nguyên liệu", "kho thực phẩm", "warehouse"]):
        return "warehouse"
    # Khách sạn không có nhà hàng và buffet, chỉ có bếp nội bộ phục vụ gọi món lên phòng
    if any(k in p_lower for k in ["quầy nhận món", "quay nhan mon", "pickup"]):
        return "pickup_area"

    # 5. Tiện ích Tầng 5 & Tầng 6
    if any(k in p_lower for k in ["hồ bơi", "ho boi", "bể bơi", "swimming pool", "infinity pool"]):
        return "infinity_pool"
    if any(k in p_lower for k in ["rooftop", "cafe", "cà phê", "coffee"]):
        return "rooftop_coffee"
    if any(k in p_lower for k in [
        "quầy bar", "quay bar", "sky bar", "sky lounge", "uống rượu", "bar",
        "quầy ba", "quay ba", "quán ba", "quan ba", "sky ba", "rooftop ba", "ba ở đâu", "ba o dau", "lên ba", "len ba", "đi ba", "di ba", "uống ở ba"
    ]):
        return "bar"
    if any(k in p_lower for k in ["karaoke", "hát karaoke", "phòng hát"]):
        return "karaoke"
    if any(k in p_lower for k in ["gym", "thể hình", "the hinh", "fitness", "tập gym"]):
        return "gym"
    if any(k in p_lower for k in ["spa", "massage", "xông hơi", "mát xa"]):
        return "spa"
    if any(k in p_lower for k in ["lưu niệm", "gift shop", "cửa hàng quà"]):
        return "gift_shop"
    if any(k in p_lower for k in ["thay đồ", "locker", "tủ đồ"]):
        return "locker_room"

    # 6. Tiện ích Tầng Trệt & Bãi xe
    if any(k in p_lower for k in ["lễ tân", "tiếp tân", "quầy lễ tân", "bàn lễ tân", "front desk", "check-in", "check in"]):
        return "front_desk"
    if any(k in p_lower for k in ["xe máy", "gửi xe máy", "bãi xe máy", "xe đạp", "hầm b1"]):
        return "parking_bike"
    if any(k in p_lower for k in ["đỗ ô tô", "bãi ô tô", "bãi xe ô tô", "hầm b2", "xe hơi"]):
        return "parking_car"
    if any(k in p_lower for k in ["bãi xe", "đỗ xe", "gửi xe", "parking"]):
        return "parking_car"

    # 7. Nếu khách hỏi đường lên phòng nghỉ chung chung (không trùng các tiện ích trên)
    if is_general_room_query:
        if room_number:
            clean_rn = room_number.strip()
            if re.match(r'^(?:40[1-9]|30[1-9])$', clean_rn):
                return f"room_{clean_rn}"
        return None

    # 8. Nếu câu không nhắc POI mới nhưng là câu nối tiếp/xác nhận/mở lại map -> kế thừa POI từ lượt trước
    if session_id:
        affirmative_nav = bool(re.search(
            r'(?:^|\b)(?:chỉ đường|chi duong|dẫn đường|dan duong|chỉ luôn|chỉ đi|dẫn đi|mở bản đồ|mo ban do|xem bản đồ|hiện bản đồ|mở map|xem map|hiện map|map của tôi đâu|bản đồ đâu|bản đồ của tôi đâu|dẫn tôi đi|chỉ tôi đi|show me the map|open the map|show map|take me there|navigate)(?:\b|$)'
            r'|'
            r'^(?:có|dạ có|da co|ừ|uh|yes|sure)[\s\!\.\?]*$',
            p_lower
        ))
        if affirmative_nav:
            last_key = session_manager.get_last_destination_key(session_id)
            if last_key:
                return last_key

    # 9. Yêu cầu mở bản đồ / chỉ đường chung chung chưa nêu rõ địa điểm (khớp FloorMap.jsx fallback)
    if re.search(r'(?:^|\b)(?:bản đồ|ban do|sơ đồ|so do|map|chỉ đường|chi duong|directions)(?:\b|$)', p_lower):
        return "infinity_pool"

    return None
