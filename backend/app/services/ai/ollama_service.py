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
        self.embed_model = settings.OLLAMA_EMBED_MODEL
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

        # Mặc định tất cả các trường hợp còn lại trả về Tiếng Việt
        return "Tiếng Việt", "vi-VN"

    def check_fast_path(self, prompt: str, language: Optional[str] = None) -> Optional[Tuple[str, str, str]]:
        """
        Kiểm tra nhanh các câu hỏi phổ biến và lời chào để phản hồi tức thì (< 1ms).
        Bỏ qua hoàn toàn việc nhúng vector ChromaDB và tính toán LLM.
        Hỗ trợ phản hồi song ngữ Anh - Việt tương ứng với ngôn ngữ được phát hiện.
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

        # PRE-CHECK: Nếu câu nói chứa từ khóa HÀNH ĐỘNG dịch vụ → Bỏ qua fast-path,
        # để Intent Router + Service FSM xử lý đúng (đặt bàn, gọi xe, sửa phòng...)
        service_action_verbs = ["đặt", "cần", "muốn", "yêu cầu", "gọi cho", "book", "order", "reserve", "need"]
        service_nouns = [
            "nhà hàng", "nha hang", "bàn ăn", "ban an", "đặt bàn", "đặt món",
            "taxi", "xe", "sân bay",
            "dọn phòng", "don phong", "khăn", "gối", "chăn",
            "sửa", "hỏng", "bảo trì", "điều hòa", "máy lạnh",
            "hành lý", "vali", "chuyển phòng",
            "concierge", "video call", "live call", "gọi video", "nhân viên",
            "lễ tân", "check in", "check out", "trả phòng",
        ]
        has_action_verb = any(v in prompt_lower for v in service_action_verbs)
        has_service_noun = any(n in prompt_lower for n in service_nouns)
        if has_action_verb and has_service_noun:
            logger.info(f"[OllamaService Fast-Path Bypass] Service intent detected, skipping fast-path for: '{prompt[:40]}'")
            return None

        # Chuẩn hóa các biến thể nhận diện giọng nói STT
        normalized = prompt_lower.replace("wi-fi", "wifi").replace("wi fi", "wifi")
        normalized = re.sub(r'[\?\.\,\!\_\:\;]', ' ', normalized)
        normalized = re.sub(r'\s+', ' ', normalized).strip()

        fast_path_cache = [
            # 0. Wake-Up Word (Rora)
            (
                r"^(hey rora|chào rora|chao rora|rora ơi|rora oi|hello rora|hi rora|rora)[\?\.\!\s]*$",
                "Dạ, Rora nghe đây ạ! Em có thể hỗ trợ gì cho quý khách?",
                "Yes, Rora is here! How can I help you, guest?"
            ),

            # 1. Chào hỏi & Xã giao
            (
                r"^(xin chào|chào em|chào robot|chào bạn|chào|hi|hello|helo|alo)\b",
                time_greeting_vi,
                time_greeting_en
            ),
            (
                r"\b(cảm ơn|cảm ơn em|cảm ơn robot|thank you|thanks)\b",
                "Dạ không có gì ạ! Chúc quý khách một kỳ nghỉ thật tuyệt vời tại khách sạn Aurora. Quý khách cần em hỗ trợ gì nữa không ạ?",
                "You're very welcome! Have a wonderful stay at Aurora Grand Hotel. Is there anything else I can assist you with?"
            ),
            (
                r"\b(tạm biệt|bye|goodbye|hẹn gặp lại)\b",
                "Dạ tạm biệt quý khách! Chúc quý khách một ngày tốt lành và hẹn sớm gặp lại ạ.",
                "Goodbye! Wishing you a wonderful day and looking forward to seeing you again."
            ),
            (
                r"\b(bạn là ai|mày là ai|bạn tên gì|bạn tên là gì|tên bạn là gì|em tên là gì|em tên gì|tên em là gì|giới thiệu về bạn|giới thiệu về em|hiểu về bạn|who are you|what is your name)\b",
                "Dạ em là Rora, trợ lý Robot Concierge thông minh tại khách sạn Aurora Grand. Em có thể hỗ trợ quý khách chỉ đường, gọi món, đặt phòng, dọn phòng, xách hành lý và tra cứu mọi tiện ích khách sạn ạ.",
                "I am Rora, your AI Concierge Assistant at Aurora Grand Hotel. I can assist you with directions, dining, housekeeping, luggage, and hotel amenities."
            ),

            # 2. Wifi & Internet
            (
                r"\b(wifi|wi fi|mật khẩu wifi|pass wifi|mạng internet|mật khẩu mạng|mạng wifi|wifi password)\b",
                "Dạ wifi miễn phí tại sảnh và các phòng là 'Aurora_Guest', mật khẩu kết nối là 'aurora2026' ạ.",
                "Complimentary Wi-Fi in the lobby and rooms is 'Aurora_Guest', with the password 'aurora2026'."
            ),

            # 3. Thủ tục Check-in / Check-out tiêu chuẩn
            (
                r"\b(giờ trả phòng|trả phòng|check out|checkout)\b",
                "Dạ giờ trả phòng chuẩn của khách sạn là 12 giờ trưa. Quý khách có muốn em đặt xe đưa đón sân bay giúp mình không ạ?",
                "Standard check-out time is 12:00 PM noon. Would you like me to arrange an airport shuttle for you?"
            ),
            (
                r"\b(nhận phòng|check in|checkin|giờ nhận phòng)\b",
                "Dạ giờ nhận phòng tiêu chuẩn là từ 14 giờ chiều. Nếu đến sớm, quý khách có thể gửi hành lý tại quầy lễ tân hoàn toàn miễn phí ạ.",
                "Standard check-in time is from 2:00 PM. If arriving early, you are welcome to store your luggage at the front desk for free."
            ),

            # 4. Hotline & Tổng đài Lễ tân
            (
                r"\b(số điện thoại lễ tân|gọi lễ tân|hotline|số lễ tân|front desk phone|operator)\b",
                "Dạ từ điện thoại bàn trong phòng, quý khách chỉ cần bấm phím số 0 để kết nối trực tiếp đến Lễ tân 24/7 ạ.",
                "From your in-room telephone, simply dial '0' to connect directly to the 24/7 Front Desk."
            ),
        ]

        is_en = (lang_code == "en-US")
        for item in fast_path_cache:
            pattern = item[0]
            reply_vi = item[1]
            reply_en = item[2] if len(item) > 2 else reply_vi
            if re.search(pattern, normalized, re.IGNORECASE) or re.search(pattern, prompt_lower, re.IGNORECASE):
                logger.info(f"[OllamaService Fast-Path Hit] Matched pattern '{pattern}' in < 1ms!")
                reply = reply_en if is_en else reply_vi
                return reply, lang_name, lang_code

        return None

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
        Async Generator sinh token theo thời gian thực từ Ollama (stream=True).
        Yield từng token ngay khi Ollama sinh ra, TTFT ~200-300ms.
        """
        if not language or language.lower() in ["auto", ""]:
            lang_name, lang_code = self.detect_language(prompt)
        else:
            lang_name = language
            lang_code = "en-US" if language.lower() in ["english", "en"] else "vi-VN"

        if lang_code == "en-US":
            system_prompt = (
                "You are Rora - an intelligent, polite, and friendly hotel concierge assistant at Aurora Grand Hotel. "
                "STRICT REQUIREMENT: Answer in fluent English based on the hotel context provided. "
                "Keep your response concise and direct in 1 to 2 short sentences (max 30 words) for voice playback. "
                "Do not use emojis or markdown formatting."
            )
        else:
            system_prompt = (
                "Bạn là Rora - Trợ lý Robot Concierge thông minh, tinh tế và lịch sự tại khách sạn Aurora Grand Hotel.\n"
                "QUY TẮC PHẢN HỒI GIAO TIẾP:\n"
                "1. Luôn xưng 'Dạ em' hoặc 'Rora' và gọi người dùng là 'Quý khách' hoặc 'Anh/chị'.\n"
                "2. Trả lời trực diện, ấm áp, súc tích trong 1 đến 2 câu ngắn (tối đa 30 từ) để phát ngay ra loa thoại.\n"
                "3. Tuyệt đối KHÔNG dùng biểu tượng cảm xúc (emoji), dấu gạch ngang markdown, hoặc chêm từ tiếng Anh."
            )

        if stored_room_number:
            system_prompt += f"\n\n[SỐ PHÒNG ĐÃ GHI NHỚ TRONG SESSION]: Khách hàng đang ở Phòng {stored_room_number}."

        emotion_str = (emotion or "").lower()
        if emotion_str in ["annoyed", "angry", "upset"]:
            system_prompt += "\n\n[LƯU Ý CẢM XÚC KHÁCH HÀNG]: Khách hàng đang KHÔNG HÀI LÒNG. Hãy phản hồi với thái độ CỰC KỲ XIN LỖI, THÂN THIỆN VÀ XOA DỊU."
        elif emotion_str in ["happy", "pleased"]:
            system_prompt += "\n\n[LƯU Ý CẢM XÚC KHÁCH HÀNG]: Khách hàng đang VUI VẺ. Hãy phản hồi với thái độ TƯƠI VUI VÀ NĂNG LƯỢNG."

        if rag_context:
            system_prompt += f"\n\n[Thông tin tra cứu từ hệ thống khách sạn / Hotel Context]:\n{rag_context}"

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
                    "temperature": 0.5,
                    "top_p": 0.9,
                    "num_predict": 40,
                    "num_ctx": 768,
                    "num_thread": 8,
                    "repeat_penalty": 1.15,
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
        Sinh câu trả lời thoại cho Concierge Robot dựa trên câu hỏi của khách, lịch sử phiên và ngữ cảnh RAG.
        Tự động phát hiện ngôn ngữ nếu language không được chỉ định hoặc là 'auto'.
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

        if lang_code == "en-US":
            system_prompt = (
                "You are Rora - an intelligent, polite, and friendly hotel concierge assistant at Aurora Grand Hotel. "
                "STRICT REQUIREMENT: Answer in fluent English based on the hotel context provided. "
                "Keep your response concise and direct in 1 to 2 short sentences (max 30 words) for voice playback. "
                "Do not use emojis or markdown formatting."
            )
        else:
            system_prompt = (
                "Bạn là Rora - Trợ lý Robot Concierge thông minh, tinh tế và lịch sự tại khách sạn Aurora Grand Hotel.\n"
                "QUY TẮC PHẢN HỒI GIAO TIẾP:\n"
                "1. Luôn xưng 'Dạ em' hoặc 'Rora' và gọi người dùng là 'Quý khách' hoặc 'Anh/chị'.\n"
                "2. Trả lời trực diện, ấm áp, súc tích trong 1 đến 2 câu ngắn (tối đa 30 từ) để phát ngay ra loa thoại.\n"
                "3. Tuyệt đối KHÔNG dùng biểu tượng cảm xúc (emoji), dấu gạch ngang markdown, hoặc chêm từ tiếng Anh."
            )

        if stored_room_number:
            system_prompt += f"\n\n[SỐ PHÒNG ĐÃ GHI NHỚ TRONG SESSION]: Khách hàng đang ở Phòng {stored_room_number}."

        emotion_str = (emotion or "").lower()
        if emotion_str in ["annoyed", "angry", "upset"]:
            system_prompt += "\n\n[LƯU Ý CẢM XÚC KHÁCH HÀNG]: Khách hàng đang KHÔNG HÀI LÒNG. Hãy phản hồi với thái độ CỰC KỲ XIN LỖI, THÂN THIỆN VÀ XOA DỊU."
        elif emotion_str in ["happy", "pleased"]:
            system_prompt += "\n\n[LƯU Ý CẢM XÚC KHÁCH HÀNG]: Khách hàng đang VUI VẺ. Hãy phản hồi với thái độ TƯƠI VUI VÀ NĂNG LƯỢNG."

        if rag_context:
            system_prompt += f"\n\n[Thông tin tra cứu từ hệ thống khách sạn / Hotel Context]:\n{rag_context}"

        messages = [{"role": "system", "content": system_prompt}]

        # Gộp lịch sử hội thoại các lượt trước trong session
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
                        "temperature": 0.5,
                        "top_p": 0.9,
                        "num_predict": 40,       # Giới hạn câu trả lời 1-2 câu ngắn gọn, CPU sinh xong trong ~1s
                        "num_ctx": 768,          # Tối ưu kích thước context vừa đủ cho hội thoại
                        "num_thread": 8,         # Khai thác tối đa số nhân P-core + E-core của Intel i7-1260P
                        "repeat_penalty": 1.15,
                    },
                    keep_alive=-1              # Giữ model thường trực vĩnh viễn trong RAM, không bị nạp lại giữa các lượt hỏi
                ),
                timeout=25.0
            )

            reply = response["message"]["content"].strip()
            # Lọc bỏ ký tự chữ Hán / Tiếng Trung rò rỉ ngẫu nhiên của Qwen khi đang tương tác Tiếng Việt/Anh
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
