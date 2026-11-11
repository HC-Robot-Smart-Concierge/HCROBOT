import asyncio
import json
import logging
import re
import time
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.ai import ChatRequest, ChatResponse
from langchain_core.runnables import RunnableConfig
from app.services.ai.session_manager import session_manager, extract_room_number, is_valid_hotel_room
from app.services.ai.concierge_graph import concierge_graph, intent_router_node, service_fsm_node, retrieval_node
from app.services.ai.tts_service import tts_service
from app.services.ai.ollama_service import ollama_service
from app.services.ai.ai_ticket_service import create_live_call_session, background_extract_and_create_ticket, create_maintenance_voice_ticket
from app.services.maintenance_request_service import duplicate_maintenance_message, merged_maintenance_message
from app.core.config import settings

logger = logging.getLogger(__name__)


async def _submit_maintenance_for_chat(db, room_number, items, english):
    try:
        code, created, merged = await create_maintenance_voice_ticket(db, room_number, items)
        if merged:
            return code, merged_maintenance_message(code, english)
        return code, None if created else duplicate_maintenance_message(code, english)
    except Exception:
        await db.rollback()
        logger.exception("[AIChatService] Maintenance request was not saved")
        return None, (
            "I couldn't submit your maintenance request. Please try again."
            if english else "Em chưa gửi được yêu cầu bảo trì. Quý khách vui lòng thử lại."
        )


