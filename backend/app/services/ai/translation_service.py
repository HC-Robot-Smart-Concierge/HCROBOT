import re
import urllib.parse
import logging
from typing import Dict, Any, Optional, Tuple
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Ký tự có dấu đặc trưng của Tiếng Việt
VIETNAMESE_DIACRITICS_REGEX = re.compile(
    r'[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]',
    re.IGNORECASE
)

# Các từ tiếng Việt thông dụng (dùng khi khách gõ/nói không dấu)
COMMON_VIETNAMESE_WORDS = {
    'xin', 'chao', 'toi', 'ban', 'anh', 'chi', 'em', 'da', 'vang', 'khong',
    'co', 'o', 'dau', 'phong', 'khach', 'san', 'nhe', 'a', 'gi', 'nay',
    'cho', 'voi', 'cua', 'duoc', 'muon', 'can', 'cam', 'on', 'roi', 'ngay',
    'dat', 'mon', 'an', 'uong', 'ho', 'boi', 'tang', 'may', 'gio', 'tra'
}

# Các từ tiếng Anh thông dụng
COMMON_ENGLISH_WORDS = {
    'the', 'is', 'are', 'was', 'were', 'where', 'what', 'how', 'when', 'who',
    'can', 'could', 'would', 'should', 'please', 'help', 'hotel', 'room',
    'pool', 'swimming', 'check', 'in', 'out', 'key', 'card', 'bill', 'breakfast',
    'lunch', 'dinner', 'restaurant', 'elevator', 'lift', 'floor', 'wifi',
    'service', 'towel', 'clean', 'need', 'want', 'thank', 'thanks', 'you'
}


