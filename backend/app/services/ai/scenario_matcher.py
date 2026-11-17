"""Fast-path scenario matching and dynamic hotel facts prompt formatting."""

import datetime
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from app.services.ai.constants import (
    MAINTENANCE_REGEX,
    ORDER_OR_SERVICE_EXCLUSION_REGEX,
    STATUS_QUERY_REGEX,
)
from app.services.ai.session_manager import extract_room_number, is_valid_hotel_room

logger = logging.getLogger(__name__)

_WHO_ARE_YOU_RE = re.compile(
    r'\b(bạn là ai|ban la ai|em là ai|em la ai|mày là ai|may la ai|rora là ai|rora la ai|robot là ai|robot la ai|tên bạn là gì|ten ban la gi|tên em là gì|ten em la gi|bạn tên gì|ban ten gi|em tên gì|em ten gi|giới thiệu bản thân|gioi thieu ban than|giới thiệu về bản thân|gioi thieu ve ban than|giới thiệu về bạn|gioi thieu ve ban|giới thiệu về em|gioi thieu ve em|giới thiệu về mình|gioi thieu ve minh|tự giới thiệu|tu gioi thieu|giới thiệu rora|who are you|what is your name|who is rora|tell me about yourself|introduce yourself)\b',
    re.IGNORECASE,
)
_GENERAL_KNOWLEDGE_RE = re.compile(
    r'\b(vận động viên|van dong vien|cầu thủ|cau thu|ca sĩ|ca si|diễn viên|dien vien|nhạc sĩ|nhac si|tác giả|tac gia|nhà văn|nha van|nhà thơ|nha tho|tổng thống|tong thong|thủ tướng|thu tuong|chủ tịch|chu tich|người nổi tiếng|nguoi noi tieng|nhân vật|nhan vat|ông là ai|bà là ai|anh là ai|chị là ai|họ là ai|bài hát|bai hat|bài thơ|bai tho|bộ phim|bo phim|cuốn sách|cuon sach|lịch sử|lich su|tiểu sử|tieu su|nguồn gốc|nguon goc|định nghĩa|dinh nghia|khái niệm|khai niem|thế nào là|the nao la|ý nghĩa là|công thức|cong thuc|tại sao|tai sao|vì sao|vi sao|lý do gì|ly do gi)\b',
    re.IGNORECASE,
)
_ROOM_QUERY_INTENT_RE = re.compile(
    r'(phòng|phong|room|p\.|p\b|số\s+phòng|so\s+phong|chỉ đường|chi duong|ở đâu|o dau|đường đến|duong den|đường lên|duong len|đường về|duong ve|lối lên|loi len|tìm phòng|tim phong|hướng dẫn|huong dan|tầng mấy|tang may|ở tầng|o tang|thông tin|thong tin|giá|gia|ban công|ban cong|giường|giuong|view|tiện nghi|tien nghi|diện tích|dien tich|mấy người|may nguoi|where is|how to get|directions|tell me about|information)',
    re.IGNORECASE,
)
_PHYSICAL_DELIVERY_RE = re.compile(
    r'(cho\s+(tôi|toi|mình|minh|em)|xin|lấy|lay|mang|đem|dem|gửi|gui|thêm|them|mượn|muon|đặt|dat)\s+(thêm\s+|them\s+)?(khăn|khan|gối|goi|chăn|chan|nệm|nem|nước|nuoc|bàn ủi|ban ui|máy sấy|may say|bàn chải|ban chai|kem đánh răng|kem danh rang|dao cạo|dao cao|dép|dep|ly|tách|tach|dọn phòng|don phong|cơm|com|phở|pho|món|mon|đồ ăn|do an|nước uống|nuoc uong|thức uống|thuc uong|pizza|hành lý|hanh ly|vali)',
    re.IGNORECASE,
)
_LUGGAGE_DELIVERY_RE = re.compile(
    r'(hỗ trợ|ho tro|giúp|giup|cần|can|nhờ|nho|mang|xách|xach|lấy|lay|chuyển|chuyen|báo|bao|tìm|tim|phòng\s*\d+|room\s*\d+).*(hành lý|hanh ly|vali|thất lạc|that lac|mất đồ|mat do|quên đồ|quen do|rơi đồ|roi do|lost|luggage|bag)|'
    r'(hành lý|hanh ly|vali|thất lạc|that lac|mất đồ|mat do|quên đồ|quen do|rơi đồ|roi do|lost|luggage|bag).*(phòng\s*\d+|room\s*\d+|lên phòng|len phong|xuống sảnh|xuong sanh|giúp|giup|hỗ trợ|ho tro)',
    re.IGNORECASE,
)
_FAQ_INQUIRY_RE = re.compile(
    r'(ở đâu|o dau|mấy giờ|may gio|bao nhiêu|bao nhieu|giá|gia|thế nào|the nao|có không|co khong|có gì|co gi|giới thiệu|gioi thieu|where|when|how|what|tell me|recommend|mật khẩu|mat khau|pass|wifi)',
    re.IGNORECASE,
)
_IN_ROOM_REQUEST_RE = re.compile(r'(tại phòng|tai phong|lên phòng|len phong|về phòng|ve phong|cho phòng|cho phong)', re.IGNORECASE)
_EXPLICIT_NAV_RE = re.compile(
    r'(ở đâu|o dau|chỗ nào|cho nao|chỉ đường|chi duong|dẫn đường|dan duong|hướng dẫn đường|lối đi|loi di|đường đến|duong den|đường lên|tìm phòng|tim phong|làm sao để đến|đi tới|di toi|đi đến|di den|where is|how do i get|show me the way)',
    re.IGNORECASE,
)
_FLOOR2_QUERY_RE = re.compile(r'\b(tầng 2|tang 2|lầu 2|lau 2|floor 2|level 2|f2)\b', re.IGNORECASE)
_TAXI_STATUS_RE = re.compile(
    r'(trạng thái|trang thai|kiểm tra|kiem tra|tới chưa|toi chua|đến chưa|den chua|sao rồi|sao roi|đang ở đâu|dang o dau|tới đâu|toi dau|check|status|\b(đã|da)?\s*(đặt|dat|gọi|goi)\b.*\b(chưa|chua)\b)',
    re.IGNORECASE,
)
_TIME_GREETING_RE = re.compile(
    r"^(xin chào|chào bạn|chào em|hello|hi|good morning|good afternoon|good evening)[\?\.\!\s]*$",
    re.IGNORECASE,
)