def _detect_destination_poi(prompt: str, reply: str = "", room_number: str | None = None) -> str | None:
    """
    Nhận diện mã điểm đến POI để đồng bộ bản đồ 8 tầng.
    Chỉ kích hoạt khi câu hỏi của người dùng (prompt) thực sự có ý định hỏi đường/vị trí.
    Tuyệt đối không tự tiện bật bản đồ khi người dùng chỉ hỏi thông tin dịch vụ thông thường
    mà câu trả lời của AI có nhắc đến quầy lễ tân hoặc tiện ích.
    """
    p_lower = (prompt or "").lower().strip()
    r_lower = (reply or "").lower().strip()
    combined = f"{p_lower} {r_lower}".strip()

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
        "way to", "directions to", "show me the way", "take me to", "lead me to", "navigate to",
        "giới thiệu", "gioi thieu", "thông tin về", "introduce", "tell me about"
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
        "hướng nào", "huong nao", "lối nào", "loi nao", "đường nào", "duong nao",
        "đi hướng nào", "đi lối nào", "đi đường nào",
        "chỉ đường", "chi duong", "dẫn đường", "dan duong", "hướng dẫn đường",
        "lối đi", "loi di", "lối lên", "loi len", "lối xuống", "loi xuong",
        "đường đến", "duong den", "đường đi", "duong di", "đường lên", "duong len", "đường về", "duong ve",
        "cách đi", "cach di", "cách đến", "cach den", "làm sao để đến", "lam sao de den",
        "tìm phòng", "tim phong", "tìm đường", "tim duong",
        "where is", "where are", "where's", "which way", "which floor", "how do i get", "how to get", "show me the way", "directions to", "lead me to", "take me to"
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

    room_nav_match = bool((room_4xx_match or room_3xx_match or is_general_room_query) and (not is_service_order_context or has_explicit_nav))

    has_nav_intent = (
        room_nav_match or
        any(k in p_lower for k in nav_intent_phrases) or
        any(k in p_lower for k in direct_loc_phrases) or
        is_short_location_utterance
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
            clean_rn = str(room_number).strip()
            if re.match(r'^(?:40[1-9]|30[1-9])$', clean_rn):
                return f"room_{clean_rn}"
        return None

    return None


async def process_chat_request(db: AsyncSession, request: ChatRequest) -> ChatResponse:
    """
    Điều phối luồng xử lý câu thoại của khách:
    1. Cập nhật Session Memory (Số phòng & Ngữ cảnh đa lượt).
    2. Chạy LangGraph Concierge Harness (Fast-Path hoặc Ollama Generator).
    3. Cập nhật lượt hội thoại vào Session Memory.
    4. Tổng hợp giọng đọc TTS (Hoài My - EdgeTTS).
    5. Xử lý tác vụ nghiệp vụ: Khởi tạo Live Video Call hoặc tạo Background Service Ticket.
    6. Nhận diện điểm đến POI cho bản đồ tương tác.
    """
    sid = request.session_id or "default_session"

    # Cập nhật số phòng nếu truyền trực tiếp hoặc bóc tách từ câu nói
    extracted_from_prompt = extract_room_number(request.prompt)
    if request.room_number and is_valid_hotel_room(request.room_number):
        session_manager.set_room_number(sid, request.room_number)
    elif extracted_from_prompt and is_valid_hotel_room(extracted_from_prompt):
        session_manager.set_room_number(sid, extracted_from_prompt)

    current_room = session_manager.get_room_number(sid)
    history = session_manager.get_history(sid)

    # 0. REDIS CLOUD FAST AI CACHE CHECK (< 5ms)
    # Bỏ qua Redis Cache nếu:
    # 1. Session đang có pending_intent chờ khách bổ sung số phòng
    # 2. Câu hỏi kiểm tra tiến độ/trạng thái đơn món (cần dữ liệu DB thời gian thực của bếp)
    # 3. Yêu cầu dịch vụ cụ thể hoặc câu nói có số phòng hoặc mở menu
    from app.services.ai.constants import SERVICE_KEYWORDS
    prompt_lower_req = (request.prompt or "").lower()
    is_status_query_req = any(k in prompt_lower_req for k in SERVICE_KEYWORDS.get("query_order_status", []))
    pending_intent_exist = bool(session_manager.get_pending_intent(sid))
    has_room_in_prompt = bool(extracted_from_prompt or request.room_number)
    is_actionable_service = any(
        any(re.search(rf'\b{re.escape(k)}\b', prompt_lower_req) for k in kws)
        for act_key, kws in SERVICE_KEYWORDS.items()
        if act_key not in ["chitchat", "faq"]
    )
    is_menu_action = any(k in prompt_lower_req for k in ["menu", "thực đơn", "thuc don", "đặt món", "gọi món", "order", "đồ ăn", "thức ăn", "dịch vụ phòng", "room service"])

    cached_ai = None
    if not pending_intent_exist and not is_status_query_req and not has_room_in_prompt and not is_actionable_service and not is_menu_action:
        from app.services.cache.redis_service import redis_service
        cached_ai = await redis_service.get_ai_cache(request.prompt, request.language or "vi")
    if cached_ai and cached_ai.get("full_text"):
        reply = cached_ai["full_text"]
        if not request.language or request.language.lower() in ("auto", "bilingual"):
            detected_lang, lang_code = ollama_service.detect_language(request.prompt)
        else:
            detected_lang = cached_ai.get("detected_language") or ("English" if "en" in (request.language or "").lower() else "Tiếng Việt")
            lang_code = cached_ai.get("lang_code") or ("en-US" if detected_lang == "English" else "vi-VN")
        act = cached_ai.get("action", "conversation")
        dest_key = cached_ai.get("destination_key")

        # Đảm bảo không bị mất destination_key nếu cache cũ lưu None
        if not dest_key:
            from app.services.ai.scenario_service import scenario_service
            sc_match = scenario_service.match_fast_path(request.prompt, lang_code=lang_code)
            if sc_match and len(sc_match) >= 5:
                if sc_match[3] == "none":
                    dest_key = None
                elif isinstance(sc_match[4], dict):
                    dest_key = sc_match[4].get("destination_key")
            if not dest_key and (not sc_match or sc_match[3] != "none"):
                dest_key = _detect_destination_poi(request.prompt, reply, current_room)

        session_manager.add_turn(sid, "user", request.prompt, language=lang_code)
        session_manager.add_turn(sid, "assistant", reply, language=lang_code, intent_action=act)

        try:
            audio_b64, mime_type, _ = await asyncio.wait_for(
                tts_service.synthesize(reply, provider="edge", language=lang_code),
                timeout=12.0
            )
        except Exception:
            audio_b64, mime_type = None, "audio/mp3"

        return ChatResponse(
            response=reply,
            model_used="redis_cloud_cache",
            detected_language=detected_lang,
            lang_code=lang_code,
            action=act,
            session_id=sid,
            current_room_number=(current_room if is_valid_hotel_room(current_room) else None),
            destination_key=dest_key,
            trigger_video_call=False,
            ticket_created=False,
            audio_base64=audio_b64,
            mime_type=mime_type or "audio/mp3",
        )

    # Điều phối hội thoại trực tiếp qua LangGraph Harness
    if not request.language or request.language.lower() in ["auto", "bilingual", ""]:
        cur_lang_name, cur_lang_code = ollama_service.detect_language(request.prompt)
    else:
        cur_lang_name = request.language
        cur_lang_code = "en-US" if (request.language.lower().startswith("en") or "english" in request.language.lower()) else "vi-VN"

    initial_state = {
        "session_id": sid,
        "prompt": request.prompt,
        "language": request.language,
        "lang_name": cur_lang_name,
        "lang_code": cur_lang_code,
        "emotion": request.emotion,
        "room_number": current_room,
        "is_room_authenticated": bool(current_room and session_manager.is_room_authenticated(sid, current_room)),
        "chat_history": history,
        "destination_key": None,
        "trigger_video_call": False,
    }
    t_start = time.perf_counter()
    graph_config: RunnableConfig = {"configurable": {"thread_id": sid}}
    graph_result = await concierge_graph.ainvoke(initial_state, config=graph_config)
    t_graph = time.perf_counter()

    reply = graph_result.get("response", "")
    detected_lang = graph_result.get("lang_name", "Tiếng Việt")
    lang_code = graph_result.get("lang_code", "vi-VN")
    act = graph_result.get("action", "conversation")

    # Thêm lượt nói vào bộ nhớ RAM của phiên để duy trì ngữ cảnh nhiều lượt
    session_manager.add_turn(sid, "user", request.prompt, language=lang_code)
    session_manager.add_turn(sid, "assistant", reply, language=lang_code, intent_action=act)
    if act == "switch_language":
        session_manager.set_language(sid, detected_lang)

    # Lấy audio_base64 từ TTS Service (EdgeTTS với fallback sang WebSpeech nếu quá 4.8s)
    try:
        audio_b64, mime_type, _ = await asyncio.wait_for(
            tts_service.synthesize(reply, provider="edge", language=lang_code),
            timeout=7.0
        )
    except Exception as e_tts:
        logger.warning(f"[AIChatService] TTS online timeout/error, fallback to frontend WebSpeech: {e_tts}")
        audio_b64, mime_type = None, "audio/mp3"
    t_tts = time.perf_counter()
    clean_p = request.prompt.encode('ascii', errors='replace').decode('ascii')
    print(f"\n[TIMING BENCHMARK] prompt='{clean_p}' | Graph: {t_graph - t_start:.3f}s | TTS: {t_tts - t_graph:.3f}s | Total: {t_tts - t_start:.3f}s\n", flush=True)

    # Cập nhật số phòng mới nhất từ kết quả Graph hoặc Session Manager
    updated_room = graph_result.get("room_number") or session_manager.get_room_number(sid)
    if updated_room:
        session_manager.set_room_number(sid, updated_room)
        current_room = updated_room

    # Xử lý Intent phân loại tác vụ dịch vụ / cuộc gọi
    act = graph_result.get("action")
    items = graph_result.get("items") or request.prompt
    is_video_call = bool(graph_result.get("trigger_video_call") or act == "concierge")
    missing_room = bool(graph_result.get("missing_room_number", False))
    require_pin = bool(graph_result.get("require_room_pin", False))
    target_room = graph_result.get("target_room_number") or current_room
    pending_act = graph_result.get("pending_service_action") or act
    pending_items = graph_result.get("pending_service_items") or items
    status_q_type = graph_result.get("status_query_type")
    support_session_id = None
    call_ticket_code = None

    if is_video_call:
        support_session_id, call_ticket_code = await create_live_call_session(
            db, request.prompt, current_room
        )
    elif require_pin:
        # Tạm dừng tạo ticket tự động - chờ khách bấm xác thực PIN trên màn hình Kiosk
        logger.info(f"[AIChatService] Service request '{act}' for Room {target_room} requires Touch PIN verification.")
    elif act and act not in ["chitchat", "conversation", "faq", "fast_path", "provide_room_number", "query_order_status", "unknown", "taxi", "book_taxi", "taxi_booking", "open_food_menu", "open_room_service_menu", "open_maintenance_menu"]:
        # Chỉ tạo ticket khi đã có số phòng và không cần PIN
        if not missing_room and current_room:
            if act == "maintenance":
                call_ticket_code, notice = await _submit_maintenance_for_chat(db, current_room, items, lang_code.startswith("en"))
                if notice:
                    reply = notice
                    audio_b64 = None  # Do not play the earlier "new ticket" response.
            else:
                asyncio.create_task(
                    background_extract_and_create_ticket(items, current_room, act, items)
                )
            logger.info(f"[AIChatService] Dispatched ticket creation for '{act}' (Room {current_room}): {items}")
        else:
            logger.info(f"[AIChatService] Service request '{act}' is waiting for room number from guest.")

    fast_hit_matched = graph_result.get("fast_path_hit")
    fast_action = graph_result.get("action")
    if fast_hit_matched and fast_action == "none":
        destination_key = None
    elif act == "query_order_status":
        destination_key = None
    else:
        destination_key = graph_result.get("destination_key") or _detect_destination_poi(request.prompt, reply, current_room)
    if destination_key and destination_key.startswith("room_"):
        r_part = destination_key.replace("room_", "")
        if not is_valid_hotel_room(r_part):
            destination_key = None
    eye_expression = graph_result.get("eye_expression")

    # Lưu kết quả vào Redis Cache (bỏ qua nếu là câu hỏi tra cứu trạng thái đơn món, yêu cầu dịch vụ hoặc có số phòng)
    if act not in ["query_order_status", "open_food_menu", "open_room_service_menu", "open_maintenance_menu", "room_service", "housekeeping", "laundry", "maintenance"] and not has_room_in_prompt and not is_menu_action:
        try:
            await redis_service.set_ai_cache(
                request.prompt,
                lang_code,
                {
                    "full_text": reply,
                    "detected_language": detected_lang,
                    "lang_code": lang_code,
                    "action": act,
                    "destination_key": destination_key,
                    "trigger_video_call": is_video_call,
                }
            )
        except Exception:
            pass

    return ChatResponse(
        response=reply,
        model_used=settings.active_llm_model,
        detected_language=detected_lang,
        lang_code=lang_code,
        action=act,
        session_id=sid,
        current_room_number=current_room,
        missing_room_number=missing_room,
        trigger_video_call=is_video_call,
        support_session_id=support_session_id,
        ticket_code=call_ticket_code,
        audio_base64=audio_b64,
        mime_type=mime_type or "audio/mp3",
        destination_key=destination_key,
        eye_expression=eye_expression,
        require_room_pin=require_pin,
        target_room_number=target_room,
        pending_service_action=pending_act,
        pending_service_items=pending_items,
        status_query_type=status_q_type,
        trigger_menu=graph_result.get("trigger_menu"),
    )


async def generate_chat_stream(request: ChatRequest) -> AsyncGenerator[str, None]:
    """
    Streaming tokens trực tiếp từ LangGraph Harness & Ollama LLM về client qua Server-Sent Events (SSE).
    Tích hợp Fast-Path (<1ms) và Service FSM (<2ms) kết hợp duy trì bộ nhớ đa lượt Session Memory.
    """
    try:
        sid = request.session_id or "default_session"
        extracted_from_prompt = extract_room_number(request.prompt)
        if request.room_number:
            session_manager.set_room_number(sid, request.room_number)
        elif extracted_from_prompt:
            session_manager.set_room_number(sid, extracted_from_prompt)
        current_room = session_manager.get_room_number(sid)
        history = session_manager.get_history(sid)

        # 0. Instant ACK (< 5ms)
        yield f"data: {json.dumps({'event': 'ack', 'status': 'connected'}, ensure_ascii=False)}\n\n"

        # 1. KIỂM TRA HARNESS: MEGA FAST-PATH (< 1ms)
        # Bỏ qua Fast-Path tĩnh nếu câu hỏi mang tính yêu cầu dịch vụ / đồ dùng buồng phòng
        prompt_l = request.prompt.lower()
        is_action_svc = bool(re.search(
            r'(cho (tôi|mình|em)|xin|lấy|mang|đem|gửi|thêm|mượn|cần|muốn|đặt|yêu cầu|order|bring|send|give me|need)',
            prompt_l,
            re.IGNORECASE
        )) and any(k in prompt_l for k in ["khăn", "khan", "gối", "chăn", "nệm", "dép", "bàn chải", "dầu gội", "sữa tắm", "massage", "giặt ủi", "dọn phòng", "món", "cơm", "nước", "đồ ăn"])
        fast_hit = None if is_action_svc else ollama_service.check_fast_path_full(request.prompt, request.language)
        if fast_hit:
            reply, lang_name, lang_code, act_type, act_payload = fast_hit
            dest_key = act_payload.get("destination_key") if isinstance(act_payload, dict) else None
            if not dest_key and act_type != "none":
                dest_key = _detect_destination_poi(request.prompt, reply, current_room)
            logger.info(f"[AIChatStream Fast-Path] Trả lời tức thì <1ms cho: '{request.prompt[:30]}' (dest: {dest_key})")

            words = reply.split(" ")
            for i, w in enumerate(words):
                token_piece = w + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'event': 'token', 'token': token_piece}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.008)

            session_manager.add_turn(sid, "user", request.prompt, language=lang_code)
            session_manager.add_turn(sid, "assistant", reply, language=lang_code, intent_action=act_type or "fast_path")
            done_payload = {
                "event": "done",
                "full_text": reply,
                "lang_code": lang_code,
                "room_number": current_room,
                "action": act_type or "fast_path",
                "destination_key": dest_key,
            }
            yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"
            return

        # 2. KIỂM TRA HARNESS: INTENT ROUTER & SERVICE FSM (< 2ms)
        router_state = await intent_router_node({
            "prompt": request.prompt,
            "room_number": current_room,
            "session_id": sid,
        })
        category = router_state.get("intent_category", "chitchat")
        action = router_state.get("action", "conversation")

        if category == "service":
            effective_room = router_state.get("room_number") or current_room
            if effective_room:
                session_manager.set_room_number(sid, effective_room)
                current_room = effective_room

            fsm_state = await service_fsm_node({
                "action": action,
                "session_id": sid,
                "is_room_authenticated": session_manager.is_room_authenticated(sid, effective_room),
                "room_number": effective_room,
                "items": router_state.get("items"),
                "lang_code": "en-US" if request.language and "en" in request.language.lower() else "vi-VN",
            })

            fsm_reply = fsm_state.get("response", "")
            is_call = bool(fsm_state.get("trigger_video_call") or action == "concierge")
            missing_room = bool(fsm_state.get("missing_room_number", False))
            fsm_items = router_state.get("items") or request.prompt

            # CHỈ TẠO TICKET KHI ĐÃ CÓ ĐẦY ĐỦ SỐ PHÒNG
            ticket_code = None
            if not is_call and not missing_room and not fsm_state.get("require_room_pin") and effective_room and action not in ["provide_room_number", "unknown", "chitchat", "conversation", "faq", "fast_path", "query_order_status", "taxi", "book_taxi", "taxi_booking", "open_food_menu", "open_room_service_menu", "open_maintenance_menu"]:
                if action == "maintenance":
                    from app.core.database import AsyncSessionLocal
                    async with AsyncSessionLocal() as ticket_db:
                        ticket_code, notice = await _submit_maintenance_for_chat(
                            ticket_db, effective_room, fsm_items, bool(request.language and "en" in request.language.lower()),
                        )
                    if notice:
                        fsm_reply = notice
                else:
                    asyncio.create_task(
                        background_extract_and_create_ticket(fsm_items, effective_room, action, fsm_items)
                    )
                logger.info(f"[AIChatStream] Dispatched ticket creation for '{action}' (Room {effective_room}): {fsm_items}")

            logger.info(f"[AIChatStream FSM] Trả lời FSM tức thì <2ms cho action: '{action}'")

            words = fsm_reply.split(" ")
            for i, w in enumerate(words):
                token_piece = w + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'event': 'token', 'token': token_piece}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.008)

            _, final_lang_code = ollama_service.detect_language(fsm_reply)
            session_manager.add_turn(sid, "user", request.prompt, language=final_lang_code)
            session_manager.add_turn(sid, "assistant", fsm_reply, language=final_lang_code, intent_action=action)

            done_payload = {
                "event": "done",
                "full_text": fsm_reply,
                "ticket_code": ticket_code,
                "require_room_pin": bool(fsm_state.get("require_room_pin")),
                "target_room_number": fsm_state.get("target_room_number"),
                "pending_service_action": fsm_state.get("pending_service_action"),
                "pending_service_items": fsm_state.get("pending_service_items"),
                "lang_code": final_lang_code,
                "room_number": effective_room,
                "missing_room_number": missing_room,
                "action": action,
                "trigger_video_call": is_call,
            }
            yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"
            return

        # 3. NẾU LÀ FAQ: TRUY VẤN VÀ CẮT GỌT RAG CONTEXT (HARNESS CONTEXT PRUNING)
        rag_context = request.rag_context
        if category == "faq" and not rag_context:
            try:
                retrieval_res = await retrieval_node({"prompt": request.prompt})
                rag_context = retrieval_res.get("rag_context", "")
            except Exception as ex_rag:
                logger.warning(f"[AIChatStream] Retrieval error: {ex_rag}")

        # 4. TRÒ CHUYỆN TỰ DO: STREAM OLLAMA TOKENS TỪ LLM
        full_text = ""
        async for token in ollama_service.generate_response_stream(
            prompt=request.prompt,
            rag_context=rag_context,
            language=request.language,
            emotion=request.emotion,
            chat_history=history,
            stored_room_number=current_room,
        ):
            full_text += token
            yield f"data: {json.dumps({'event': 'token', 'token': token}, ensure_ascii=False)}\n\n"

        _, final_lang_code = ollama_service.detect_language(full_text)

        session_manager.add_turn(sid, "user", request.prompt, language=final_lang_code)
        session_manager.add_turn(sid, "assistant", full_text, language=final_lang_code, intent_action="conversation")

        done_payload = {
            "event": "done",
            "full_text": full_text,
            "lang_code": final_lang_code,
            "room_number": current_room,
            "action": "conversation",
        }
        yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"
    except Exception as e:
        logger.error(f"[AIChatStream Error] {e}")
        yield f"data: {json.dumps({'event': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
