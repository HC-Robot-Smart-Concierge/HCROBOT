"""Language detection, fast-path dispatch, voice text normalization, and prompt assembly for OllamaService."""

import datetime
import logging
import re
from typing import Any, Dict, Optional, Tuple

from app.services.ai.constants import BELLMAN_MENU_TRIGGER_KEYWORDS, SERVICE_KEYWORDS
from app.services.ai.scenario_service import scenario_service
from app.services.bell_request_service import classify_bell_request
from app.services.maintenance_request_service import is_fault_report

logger = logging.getLogger(__name__)

COMMON_EN_WORDS = frozenset("""
the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she
or an will my one all would there their what so up out if about who get which go me when make can like time no
just him know take people into year your good some could them see other than then now look only come its over
think also back after use two how our work first well way even new want because any these give day most us
is are was were am been being has had did does doing
hotel room rooms pool swimming gym spa bar restaurant food drink coffee tea breakfast lunch dinner
towel towels blanket pillow pillows bed beds sleep key card door light lights ac air conditioner
tv phone wifi internet password luggage bag taxi car airport flight bill pay price cost cash credit
check checkout checkin help assist please thank thanks hello hi hey morning afternoon evening night bye
welcome book order service staff receptionist reception front desk lobby floor elevator lift stairs
toilet restroom bathroom shower water bath soap shampoo toothbrush toothpaste slippers hair dryer
clean cleaning dirty fix repair broken working open close hours time today tomorrow tonight tour
beach sea view map location guide doctor emergency cold hot warm quiet noisy extra free cancel
turn on off late bag board instructions gel bottle wine size ancient town city
yes ok okay sure fine sir madam recommend direction where what when why who how which whose
can could would should will do does did is are was were have has had may might must
luggage baggage towel water food drink restaurant taxi airport service need want
show tell guide find open close order call bring get take clean go see look give pay cost price menu
coffee tea beer bar cocktail floor lobby elevator lift toilet restroom bathroom door card key bill
now today tonight tomorrow time later yes no ok okay sure fine sir madam assist recommend direction
attraction attractions sightseeing places visit night market sea view ocean view lake view street
broken not working leak leaking noisy loud dark cold freeze freezing hot boiled
pillow blanket mattress sheet sheets hanger iron iron board adapter plug charger socket
slippers bathrobe bathrobes umbrella laundry dry dry cleaning laundry bag wash washing
room rate price list deposit receipt invoice luggage storage bellman wake up wake call
service request amenities facility facilities elevator gym pool swimming pool
""".split())

COMMON_VI_WORDS = frozenset("""
la cua va co khong duoc cho voi ve tu den o trong tai cac nhung mot hai ba bon nam sau bay tam chin muoi
phong khach san toi minh ban anh em chi chu bac da roi chua dang se muon can xin hoi giup lam on cam
chao hen gap lai bao nhieu tien gia may gio dau nao sao nhu the dat mang them giat ui sua ket bi hong
hu mat dep tot xau ngon do an uong nuoc tra cafe ca phe an sang com goi xe dua don san bay thang may
ve sinh nha tam khan men chieu nem giuong chia khoa the tu mat khau be boi ho boi le tan buong phong
""".split())

EN_SUBSTRING_PATTERNS = [
    r'\b(wh[a-z]+|th[a-z]+|sh[a-z]+|ch[a-z]+)\b',
    r'[a-z]+(tion|sion|ment|ness|able|ible|less|ful|ing|ed)\b',
    r'\b[a-z]+(ck|ght|ould|ight)\b',
]


