"""Fast-path routing, reply normalization, and offline RAG fallback helpers for OllamaService."""

import datetime
import logging
import re
from typing import Any, Dict, Optional, Tuple

from app.services.ai.constants import BELLMAN_MENU_TRIGGER_KEYWORDS, FOOD_MENU_TRIGGER_KEYWORDS, SERVICE_KEYWORDS
from app.services.ai.scenario_service import scenario_service
from app.services.bell_request_service import classify_bell_request
from app.services.maintenance_request_service import is_fault_report

logger = logging.getLogger(__name__)

_SERVICE_ACTION_VERBS = [
    "đặt", "cần", "muốn", "yêu cầu", "sửa", "cho", "xin", "lấy", "mang", "giao", "gọi", "đổi",
    "book", "order", "reserve", "need", "repair", "fix", "send", "bring", "get",
]
_SERVICE_NOUNS = [
    "khăn", "gối", "chăn", "dọn phòng", "don phong", "nước", "đồ ăn", "cơm", "hành lý", "vali",
    "điều hòa", "máy lạnh", "bóng đèn", "nước rò", "kẹt", "taxi", "bàn ủi", "sấy tóc", "máy sấy",
    "towel", "cleaning", "food", "water", "drink", "luggage", "iron",
]
_NEARBY_EXPLORATION_KEYWORDS = [
    "gần đây", "xung quanh", "quanh đây", "gần khách sạn", "ngoại khu", "chợ đêm",
    "chơi gì", "ăn gì ở đâu", "đi đâu chơi", "địa điểm du lịch", "địa điểm tham quan",
    "có gì chơi", "quanh khách sạn", "nearby", "around here", "night market", "sightseeing",
]
_GREETING_RE = re.compile(
    r"^(xin chào|xin chao|chào em|chao em|chào robot|chao robot|chào bạn|chao ban|"
    r"chào rora|chao rora|hello|hi|hey|good morning|good afternoon|good evening)[\?\.\!\s]*$"
)
_INTRO_RE = re.compile(
    r"\b(bạn là ai|ban la ai|em là ai|em la ai|mày là ai|may la ai|rora là ai|rora la ai|"
    r"robot là ai|robot la ai|tên bạn là gì|ten ban la gi|tên em là gì|ten em la gi|"
    r"bạn tên gì|ban ten gi|em tên gì|em ten gi|giới thiệu bản thân|gioi thieu ban than|"
    r"giới thiệu về bản thân|gioi thieu ve ban than|giới thiệu về bạn|gioi thieu ve ban|"
    r"giới thiệu về em|gioi thieu ve em|giới thiệu về mình|gioi thieu ve minh|"
    r"bạn giới thiệu bản thân được không|ban gioi thieu ban than duoc khong|"
    r"bạn có thể giới thiệu bản thân|ban co the gioi thieu ban than|"
    r"bạn có thể giới thiệu về bản thân|ban co the gioi thieu ve ban than|"
    r"tự giới thiệu|tu gioi thieu|giới thiệu rora|gioi thieu rora|"
    r"who are you|what is your name|who is rora|tell me about yourself|introduce yourself)\b"
)


def clean_vietnamese_voice_text(text: str) -> str:
    """Làm sạch và chuẩn hóa văn bản tiếng Việt cho giọng đọc mượt mà, không bị ngắc ngứ."""
    if not text:
        return ""
    text = re.sub(r"\bдо\b", "đến", text, flags=re.IGNORECASE)
    text = re.sub(r"\bчасов\b", "giờ", text, flags=re.IGNORECASE)
    text = re.sub(r"[\u0400-\u04FF]", "", text)
    text = re.sub(r"[\u4e00-\u9fff]", "", text)
    text = re.sub(r"[*#_`\[\]()]", "", text)
    text = re.sub(r"(\d{1,2}):00\b", r"\1 giờ", text)
    text = re.sub(r"(\d{1,2}):(\d{2})\b", r"\1 giờ \2 phút", text)
    text = re.sub(r"(\d{1,2})h(\d{1,2})\b", r"\1 giờ \2 phút", text)
    text = re.sub(r"(\d{1,2})h\b", r"\1 giờ", text)
    text = re.sub(r"(\d{1,2})\s*(?:giờ|h)?\s*[-–—]\s*(\d{1,2})\s*(?:giờ|h)?", r"từ \1 đến \2 giờ", text)
    text = re.sub(r"\b24/7\b", "24 trên 7", text)
    return re.sub(r"\s+", " ", text).strip()


def format_and_clean_reply(reply: str, lang_code: str) -> str:
    """Chuẩn hóa văn bản câu trả lời trước khi gửi ra ngoài."""
    if not reply:
        return ""
    if lang_code == "vi-VN":
        return clean_vietnamese_voice_text(reply)
    if lang_code != "zh-CN":
        reply = re.sub(r"[\u4e00-\u9fff\u3400-\u4dbf]+", "", reply).strip()
        reply = re.sub(r"[*#_`\[\]()]", "", reply).strip()
    return reply


