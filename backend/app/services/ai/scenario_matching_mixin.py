"""Fast-path matching logic for ScenarioService."""

import datetime
import logging
import re
from typing import Any, Dict, Optional, Tuple

from app.services.ai.constants import (
    MAINTENANCE_REGEX,
    ORDER_OR_SERVICE_EXCLUSION_REGEX,
    STATUS_QUERY_REGEX,
)
from app.services.ai.session_manager import extract_room_number, is_valid_hotel_room

logger = logging.getLogger(__name__)


class ScenarioMatchingMixin:
    """Provides sub-millisecond fast-path scenario matching."""

    def match_fast_path(
        self, prompt: str, lang_code: str = "vi-VN"
    ) -> Optional[Tuple[str, str, str, str, Optional[Dict[str, Any]]]]:
        """

        Doi soat nhanh (<1ms) cau hoi cua khach voi danh sach kich ban trong In-Memory RAM.

        Tra ve: (response_text, lang_name, lang_code, action_type, action_payload) neu khop.

        """
        if not prompt or not prompt.strip():
            return None

        # 1. Chuan hoa prompt
        prompt_lower = prompt.lower().strip()
        normalized = prompt_lower.replace("wi-fi", "wifi").replace("wi fi", "wifi")
        normalized = re.sub(r'[\?\.\,\!\\_\:\;]', ' ', normalized)
        normalized = re.sub(r'\s+', ' ', normalized).strip()

        # 1b. Khong kich hoat Fast-Path khach san voi cac cau hoi ve kien thuc chung, nhan vat, thuc the ngoai khach san
        is_who_are_you_self = bool(re.search(
            r'\b(bạn là ai|ban la ai|em là ai|em la ai|mày là ai|may la ai|rora là ai|rora la ai|robot là ai|robot la ai|tên bạn là gì|ten ban la gi|tên em là gì|ten em la gi|bạn tên gì|ban ten gi|em tên gì|em ten gi|giới thiệu bản thân|gioi thieu ban than|giới thiệu về bản thân|gioi thieu ve ban than|giới thiệu về bạn|gioi thieu ve ban|giới thiệu về em|gioi thieu ve em|giới thiệu về mình|gioi thieu ve minh|tự giới thiệu|tu gioi thieu|giới thiệu rora|who are you|what is your name|who is rora|tell me about yourself|introduce yourself)\b',
            normalized,
            re.IGNORECASE
        ))
        if not is_who_are_you_self:
            is_general_knowledge = bool(re.search(
                r'\b(vận động viên|van dong vien|cầu thủ|cau thu|ca sĩ|ca si|diễn viên|dien vien|nhạc sĩ|nhac si|tác giả|tac gia|nhà văn|nha van|nhà thơ|nha tho|tổng thống|tong thong|thủ tướng|thu tuong|chủ tịch|chu tich|người nổi tiếng|nguoi noi tieng|nhân vật|nhan vat|ông là ai|bà là ai|anh là ai|chị là ai|họ là ai|bài hát|bai hat|bài thơ|bai tho|bộ phim|bo phim|cuốn sách|cuon sach|lịch sử|lich su|tiểu sử|tieu su|nguồn gốc|nguon goc|định nghĩa|dinh nghia|khái niệm|khai niem|thế nào là|the nao la|ý nghĩa là|công thức|cong thuc|tại sao|tai sao|vì sao|vi sao|lý do gì|ly do gi)\b',
                normalized,
                re.IGNORECASE
            ))
            if is_general_knowledge:
                return None
        is_en = (lang_code == "en-US")
        lang_name = "English" if is_en else "Tiếng Việt"

        # 1c. Kiem tra neu khach hoi duong di hoac thong tin ve phong KHONG TON TAI trong khach san
        room_candidate = extract_room_number(normalized)
        if room_candidate and not is_valid_hotel_room(room_candidate):
            is_room_intent = bool(re.search(
                r'(phòng|phong|room|p\.|p\b|số\s+phòng|so\s+phong|chỉ đường|chi duong|ở đâu|o dau|đường đến|duong den|đường lên|duong len|đường về|duong ve|lối lên|loi len|tìm phòng|tim phong|hướng dẫn|huong dan|tầng mấy|tang may|ở tầng|o tang|thông tin|thong tin|giá|gia|ban công|ban cong|giường|giuong|view|tiện nghi|tien nghi|diện tích|dien tich|mấy người|may nguoi|where is|how to get|directions|tell me about|information)',
                normalized,
                re.IGNORECASE
            ))
            if is_room_intent:
                msg_vi = f"Dạ khách sạn Aurora Grand hiện không có phòng {room_candidate} ạ. Khách sạn chỉ có các phòng lưu trú từ 301 đến 310 tại Tầng 3 và từ 401 đến 410 tại Tầng 4. Quý khách vui lòng kiểm tra lại số phòng nhé ạ."
                msg_en = f"Aurora Grand Hotel does not have room {room_candidate}. Our guest rooms are located on Level 3 (rooms 301 to 310) and Level 4 (rooms 401 to 410). Please double check your room number."
                reply_text = msg_en if is_en else msg_vi
                logger.info(f"[ScenarioService FastPath] Non-existent room query intercepted for '{room_candidate}'. Rejecting session room save.")
                return (
                    reply_text,
                    lang_name,
                    lang_code,
                    "conversation",
                    {"destination_key": None, "invalid_room": room_candidate}
                )

        # 2. Duyet cac kich ban da sap xep theo priority giam dan
        for scn in self._cache:
            if not scn.get("is_active", True) or not scn.get("is_fast_path", True):
                continue
            # Bypass fast-path nếu khách đang đưa ra yêu cầu gọi đồ / giao đồ / đặt món vật lý lên phòng
            # nhưng kịch bản là FAQ tĩnh (action_type == 'none')
            is_physical_item_delivery = bool(re.search(
                r'(cho\s+(tôi|toi|mình|minh|em)|xin|lấy|lay|mang|đem|dem|gửi|gui|thêm|them|mượn|muon|đặt|dat)\s+(thêm\s+|them\s+)?(khăn|khan|gối|goi|chăn|chan|nệm|nem|nước|nuoc|bàn ủi|ban ui|máy sấy|may say|bàn chải|ban chai|kem đánh răng|kem danh rang|dao cạo|dao cao|dép|dep|ly|tách|tach|dọn phòng|don phong|cơm|com|phở|pho|món|mon|đồ ăn|do an|nước uống|nuoc uong|thức uống|thuc uong|pizza|hành lý|hanh ly|vali)',
                normalized,
                re.IGNORECASE
            )) or bool(re.search(
                r'(hỗ trợ|ho tro|giúp|giup|cần|can|nhờ|nho|mang|xách|xach|lấy|lay|chuyển|chuyen|báo|bao|tìm|tim|phòng\s*\d+|room\s*\d+).*(hành lý|hanh ly|vali|thất lạc|that lac|mất đồ|mat do|quên đồ|quen do|rơi đồ|roi do|lost|luggage|bag)|'
                r'(hành lý|hanh ly|vali|thất lạc|that lac|mất đồ|mat do|quên đồ|quen do|rơi đồ|roi do|lost|luggage|bag).*(phòng\s*\d+|room\s*\d+|lên phòng|len phong|xuống sảnh|xuong sanh|giúp|giup|hỗ trợ|ho tro)',
                normalized,
                re.IGNORECASE
            ))
            is_faq_inquiry = bool(re.search(
                r'(ở đâu|o dau|mấy giờ|may gio|bao nhiêu|bao nhieu|giá|gia|thế nào|the nao|có không|co khong|có gì|co gi|giới thiệu|gioi thieu|where|when|how|what|tell me|recommend|mật khẩu|mat khau|pass|wifi)',
                normalized,
                re.IGNORECASE
            ))
            if is_physical_item_delivery and not is_faq_inquiry and str(scn.get("action_type") or "none") == "none":
                continue
            # Bypass fast-path chi duong neu khach dang goi do / dat mon / yeu cau dich vu len phong (C. Quy tac phan tang kiem soat)
            is_order_or_service = bool(ORDER_OR_SERVICE_EXCLUSION_REGEX.search(normalized))
            has_in_room_request = bool(re.search(
                r'(tại phòng|tai phong|lên phòng|len phong|về phòng|ve phong|cho phòng|cho phong)',
                normalized,
                re.IGNORECASE
            ))
            has_explicit_nav = bool(re.search(
                r'(ở đâu|o dau|chỗ nào|cho nao|chỉ đường|chi duong|dẫn đường|dan duong|hướng dẫn đường|lối đi|loi di|đường đến|duong den|đường lên|tìm phòng|tim phong|làm sao để đến|đi tới|di toi|đi đến|di den|where is|how do i get|show me the way)',
                normalized,
                re.IGNORECASE
            ))
            if is_order_or_service and not has_explicit_nav:
                dest = (scn.get("action_payload") or {}).get("destination_key", "")
                if str(scn.get("action_type")) == "show_map":
                    if str(dest).startswith("room_") or has_in_room_request:
                        continue
                if re.match(r"^scn-room-\d+", str(scn.get("id", ""))):
                    continue
            # Neu kich ban la scn-restroom-ground, bo qua neu khach dang hoi ve nha ve sinh tang 2
            if scn.get("id") == "scn-restroom-ground":
                is_f2_query = bool(re.search(
                    r'\b(tầng 2|tang 2|lầu 2|lau 2|floor 2|level 2|f2)\b',
                    normalized,
                    re.IGNORECASE
                ))
                if is_f2_query:
                    continue
            # Neu kich ban la scn-rooms-general, bo qua neu khach dang tim phong chuc nang / tien ich khac
                        # Neu kich ban la book_taxi / scn-airport-shuttle, bo qua neu khach dang hoi kiem tra trang thai dat xe
            if scn.get("action_type") == "book_taxi" or scn.get("id") == "scn-airport-shuttle":
                is_taxi_status_check = bool(re.search(
                    r'(trạng thái|trang thai|kiểm tra|kiem tra|tới chưa|toi chua|đến chưa|den chua|sao rồi|sao roi|đang ở đâu|dang o dau|tới đâu|toi dau|check|status|\b(đã|da)?\s*(đặt|dat|gọi|goi)\b.*\b(chưa|chua)\b)',
                    normalized,
                    re.IGNORECASE
                ))
                if is_taxi_status_check:
                    continue
            # Neu kich ban la open_food_menu (nhu scn-in-room-dining), bo qua neu khach dang noi ve bao tri, sua chua, bao hong
            if scn.get("action_type") == "open_food_menu":
                is_mnt_intent = bool(MAINTENANCE_REGEX.search(normalized))
                if is_mnt_intent:
                    continue
            # Neu kich ban la open_maintenance_menu hoac scn-room-maintenance, bo qua neu khach dang hoi kiem tra tien do / trang thai sua chua
            if scn.get("action_type") == "open_maintenance_menu" or scn.get("id") in ["scn-maintenance-menu", "scn-room-maintenance"]:
                is_maintenance_status_check = bool(STATUS_QUERY_REGEX.search(normalized))
                if is_maintenance_status_check:
                    continue
            if scn.get("id") == "scn-rooms-general":
                non_bedroom_facilities = [
                    "gym", "karaoke", "họp", "hop", "xông hơi", "xong hoi", "spa", "bếp", "bep",
                    "vệ sinh", "ve sinh", "thể hình", "the hinh", "tập", "tap", "fitness", "locker"
                ]
                if any(re.search(rf'(?<!\w){re.escape(f)}(?!\w)', normalized, re.IGNORECASE) for f in non_bedroom_facilities):
                    continue
            keywords = scn.get("match_keywords") or []
            match_type = scn.get("match_type", "keyword")
            is_matched = False
            if match_type == "exact":
                # Khop chinh xac hoac khop ca cau ngan
                for kw in keywords:
                    kw_clean = kw.lower().strip()
                    if normalized == kw_clean or prompt_lower == kw_clean:
                        is_matched = True
                        break
            elif match_type == "regex":
                # Khop theo bieu thuc chinh quy
                for pattern in keywords:
                    try:
                        if re.search(pattern, normalized, re.IGNORECASE) or re.search(pattern, prompt_lower, re.IGNORECASE):
                            is_matched = True
                            break
                    except Exception:
                        continue
            else:
                # Default: keyword search trong chuoi
                for kw in keywords:
                    kw_clean = kw.lower().strip()
                    if not kw_clean:
                        continue
                    # Neu la so phong rieng le (301-309, 401-409) -> kiem tra ranh gioi tu (word boundary)
                    if kw_clean.isdigit():
                        if re.search(rf'\b{re.escape(kw_clean)}\b', normalized) or re.search(rf'\b{re.escape(kw_clean)}\b', prompt_lower):
                            is_matched = True
                            break
                    else:
                        # Kiem tra tu khoa theo ranh gioi tu (word boundary) de tranh khop chuoi con sai
                        pattern = rf'(?<!\w){re.escape(kw_clean)}(?!\w)'
                        if re.search(pattern, normalized) or re.search(pattern, prompt_lower):
                            is_matched = True
                            break
            if is_matched:
                action_type = str(scn.get("action_type") or "none")
                raw_payload = scn.get("action_payload")
                action_payload: Optional[Dict[str, Any]] = dict(raw_payload) if isinstance(raw_payload, dict) else None
                # Xu ly dac thu cho kich ban chuyen doi ngon ngu
                if action_type == "switch_language":
                    target_lang = (action_payload or {}).get("target_language")
                    if target_lang == "toggle":
                        if is_en:
                            target_lang = "Tiếng Việt"
                            target_lang_code = "vi-VN"
                        else:
                            target_lang = "English"
                            target_lang_code = "en-US"
                    elif target_lang == "English" or (target_lang and "en" in str(target_lang).lower()):
                        target_lang = "English"
                        target_lang_code = "en-US"
                    else:
                        target_lang = "Tiếng Việt"
                        target_lang_code = "vi-VN"
                    lang_name = target_lang
                    lang_code = target_lang_code
                    if target_lang_code == "en-US":
                        response_text = str(scn.get("response_en") or scn.get("response_vi") or "Sure! I have switched to English.")
                    else:
                        response_text = str(scn.get("response_vi") or "Dạ vâng, em đã chuyển sang Tiếng Việt rồi ạ.")
                resp_text = str((scn.get("response_en") if is_en and scn.get("response_en") else scn.get("response_vi")) or scn.get("response_vi") or "")
                # Xu ly dac thu cho kich ban mo menu bao tri & sua chua phong
                if action_type == "open_maintenance_menu":
                    if not isinstance(action_payload, dict):
                        action_payload = {}
                    action_payload["trigger_menu"] = "maintenance"
                    action_payload["destination_key"] = None
                    if room_candidate and is_valid_hotel_room(room_candidate):
                        action_payload["target_room_number"] = room_candidate
                        if is_en:
                            resp_text = f"We sincerely apologize for this inconvenience! I have opened the Maintenance & Repair screen for Room {room_candidate}. Please select the issue you are experiencing or track your repair progress."
                        else:
                            resp_text = f"Dạ em rất xin lỗi vì sự bất tiện này trong phòng {room_candidate} ạ! Em đã mở danh mục Báo hỏng & Sửa chữa trên màn hình cho phòng mình rồi ạ. Quý khách vui lòng chọn sự cố hoặc tra cứu tiến độ nhé ạ."
                logger.info(f"[ScenarioService FastPath Hit] Matched scenario '{scn.get('id')}' - '{scn.get('title')}' in <1ms")
                return resp_text, lang_name, lang_code, action_type, action_payload

        # 3. Kiem tra loi chao theo buoi (Dynamic Time Greeting)
        hour = datetime.datetime.now().hour
        if re.search(r"^(xin chào|chào bạn|chào em|hello|hi|good morning|good afternoon|good evening)[\?\.\!\s]*$", normalized, re.IGNORECASE):
            if 5 <= hour < 11:
                reply = "Good morning! Welcome to Aurora Grand Hotel. How may I assist you today?" if is_en else "Dạ em chào buổi sáng quý khách! Chúc quý khách một ngày mới tốt lành tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
            elif 11 <= hour < 18:
                reply = "Good afternoon! Welcome to Aurora Grand Hotel. How may I assist you today?" if is_en else "Dạ em chào quý khách! Chúc quý khách một buổi chiều vui vẻ tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
            else:
                reply = "Good evening! Welcome to Aurora Grand Hotel. How may I assist you tonight?" if is_en else "Dạ em chào buổi tối quý khách! Chúc quý khách một buổi tối thư thái tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
            return reply, lang_name, lang_code, "none", None
        return None
