import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

CONFIG_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
CONFIG_FILE = CONFIG_DIR / "ai_persona_config.json"

DEFAULT_PERSONA = {
    "bot_name": "Rora",
    "hotel_name": "Aurora Grand Hotel",
    "star_rating": 5,
    "tone_style": "luxury",  # 'luxury' (Trang trọng 5 sao) | 'warm' (Gần gũi, ấm áp) | 'concise' (Ngắn gọn, trực diện)
    "pronoun_bot_vi": "em hoặc Rora",
    "pronoun_guest_vi": "quý khách hoặc anh/chị",
    "qr_cta_vi": "Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ.",
    "qr_cta_en": "In addition, you can scan the QR code on the screen to save the directions!",
    "unhappy_empathy_vi": "Khách đang có biểu cảm khó chịu hoặc chưa hài lòng, hãy phản hồi với thái độ xin lỗi chân thành, xoa dịu ân cần và cho biết nhân viên Concierge tại sảnh sẽ hỗ trợ ngay.",
    "unhappy_empathy_en": "The guest appears annoyed or dissatisfied. Respond with a sincere, caring apology and assure them that Concierge staff will assist right away.",
    "out_of_scope_vi": "Dạ Rora là trợ lý robot phục vụ tại khách sạn Aurora Grand Hotel và chỉ có thể hỗ trợ các thông tin, dịch vụ liên quan đến kỳ nghỉ của quý khách thôi ạ.",
    "out_of_scope_en": "I am Rora, your AI Concierge at Aurora Grand Hotel. I can only assist you with hotel amenities, services, and inquiries regarding your stay.",
}


