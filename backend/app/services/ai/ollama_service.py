import asyncio
import datetime
import json
import logging
import re
from typing import Dict, Any, List, Optional, Tuple

import ollama

from app.core.config import settings
from app.services.ai.scenario_service import scenario_service

logger = logging.getLogger(__name__)


class OllamaService:
    def __init__(self):
        self.host = settings.OLLAMA_HOST
        self.model = settings.OLLAMA_MODEL
        self.embed_model = getattr(settings, "OLLAMA_EMBED_MODEL", None)
        self._client = ollama.AsyncClient(host=self.host)

    async def _call_groq(self, messages: List[Dict[str, str]], json_mode: bool = False, max_tokens: int = 60) -> Optional[str]:
        """
        Gọi Groq Cloud API qua HTTP POST (OpenAI format).
        Chỉ kích hoạt khi AI_PROVIDER='groq' hoặc tự động fallback khi Ollama cục bộ offline.
        """
        if not settings.GROQ_API_KEY:
            return None
        import httpx
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "HC-Robot-Concierge/1.0",
        }
        payload = {
            "model": settings.GROQ_MODEL or "qwen/qwen3.8-27b",
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.0 if json_mode else 0.4,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    logger.warning(f"[Groq API Warning] status={res.status_code}: {res.text[:120]}")
                    return None
        except Exception as e:
            logger.warning(f"[Groq API Error]: {str(e)}")
            return None

    @staticmethod
    def detect_language(text: str) -> Tuple[str, str]:
        """
        Tự động phân tích câu nói của khách để nhận diện ngôn ngữ và mã lang_code cho TTS.
        Nhận biết chính xác Tiếng Việt (vi-VN), Tiếng Anh (en-US), Tiếng Trung (zh-CN), Tiếng Nhật (ja-JP).
        """
        if not text or not text.strip():
            return "Tiếng Việt", "vi-VN"

        # 1. Ký tự có dấu tiếng Việt đặc trưng -> 100% Tiếng Việt
        if re.search(r'[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]', text, re.IGNORECASE):
            return "Tiếng Việt", "vi-VN"

        lower_text = text.lower().strip()

        # 2. Tiếng Trung (Chữ Hán)
        cjk_chars = re.findall(r'[\u4e00-\u9fff]', text)
        latin_chars = re.findall(r'[a-zA-Z]', text)
        if len(cjk_chars) > 0 and len(cjk_chars) > len(latin_chars):
            return "Tiếng Trung", "zh-CN"

        # 3. Tiếng Nhật (Hiragana / Katakana)
        if re.search(r'[\u3040-\u30ff]', text):
            return "Tiếng Nhật", "ja-JP"

        # 4. Tiếng Việt không dấu (các cụm từ / từ vựng đặc trưng tránh trùng với tiếng Anh)
        vi_phrases = [
            r'\bphong\s*[0-9]', r'\bphong\b', r'\btoi\b', r'\bmuon\b', r'\bkhan\s*tam\b',
            r'\bdon\s*phong\b', r'\bo\s*dau\b', r'\bkhach\s*san\b', r'\ble\s*tan\b',
            r'\bbao\s*tri\b', r'\bcam\s*on\b', r'\bchao\s*em\b', r'\bxin\s*chao\b',
            r'\bquy\s*khach\b', r'\btra\s*phong\b', r'\bnhan\s*phong\b',
            r'\bgoi\s*xe\b', r'\bthang\s*may\b', r'\bho\s*boi\b', r'\bbe\s*boi\b'
        ]
        if any(re.search(pattern, lower_text) for pattern in vi_phrases):
            return "Tiếng Việt", "vi-VN"

        # 5. Tiếng Anh: kiểm tra các mẫu câu và tập từ vựng tiếng Anh thông dụng
        english_patterns = [
            r'\b(where|what|when|why|who|how|which|whose)\b',
            r'\b(can|could|would|should|will|do|does|did|is|are|was|were|have|has|had)\b',
            r'\b(i|you|he|she|it|we|they|my|your|his|her|its|our|their|me|him|them|us)\b',
            r'\b(hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening|goodbye|bye)\b',
            r'\b(thank\s+you|thanks|please|excuse\s+me|sorry|pardon)\b',
            r'\b(hotel|room|pool|swimming|wifi|password|breakfast|checkout|checkin|gym|spa)\b',
            r'\b(luggage|baggage|towel|water|food|drink|restaurant|taxi|airport|service|help|need|want)\b'
        ]
        if any(re.search(pattern, lower_text) for pattern in english_patterns):
            return "English", "en-US"

        return "Tiếng Việt", "vi-VN"

    def check_fast_path(self, prompt: str, language: Optional[str] = None) -> Optional[Tuple[str, str, str]]:
        """
        Phản hồi tức thì (<1ms) từ Dynamic Fast-Path In-Memory Cache.
        Trả về 3-tuple (reply, lang_name, lang_code) để tương thích ngược.
        """
        match = self.check_fast_path_full(prompt, language)
        if match:
            return match[0], match[1], match[2]
        return None

    def check_fast_path_full(
        self, prompt: str, language: Optional[str] = None
    ) -> Optional[Tuple[str, str, str, str, Optional[Dict[str, Any]]]]:
        """
        Phản hồi tức thì (<1ms) từ Dynamic Fast-Path In-Memory Cache (do Admin quản lý qua API).
        Bao phủ: chào hỏi, tiện ích, dịch vụ, FAQ, chỉ đường, kích hoạt video call.
        Trả về: (reply, lang_name, lang_code, action_type, action_payload).
        """
        if not prompt or not prompt.strip():
            return None

        if not language or language.lower() in ["auto", ""]:
            lang_name, lang_code = self.detect_language(prompt)
        else:
            lang_name = language
            lang_code = "en-US" if language.lower() in ["english", "en"] else "vi-VN"

        prompt_lower = prompt.lower().strip()
        is_en = lang_code == "en-US"

        import datetime
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

        # PRE-CHECK: Nếu câu nói chứa từ khóa HÀNH ĐỘNG dịch vụ buồng phòng / bảo trì
        # → Bỏ qua fast-path để Intent Router + Service FSM xử lý slot-filling số phòng
        service_action_verbs = [
            "đặt", "cần", "muốn", "yêu cầu", "sửa",
            "book", "order", "reserve", "need", "repair", "fix"
        ]
        service_nouns = [
            "khăn", "gối", "chăn", "dọn phòng", "don phong",
            "điều hòa", "máy lạnh", "bóng đèn", "nước rò", "kẹt", "towel", "cleaning"
        ]
        has_action_verb = any(v in prompt_lower for v in service_action_verbs)
        has_service_noun = any(n in prompt_lower for n in service_nouns)
        if has_action_verb and has_service_noun:
            logger.info(f"[OllamaService Fast-Path Bypass] Service action intent detected, skipping fast-path for: '{prompt[:40]}'")
            return None

        # Đối soát nhanh từ Dynamic Scenarios Cache trong RAM (< 0.1ms)
        dynamic_hit = scenario_service.match_fast_path(prompt, lang_code)
        if dynamic_hit:
            return dynamic_hit

        # 2. Lời chào chung (Greetings)
        if re.search(r"^(xin chào|xin chao|chào em|chao em|chào robot|chao robot|chào bạn|chao ban|chào rora|chao rora|hello|hi|hey|good morning|good afternoon|good evening)[\?\.\!\s]*$", prompt_lower):
            return (time_greeting_en if is_en else time_greeting_vi), lang_name, lang_code

        # 2.1. Hỏi thăm sức khỏe (How are you)
        if re.search(r"\b(khỏe không|khoe khong|bạn khỏe không|ban khoe khong|em khỏe không|em khoe khong|bạn có khỏe không|ban co khoe khong|how are you|how are you doing)\b", prompt_lower):
            reply_vi = "Dạ em khỏe ạ! Cảm ơn quý khách đã quan tâm. Em có thể hỗ trợ gì cho kỳ nghỉ của mình hôm nay ạ?"
            reply_en = "I am doing great, thank you for asking! How may I assist you with your stay today?"
            return (reply_en if is_en else reply_vi), lang_name, lang_code

        # 3. Lời cảm ơn (Thanks)
        if re.search(r"\b(cảm ơn|cam on|thank you|thanks|cảm ơn em|cảm ơn rora)\b", prompt_lower):
            reply_vi = "Dạ không có gì ạ! Rora rất hân hạnh được hỗ trợ quý khách. Chúc quý khách có những phút giây tuyệt vời tại Aurora!"
            reply_en = "You are most welcome! Rora is always delighted to assist you. Have a wonderful time at Aurora!"
            return (reply_en if is_en else reply_vi), lang_name, lang_code

        # 4. Tạm biệt (Farewell)
        if re.search(r"\b(tạm biệt|tam biet|goodbye|bye|bye bye|hẹn gặp lại)\b", prompt_lower):
            reply_vi = "Dạ tạm biệt quý khách! Chúc quý khách một ngày tràn ngập niềm vui và hẹn sớm gặp lại ạ."
            reply_en = "Goodbye! Wishing you a joyful day and looking forward to seeing you again."
            return (reply_en if is_en else reply_vi), lang_name, lang_code

        # 5. Hồ bơi / Bể bơi (Pool)
        if re.search(r"\b(hồ bơi|bể bơi|swimming pool|pool)\b", prompt_lower):
            reply_vi = "Dạ hồ bơi vô cực ngoài trời nằm ở Tầng 4, mở cửa từ 6 giờ sáng đến 22 giờ tối và có sẵn khăn tắm miễn phí ạ."
            reply_en = "The outdoor infinity pool is located on Level 4, open from 6:00 AM to 10:00 PM with complimentary towels."
            return (reply_en if is_en else reply_vi), lang_name, lang_code

        # 6. Nhà hàng / Ăn sáng / Buffet (Restaurant & Breakfast)
        if re.search(r"\b(nhà hàng|bữa sáng|buffet sáng|ăn sáng|restaurant|breakfast)\b", prompt_lower):
            reply_vi = "Dạ Nhà hàng Aurora nằm ở Tầng 2, phục vụ buffet sáng từ 6 giờ 30 đến 10 giờ sáng hàng ngày ạ."
            reply_en = "The Aurora Restaurant is located on Level 2, serving breakfast buffet from 6:30 AM to 10:00 AM daily."
            return (reply_en if is_en else reply_vi), lang_name, lang_code

        # 7. Phòng Gym / Thể hình (Gym / Fitness)
        if re.search(r"\b(phòng gym|tập gym|thể dục|gym|fitness)\b", prompt_lower):
            reply_vi = "Dạ Phòng Gym và trung tâm thể hình nằm ở Tầng 4, mở cửa phục vụ 24 trên 7 miễn phí cho quý khách ạ."
            reply_en = "The Fitness Center is on Level 4, open 24/7 complimentary for staying guests."
            return (reply_en if is_en else reply_vi), lang_name, lang_code

        # 8. Spa / Xông hơi (Spa & Sauna)
        if re.search(r"\b(spa|massage|xông hơi|sauna)\b", prompt_lower):
            reply_vi = "Dạ Aurora Luxury Spa nằm tại Tầng 5, mở cửa phục vụ quý khách từ 9 giờ sáng đến 22 giờ tối ạ."
            reply_en = "Aurora Luxury Spa is on Level 5, open from 9:00 AM to 10:00 PM."
            return (reply_en if is_en else reply_vi), lang_name, lang_code

        # 9. Giờ nhận phòng / Trả phòng (Check-in / Check-out)
        if re.search(r"\b(trả phòng|check out|check-out|mấy giờ trả phòng|trả phòng lúc mấy giờ)\b", prompt_lower):
            reply_vi = "Dạ giờ trả phòng tiêu chuẩn là trước 12 giờ trưa quý khách nhé."
            reply_en = "Standard check-out time is before 12:00 PM noon."
            return (reply_en if is_en else reply_vi), lang_name, lang_code

        if re.search(r"\b(nhận phòng|check in|check-in|mấy giờ nhận phòng|nhận phòng lúc mấy giờ)\b", prompt_lower):
            reply_vi = "Dạ giờ nhận phòng tiêu chuẩn tại khách sạn Aurora là từ 14 giờ chiều ạ."
            reply_en = "Standard check-in time at Aurora Hotel is from 2:00 PM."
            return (reply_en if is_en else reply_vi), lang_name, lang_code

        # 10. Nhà vệ sinh / Toilet / WC
        if re.search(r"\b(nhà vệ sinh|toilet|wc|restroom|phòng vệ sinh)\b", prompt_lower):
            reply_vi = "Dạ nhà vệ sinh sảnh chính nằm ở phía tay phải sau quầy lễ tân tầng 1 ạ."
            reply_en = "The lobby restrooms are located on the right side behind the Front Desk on Level 1."
            return (reply_en if is_en else reply_vi), lang_name, lang_code

        # 11. Bãi đỗ xe (Parking)
        if re.search(r"\b(bãi đỗ xe|đỗ xe|gửi xe|bãi xe|parking)\b", prompt_lower):
            reply_vi = "Dạ bãi đỗ xe ô tô và xe máy miễn phí nằm ở Tầng hầm B1 của khách sạn ạ."
            reply_en = "Complimentary car and motorbike parking is located at Basement B1."
            return (reply_en if is_en else reply_vi), lang_name, lang_code

        # 12. Danh tính robot (Who are you)
        if re.search(r"\b(bạn là ai|em là ai|tên gì|who are you|what is your name)\b", prompt_lower):
            reply_vi = "Dạ em là Rora, trợ lý Robot Concierge thông minh của khách sạn 5 sao Aurora Grand. Rất hân hạnh được phục vụ quý khách ạ!"
            reply_en = "I am Rora, the smart AI Concierge Robot at Aurora Grand Hotel. It is my pleasure to assist you!"
            return (reply_en if is_en else reply_vi), lang_name, lang_code

        return None

    @staticmethod
    def clean_vietnamese_voice_text(text: str) -> str:
        """Làm sạch và chuẩn hóa văn bản tiếng Việt cho giọng đọc mượt mà, không bị ngắc ngứ."""
        if not text:
            return ""
        # Chuyển đổi ký tự ngoại ngữ lỗi do LLM multilingual
        text = re.sub(r'\bдо\b', 'đến', text, flags=re.IGNORECASE)
        text = re.sub(r'\bчасов\b', 'giờ', text, flags=re.IGNORECASE)
        text = re.sub(r'[\u0400-\u04FF]', '', text)
        text = re.sub(r'[\u4e00-\u9fff]', '', text)
        text = re.sub(r'[*#_`\[\]()]', '', text)
        # Giờ chẵn: 10:00 -> 10 giờ
        text = re.sub(r'(\d{1,2}):00\b', r'\1 giờ', text)
        # Giờ lẻ: 6:30 -> 6 giờ 30 phút
        text = re.sub(r'(\d{1,2}):(\d{2})\b', r'\1 giờ \2 phút', text)
        text = re.sub(r'(\d{1,2})h(\d{1,2})\b', r'\1 giờ \2 phút', text)
        text = re.sub(r'(\d{1,2})h\b', r'\1 giờ', text)
        # Khoảng giờ: 6-22h hoặc 9 giờ-22 giờ -> từ 6 đến 22 giờ
        text = re.sub(r'(\d{1,2})\s*(?:giờ|h)?\s*[-–—]\s*(\d{1,2})\s*(?:giờ|h)?', r'từ \1 đến \2 giờ', text)
        text = re.sub(r'\b24/7\b', '24 trên 7', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def _build_system_prompt(
        self,
        lang_code: str,
        emotion: Optional[str] = None,
        stored_room_number: Optional[str] = None,
        rag_context: Optional[str] = None,
    ) -> str:
        """
        Xây dựng System Prompt tối ưu cho giao tiếp hội thoại tự nhiên, thông minh và phản hồi nhanh.
        Tự động nạp thông tin tiện ích động từ ScenarioService (do Admin quản lý qua API).
        """
        hotel_facts = scenario_service.get_hotel_facts_prompt(lang_code)

        if lang_code == "en-US":
            prompt = (
                "You are Rora - a smart, charming, and courteous AI Concierge Robot at the 5-star Aurora Grand Hotel.\n"
                "CONVERSATIONAL GUIDELINES:\n"
                "1. Always communicate naturally, warmly, and politely in 2 to 3 clear, complete sentences.\n"
                "2. Speak directly and helpfully as a professional 5-star concierge. Answer questions accurately and concisely.\n"
                "3. Never use emojis, markdown formatting (*, #, _, -), or bulleted lists to ensure smooth speech synthesis.\n"
                "4. State times clearly in full words (e.g., 'from 6:00 AM to 10:00 PM', '12:00 PM noon').\n"
            )
            if hotel_facts:
                prompt += f"\n{hotel_facts}\n"
            else:
                prompt += (
                    "AURORA GRAND HOTEL AMENITIES & FACTS:\n"
                    "- Level 1: Main Lobby, Front Desk 24/7 (dial 0 from room telephone), and ATM.\n"
                    "- Level 2: Aurora Restaurant (serves breakfast buffet from 6:30 AM to 10:00 AM).\n"
                    "- Level 3: Conference Center & Executive Meeting Rooms.\n"
                    "- Level 4: Infinity Pool (open 6:00 AM to 10:00 PM, free towels) & 24/7 Fitness Center / Gym.\n"
                    "- Level 5: Aurora Luxury Spa & Sauna (open 9:00 AM to 10:00 PM).\n"
                    "- Basement B1: Complimentary parking for staying guests.\n"
                    "- Wi-Fi: Network name 'Aurora_Guest', password 'aurora2026'.\n"
                    "- Hours: Standard check-in from 2:00 PM, check-out before 12:00 PM noon.\n"
                )
        else:
            prompt = (
                "Bạn là Rora - Trợ lý Robot Concierge thông minh, lễ phép, duyên dáng và hiếu khách tại khách sạn 5 sao Aurora Grand Hotel.\n"
                "PHONG CÁCH GIAO TIẾP VÀ TRÒ CHUYỆN TỰ NHIÊN:\n"
                "1. Luôn xưng 'Dạ em' hoặc 'Rora' và gọi người trò chuyện là 'quý khách' hoặc 'anh/chị'.\n"
                "2. Trò chuyện một cách tự nhiên, gần gũi, ấm áp, lưu loát như một nhân viên lễ tân 5 sao chuyên nghiệp.\n"
                "3. Trả lời đúng trọng tâm, súc tích trong 2 đến 3 câu văn gãy gọn, hoàn chỉnh để phát giọng đọc mượt mà và người nghe dễ nắm bắt nhất.\n"
                "4. BẮT BUỘC dùng 100% tiếng Việt tự nhiên, chuẩn mực. Tuyệt đối không chèn từ ngoại ngữ vô nghĩa.\n"
                "5. Tuyệt đối KHÔNG dùng emoji, ký hiệu markdown (*, #, _, -) hay gạch đầu dòng.\n"
                "6. Viết thời gian rõ ràng: luôn viết bằng chữ như 'từ 6 giờ sáng đến 22 giờ tối', '12 giờ trưa', không viết tắt '6-22h'.\n"
            )
            if hotel_facts:
                prompt += f"\n{hotel_facts}\n"
            else:
                prompt += (
                    "\nTHÔNG TIN TIỆN ÍCH KHÁCH SẠN AURORA GRAND (ĐỂ TƯ VẤN CHO KHÁCH):\n"
                    "- Tầng 1: Sảnh chính, Quầy Lễ tân 24/7 (từ điện thoại phòng bấm phím 0) và máy ATM rút tiền.\n"
                    "- Tầng 2: Nhà hàng Aurora (phục vụ buffet sáng từ 6 giờ 30 đến 10 giờ sáng).\n"
                    "- Tầng 3: Trung tâm hội nghị & phòng họp sự kiện cao cấp.\n"
                    "- Tầng 4: Hồ bơi vô cực ngoài trời (mở từ 6 giờ sáng đến 22 giờ tối, khăn tắm miễn phí) và Phòng Gym (mở cửa 24/7).\n"
                    "- Tầng 5: Aurora Spa thư giãn (mở từ 9 giờ sáng đến 22 giờ tối).\n"
                    "- Tầng hầm B1: Bãi đỗ xe ô tô và xe máy miễn phí cho khách lưu trú.\n"
                    "- Wi-Fi miễn phí: Tên mạng 'Aurora_Guest', mật khẩu là 'aurora2026'.\n"
                    "- Thời gian lưu trú: Nhận phòng từ 14 giờ chiều, trả phòng trước 12 giờ trưa.\n"
                )

        if stored_room_number:
            prompt += f"\n[Thông tin phòng]: Quý khách ở phòng {stored_room_number}."

        emotion_str = (emotion or "").lower()
        if emotion_str in ["annoyed", "angry", "upset"]:
            prompt += "\n[Cảm xúc khách]: Khách đang chưa hài lòng, hãy phản hồi với thái độ xin lỗi và xoa dịu ân cần."
        elif emotion_str in ["happy", "pleased"]:
            prompt += "\n[Cảm xúc khách]: Khách đang rất vui vẻ, hãy phản hồi tươi vui và nhiệt tình."

        if rag_context:
            prompt += f"\n[Thông tin bổ sung]:\n{rag_context}"

        return prompt

    async def generate_response_stream(
        self,
        prompt: str,
        rag_context: Optional[str] = None,
        language: Optional[str] = None,
        emotion: Optional[str] = None,
        chat_history: Optional[List[Dict[str, str]]] = None,
        stored_room_number: Optional[str] = None,
    ):
        """
        Async Generator sinh token theo thời gian thực từ Qwen LLM qua Ollama (stream=True).
        """
        # 0. Kiểm tra Mega Fast-Path tức thì (< 1ms)
        fast_hit = self.check_fast_path(prompt, language)
        if fast_hit:
            reply, _, _ = fast_hit
            yield reply
            return

        # Ưu tiên Gemini LLM Engine nếu được kích hoạt
        if getattr(settings, "is_gemini_active", False):
            try:
                from app.services.ai.gemini_service import gemini_service
                if gemini_service.is_configured:
                    async for token in gemini_service.generate_response_stream(
                        prompt=prompt,
                        rag_context=rag_context,
                        language=language,
                        emotion=emotion,
                        chat_history=chat_history,
                        stored_room_number=stored_room_number,
                    ):
                        yield token
                    return
            except Exception as e_gemini:
                logger.warning(f"[OllamaService] Gemini streaming error, fallback to Ollama Llama: {e_gemini}")

        if not language or language.lower() in ["auto", ""]:
            lang_name, lang_code = self.detect_language(prompt)
        else:
            lang_name = language
            lang_code = "en-US" if language.lower() in ["english", "en"] else "vi-VN"

        system_prompt = self._build_system_prompt(
            lang_code=lang_code,
            emotion=emotion,
            stored_room_number=stored_room_number,
            rag_context=rag_context,
        )

        messages = [{"role": "system", "content": system_prompt}]
        if chat_history:
            for turn in chat_history:
                if turn.get("role") in ["user", "assistant"] and turn.get("content"):
                    messages.append({"role": turn["role"], "content": turn["content"]})
        messages.append({"role": "user", "content": prompt})

        try:
            response_stream = await self._client.chat(
                model=self.model,
                messages=messages,
                stream=True,
                options={
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "num_ctx": 1024,
                    "num_predict": 70,
                    "num_thread": 8,
                    "repeat_penalty": 1.1,
                },
                keep_alive="30m"
            )

            async for chunk in response_stream:
                token = chunk.get("message", {}).get("content", "")
                if token:
                    yield token
        except Exception as e:
            logger.error(f"[OllamaService StreamError] Lỗi streaming LLM: {str(e)}")
            fallback = "Xin lỗi quý khách, hiện không thể kết nối tới AI Server." if lang_code == "vi-VN" else "Sorry, cannot connect to AI Server."
            yield fallback

    async def generate_response(
        self,
        prompt: str,
        rag_context: Optional[str] = None,
        language: Optional[str] = None,
        emotion: Optional[str] = None,
        chat_history: Optional[List[Dict[str, str]]] = None,
        stored_room_number: Optional[str] = None,
    ) -> Tuple[str, str, str]:
        """
        Sinh câu trả lời thoại cho Concierge Robot dựa trên câu hỏi của khách và lịch sử phiên.
        """
        # 0. Kiểm tra Fast-Path trước
        fast_hit = self.check_fast_path(prompt, language)
        if fast_hit:
            return fast_hit

        # Ưu tiên Gemini LLM Engine nếu được kích hoạt
        if getattr(settings, "is_gemini_active", False):
            try:
                from app.services.ai.gemini_service import gemini_service
                if gemini_service.is_configured:
                    return await gemini_service.generate_response(
                        prompt=prompt,
                        rag_context=rag_context,
                        language=language,
                        emotion=emotion,
                        chat_history=chat_history,
                        stored_room_number=stored_room_number,
                    )
            except Exception as e_gemini:
                logger.warning(f"[OllamaService] Gemini generate error, fallback to Ollama Llama: {e_gemini}")

        if not language or language.lower() in ["auto", ""]:
            lang_name, lang_code = self.detect_language(prompt)
        else:
            lang_name = language
            lang_code = "en-US" if language.lower() in ["english", "en"] else "vi-VN"

        system_prompt = self._build_system_prompt(
            lang_code=lang_code,
            emotion=emotion,
            stored_room_number=stored_room_number,
            rag_context=rag_context,
        )

        messages = [{"role": "system", "content": system_prompt}]
        if chat_history:
            for turn in chat_history:
                if turn.get("role") in ["user", "assistant"] and turn.get("content"):
                    messages.append({"role": turn["role"], "content": turn["content"]})
        messages.append({"role": "user", "content": prompt})

        # 1. Chế độ Test máy yếu đặc thù qua Groq Cloud (chỉ kích hoạt khi AI_PROVIDER='groq')
        use_groq = (settings.AI_PROVIDER == "groq" and bool(settings.GROQ_API_KEY))
        if use_groq:
            logger.info(f"[OllamaService -> Groq Cloud] Chế độ máy yếu: gọi Groq model {settings.GROQ_MODEL}")
            groq_reply = await self._call_groq(messages, json_mode=False, max_tokens=60)
            if groq_reply:
                reply = groq_reply.strip()
                if lang_code != "zh-CN":
                    reply = re.sub(r'[\u4e00-\u9fff\u3400-\u4dbf]+', '', reply).strip()
                final_lang_name, final_lang_code = self.detect_language(reply)
                return reply, final_lang_name, final_lang_code

        # 2. Mặc định cho toàn bộ dự án: Chạy Ollama cục bộ nguyên bản
        try:
            response = await asyncio.wait_for(
                self._client.chat(
                    model=self.model,
                    messages=messages,
                    options={
                        "temperature": 0.7,
                        "top_p": 0.9,
                        "num_ctx": 1024,
                        "num_predict": 70,
                        "num_thread": 8,
                        "repeat_penalty": 1.1,
                    },
                    keep_alive="30m"
                ),
                timeout=25.0
            )

            reply = response["message"]["content"].strip()
            if lang_code != "zh-CN":
                reply = re.sub(r'[\u4e00-\u9fff\u3400-\u4dbf]+', '', reply).strip()

            final_lang_name, final_lang_code = self.detect_language(reply)
            return reply, final_lang_name, final_lang_code
        except Exception as e:
            logger.warning(f"[OllamaService Warning] Lỗi Ollama cục bộ: {str(e)}")

            # Fallback an toàn sang Groq nếu có API key (phòng ngừa máy yếu hết RAM không bật được Ollama)
            if settings.GROQ_API_KEY:
                logger.info("[OllamaService Fallback] Tự động chuyển tiếp sang Groq Cloud...")
                groq_reply = await self._call_groq(messages, json_mode=False, max_tokens=60)
                if groq_reply:
                    reply = groq_reply.strip()
                    if lang_code != "zh-CN":
                        reply = re.sub(r'[\u4e00-\u9fff\u3400-\u4dbf]+', '', reply).strip()
                    final_lang_name, final_lang_code = self.detect_language(reply)
                    return reply, final_lang_name, final_lang_code

            fallback = "Xin lỗi quý khách, hiện không thể kết nối tới AI Server." if lang_code == "vi-VN" else "Sorry, cannot connect to AI Server."
            return fallback, lang_name, lang_code

    async def extract_intent(self, user_speech: str) -> Dict[str, Any]:
        """
        Bóc tách Ý định (Intent) & Thực thể (Entities) từ câu nói của khách hàng ra JSON chuẩn.
        """
        # Làm sạch wake-up word 'Rora' nếu có ở đầu câu nói
        user_speech = re.sub(r'^(?:hey rora|chào rora|chao rora|rora ơi|rora oi|hello rora|hi rora|rora)[\,\.\!\s]*', '', user_speech, flags=re.IGNORECASE).strip() or user_speech

        # Regex kiểm tra nhanh số phòng trực tiếp (Ví dụ: "phòng 502", "p.304", "502", "tôi ở 402")
        room_match = re.search(r'(?:phòng|p\.|p|phong)\s*([0-9]{3,4})|^(?:tôi ở|ở)\s*([0-9]{3,4})$', user_speech, re.IGNORECASE)
        extracted_room_regex = None
        if room_match:
            extracted_room_regex = room_match.group(1) or room_match.group(2)

        # Fast-Path Keyword Check (Nếu khớp từ khóa dịch vụ rõ ràng -> Trả về luôn siêu tốc < 1ms)
        lower_speech = user_speech.lower()
        fast_action = None
        if any(k in lower_speech for k in ["khăn", "khan", "tắm", "tam", "dọn phòng", "don phong", "gối", "goi", "chăn", "chan", "nệm", "nem", "towel", "clean"]):
            fast_action = "housekeeping"
        elif any(k in lower_speech for k in ["cơm", "com", "nước", "nuoc", "ăn", "an", "uống", "uong", "đồ ăn", "do an", "trà", "tra", "cà phê", "ca phe", "pizza", "phở", "pho", "bánh", "banh", "food", "drink"]):
            fast_action = "room_service"
        elif any(k in lower_speech for k in ["hành lý", "hanh ly", "vali", "túi", "tui", "chuyển phòng", "chuyen phong", "mang đồ", "mang do", "luggage", "bag"]):
            fast_action = "bellman"
        elif any(k in lower_speech for k in ["hỏng", "hong", "sửa", "sua", "điều hòa", "dieu hoa", "bóng đèn", "bong den", "nước rò", "nuoc ro", "máy lạnh", "may lanh", "tủ lạnh", "tu lanh", "fix", "repair"]):
            fast_action = "maintenance"
        elif any(k in lower_speech for k in ["đặt bàn", "dat ban", "đặt món", "dat mon", "bàn ăn", "ban an", "nhà hàng", "nha hang", "table", "restaurant"]):
            fast_action = "restaurant"
        elif any(k in lower_speech for k in ["taxi", "đặt xe", "dat xe", "gọi xe", "goi xe", "sân bay", "san bay", "cab", "ride"]):
            fast_action = "taxi"
        elif any(k in lower_speech for k in ["concierge", "gặp người", "gap nguoi", "nhân viên hỗ trợ", "live call", "video call", "tổng đài", "tong dai", "trợ giúp trực tiếp"]):
            fast_action = "concierge"
        elif any(k in lower_speech for k in ["lễ tân", "le tan", "check out", "checkout", "check in", "checkin", "đổi phòng", "doi phong", "trả phòng", "tra phong", "front desk", "reception"]):
            fast_action = "reception"

        if fast_action:
            clean_items = user_speech
            if extracted_room_regex:
                clean_items = re.sub(r'^(?:tôi ở|ở|phòng|p\.|p|phong)?\s*' + re.escape(extracted_room_regex) + r'\s*(?:cần|muốn|cho|lấy|gửi)?\s*', '', clean_items, flags=re.IGNORECASE).strip()
            return {
                "action": fast_action,
                "room_number": extracted_room_regex,
                "items": clean_items or user_speech,
            }

        # Fast-Path: Nếu chỉ là chào hỏi, cảm ơn, tạm biệt -> Trả về unknown tức thì, không cần gọi Ollama LLM
        if any(re.search(p, lower_speech) for p in [r"^(xin chào|chào|hi|hello|helo|alo)\b", r"\b(cảm ơn|thanks|thank you)\b", r"\b(tạm biệt|bye|goodbye)\b", r"\b(bạn là ai|mày là ai|bạn tên gì)\b"]):
            return {
                "action": "unknown",
                "room_number": extracted_room_regex,
                "items": None,
            }

        # Ưu tiên Gemini LLM Engine nếu được kích hoạt
        if getattr(settings, "is_gemini_active", False):
            try:
                from app.services.ai.gemini_service import gemini_service
                if gemini_service.is_configured:
                    return await gemini_service.extract_intent(user_speech=user_speech)
            except Exception as e_gemini:
                logger.warning(f"[OllamaService] Gemini extract_intent error, fallback to Ollama Llama: {e_gemini}")

        system_prompt = (
            "Bạn là hệ thống trích xuất dữ liệu tự động cho dịch vụ khách sạn. "
            "Hãy phân tích câu nói của khách và trả về kết quả dưới định dạng JSON duy nhất với các field sau:\n"
            "- action: một trong các giá trị ['housekeeping', 'room_service', 'bellman', 'maintenance', 'taxi', 'concierge', 'reception', 'restaurant', 'provide_room_number', 'faq', 'unknown']\n"
            "- room_number: số phòng nếu được nhắc tới (VD: '302', '502'), nếu không có để null\n"
            "- items: chi tiết món đồ/món ăn/dịch vụ yêu cầu (VD: '2 cái khăn tắm', '1 dĩa cơm chiên'), nếu không có để null\n\n"
            "Chỉ trả về JSON thuần túy, không kèm bất kỳ câu giải thích nào."
        )

        intent_messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_speech}
        ]

        # 1. Chế độ Test máy yếu đặc thù qua Groq Cloud
        use_groq = (settings.AI_PROVIDER == "groq" and bool(settings.GROQ_API_KEY))
        if use_groq:
            groq_content = await self._call_groq(intent_messages, json_mode=True, max_tokens=60)
            if groq_content:
                try:
                    parsed_json = json.loads(groq_content.strip())
                    if extracted_room_regex and not parsed_json.get("room_number"):
                        parsed_json["room_number"] = extracted_room_regex
                    return parsed_json
                except Exception as je:
                    logger.warning(f"[Groq JSON parse warning]: {je}")

        # 2. Mặc định cho toàn bộ dự án: Chạy Ollama cục bộ nguyên bản
        try:
            response = await asyncio.wait_for(
                self._client.chat(
                    model=self.model,
                    messages=intent_messages,
                    format="json",
                    options={
                        "temperature": 0.0,
                        "num_predict": 35,
                        "num_ctx": 512,
                        "num_thread": 8,
                    },
                    keep_alive=-1
                ),
                timeout=20.0
            )
            content = response["message"]["content"].strip()
            parsed_json = json.loads(content)
            
            if extracted_room_regex and not parsed_json.get("room_number"):
                parsed_json["room_number"] = extracted_room_regex

            return parsed_json
        except Exception as e:
            err_msg = repr(e) if not str(e) else str(e)
            logger.warning(f"[OllamaService Warning] Lỗi Ollama khi bóc tách intent: {err_msg}")
            
            # Fallback an toàn sang Groq nếu có API key
            if settings.GROQ_API_KEY:
                groq_content = await self._call_groq(intent_messages, json_mode=True, max_tokens=60)
                if groq_content:
                    try:
                        parsed_json = json.loads(groq_content.strip())
                        if extracted_room_regex and not parsed_json.get("room_number"):
                            parsed_json["room_number"] = extracted_room_regex
                        return parsed_json
                    except Exception:
                        pass

            # Keyword-based Intent Fallback khi LLM offline/timeout
            fallback_action = "unknown"
            lower_speech = user_speech.lower()
            if any(k in lower_speech for k in ["khăn", "tắm", "dọn phòng", "gối", "chăn", "nệm", "dọn", "towel", "clean"]):
                fallback_action = "housekeeping"
            elif any(k in lower_speech for k in ["cơm", "nước", "ăn", "uống", "đồ ăn", "trà", "cà phê", "pizza", "phở", "bánh", "food", "drink"]):
                fallback_action = "room_service"
            elif any(k in lower_speech for k in ["hành lý", "vali", "túi", "chuyển phòng", "mang đồ", "luggage", "bag"]):
                fallback_action = "bellman"
            elif any(k in lower_speech for k in ["hỏng", "sửa", "điều hòa", "bóng đèn", "nước rò", "máy lạnh", "tủ lạnh", "fix", "repair"]):
                fallback_action = "maintenance"
            elif any(k in lower_speech for k in ["đặt bàn", "đặt món trước", "bàn ăn", "nhà hàng", "table", "restaurant"]):
                fallback_action = "restaurant"
            elif any(k in lower_speech for k in ["taxi", "đặt xe", "gọi xe", "sân bay", "cab", "ride"]):
                fallback_action = "taxi"
            elif any(k in lower_speech for k in ["concierge", "gặp người", "nhân viên hỗ trợ", "live call", "video call", "tổng đài"]):
                fallback_action = "concierge"
            elif any(k in lower_speech for k in ["lễ tân", "check out", "check in", "đổi phòng", "trả phòng", "front desk", "reception"]):
                fallback_action = "reception"
            elif extracted_room_regex:
                fallback_action = "provide_room_number"

            return {
                "action": fallback_action,
                "room_number": extracted_room_regex,
                "items": user_speech,
            }

    async def get_embedding(self, text: str) -> List[float]:
        """
        Tạo Vector Embedding từ đoạn văn bản để lưu/tìm kiếm trong ChromaDB Vector Store.
        """
        try:
            response = await self._client.embeddings(
                model=self.embed_model,
                prompt=text
            )
            return response["embedding"]
        except Exception as e:
            logger.error(f"[OllamaService Error] Lỗi tạo vector embedding: {str(e)}")
            raise RuntimeError(f"Lỗi khi tạo embedding qua Ollama ({self.embed_model}): {str(e)}")


# Singleton Instance
ollama_service = OllamaService()
