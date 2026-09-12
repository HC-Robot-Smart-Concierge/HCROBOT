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
        Mặc định ưu tiên Tiếng Việt (vi-VN) cho mọi tương tác.
        Chỉ chuyển sang Tiếng Anh nếu khách sử dụng câu thoại tiếng Anh rõ ràng.
        """
        if not text:
            return "Tiếng Việt", "vi-VN"

        # 1. Ký tự có dấu tiếng Việt đặc trưng HOẶC từ vựng Tiếng Việt phổ biến -> Ưu tiên Tiếng Việt 100%
        if re.search(r'[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõõôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]', text, re.IGNORECASE):
            return "Tiếng Việt", "vi-VN"

        vi_keywords = [
            r'\bphong\b', r'\bphồng\b', r'\btoi\b', r'\bmuon\b', r'\bcan\b', r'\bkhan\b', r'\btam\b',
            r'\bdon\b', r'\ban\b', r'\buong\b', r'\bgiup\b', r'\bo dau\b', r'\bkhach\b', r'\bsan\b',
            r'\ble tan\b', r'\bbao tri\b', r'\bsua\b', r'\bnuoc\b', r'\bcom\b', r'\bban\b'
        ]
        lower_text = text.lower()
        if any(re.search(pattern, lower_text) for pattern in vi_keywords):
            return "Tiếng Việt", "vi-VN"

        # 2. Chỉ coi là Tiếng Trung nếu toàn bộ hoặc đa số văn bản là chữ Hán (Tránh rò rỉ 1-2 ký tự rác của Qwen)
        cjk_chars = re.findall(r'[\u4e00-\u9fff]', text)
        latin_chars = re.findall(r'[a-zA-Z]', text)
        if len(cjk_chars) > 0 and len(cjk_chars) > len(latin_chars):
            return "Tiếng Trung", "zh-CN"

        # 3. Chữ Hiragana / Katakana / Tiếng Nhật
        if re.search(r'[\u3040-\u30ff]', text):
            return "Tiếng Nhật", "ja-JP"

        # 4. Kiểm tra cấu trúc câu tiếng Anh giao tiếp rõ ràng
        english_phrases = [
            r'\bwhere is\b', r'\bwhat time\b', r'\bhow to\b', r'\bhow can\b',
            r'\bcan i\b', r'\bcould you\b', r'\bi want\b', r'\bi need\b', r'\bi would like\b',
            r'\bis there\b', r'\bare there\b', r'\bwhen does\b', r'\bwhat is\b', r'\bthank you\b',
            r'\bgood morning\b', r'\bgood evening\b', r'\bhello robot\b'
        ]
        if any(re.search(pattern, lower_text) for pattern in english_phrases):
            return "English", "en-US"

        # Mặc định tất cả các trường hợp khác đều trả về Tiếng Việt
        return "Tiếng Việt", "vi-VN"

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
        if not language or language.lower() in ["auto", ""]:
            lang_name, lang_code = self.detect_language(prompt)
        else:
            lang_name = language
    def check_fast_path(self, prompt: str, language: Optional[str] = None) -> Optional[Tuple[str, str, str]]:
        """
        Kiểm tra nhanh các câu hỏi phổ biến và lời chào để phản hồi tức thì (< 1ms).
        Bỏ qua hoàn toàn việc nhúng vector ChromaDB và tính toán LLM.
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
            time_greeting = "Dạ em chào buổi sáng quý khách! Chúc quý khách một ngày mới tràn đầy năng lượng tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
        elif 11 <= hour < 18:
            time_greeting = "Dạ em chào quý khách! Chúc quý khách một buổi chiều thật vui vẻ tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
        else:
            time_greeting = "Dạ em chào buổi tối quý khách! Chúc quý khách một buổi tối thư thái tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"

        prompt_lower = prompt.lower().strip()
        # Chuẩn hóa các biến thể nhận diện giọng nói STT (Google STT thường sinh 'wi-fi' có dấu gạch ngang)
        normalized = prompt_lower.replace("wi-fi", "wifi").replace("wi fi", "wifi")
        normalized = re.sub(r'[\?\.\,\!\_\:\;]', ' ', normalized)
        normalized = re.sub(r'\s+', ' ', normalized).strip()

        fast_path_cache = [
            # 1. Chào hỏi & Xã giao
            (r"^(xin chào|chào em|chào robot|chào bạn|chào|hi|hello|helo|alo)\b", time_greeting),
            (r"\b(cảm ơn|cảm ơn em|cảm ơn robot|thank you|thanks)\b", "Dạ không có gì ạ! Chúc quý khách một kỳ nghỉ thật tuyệt vời tại khách sạn Aurora. Quý khách cần em hỗ trợ gì nữa không ạ?"),
            (r"\b(tạm biệt|bye|goodbye|hẹn gặp lại)\b", "Dạ tạm biệt quý khách! Chúc quý khách một ngày tốt lành và hẹn sớm gặp lại ạ."),
            (r"\b(bạn là ai|mày là ai|bạn tên gì|tên bạn là gì|giới thiệu về bạn|hiểu về bạn|tìm hiểu về bạn|biết gì về bạn)\b", "Dạ em là HCRobot, trợ lý lễ tân thông minh tại khách sạn Aurora Grand. Em có thể hỗ trợ quý khách chỉ đường, gọi món, đặt phòng và tra cứu tiện ích khách sạn ạ."),

            # 2. Tiện ích nổi bật (Bể bơi, Gym, Spa, Bar)
            (r"\b(hồ bơi|bể bơi|swimming pool|vô cực|cực mở cửa|hồ bơi ở đâu|bể bơi ở đâu|bơi)\b", "Dạ hồ bơi vô cực nằm ở Tầng 4 của khách sạn, mở cửa từ 6 giờ sáng đến 10 giờ tối ạ. Quý khách có cần em gọi nước uống lên hồ bơi không ạ?"),
            (r"\b(gym|phòng gym|phòng tập|thể hình|thể dục|fitness)\b", "Dạ phòng tập thể hình Fitness Center nằm tại Tầng 3 của khách sạn, mở cửa 24/7 và hoàn toàn miễn phí cho khách lưu trú ạ."),
            (r"\b(spa|massage|mát xa|xông hơi|chăm sóc da)\b", "Dạ Aurora Spa nằm tại Tầng 5, mở cửa từ 9 giờ sáng đến 10 giờ tối. Quý khách có muốn em đặt lịch hẹn trước với chuyên viên không ạ?"),
            (r"\b(bar|quầy bar|rooftop|sky bar|quán bar)\b", "Dạ Sky Lounge Bar nằm tại Tầng 19 sân thượng, mở cửa từ 16 giờ đến nửa đêm với tầm nhìn toàn cảnh thành phố cực đẹp ạ."),

            # 3. Ẩm thực & Bữa sáng
            (r"\b(ăn sáng|nhà hàng|bữa sáng|breakfast|buffet)\b", "Dạ nhà hàng buffet sáng Aurora nằm ở Tầng 2, phục vụ từ 6 giờ đến 10 giờ sáng hàng ngày ạ."),
            (r"\b(thực đơn|menu|món ăn|đồ ăn|gọi món)\b", "Dạ quý khách có thể xem thực đơn chi tiết và đặt món trực tiếp trên màn hình của em để bộ phận Bếp chuẩn bị ngay ạ."),

            # 4. Wifi & Internet (bắt cả wifi lẫn wi-fi)
            (r"\b(wifi|wi fi|mật khẩu wifi|pass wifi|mạng internet|mật khẩu mạng|mạng wifi)\b", "Dạ wifi miễn phí tại sảnh và các phòng là 'Aurora_Guest', mật khẩu kết nối là 'aurora2026' ạ."),

            # 5. Thủ tục Check-in / Check-out
            (r"\b(giờ trả phòng|trả phòng|check out|checkout)\b", "Dạ giờ trả phòng chuẩn của khách sạn là 12 giờ trưa. Quý khách có muốn em đặt xe đưa đón sân bay giúp mình không ạ?"),
            (r"\b(nhận phòng|check in|checkin|giờ nhận phòng)\b", "Dạ giờ nhận phòng tiêu chuẩn là từ 14 giờ chiều. Nếu đến sớm, quý khách có thể gửi hành lý tại quầy lễ tân hoàn toàn miễn phí ạ."),

            # 6. Dịch vụ phòng & Hỗ trợ
            (r"\b(thang máy|thang may)\b", "Dạ sảnh thang máy chính nằm ngay phía sau quầy lễ tân bên tay phải của quý khách ạ."),
            (r"\b(nhà vệ sinh|toilet|wc|ve sinh)\b", "Dạ nhà vệ sinh sảnh tầng trệt nằm ở cuối hành lang bên tay trái, cạnh quầy Lounge ạ."),
            (r"\b(gửi hành lý|giữ hành lý|gửi đồ|giữ đồ|vali)\b", "Dạ quý khách có thể gửi hành lý hoàn toàn miễn phí tại quầy lễ tân ngay sảnh chính ạ."),
            (r"\b(bàn ủi|bàn là|ban ui|ban la)\b", "Dạ bàn ủi và cầu là có sẵn trong tủ quần áo của phòng. Nếu cần thêm, em sẽ báo bộ phận Buồng phòng mang lên ngay ạ."),
            (r"\b(taxi|đặt xe|xe đưa đón|san bay|sân bay)\b", "Dạ quý khách có muốn em hỗ trợ liên hệ xe taxi hoặc xe đưa đón sân bay của khách sạn ngay bây giờ không ạ?"),
            (r"\b(số điện thoại lễ tân|gọi lễ tân|hotline|số lễ tân)\b", "Dạ từ điện thoại bàn trong phòng, quý khách chỉ cần bấm phím số 0 để kết nối trực tiếp đến Lễ tân 24/7 ạ."),
            (r"\b(dọn phòng|dọn dẹp|vệ sinh phòng|thay khăn)\b", "Dạ em đã ghi nhận, em sẽ thông báo ngay cho bộ phận Buồng phòng đến hỗ trợ dọn phòng cho quý khách ạ."),
        ]

        for pattern, fast_reply in fast_path_cache:
            if re.search(pattern, normalized, re.IGNORECASE) or re.search(pattern, prompt_lower, re.IGNORECASE):
                logger.info(f"[OllamaService Fast-Path Hit] Matched pattern '{pattern}' in < 1ms!")
                return fast_reply, lang_name, lang_code

        return None

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
                "You are HCRobot - an intelligent, polite, and friendly hotel concierge assistant at Aurora Grand Hotel. "
                "STRICT REQUIREMENT: Answer in fluent English based on the hotel context provided. "
                "Keep your response concise and direct in 1 to 2 short sentences (max 30 words) for voice playback. "
                "Do not use emojis or markdown formatting."
            )
        else:
            system_prompt = (
                "Bạn là HCRobot - Trợ lý Robot Concierge thông minh, tinh tế và lịch sự tại khách sạn Aurora Grand Hotel.\n"
                "QUY TẮC PHẢN HỒI GIAO TIẾP:\n"
                "1. Luôn xưng 'Dạ em' hoặc 'Em' và gọi người dùng là 'Quý khách' hoặc 'Anh/chị'.\n"
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
            "- action: một trong các giá trị ['housekeeping', 'room_service', 'bellman', 'maintenance', 'restaurant', 'provide_room_number', 'faq', 'unknown']\n"
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
