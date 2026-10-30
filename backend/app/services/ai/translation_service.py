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
    'dat', 'mon', 'an', 'uong', 'ho', 'boi', 'tang', 'may', 'gio', 'tra',
    'giup', 'le', 'tan', 'nha', 'hang', 'khan', 'tam', 'nuoc', 'don'
}

# Các từ tiếng Anh thông dụng
COMMON_ENGLISH_WORDS = {
    'the', 'is', 'are', 'was', 'were', 'where', 'what', 'how', 'when', 'who', 'why',
    'can', 'could', 'would', 'should', 'will', 'please', 'help', 'hotel', 'room',
    'pool', 'swimming', 'check', 'in', 'out', 'key', 'card', 'bill', 'breakfast',
    'lunch', 'dinner', 'restaurant', 'elevator', 'lift', 'floor', 'wifi', 'password',
    'service', 'towel', 'towels', 'clean', 'cleaning', 'need', 'want', 'thank', 'thanks',
    'you', 'your', 'i', 'my', 'me', 'we', 'us', 'he', 'she', 'they', 'it', 'this', 'that',
    'good', 'morning', 'afternoon', 'evening', 'night', 'excuse', 'sorry', 'hello', 'hi',
    'yes', 'no', 'taxi', 'airport', 'luggage', 'bag', 'passport', 'phone', 'water',
    'food', 'menu', 'order', 'book', 'booking', 'reservation', 'late', 'early', 'now',
    'today', 'tomorrow', 'much', 'many', 'more', 'extra', 'hot', 'cold', 'broken',
    'work', 'working', 'speak', 'talk', 'understand', 'english', 'vietnamese',
    'from', 'to', 'at', 'on', 'for', 'with', 'about', 'have', 'has', 'had', 'do', 'does', 'did', 'not'
}

# Các từ cảm thán/đệm ngắn trung tính không cần dịch
NEUTRAL_WORDS = {
    'ok', 'okay', 'ah', 'uh', 'um', 'oh', 'alo', 'ha', 'hmm'
}