_NON_BEDROOM_FACILITIES = [
    "gym", "karaoke", "họp", "hop", "xông hơi", "xong hoi", "spa", "bếp", "bep",
    "vệ sinh", "ve sinh", "thể hình", "the hinh", "tập", "tap", "fitness", "locker",
]
_CONTINUATION_HOOKS = {
    "vi": {
        "facility": " Quý khách có muốn Rora mở bản đồ chỉ đường hoặc cần em hỗ trợ thêm thông tin gì nữa không ạ?",
        "reception": " Quý khách có cần Rora hỗ trợ thêm thông tin hay thủ tục nào khác không ạ?",
        "service": " Quý khách có cần em ghi nhận thêm yêu cầu gì cho phòng mình không ạ?",
        "faq": " Quý khách có muốn tìm hiểu thêm về dịch vụ nào khác của khách sạn không ạ?",
        "chitchat": " Rora có thể hỗ trợ quý khách dịch vụ gì nữa hôm nay ạ?",
    },
    "en": {
        "facility": " Would you like me to show directions on the map, or can I assist you with anything else?",
        "reception": " May I assist you with any other front desk inquiries?",
        "service": " Is there anything else you would like to request for your stay?",
        "faq": " Would you like to know more about any of our other hotel services?",
        "chitchat": " How else may I be of service to you today?",
    },
}


def _normalize_prompt(prompt: str) -> Tuple[str, str]:
    prompt_lower = prompt.lower().strip()
    normalized = prompt_lower.replace("wi-fi", "wifi").replace("wi fi", "wifi")
    normalized = re.sub(r'[\?\.\,\!\\_\:\;]', ' ', normalized)
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    return prompt_lower, normalized