class TranslationService:
    """
    Dịch vụ Phiên dịch Siêu Tốc (Fast Auto-Translation Service)
    tối ưu cho WebRTC Video Call 2 chiều giữa Robot Kiosk (Khách) và Concierge (Lễ tân).
    """

    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=3.0)

    @staticmethod
    def normalize_lang_code(lang: str) -> str:
        """Chuẩn hóa mã ngôn ngữ về 'vi' hoặc 'en'."""
        if not lang:
            return "vi"
        clean = lang.lower().strip()
        if clean.startswith("vi") or "việt" in clean or "viet" in clean:
            return "vi"
        if clean.startswith("en") or "anh" in clean or "eng" in clean:
            return "en"
        return clean[:2]

    @classmethod
    def detect_language(cls, text: str) -> str:
        """
        Nhận diện nhanh ngôn ngữ giữa Tiếng Việt ('vi') và Tiếng Anh ('en').
        """
        if not text or not text.strip():
            return "vi"

        # 1. Nếu chứa bất kỳ nguyên âm tiếng Việt có dấu nào -> Chắc chắn 100% là Tiếng Việt
        if VIETNAMESE_DIACRITICS_REGEX.search(text):
            return "vi"

        clean_words = set(re.findall(r'\b[a-zA-Z]+\b', text.lower()))
        if not clean_words:
            return "vi"

        # 2. Đếm số từ trùng khớp trong từ điển thông dụng
        vi_hits = len(clean_words.intersection(COMMON_VIETNAMESE_WORDS))
        en_hits = len(clean_words.intersection(COMMON_ENGLISH_WORDS))

        if vi_hits > en_hits:
            return "vi"
        if en_hits > vi_hits:
            return "en"

        # 3. Phân tích ngữ cảnh mặc định: nếu text chỉ gồm ký tự ascii thông thường và độ dài > 2 từ
        if len(clean_words) >= 2 and en_hits > 0:
            return "en"

        return "vi"

    async def _translate_via_google_gtx(self, text: str, src_lang: str, target_lang: str) -> Optional[str]:
        """
        Gọi Google Translate Web API siêu tốc (50ms - 150ms).
        """
        try:
            encoded_text = urllib.parse.quote(text)
            url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={src_lang}&tl={target_lang}&dt=t&q={encoded_text}"
            res = await self.http_client.get(url)
            if res.status_code == 200:
                data = res.json()
                if data and isinstance(data, list) and len(data) > 0 and data[0]:
                    parts = [seg[0] for seg in data[0] if seg and len(seg) > 0 and seg[0]]
                    translated = "".join(parts).strip()
                    if translated:
                        return translated
        except Exception as e:
            logger.warning(f"[TranslationService] Google GTX failed ({e}), attempting fallback...")
        return None

    async def _translate_via_gemini_fallback(self, text: str, src_lang: str, target_lang: str) -> Optional[str]:
        """
        Dự phòng dịch qua Gemini nếu mạng ngoài Google GTX bị chặn hoặc lỗi.
        """
        try:
            from app.services.ai.gemini_service import gemini_service
            if not gemini_service.is_configured:
                return None

            src_name = "Vietnamese" if src_lang == "vi" else "English"
            tgt_name = "English" if target_lang == "en" else "Vietnamese"
            prompt = (
                f"Translate the following hospitality/hotel spoken dialogue sentence from {src_name} to {tgt_name}.\n"
                f"Provide ONLY the direct translated sentence without quotes, explanations or extra words.\n\n"
                f"Original: {text}"
            )
            reply = await gemini_service.generate_reply(prompt=prompt, timeout=3.5)
            if reply and reply.strip():
                return reply.strip().strip('"').strip("'")
        except Exception as e:
            logger.warning(f"[TranslationService] Gemini fallback translation failed: {e}")
        return None

    async def translate(
        self,
        text: str,
        source_lang: str = "auto",
        target_lang: str = "vi",
        sender_role: str = "guest",
    ) -> Dict[str, Any]:
        """
        Thực hiện dịch thuật thông minh:
        - Tự động nhận diện ngôn ngữ nếu là 'auto'.
        - Nếu source == target hoặc cả 2 bên cùng nói tiếng Việt -> Bypass dịch (0ms).
        - Nếu khác ngôn ngữ -> Dịch và trả về song ngữ.
        """
        clean_text = (text or "").strip()
        if not clean_text:
            return {
                "original_text": "",
                "translated_text": "",
                "source_lang": "vi",
                "target_lang": target_lang,
                "needs_translation": False,
            }

        # 1. Xác định ngôn ngữ nguồn thực tế
        target_code = self.normalize_lang_code(target_lang)
        if source_lang == "auto" or not source_lang:
            detected_src = self.detect_language(clean_text)
        else:
            detected_src = self.normalize_lang_code(source_lang)

        # 2. Quy tắc bypass thông minh:
        # Nếu nguồn và đích giống nhau -> KHÔNG CẦN DỊCH
        if detected_src == target_code:
            return {
                "original_text": clean_text,
                "translated_text": clean_text,
                "source_lang": detected_src,
                "target_lang": target_code,
                "needs_translation": False,
            }

        # Nếu Khách nói tiếng Việt gửi cho Lễ tân (Lễ tân là người Việt) -> KHÔNG CẦN DỊCH
        if sender_role == "guest" and detected_src == "vi" and target_code == "vi":
            return {
                "original_text": clean_text,
                "translated_text": clean_text,
                "source_lang": "vi",
                "target_lang": "vi",
                "needs_translation": False,
            }

        # 3. Tiến hành dịch thuật:
        # Thử Google GTX trước (< 100ms)
        translated = await self._translate_via_google_gtx(clean_text, detected_src, target_code)

        # Fallback sang Gemini nếu cần
        if not translated:
            translated = await self._translate_via_gemini_fallback(clean_text, detected_src, target_code)

        # Fallback an toàn cuối cùng: Trả lại text gốc nếu mọi dịch vụ đều không phản hồi
        if not translated:
            logger.warning("[TranslationService] All translation providers failed, returning original text.")
            translated = clean_text

        return {
            "original_text": clean_text,
            "translated_text": translated,
            "source_lang": detected_src,
            "target_lang": target_code,
            "needs_translation": (translated != clean_text),
        }


# Singleton instance
translation_service = TranslationService()