class OllamaPromptFastpathMixin:
    """Language detection, fast-path checks, reply cleanup, and system prompt assembly."""

    @staticmethod
    def detect_language(text: str) -> Tuple[str, str]:
        """
        Tự động phân tích câu nói của khách để nhận diện ngôn ngữ và mã lang_code cho TTS.
        Chỉ hỗ trợ song ngữ chuẩn xác: Tiếng Việt (vi-VN) và Tiếng Anh (en-US).
        """
        if not text or not text.strip():
            return "Tiếng Việt", "vi-VN"

        # 1. Ký tự có dấu tiếng Việt đặc trưng -> 100% Tiếng Việt
        if re.search(r'[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]', text, re.IGNORECASE):
            return "Tiếng Việt", "vi-VN"

        lower_text = text.lower().strip()
        words = re.findall(r'[a-zA-Z]+', lower_text)
        if not words:
            return "Tiếng Việt", "vi-VN"

        en_score = sum(1 for w in words if w in COMMON_EN_WORDS)
        vi_score = sum(1 for w in words if w in COMMON_VI_WORDS)

        if en_score > vi_score:
            return "English", "en-US"
        if vi_score > en_score:
            return "Tiếng Việt", "vi-VN"
        if en_score > 0:
            return "English", "en-US"

        for p in EN_SUBSTRING_PATTERNS:
            if re.search(p, lower_text):
                return "English", "en-US"

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
        """Phản hồi tức thì (<1ms) từ Dynamic Fast-Path In-Memory Cache."""
        match = self.check_fast_path_full(prompt, language)
        if match:
            return match[0], match[1], match[2]
        return None

    def check_fast_path_full(
        self, prompt: str, language: Optional[str] = None
    ) -> Optional[Tuple[str, str, str, Optional[str], Optional[Dict[str, Any]]]]:
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

        service_action_verbs = [
            "đặt", "cần", "muốn", "yêu cầu", "sửa", "cho", "xin", "lấy", "mang", "giao", "gọi", "đổi",
            "book", "order", "reserve", "need", "repair", "fix", "send", "bring", "get"
        ]
        service_nouns = [
            "khăn", "gối", "chăn", "dọn phòng", "don phong", "nước", "đồ ăn", "cơm", "hành lý", "vali",
            "điều hòa", "máy lạnh", "bóng đèn", "nước rò", "kẹt", "taxi", "bàn ủi", "sấy tóc", "máy sấy",
            "towel", "cleaning", "food", "water", "drink", "luggage", "iron"
        ]
        has_action_verb = any(v in prompt_lower for v in service_action_verbs)
        has_service_noun = any(n in prompt_lower for n in service_nouns)
        is_bell_task = any(k in prompt_lower for k in SERVICE_KEYWORDS["bellman"]) and bool(classify_bell_request(prompt))
        if (has_action_verb and has_service_noun) or is_fault_report(prompt) or is_bell_task or any(
            k in prompt_lower for k in BELLMAN_MENU_TRIGGER_KEYWORDS
        ):
            logger.info(f"[OllamaService Fast-Path Bypass] Service action intent detected, skipping fast-path for: '{prompt[:40]}'")
            return None

        nearby_exploration_keywords = [
            "gần đây", "xung quanh", "quanh đây", "gần khách sạn", "ngoại khu", "chợ đêm",
            "chơi gì", "ăn gì ở đâu", "đi đâu chơi", "địa điểm du lịch", "địa điểm tham quan",
            "có gì chơi", "quanh khách sạn", "nearby", "around here", "night market", "sightseeing"
        ]
        if any(kw in prompt_lower for kw in nearby_exploration_keywords):
            logger.info(f"[OllamaService Fast-Path Bypass] Nearby exploration query detected, delegating to RAG: '{prompt[:40]}'")
            return None

        dynamic_hit = scenario_service.match_fast_path(prompt, lang_code)
        if dynamic_hit:
            return dynamic_hit

        if re.search(r"^(xin chào|xin chao|chào em|chao em|chào robot|chao robot|chào bạn|chao ban|chào rora|chao rora|hello|hi|hey|good morning|good afternoon|good evening)[\?\.\!\s]*$", prompt_lower):
            return (time_greeting_en if is_en else time_greeting_vi), lang_name, lang_code, None, None

        if re.search(r"\b(bạn là ai|ban la ai|em là ai|em la ai|mày là ai|may la ai|rora là ai|rora la ai|robot là ai|robot la ai|tên bạn là gì|ten ban la gi|tên em là gì|ten em la gi|bạn tên gì|ban ten gi|em tên gì|em ten gi|giới thiệu bản thân|gioi thieu ban than|giới thiệu về bản thân|gioi thieu ve ban than|giới thiệu về bạn|gioi thieu ve ban|giới thiệu về em|gioi thieu ve em|giới thiệu về mình|gioi thieu ve minh|bạn giới thiệu bản thân được không|ban gioi thieu ban than duoc khong|bạn có thể giới thiệu bản thân|ban co the gioi thieu ban than|bạn có thể giới thiệu về bản thân|ban co the gioi thieu ve ban than|tự giới thiệu|tu gioi thieu|giới thiệu rora|gioi thieu rora|who are you|what is your name|who is rora|tell me about yourself|introduce yourself)\b", prompt_lower):
            intro_vi = "Dạ em là Rora, trợ lý Robot Concierge thông minh của khách sạn 5 sao Aurora Grand. Rất hân hạnh được phục vụ và đồng hành cùng quý khách ạ!"
            intro_en = "I am Rora, the smart AI Concierge Robot at Aurora Grand Hotel. It is my pleasure to assist and accompany you!"
            return (intro_en if is_en else intro_vi), lang_name, lang_code, "conversation", {"eye_expression": "happy"}

        return None

    @staticmethod
    def clean_vietnamese_voice_text(text: str) -> str:
        """Làm sạch và chuẩn hóa văn bản tiếng Việt cho giọng đọc mượt mà, không bị ngắc ngứ."""
        if not text:
            return ""
        text = re.sub(r'\bдо\b', 'đến', text, flags=re.IGNORECASE)
        text = re.sub(r'\bчасов\b', 'giờ', text, flags=re.IGNORECASE)
        text = re.sub(r'[\u0400-\u04FF]', '', text)
        text = re.sub(r'[\u4e00-\u9fff]', '', text)
        text = re.sub(r'[*#_`\[\]()]', '', text)
        text = re.sub(r'(\d{1,2}):00\b', r'\1 giờ', text)
        text = re.sub(r'(\d{1,2}):(\d{2})\b', r'\1 giờ \2 phút', text)
        text = re.sub(r'(\d{1,2})h(\d{1,2})\b', r'\1 giờ \2 phút', text)
        text = re.sub(r'(\d{1,2})h\b', r'\1 giờ', text)
        text = re.sub(r'(\d{1,2})\s*(?:giờ|h)?\s*[-–—]\s*(\d{1,2})\s*(?:giờ|h)?', r'từ \1 đến \2 giờ', text)
        text = re.sub(r'\b24/7\b', '24 trên 7', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    @classmethod
    def format_and_clean_reply(cls, reply: str, lang_code: str) -> str:
        """Chuẩn hóa văn bản câu trả lời trước khi gửi ra ngoài: dọn dẹp markdown, ký tự lạ, và chuẩn hóa giờ."""
        if not reply:
            return ""
        if lang_code == "vi-VN":
            return cls.clean_vietnamese_voice_text(reply)
        elif lang_code != "zh-CN":
            reply = re.sub(r'[\u4e00-\u9fff\u3400-\u4dbf]+', '', reply).strip()
            reply = re.sub(r'[*#_`\[\]()]', '', reply).strip()
        return reply

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
        from app.services.rag.facilities_kb_service import get_kb_facts_prompt
        kb_facts = get_kb_facts_prompt(lang_code)
        hotel_facts = scenario_service.get_hotel_facts_prompt(lang_code)

        if lang_code == "en-US":
            prompt = (
                "You are Rora - a smart, charming, and courteous AI Concierge Robot at the 5-star Aurora Grand Hotel.\n"
                "CRITICAL LANGUAGE DIRECTIVE:\n"
                "- The guest is communicating in ENGLISH. You MUST ALWAYS respond in 100% fluent, natural ENGLISH.\n"
                "- NEVER reply in Vietnamese or any other language when the guest speaks English.\n"
                "- Even though the hotel knowledge base and reference facts below are written in Vietnamese, you MUST translate and summarize all facts into natural English for the guest.\n\n"
                "CONVERSATIONAL GUIDELINES:\n"
                "1. Always communicate naturally, warmly, and politely in 2 to 3 clear, complete sentences.\n"
                "2. Speak directly and helpfully as a professional 5-star concierge. Answer questions accurately and concisely.\n"
                "3. Never use emojis, markdown formatting (*, #, _, -), or bulleted lists to ensure smooth speech synthesis.\n"
                "4. State times clearly in full words (e.g., 'from 6:00 AM to 10:00 PM', '12:00 PM noon').\n"
                "5. When providing directions or guiding to a hotel facility or room, politely end with: 'In addition, you can scan the QR code on the screen to save the directions!'\n"
                "6. MANDATORY SERVICE & ROOM NUMBER RULES:\n"
                "   - Whenever the guest makes a room service or amenity request (cleaning, towels, food, repairs, luggage, taxi):\n"
                "     + If room number is NOT known yet (not in [Room Info]): ALWAYS politely ask for their room number first.\n"
                "     + If room number IS ALREADY known (in [Room Info]): Confirm the request with their room number and NEVER ask for their room number again during this session.\n"
                "7. KNOWLEDGE INTEGRITY (STRICT RAG & FACTS):\n"
                "   - All factual details regarding hotel amenities, timings, room types, and services are strictly governed by [Hotel Knowledge Base (RAG)] and Admin-configured facts.\n"
                "   - NEVER hallucinate or invent facilities not documented in the provided knowledge base.\n"
                "   - If an amenity or inquiry is not found in the documentation, politely advise the guest to check with the Front Desk.\n"
            )
            if kb_facts:
                prompt += f"\n{kb_facts}\n"
            if hotel_facts:
                prompt += f"\n{hotel_facts}\n"
        else:
            prompt = (
                "Bạn là Rora - Trợ lý Robot Concierge thông minh, lễ phép, duyên dáng và hiếu khách tại khách sạn 5 sao Aurora Grand Hotel.\n"
                "PHONG CÁCH GIAO TIẾP VÀ TRÒ CHUYỆN TỰ NHIÊN:\n"
                "1. Xưng là 'em' hoặc 'Rora' và gọi người trò chuyện là 'quý khách' hoặc 'anh/chị'. Giao tiếp tự nhiên, lịch sự, có thể mở đầu lời chào bằng 'Dạ' khi phù hợp nhưng tuyệt đối không lặp lại từ 'Dạ' ở đầu mỗi câu tiếp theo.\n"
                "2. Trò chuyện một cách tự nhiên, gần gũi, ấm áp, lưu loát như một nhân viên lễ tân 5 sao chuyên nghiệp.\n"
                "3. Trả lời đúng trọng tâm, súc tích trong 2 đến 3 câu văn gãy gọn, hoàn chỉnh để phát giọng đọc mượt mà và người nghe dễ nắm bắt nhất.\n"
                "4. BẮT BUỘC dùng 100% tiếng Việt tự nhiên, chuẩn mực. Tuyệt đối không chèn từ ngoại ngữ vô nghĩa.\n"
                "5. Tuyệt đối KHÔNG dùng emoji, ký hiệu markdown (*, #, _, -) hay gạch đầu dòng.\n"
                "6. Viết thời gian rõ ràng: luôn viết bằng chữ như 'từ 6 giờ sáng đến 22 giờ tối', '12 giờ trưa', không viết tắt '6-22h'.\n"
                "7. Khi hướng dẫn chỉ đường hoặc giới thiệu vị trí một tiện ích hay phòng của khách sạn, ở cuối câu hãy luôn thêm câu mời: 'Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ.'\n"
                "8. QUY TẮC BẮT BUỘC VỀ YÊU CẦU DỊCH VỤ LIÊN QUAN TỚI SỐ PHÒNG:\n"
                "   - Khi khách yêu cầu bất kỳ dịch vụ phòng nào (khăn tắm, buồng phòng, dọn phòng, chăn gối, đồ dùng, đồ ăn thức uống room service, hành lý bellman, sửa chữa máy lạnh điện nước, đặt xe taxi, v.v.):\n"
                "     + Nếu CHƯA BIẾT số phòng (chưa có trong [Thông tin phòng]): BẮT BUỘC Rora phải hỏi số phòng của quý khách trước (ví dụ: 'Dạ em sẽ hỗ trợ ... cho quý khách ngay ạ! Quý khách vui lòng cho em xin số phòng của mình là bao nhiêu ạ?').\n"
                "     + Nếu ĐÃ BIẾT số phòng (đã có trong [Thông tin phòng] hoặc vừa được cung cấp): Ghi nhận yêu cầu KÈM SỐ PHÒNG của khách (ví dụ: 'Dạ Rora đã ghi nhận yêu cầu ... cho Phòng [X] rồi ạ, bộ phận chuyên trách sẽ hỗ trợ quý khách ngay!') và TUYỆT ĐỐI KHÔNG hỏi lại số phòng nữa trong suốt phiên trò chuyện.\n"
                "   - Toàn bộ các yêu cầu dịch vụ tiếp theo trong phiên này đều tự động gắn với số phòng đã lưu đó.\n"
                "9. NGUYÊN TẮC BẢO TOÀN THÔNG TIN (RAG VÀ FAST-PATH):\n"
                "   - Toàn bộ thông tin về cơ sở vật chất, tiện ích, giờ hoạt động và quy định do [Cơ sở tri thức khách sạn (RAG)] và Admin quản lý.\n"
                "   - Tuyệt đối KHÔNG tự ý suy diễn hoặc bịa đặt các dịch vụ không có trong tài liệu.\n"
                "   - Nếu thông tin khách hỏi không có trong tài liệu, hãy lịch sự trả lời rằng Rora sẽ liên hệ nhân viên hoặc quầy lễ tân để hỗ trợ quý khách.\n"
            )
            if kb_facts:
                prompt += f"\n{kb_facts}\n"
            if hotel_facts:
                prompt += f"\n{hotel_facts}\n"

        if stored_room_number:
            prompt += f"\n[Thông tin phòng]: Quý khách ở phòng {stored_room_number}."

        emotion_str = (emotion or "").lower()
        if emotion_str in ["annoyed", "angry", "upset", "unhappy", "frustrated", "khó chịu", "kho chiu"]:
            prompt += "\n[Cảm xúc khách]: Khách đang có biểu cảm khó chịu hoặc chưa hài lòng, hãy phản hồi với thái độ xin lỗi chân thành, xoa dịu ân cần và cho biết nhân viên Concierge tại sảnh sẽ hỗ trợ ngay."
        elif emotion_str in ["happy", "pleased"]:
            prompt += "\n[Cảm xúc khách]: Khách đang rất vui vẻ, hãy phản hồi tươi vui và nhiệt tình."

        if rag_context:
            kb_label = "[Hotel Knowledge Base (Reference Facts)]" if lang_code == "en-US" else "[Cơ sở tri thức khách sạn (RAG)]"
            prompt += f"\n{kb_label}:\n{rag_context}"

        return prompt