def _should_bypass_scenario(scn: Dict[str, Any], normalized: str) -> bool:
    is_physical = bool(_PHYSICAL_DELIVERY_RE.search(normalized) or _LUGGAGE_DELIVERY_RE.search(normalized))
    if is_physical and not _FAQ_INQUIRY_RE.search(normalized) and str(scn.get("action_type") or "none") == "none":
        return True

    if ORDER_OR_SERVICE_EXCLUSION_REGEX.search(normalized) and not _EXPLICIT_NAV_RE.search(normalized):
        dest = (scn.get("action_payload") or {}).get("destination_key", "")
        if str(scn.get("action_type")) == "show_map" and (str(dest).startswith("room_") or _IN_ROOM_REQUEST_RE.search(normalized)):
            return True
        if re.match(r"^scn-room-\d+", str(scn.get("id", ""))):
            return True

    scn_id = scn.get("id")
    action_type = scn.get("action_type")
    if scn_id == "scn-restroom-ground" and _FLOOR2_QUERY_RE.search(normalized):
        return True
    if (action_type == "book_taxi" or scn_id == "scn-airport-shuttle") and _TAXI_STATUS_RE.search(normalized):
        return True
    if action_type == "open_food_menu" and MAINTENANCE_REGEX.search(normalized):
        return True
    if (action_type == "open_maintenance_menu" or scn_id in ("scn-maintenance-menu", "scn-room-maintenance")) and STATUS_QUERY_REGEX.search(normalized):
        return True
    if scn_id == "scn-rooms-general" and any(
        re.search(rf'(?<!\w){re.escape(f)}(?!\w)', normalized, re.IGNORECASE) for f in _NON_BEDROOM_FACILITIES
    ):
        return True
    return False


def _scenario_matches_prompt(scn: Dict[str, Any], normalized: str, prompt_lower: str) -> bool:
    keywords = scn.get("match_keywords") or []
    match_type = scn.get("match_type", "keyword")

    if match_type == "exact":
        return any(
            normalized == kw.lower().strip() or prompt_lower == kw.lower().strip()
            for kw in keywords
        )
    if match_type == "regex":
        for pattern in keywords:
            try:
                if re.search(pattern, normalized, re.IGNORECASE) or re.search(pattern, prompt_lower, re.IGNORECASE):
                    return True
            except Exception:
                continue
        return False

    for kw in keywords:
        kw_clean = kw.lower().strip()
        if not kw_clean:
            continue
        pattern = rf'\b{re.escape(kw_clean)}\b' if kw_clean.isdigit() else rf'(?<!\w){re.escape(kw_clean)}(?!\w)'
        if re.search(pattern, normalized) or re.search(pattern, prompt_lower):
            return True
    return False


def _append_continuation_hook(resp_text: str, scn: Dict[str, Any], action_type: str, is_en: bool) -> str:
    if action_type not in ("none", "show_map", "conversation") or scn.get("trigger_menu"):
        return resp_text
    clean_resp = resp_text.strip()
    has_question = (
        clean_resp.endswith("?")
        or clean_resp.endswith("ạ?")
        or ("?" in clean_resp and len(clean_resp.split("?")[-1].strip()) < 15)
    )
    if has_question:
        return resp_text
    hooks = _CONTINUATION_HOOKS["en" if is_en else "vi"]
    return clean_resp + hooks.get(scn.get("category", "faq"), hooks["faq"])


def _build_matched_response(
    scn: Dict[str, Any],
    room_candidate: Optional[str],
    is_en: bool,
    lang_name: str,
    lang_code: str,
) -> Tuple[str, str, str, str, Optional[Dict[str, Any]]]:
    action_type = str(scn.get("action_type") or "none")
    raw_payload = scn.get("action_payload")
    action_payload: Optional[Dict[str, Any]] = dict(raw_payload) if isinstance(raw_payload, dict) else None

    if action_type == "switch_language":
        target_lang = (action_payload or {}).get("target_language")
        if target_lang == "toggle":
            target_lang, target_lang_code = ("Tiếng Việt", "vi-VN") if is_en else ("English", "en-US")
        elif target_lang == "English" or (target_lang and "en" in str(target_lang).lower()):
            target_lang, target_lang_code = "English", "en-US"
        else:
            target_lang, target_lang_code = "Tiếng Việt", "vi-VN"
        lang_name, lang_code = target_lang, target_lang_code

    resp_text = str(
        (scn.get("response_en") if is_en and scn.get("response_en") else scn.get("response_vi"))
        or scn.get("response_vi")
        or ""
    )

    if action_type == "open_maintenance_menu":
        if not isinstance(action_payload, dict):
            action_payload = {}
        action_payload["trigger_menu"] = "maintenance"
        action_payload["destination_key"] = None
        if room_candidate and is_valid_hotel_room(room_candidate):
            action_payload["target_room_number"] = room_candidate
            resp_text = (
                f"We sincerely apologize for this inconvenience! I have opened the Maintenance & Repair screen for Room {room_candidate}. Please select the issue you are experiencing or track your repair progress."
                if is_en
                else f"Dạ em rất xin lỗi vì sự bất tiện này trong phòng {room_candidate} ạ! Em đã mở danh mục Báo hỏng & Sửa chữa trên màn hình cho phòng mình rồi ạ. Quý khách vui lòng chọn sự cố hoặc tra cứu tiến độ nhé ạ."
            )

    logger.info(f"[ScenarioService FastPath Hit] Matched scenario '{scn.get('id')}' - '{scn.get('title')}' in <1ms")
    resp_text = _append_continuation_hook(resp_text, scn, action_type, is_en)
    return resp_text, lang_name, lang_code, action_type, action_payload