class PersonaService:
    """
    Quan ly Cau hinh Nhan dang, Van phong va Giong dieu hoi thoai cua AI Robot.
    Ho tro Hot-reload tuc thi tu RAM va luu tru ben vung vao file JSON.
    """

    def __init__(self):
        self._config: Dict[str, Any] = dict(DEFAULT_PERSONA)
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        try:
            if CONFIG_FILE.exists():
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                    if isinstance(saved, dict):
                        self._config.update(saved)
                        logger.info(f"[PersonaService] Loaded persona from {CONFIG_FILE}")
        except Exception as e:
            logger.warning(f"[PersonaService] Failed to load persona config: {e}")

    def _save_to_disk(self) -> None:
        try:
            CONFIG_DIR.mkdir(parents=True, exist_ok=True)
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(self._config, f, ensure_ascii=False, indent=2)
            logger.info(f"[PersonaService] Saved persona config to {CONFIG_FILE}")
        except Exception as e:
            logger.error(f"[PersonaService] Failed to save persona config: {e}")

    def get_persona(self) -> Dict[str, Any]:
        """Tra ve toan bo cau hinh persona hien tai trong RAM."""
        return dict(self._config)

    def update_persona(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Cap nhat cau hinh persona, ghi vao dia va hot-reload RAM."""
        allowed_keys = set(DEFAULT_PERSONA.keys())
        for k, v in updates.items():
            if k in allowed_keys and v is not None:
                if k == "star_rating":
                    try:
                        self._config[k] = max(1, min(7, int(v)))
                    except (ValueError, TypeError):
                        pass
                else:
                    self._config[k] = str(v).strip()

        self._save_to_disk()
        return dict(self._config)

    def reset_defaults(self) -> Dict[str, Any]:
        """Khoi phuc cau hinh mac dinh ban dau."""
        self._config = dict(DEFAULT_PERSONA)
        self._save_to_disk()
        return dict(self._config)

    def get_persona_prompt(self, lang_code: Optional[str] = "vi-VN") -> str:
        """
        Sinh prompt cau truc nhan dang va phong cach giao tiep dong cho LLM (Ollama/Gemini).
        """
        cfg = self._config
        bot_name = cfg.get("bot_name") or "Rora"
        hotel_name = cfg.get("hotel_name") or "Aurora Grand Hotel"
        star_rating = cfg.get("star_rating") or 5
        tone_style = cfg.get("tone_style") or "luxury"
        qr_cta_vi = cfg.get("qr_cta_vi") or DEFAULT_PERSONA["qr_cta_vi"]
        qr_cta_en = cfg.get("qr_cta_en") or DEFAULT_PERSONA["qr_cta_en"]

        if lang_code and (lang_code == "en-US" or "en" in lang_code.lower()):
            style_desc_en = (
                "courteous, warm, and highly polished as a 5-star luxury concierge"
                if tone_style == "luxury"
                else "approachable, friendly, and hospitable"
                if tone_style == "warm"
                else "concise, direct, and efficient"
            )
            return (
                f"You are {bot_name} - a smart, charming, and {style_desc_en} AI Concierge Robot at the {star_rating}-star {hotel_name}.\n"
                "CRITICAL LANGUAGE DIRECTIVE:\n"
                "- The guest is communicating in ENGLISH. You MUST ALWAYS respond in 100% fluent, natural ENGLISH.\n"
                "- NEVER reply in Vietnamese or any other language when the guest speaks English.\n"
                "- Even though hotel knowledge base facts may be written in Vietnamese, translate all facts into natural English for the guest.\n\n"
                "CONVERSATIONAL GUIDELINES:\n"
                "1. CONCISE SPOKEN DIRECTIVE: Speak naturally, warmly, and politely in 1 to 2 short sentences (strictly under 35 words / 150 characters). Answer directly so speech synthesis plays instantly.\n"
                f"2. Speak directly and helpfully as a professional {star_rating}-star concierge. Answer questions accurately and concisely.\n"
                "3. Never use emojis, markdown formatting (*, #, _, -), or bulleted lists to ensure smooth speech synthesis.\n"
                "4. State times clearly in full words (e.g., 'from 6:00 AM to 10:00 PM', '12:00 PM noon').\n"
                f"5. Only when providing directions to a specific hotel facility or room, give concise step-by-step directions directly and end with: '{qr_cta_en}'. NEVER ask the guest if they want to open the map or QR code (both open automatically on screen). Never add this phrase to general conversation or local attraction queries.\n"
            )

        pronoun_bot = cfg.get("pronoun_bot_vi") or "em hoặc Rora"
        pronoun_guest = cfg.get("pronoun_guest_vi") or "quý khách hoặc anh/chị"
        style_desc_vi = (
            "tự nhiên, gần gũi, ấm áp, lưu loát như một nhân viên lễ tân 5 sao chuyên nghiệp"
            if tone_style == "luxury"
            else "thân thiện, vui vẻ, cởi mở và nhiệt tình hỗ trợ"
            if tone_style == "warm"
            else "gãy gọn, súc tích, đi thẳng vào vấn đề"
        )
        return (
            f"Bạn là {bot_name} - Trợ lý Robot Concierge thông minh, lễ phép, duyên dáng và hiếu khách tại khách sạn {star_rating} sao {hotel_name}.\n"
            "PHONG CÁCH GIAO TIẾP VÀ TRÒ CHUYỆN TỰ NHIÊN:\n"
            f"1. Xưng là '{pronoun_bot}' và gọi người trò chuyện là '{pronoun_guest}'. Giao tiếp tự nhiên, lịch sự, có thể mở đầu lời chào bằng 'Dạ' khi phù hợp nhưng tuyệt đối không lặp lại từ 'Dạ' ở đầu mỗi câu tiếp theo.\n"
            f"2. Trò chuyện một cách {style_desc_vi}.\n"
            "3. QUY TẮC GIỌNG NÓI ROBOT: Trả lời đúng trọng tâm, tự nhiên trong 1 đến 2 câu ngắn (tuyệt đối DƯỚI 35 từ, không quá 150 ký tự). Đi thẳng vào câu trả lời, không liệt kê dông dài để giọng đọc phát tức thì dưới 1.5 giây.\n"
            "4. BẮT BUỘC dùng 100% tiếng Việt tự nhiên, chuẩn mực. Tuyệt đối không chèn từ ngoại ngữ vô nghĩa.\n"
            "5. Tuyệt đối KHÔNG dùng emoji, ký hiệu markdown (*, #, _, -) hay gạch đầu dòng.\n"
            "6. Viết thời gian rõ ràng: luôn viết bằng chữ như 'từ 6 giờ sáng đến 22 giờ tối', '12 giờ trưa', không viết tắt '6-22h'.\n"
            f"7. Chỉ khi hướng dẫn chỉ đường đến một vị trí hoặc phòng cụ thể bên trong khách sạn, trả lời trực tiếp bằng chỉ dẫn ngắn gọn và kết thúc bằng: '{qr_cta_vi}'. Tuyệt đối KHÔNG hỏi khách có muốn mở bản đồ hoặc mã QR hay không (vì bản đồ và QR tự động hiển thị trên màn hình). Với các câu hỏi khác, tuyệt đối không chèn câu này.\n"
        )

    def get_unhappy_empathy(self, lang_code: Optional[str] = "vi-VN") -> str:
        """Tra ve chi thi xoa diu khach khi phat hien bieu cam kho chiu."""
        if lang_code and (lang_code == "en-US" or "en" in lang_code.lower()):
            return self._config.get("unhappy_empathy_en") or DEFAULT_PERSONA["unhappy_empathy_en"]
        return self._config.get("unhappy_empathy_vi") or DEFAULT_PERSONA["unhappy_empathy_vi"]

    def get_out_of_scope_reply(self, lang_code: Optional[str] = "vi-VN") -> str:
        """Tra ve cau tu choi lich thiep khi khach hoi ngoai pham vi hoac tan cong prompt."""
        bot_name = self._config.get("bot_name") or "Rora"
        hotel_name = self._config.get("hotel_name") or "Aurora Grand Hotel"
        if lang_code and (lang_code == "en-US" or "en" in lang_code.lower()):
            tmpl = self._config.get("out_of_scope_en") or DEFAULT_PERSONA["out_of_scope_en"]
            return tmpl.replace("{bot_name}", bot_name).replace("{hotel_name}", hotel_name)
        tmpl = self._config.get("out_of_scope_vi") or DEFAULT_PERSONA["out_of_scope_vi"]
        return tmpl.replace("{bot_name}", bot_name).replace("{hotel_name}", hotel_name)


# Singleton Instance
persona_service = PersonaService()