def check_fast_path_full(
    prompt: str,
    language: Optional[str],
    detect_fn,
) -> Optional[Tuple[str, str, str, Optional[str], Optional[Dict[str, Any]]]]:
    """In-memory fast-path check covering scenarios, real-time greetings, and self intro."""
    if not prompt or not prompt.strip():
        return None

    if not language or language.lower() in ["auto", ""]:
        lang_name, lang_code = detect_fn(prompt)
    else:
        lang_name = language
        lang_code = "en-US" if (language.lower().startswith("en") or "english" in language.lower()) else "vi-VN"

    prompt_lower = prompt.lower().strip()
    is_en = lang_code == "en-US"

    now_hour = datetime.datetime.now().hour
    if 5 <= now_hour < 12:
        time_greeting_vi = "Dạ, Rora xin chào buổi sáng quý khách! Chúc quý khách một ngày mới tràn ngập niềm vui ạ."
        time_greeting_en = "Good morning! Rora wishes you a wonderful and joyful day."
    elif 12 <= now_hour < 18:
        time_greeting_vi = "Dạ, Rora xin chào quý khách! Em có thể hỗ trợ gì cho quý khách chiều nay ạ?"
        time_greeting_en = "Good afternoon! How may Rora assist you today?"
    else:
        time_greeting_vi = "Dạ, Rora xin chào buổi tối quý khách! Chúc quý khách buổi tối an lành và thư giãn ạ."
        time_greeting_en = "Good evening! Wishing you a peaceful and relaxing evening."

    has_action_verb = any(v in prompt_lower for v in _SERVICE_ACTION_VERBS)
    has_service_noun = any(n in prompt_lower for n in _SERVICE_NOUNS)
    is_bell_task = any(k in prompt_lower for k in SERVICE_KEYWORDS["bellman"]) and bool(classify_bell_request(prompt))
    is_menu_trigger = any(k in prompt_lower for k in FOOD_MENU_TRIGGER_KEYWORDS) or any(k in prompt_lower for k in BELLMAN_MENU_TRIGGER_KEYWORDS)
    if not is_menu_trigger and (
        (has_action_verb and has_service_noun)
        or is_fault_report(prompt)
        or is_bell_task
    ):
        logger.info(f"[OllamaService Fast-Path Bypass] Service action intent detected, skipping fast-path for: '{prompt[:40]}'")
        return None

    if any(kw in prompt_lower for kw in _NEARBY_EXPLORATION_KEYWORDS):
        logger.info(f"[OllamaService Fast-Path Bypass] Nearby exploration query detected, delegating to RAG: '{prompt[:40]}'")
        return None

    dynamic_hit = scenario_service.match_fast_path(prompt, lang_code)
    if dynamic_hit:
        return dynamic_hit

    if _GREETING_RE.search(prompt_lower):
        return (time_greeting_en if is_en else time_greeting_vi), lang_name, lang_code, None, None

    if _INTRO_RE.search(prompt_lower):
        intro_vi = "Dạ em là Rora, trợ lý Robot Concierge thông minh của khách sạn 5 sao Aurora Grand. Rất hân hạnh được phục vụ và đồng hành cùng quý khách ạ!"
        intro_en = "I am Rora, the smart AI Concierge Robot at Aurora Grand Hotel. It is my pleasure to assist and accompany you!"
        return (intro_en if is_en else intro_vi), lang_name, lang_code, "conversation", {"eye_expression": "happy"}

    return None


def generate_offline_fallback(
    prompt: str,
    lang_code: str = "vi-VN",
    rag_context: Optional[str] = None,
) -> str:
    """Fallback answer using preloaded RAG context, fast-path scenarios, or ChromaDB lookup."""
    is_en = lang_code == "en-US"

    if rag_context and len(rag_context.strip()) > 20:
        clean_ctx = re.sub(r"[*#_`]", "", rag_context).strip()
        sentences = [s.strip() for s in clean_ctx.split(".") if len(s.strip()) > 15]
        if sentences:
            return (
                f"According to hotel info: {sentences[0]}."
                if is_en
                else f"Dạ theo thông tin khách sạn: {sentences[0]} ạ."
            )

    fast_hit = scenario_service.match_fast_path(prompt, lang_code)
    if fast_hit:
        return fast_hit[0]

    try:
        from app.services.rag.chroma import get_concierge_collection

        res = get_concierge_collection("concierge_kb").query(query_texts=[prompt], n_results=1)
        docs = res.get("documents", [[]])[0] if res and res.get("documents") else None
        if docs and len(docs[0].strip()) > 15:
            clean_ctx = re.sub(r"[*#_`]", "", docs[0].strip()).strip()
            sentences = [s.strip() for s in clean_ctx.split(".") if len(s.strip()) > 15]
            if sentences:
                return (
                    f"According to hotel info: {sentences[0]}."
                    if is_en
                    else f"Dạ theo thông tin khách sạn: {sentences[0]} ạ."
                )
    except Exception as e_rag:
        logger.debug(f"[Offline RAG Query Error]: {e_rag}")

    return (
        "I have noted your request. Please contact the Front Desk at Level 1 or dial 0 from your room phone for immediate assistance!"
        if is_en
        else "Dạ Rora xin ghi nhận câu hỏi của quý khách. Quý khách vui lòng liên hệ Quầy Lễ tân sảnh tầng 1 hoặc gọi phím 0 từ điện thoại phòng để được hỗ trợ chu đáo nhất nhé ạ!"
    )
