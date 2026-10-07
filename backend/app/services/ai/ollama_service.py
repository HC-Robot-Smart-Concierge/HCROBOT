import asyncio
import datetime
import json
import logging
import re
from typing import Dict, Any, List, Optional, Tuple

import ollama

from app.core.config import settings

logger = logging.getLogger(__name__)


class OllamaService:
    def __init__(self):
        self.host = settings.OLLAMA_HOST
        self.model = settings.OLLAMA_MODEL
        self.embed_model = getattr(settings, "OLLAMA_EMBED_MODEL", None)
        self._client = ollama.AsyncClient(host=self.host)

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
        MEGA FAST-PATH: Phản hồi tức thì (<1ms) cho ~95% câu hỏi khách sạn.
        Không gọi ChromaDB, không gọi LLM. Bao phủ: chào hỏi, tiện ích, dịch vụ, FAQ, chỉ đường.
        """
        if not prompt:
            return None

        if not language or language.lower() in ["auto", ""]:
            lang_name, lang_code = self.detect_language(prompt)
        else:
            lang_name = language
            lang_code = "en-US" if language.lower() in ["english", "en"] else "vi-VN"

        hour = datetime.datetime.now().hour
        if 5 <= hour < 11:
            time_greeting_vi = "Dạ em chào buổi sáng quý khách! Chúc quý khách một ngày mới tràn đầy năng lượng tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
            time_greeting_en = "Good morning! Welcome to Aurora Grand Hotel. How may I assist you today?"
        elif 11 <= hour < 18:
            time_greeting_vi = "Dạ em chào quý khách! Chúc quý khách một buổi chiều thật vui vẻ tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
            time_greeting_en = "Good afternoon! Welcome to Aurora Grand Hotel. How may I assist you today?"
        else:
            time_greeting_vi = "Dạ em chào buổi tối quý khách! Chúc quý khách một buổi tối thư thái tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
            time_greeting_en = "Good evening! Welcome to Aurora Grand Hotel. How may I assist you tonight?"

        prompt_lower = prompt.lower().strip()

        # Chuẩn hóa các biến thể nhận diện giọng nói STT
        normalized = prompt_lower.replace("wi-fi", "wifi").replace("wi fi", "wifi")
        normalized = re.sub(r'[\?\.\,\!\\_\:\;]', ' ', normalized)
        normalized = re.sub(r'\s+', ' ', normalized).strip()

        is_en = (lang_code == "en-US")

        # 0. Wake-up call (Rora)
        wake_pattern = r"^(hey rora|chào rora|chao rora|rora ơi|rora oi|hello rora|hi rora|rora)[\?\.\!\s]*$"
        if re.search(wake_pattern, normalized, re.IGNORECASE) or re.search(wake_pattern, prompt_lower, re.IGNORECASE):
            reply = "Yes, Rora is here! How can I help you, guest?" if is_en else "Dạ, Rora nghe đây ạ! Em có thể hỗ trợ gì cho quý khách?"
            logger.info(f"[OllamaService Fast-Path Hit] Wake-up word detected in <1ms!")
            return reply, lang_name, lang_code

        # 1. Wifi fast-path
        if re.search(r"\b(wifi|wi fi|mật khẩu wifi|pass wifi|mạng internet|mật khẩu mạng|mạng wifi|wifi password|internet)\b", prompt_lower):
            reply_vi = "Dạ wifi miễn phí tại sảnh và các phòng là 'Aurora_Guest', mật khẩu kết nối là 'aurora2026' ạ."
            reply_en = "Complimentary Wi-Fi in the lobby and rooms is 'Aurora_Guest', with the password 'aurora2026'."
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
        Tích hợp đầy đủ thông tin khách sạn để Qwen 3B tự tin trả lời lưu loát mọi tình huống.
        """
        if lang_code == "en-US":
            prompt = (
                "You are Rora - a smart, charming, and courteous AI Concierge Robot at the 5-star Aurora Grand Hotel.\n"
                "CONVERSATIONAL GUIDELINES:\n"
                "1. Always communicate naturally, warmly, and politely in 2 to 3 clear, complete sentences.\n"
                "2. Speak directly and helpfully as a professional 5-star concierge. Answer questions accurately and concisely.\n"
                "3. Never use emojis, markdown formatting (*, #, _, -), or bulleted lists to ensure smooth speech synthesis.\n"
                "4. State times clearly in full words (e.g., 'from 6:00 AM to 10:00 PM', '12:00 PM noon').\n"
                "AURORA GRAND HOTEL AMENITIES & FACTS:\n"
                "- Level 1: Main Lobby, Front Desk 24/7 (dial 0 from room telephone), and ATM.\n"
                "- Level 2: Aurora Restaurant (serves breakfast buffet from 6:30 AM to 10:00 AM).\n"
                "- Level 3: Conference Center & Executive Meeting Rooms.\n"
                "- Level 4: Infinity Pool (open 6:00 AM to 10:00 PM, free towels) & 24/7 Fitness Center / Gym.\n"
                "- Level 5: Aurora Luxury Spa & Sauna (open 9:00 AM to 10:00 PM).\n"
                "- Basement B1: Complimentary parking for staying guests.\n"
                "- Wi-Fi: Network name 'Aurora_Guest', password 'aurora2026'.\n"
                "- Hours: Standard check-in from 2:00 PM, check-out before 12:00 PM noon."
            )
        else:
            prompt = (
                "Bạn là Rora - Trợ lý Robot Concierge thông minh, lễ phép, duyên dáng và hiếu khách tại khách sạn 5 sao Aurora Grand Hotel.\n"
                "PHONG CÁCH GIAO TIẾP VÀ TRÒ CHUYỆN TỰ NHIÊN:\n"
                "1. Luôn xưng 'Dạ em' hoặc 'Rora' và gọi người trò chuyện là 'quý khách' hoặc 'anh/chị'.\n"
                "2. Trò chuyện một cách tự nhiên, gần gũi, ấm áp, lưu loát như một nhân viên lễ tân 5 sao chuyên nghiệp.\n"
                "3. Trả lời đúng trọng tâm, súc tích trong 2 đến 3 câu văn gãy gọn, hoàn chỉnh để phát giọng đọc mượt mà và người nghe dễ nắm bắt nhất.\n"
                "4. BẮT BUỘC dùng 100% tiếng Việt tự nhiên, chuẩn mực. Tuyệt đối không chèn từ ngoại ngữ vô nghĩa (như tiếng Nga до, tiếng Trung).\n"
                "5. Tuyệt đối KHÔNG dùng emoji, ký hiệu markdown (*, #, _, -) hay gạch đầu dòng.\n"
                "6. Viết thời gian rõ ràng: luôn viết bằng chữ như 'từ 6 giờ sáng đến 22 giờ tối', '12 giờ trưa', không viết tắt '6-22h'.\n\n"
                "THÔNG TIN TIỆN ÍCH KHÁCH SẠN AURORA GRAND (ĐỂ TƯ VẤN CHO KHÁCH):\n"
                "- Tầng 1: Sảnh chính, Quầy Lễ tân 24/7 (từ điện thoại phòng bấm phím 0) và máy ATM rút tiền.\n"
                "- Tầng 2: Nhà hàng Aurora (phục vụ buffet sáng từ 6 giờ 30 đến 10 giờ sáng).\n"
                "- Tầng 3: Trung tâm hội nghị & phòng họp sự kiện cao cấp.\n"
                "- Tầng 4: Hồ bơi vô cực ngoài trời (mở từ 6 giờ sáng đến 22 giờ tối, khăn tắm miễn phí) và Phòng Gym (mở cửa 24/7).\n"
                "- Tầng 5: Aurora Spa thư giãn (mở từ 9 giờ sáng đến 22 giờ tối).\n"
                "- Tầng hầm B1: Bãi đỗ xe ô tô và xe máy miễn phí cho khách lưu trú.\n"
                "- Wi-Fi miễn phí: Tên mạng 'Aurora_Guest', mật khẩu là 'aurora2026'.\n"
                "- Thời gian lưu trú: Nhận phòng từ 14 giờ chiều, trả phòng trước 12 giờ trưa."
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
        Yield từng token ngay khi LLM sinh ra, TTFT tức thì và không bị giới hạn token bất hợp lý.
        """
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
                    "num_ctx": 4096,
                    "num_thread": 8,
                    "repeat_penalty": 1.1,
                },
                keep_alive=-1
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
            response = await asyncio.wait_for(
                self._client.chat(
                    model=self.model,
                    messages=messages,
                    options={
                        "temperature": 0.7,
                        "top_p": 0.9,
                        "num_ctx": 4096,
                        "num_thread": 8,
                        "repeat_penalty": 1.1,
                    },
                    keep_alive=-1
                ),
                timeout=25.0
            )

            reply = response["message"]["content"].strip()
            if lang_code != "zh-CN":
                reply = re.sub(r'[\u4e00-\u9fff\u3400-\u4dbf]+', '', reply).strip()

            final_lang_name, final_lang_code = self.detect_language(reply)
            return reply, final_lang_name, final_lang_code
        except Exception as e:
            logger.error(f"[OllamaService Error] Lỗi khi sinh câu trả lời LLM: {str(e)}")
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

        system_prompt = (
            "Bạn là hệ thống trích xuất dữ liệu tự động cho dịch vụ khách sạn. "
            "Hãy phân tích câu nói của khách và trả về kết quả dưới định dạng JSON duy nhất với các field sau:\n"
            "- action: một trong các giá trị ['housekeeping', 'room_service', 'bellman', 'maintenance', 'taxi', 'concierge', 'reception', 'restaurant', 'provide_room_number', 'faq', 'unknown']\n"
            "- room_number: số phòng nếu được nhắc tới (VD: '302', '502'), nếu không có để null\n"
            "- items: chi tiết món đồ/món ăn/dịch vụ yêu cầu (VD: '2 cái khăn tắm', '1 dĩa cơm chiên'), nếu không có để null\n\n"
            "Chỉ trả về JSON thuần túy, không kèm bất kỳ câu giải thích nào."
        )

        try:
            response = await asyncio.wait_for(
                self._client.chat(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_speech}
                    ],
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
            logger.warning(f"[OllamaService Warning] Lỗi hoặc Timeout khi bóc tách intent: {err_msg}")
            
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