class TranslationService:
    """
    Dịch vụ Phiên dịch Siêu Tốc (Fast Auto-Translation Service)
    tối ưu cho WebRTC Video Call 2 chiều giữa Robot Kiosk (Khách) và Concierge (Lễ tân).
    Tách biệt hoàn toàn Ngôn ngữ đầu vào (Input Language theo từng câu) và Ngôn ngữ đầu ra (Target Language của người nhận).
    """

    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=3.0)

    async def close(self):
        """Đóng httpx AsyncClient khi ứng dụng tắt."""
        if self.http_client and not self.http_client.is_closed:
            await self.http_client.aclose()

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
        Trả về 'neutral' nếu câu nói chỉ gồm 1 từ cảm thán trung tính (ok, ah, hmm...).
        """
        if not text or not text.strip():
            return "neutral"

        clean_words = set(
            re.findall(
                r'\b[a-zA-Zàáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+\b',
                text.lower()
            )
        )
        if not clean_words:
            return "neutral"

        # 1. Nếu chỉ có 1 từ đệm trung tính (ok, ah, hmm) -> Không dịch
        if len(clean_words) <= 1 and clean_words.issubset(NEUTRAL_WORDS):
            return "neutral"

        # 2. Nếu chứa bất kỳ ký tự tiếng Việt có dấu nào -> Chắc chắn là Tiếng Việt ('vi')
        if VIETNAMESE_DIACRITICS_REGEX.search(text):
            return "vi"

        # 3. Đếm số từ trùng khớp trong từ điển thông dụng
        vi_hits = len(clean_words.intersection(COMMON_VIETNAMESE_WORDS))
        en_hits = len(clean_words.intersection(COMMON_ENGLISH_WORDS))

        if vi_hits > en_hits:
            return "vi"
        if en_hits > vi_hits:
            return "en"

        # 4. Nếu câu hoàn toàn là ASCII không dấu và không khớp từ tiếng Việt nào -> Ưu tiên 'en'
        if vi_hits == 0:
            return "en"

        return "vi"

    async def _translate_via_google_gtx(
        self, text: str, src_lang: str, target_lang: str
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Gọi Google Translate Web API siêu tốc (50ms - 150ms).
        Trả về tuple (translated_text, detected_source_lang).
        """
        try:
            encoded_text = urllib.parse.quote(text)
            url = (
                f"https://translate.googleapis.com/translate_a/single"
                f"?client=gtx&sl={src_lang}&tl={target_lang}&dt=t&q={encoded_text}"
            )
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(url)
            if res.status_code == 200:
                data = res.json()
                detected = data[2] if len(data) > 2 and data[2] else None
                if data and isinstance(data, list) and len(data) > 0 and data[0]:
                    parts = [seg[0] for seg in data[0] if seg and len(seg) > 0 and seg[0]]
                    translated = "".join(parts).strip()
                    if translated:
                        return translated, detected
        except Exception as e:
            logger.warning(f"[TranslationService] Google GTX failed ({e}), attempting fallback...")
        return None, None

    async def _translate_via_gemini_fallback(
        self, text: str, src_lang: str, target_lang: str
    ) -> Optional[str]:
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
        with_audio: bool = False,
    ) -> Dict[str, Any]:
        """
        Thực hiện dịch thuật tách biệt Ngôn ngữ câu nói (source_lang) và Ngôn ngữ đích của người nhận (target_lang):
        - Tự động nhận diện ngôn ngữ câu nói nếu source_lang='auto'.
        - Nếu ngôn ngữ câu nói trùng với ngôn ngữ đích của người nhận (vd: Khách nói tiếng Việt gửi cho Staff có target='vi',
          hoặc Staff nói tiếng Anh gửi cho Khách có target='en') -> Giữ nguyên văn bản gốc, needs_translation=False, không gọi TTS.
        - Nếu khác ngôn ngữ -> Dịch sang target_lang và tổng hợp TTS nếu with_audio=True.
        """
        clean_text = (text or "").strip()
        target_code = self.normalize_lang_code(target_lang)

        if not clean_text:
            return {
                "original_text": "",
                "translated_text": "",
                "source_lang": "vi",
                "target_lang": target_code,
                "needs_translation": False,
                "audio_base64": None,
                "tts_error_code": None,
                "tts_error_detail": None,
            }

        # 1. Xác định ngôn ngữ nguồn của câu vừa nói:
        if VIETNAMESE_DIACRITICS_REGEX.search(clean_text):
            detected_src = "vi"
        elif source_lang and source_lang.lower() not in ("auto", "bilingual"):
            detected_src = self.normalize_lang_code(source_lang)
        else:
            detected_src = self.detect_language(clean_text)

        # 2. Quy tắc giữ nguyên khi trung tính hoặc cùng ngôn ngữ với đích nhận:
        if detected_src == "neutral":
            return {
                "original_text": clean_text,
                "translated_text": clean_text,
                "source_lang": "neutral",
                "target_lang": target_code,
                "needs_translation": False,
                "audio_base64": None,
                "tts_error_code": None,
                "tts_error_detail": None,
            }

        if detected_src == target_code:
            return {
                "original_text": clean_text,
                "translated_text": clean_text,
                "source_lang": detected_src,
                "target_lang": target_code,
                "needs_translation": False,
                "audio_base64": None,
                "tts_error_code": None,
                "tts_error_detail": None,
            }

        # 3. Tiến hành dịch thuật:
        src_for_gtx = "auto" if (not source_lang or source_lang.lower() in ("auto", "bilingual")) else detected_src
        translated, gtx_detected = await self._translate_via_google_gtx(clean_text, src_for_gtx, target_code)
        if gtx_detected and gtx_detected.lower()[:2] in ("vi", "en"):
            detected_src = self.normalize_lang_code(gtx_detected)

        # Nếu Google GTX phát hiện ngôn ngữ thực tế trùng với target_code -> Giữ nguyên câu gốc, không cần dịch/TTS
        if detected_src == target_code:
            return {
                "original_text": clean_text,
                "translated_text": clean_text,
                "source_lang": detected_src,
                "target_lang": target_code,
                "needs_translation": False,
                "audio_base64": None,
                "tts_error_code": None,
                "tts_error_detail": None,
            }

        # Fallback sang Gemini nếu Google GTX lỗi
        if not translated:
            translated = await self._translate_via_gemini_fallback(clean_text, detected_src, target_code)

        if not translated:
            logger.warning("[TranslationService] All translation providers failed, returning original text.")
            translated = clean_text
            needs_translation = False
        else:
            needs_translation = (translated.strip().lower() != clean_text.strip().lower()) or (detected_src != target_code)

        audio_b64 = None
        tts_err_code = None
        tts_err_detail = None
        if needs_translation and with_audio and translated.strip():
            try:
                from app.services.ai.tts_service import tts_service
                tts_res = await tts_service.synthesize_with_details(
                    text=translated,
                    language=target_code,
                )
                audio_b64 = tts_res.get("audio_base64") or None
                tts_err_code = tts_res.get("error_code")
                tts_err_detail = tts_res.get("error_detail")
            except Exception as e:
                tts_err_code = "TTS_PROVIDER_ERROR"
                tts_err_detail = str(e)
                logger.warning(f"[TranslationService] TTS synthesis failed during translation: {e}")

        return {
            "original_text": clean_text,
            "translated_text": translated,
            "source_lang": detected_src,
            "target_lang": target_code,
            "needs_translation": needs_translation,
            "audio_base64": audio_b64,
            "tts_error_code": tts_err_code,
            "tts_error_detail": tts_err_detail,
        }


# Singleton instance
translation_service = TranslationService()
