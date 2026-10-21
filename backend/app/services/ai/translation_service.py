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

# Các từ đệm/từ vay mượn ngắn phổ biến không đổi ngôn ngữ (Neutral words/fillers)
NEUTRAL_WORDS = {
    'ok', 'okay', 'yes', 'yeah', 'yep', 'no', 'nope', 'ah', 'uh', 'um', 'oh', 'bye', 'alo', 'ha', 'hmm', 'dạ', 'vâng'
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
        Trả về 'neutral' nếu câu nói chỉ gồm 1 từ đệm ngắn không đủ tin cậy để đổi ngôn ngữ.
        """
        if not text or not text.strip():
            return "neutral"

        clean_words = set(re.findall(r'\b[a-zA-Zàáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+\b', text.lower()))
        if not clean_words:
            return "neutral"

        # Nếu chỉ có 1 từ đệm trung tính (vd: ok, yeah, ah, hmm) -> Không đổi ngôn ngữ phiên
        if len(clean_words) <= 1 and clean_words.issubset(NEUTRAL_WORDS):
            return "neutral"

        # 1. Nếu chứa bất kỳ nguyên âm tiếng Việt có dấu nào -> Chắc chắn 100% là Tiếng Việt
        if VIETNAMESE_DIACRITICS_REGEX.search(text):
            return "vi"

        # 2. Đếm số từ trùng khớp trong từ điển thông dụng
        vi_hits = len(clean_words.intersection(COMMON_VIETNAMESE_WORDS))
        en_hits = len(clean_words.intersection(COMMON_ENGLISH_WORDS))

        if vi_hits > en_hits:
            return "vi"
        if en_hits > vi_hits:
            return "en"

        # 3. Phân tích ngữ cảnh mặc định: nếu text chỉ gồm ký tự ascii thông thường và độ dài >= 2 từ
        if len(clean_words) >= 2 and en_hits > 0:
            return "en"

        return "vi"

    async def _translate_via_google_gtx(self, text: str, src_lang: str, target_lang: str) -> tuple[Optional[str], Optional[str]]:
        """
        Gọi Google Translate Web API siêu tốc (50ms - 150ms).
        Trả về tuple (translated_text, detected_source_lang).
        """
        try:
            encoded_text = urllib.parse.quote(text)
            url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={src_lang}&tl={target_lang}&dt=t&q={encoded_text}"
            res = await self.http_client.get(url)
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
        with_audio: bool = False,
    ) -> Dict[str, Any]:
        """
        Thực hiện dịch thuật thông minh Zero-Touch:
        - Tự động nhận diện ngôn ngữ nếu là 'auto' qua Google AI + Diacritics Regex.
        - Nếu nguồn và đích giống nhau hoặc cùng là tiếng Việt -> Tự động Bypass (không dịch, KHÔNG phát âm TTS).
        - Nếu khác ngôn ngữ -> Dịch và tổng hợp giọng đọc TTS tương ứng (Hoài My cho VI, Jenny cho EN).
        """
        clean_text = (text or "").strip()
        if not clean_text:
            return {
                "original_text": "",
                "translated_text": "",
                "source_lang": "vi",
                "target_lang": target_lang,
                "needs_translation": False,
                "audio_base64": None,
            }

        # 1. Xác định ngôn ngữ nguồn và đích:
        target_code = self.normalize_lang_code(target_lang)
        
        # Nếu có dấu tiếng Việt rõ ràng -> Chắc chắn 100% là Tiếng Việt
        if VIETNAMESE_DIACRITICS_REGEX.search(clean_text):
            detected_src = "vi"
        elif source_lang != "auto" and source_lang:
            detected_src = self.normalize_lang_code(source_lang)
        else:
            detected_src = self.detect_language(clean_text)

        # 2. Quy tắc bypass thông minh:
        # Nếu là từ đệm trung tính (ok, hmm, ah,...) -> Không dịch, không đổi ngôn ngữ
        if detected_src == "neutral":
            return {
                "original_text": clean_text,
                "translated_text": clean_text,
                "source_lang": "neutral",
                "target_lang": target_code,
                "needs_translation": False,
                "audio_base64": None,
            }

        # Nếu nguồn và đích giống nhau -> KHÔNG CẦN DỊCH, KHÔNG CẦN TTS
        if detected_src == target_code:
            return {
                "original_text": clean_text,
                "translated_text": clean_text,
                "source_lang": detected_src,
                "target_lang": target_code,
                "needs_translation": False,
                "audio_base64": None,
            }

        # Nếu Khách nói tiếng Việt gửi cho Lễ tân (Lễ tân là người Việt) -> KHÔNG CẦN DỊCH
        if sender_role == "guest" and detected_src == "vi" and target_code == "vi":
            return {
                "original_text": clean_text,
                "translated_text": clean_text,
                "source_lang": "vi",
                "target_lang": "vi",
                "needs_translation": False,
                "audio_base64": None,
            }

        # 3. Tiến hành dịch thuật:
        # Thử Google GTX trước (< 100ms) với sl=auto để Google nhận diện chính xác
        src_for_gtx = "auto" if source_lang == "auto" else detected_src
        translated, gtx_detected = await self._translate_via_google_gtx(clean_text, src_for_gtx, target_code)
        if gtx_detected:
            detected_src = self.normalize_lang_code(gtx_detected)

        # Nếu sau khi đối chiếu ngôn ngữ thực tế trùng với ngôn ngữ đích -> KHÔNG DỊCH, KHÔNG TTS!
        if detected_src == target_code or translated == clean_text:
            return {
                "original_text": clean_text,
                "translated_text": clean_text,
                "source_lang": detected_src,
                "target_lang": target_code,
                "needs_translation": False,
                "audio_base64": None,
            }

        # Fallback sang Gemini nếu Google GTX lỗi
        if not translated:
            translated = await self._translate_via_gemini_fallback(clean_text, detected_src, target_code)

        # Fallback an toàn cuối cùng: Trả lại text gốc nếu mọi dịch vụ đều không phản hồi
        if not translated:
            logger.warning("[TranslationService] All translation providers failed, returning original text.")
            translated = clean_text

        needs_translation = (translated != clean_text)
        audio_b64 = None
        if needs_translation and with_audio:
            try:
                from app.services.ai.tts_service import tts_service
                audio_b64, _, _ = await tts_service.synthesize(
                    text=translated,
                    language=target_code,
                )
            except Exception as e:
                logger.warning(f"[TranslationService] TTS synthesis failed during translation: {e}")

        return {
            "original_text": clean_text,
            "translated_text": translated,
            "source_lang": detected_src,
            "target_lang": target_code,
            "needs_translation": needs_translation,
            "audio_base64": audio_b64,
        }


# Singleton instance
translation_service = TranslationService()