def _match_time_greeting(
    normalized: str, is_en: bool, lang_name: str, lang_code: str
) -> Optional[Tuple[str, str, str, str, Optional[Dict[str, Any]]]]:
    if not _TIME_GREETING_RE.search(normalized):
        return None
    hour = datetime.datetime.now().hour
    if 5 <= hour < 11:
        reply = (
            "Good morning! Welcome to Aurora Grand Hotel. How may I assist you today?"
            if is_en
            else "Dạ em chào buổi sáng quý khách! Chúc quý khách một ngày mới tốt lành tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
        )
    elif 11 <= hour < 18:
        reply = (
            "Good afternoon! Welcome to Aurora Grand Hotel. How may I assist you today?"
            if is_en
            else "Dạ em chào quý khách! Chúc quý khách một buổi chiều vui vẻ tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
        )
    else:
        reply = (
            "Good evening! Welcome to Aurora Grand Hotel. How may I assist you tonight?"
            if is_en
            else "Dạ em chào buổi tối quý khách! Chúc quý khách một buổi tối thư thái tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
        )
    return reply, lang_name, lang_code, "none", None


def match_fast_path_scenarios(
    scenarios: List[Dict[str, Any]], prompt: str, lang_code: str = "vi-VN"
) -> Optional[Tuple[str, str, str, str, Optional[Dict[str, Any]]]]:
    """Match user speech against cached fast-path scenarios in priority order."""
    if not prompt or not prompt.strip():
        return None

    prompt_lower, normalized = _normalize_prompt(prompt)
    if not _WHO_ARE_YOU_RE.search(normalized) and _GENERAL_KNOWLEDGE_RE.search(normalized):
        return None

    is_en = lang_code == "en-US"
    lang_name = "English" if is_en else "Tiếng Việt"

    room_candidate = extract_room_number(normalized)
    if room_candidate and not is_valid_hotel_room(room_candidate) and _ROOM_QUERY_INTENT_RE.search(normalized):
        reply_text = (
            f"Aurora Grand Hotel does not have room {room_candidate}. Our guest rooms are located on Level 3 (rooms 301 to 310) and Level 4 (rooms 401 to 410). Please double check your room number."
            if is_en
            else f"Dạ khách sạn Aurora Grand hiện không có phòng {room_candidate} ạ. Khách sạn chỉ có các phòng lưu trú từ 301 đến 310 tại Tầng 3 và từ 401 đến 410 tại Tầng 4. Quý khách vui lòng kiểm tra lại số phòng nhé ạ."
        )
        logger.info(f"[ScenarioService FastPath] Non-existent room query intercepted for '{room_candidate}'. Rejecting session room save.")
        return reply_text, lang_name, lang_code, "conversation", {"destination_key": None, "invalid_room": room_candidate}

    for scn in scenarios:
        if not scn.get("is_active", True) or not scn.get("is_fast_path", True):
            continue
        if _should_bypass_scenario(scn, normalized):
            continue
        if _scenario_matches_prompt(scn, normalized, prompt_lower):
            return _build_matched_response(scn, room_candidate, is_en, lang_name, lang_code)

    return _match_time_greeting(normalized, is_en, lang_name, lang_code)


def format_hotel_facts_prompt(scenarios: List[Dict[str, Any]], lang_code: str = "vi-VN") -> str:
    """Build hotel facilities & FAQ summary block from cached scenarios for LLM system prompts."""
    is_en = lang_code == "en-US"
    active_facts: List[str] = []
    for scn in sorted(scenarios, key=lambda s: s.get("priority", 0), reverse=True):
        if not scn.get("is_active", True):
            continue
        if scn.get("category", "") in ("facility", "faq"):
            resp = scn.get("response_en") if is_en and scn.get("response_en") else scn.get("response_vi")
            if resp:
                active_facts.append(f"- {scn.get('title')}: {resp}")
                if len(active_facts) >= 12:
                    break

    if not active_facts:
        return ""
    header = "HOTEL AMENITIES & FACTS (CONFIGURED BY ADMIN):\n" if is_en else "THÔNG TIN TIỆN ÍCH KHÁCH SẠN (DO ADMIN THIẾT LẬP):\n"
    return header + "\n".join(active_facts)
