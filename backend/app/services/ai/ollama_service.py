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

class OllamaService:
    def __init__(self):
        self.host = settings.OLLAMA_HOST
        self.model = settings.OLLAMA_MODEL
        self.embed_model = getattr(settings, "OLLAMA_EMBED_MODEL", None)
        self._client = ollama.AsyncClient(host=self.host)

    async def _call_groq(self, messages: List[Dict[str, str]], json_mode: bool = False, max_tokens: int = 150) -> Optional[str]:
        """
        Gọi Groq Cloud API qua HTTP POST (OpenAI format).
        Ưu tiên hàng đầu (Tier 1), phản hồi siêu tốc (< 500ms).
        """
        if not settings.GROQ_API_KEY:
            return None
        import httpx
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "curl/8.0.1",
        }
        payload: Dict[str, Any] = {
            "model": settings.GROQ_MODEL or "qwen/qwen3.8-27b",
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.0 if json_mode else 0.4,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data["choices"][0]["message"]["content"]
                elif res.status_code == 429:
                    logger.warning("[Groq 429 Rate Limit] Token bucket full, waiting 0.8s for fast auto-recovery...")
                    await asyncio.sleep(0.8)
                    res_retry = await client.post(url, headers=headers, json=payload)
                    if res_retry.status_code == 200:
                        return res_retry.json()["choices"][0]["message"]["content"]
                    else:
                        logger.warning(f"[Groq Retry Failed] status={res_retry.status_code}")
                        return None
                else:
                    logger.warning(f"[Groq API Warning] status={res.status_code}: {res.text[:120]}")
                    return None
        except Exception as e:
            logger.warning(f"[Groq API Error]: {str(e)}")
            return None

    async def _call_groq_stream(self, messages: List[Dict[str, str]], max_tokens: int = 150):
        """
        Streaming token từ Groq Cloud API theo chuẩn Server-Sent Events (SSE).
        """
        if not settings.GROQ_API_KEY:
            return
        import httpx
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "User-Agent": "curl/8.0.1",
        }
        payload: Dict[str, Any] = {
            "model": settings.GROQ_MODEL or "qwen/qwen3.8-27b",
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.4,
            "stream": True,
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as response:
                    if response.status_code != 200:
                        err_text = await response.aread()
                        logger.warning(f"[Groq Stream Warning] status={response.status_code}: {err_text[:120].decode('utf-8', errors='ignore')}")
                        return
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data_str)
                                choices = chunk.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        yield content
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            logger.warning(f"[Groq Stream Error]: {str(e)}")
            raise

    @staticmethod
    def detect_language(text: str) -> Tuple[str, str]:
        """
        Tự động phân tích câu nói của khách để nhận diện ngôn ngữ và mã lang_code cho TTS.
        Hỗ trợ song ngữ chuẩn xác 100%: Tiếng Việt (vi-VN), Tiếng Anh (en-US), Tiếng Trung (zh-CN), Tiếng Nhật (ja-JP).
        """
        if not text or not text.strip():
            return "Tiếng Việt", "vi-VN"

        # 1. Ký tự có dấu tiếng Việt đặc trưng -> 100% Tiếng Việt
        if re.search(r'[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]', text, re.IGNORECASE):
            return "Tiếng Việt", "vi-VN"

        # 2. Tiếng Trung (Chữ Hán)
        cjk_chars = re.findall(r'[一-鿿]', text)
        latin_chars = re.findall(r'[a-zA-Z]', text)
        if len(cjk_chars) > 0 and len(cjk_chars) > len(latin_chars):
            return "Tiếng Trung", "zh-CN"

        # 3. Tiếng Nhật (Hiragana / Katakana)
        if re.search(r'[぀-ヿ]', text):
            return "Tiếng Nhật", "ja-JP"

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

        # Kiểm tra hình thái học tiếng Anh (morphology patterns)
        for p in EN_SUBSTRING_PATTERNS:
            if re.search(p, lower_text):
                return "English", "en-US"

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
            r'\b(luggage|baggage|towel|water|food|drink|restaurant|taxi|airport|service|help|need|want)\b',
            r'\b(show|tell|guide|find|open|close|order|call|bring|get|take|clean|go|see|look|give|pay|cost|price|menu)\b',
            r'\b(coffee|tea|beer|bar|cocktail|floor|lobby|elevator|lift|toilet|restroom|bathroom|door|card|key|bill)\b',
            r'\b(now|today|tonight|tomorrow|time|later|yes|no|ok|okay|sure|fine|sir|madam|assist|recommend|direction)\b'
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

        # PRE-CHECK 1: Nếu câu nói chứa từ khóa HÀNH ĐỘNG dịch vụ buồng phòng / bảo trì / ẩm thực / hành lý
        # → Bỏ qua fast-path để Intent Router + Service FSM xử lý slot-filling số phòng
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
        if has_action_verb and has_service_noun:
            logger.info(f"[OllamaService Fast-Path Bypass] Service action intent detected, skipping fast-path for: '{prompt[:40]}'")
            return None

        # PRE-CHECK 2: Nếu câu hỏi về KHÁM PHÁ XUNG QUANH / NGOẠI KHU / CHỢ ĐÊM / ĐI CHƠI
        # → Bỏ qua fast-path nội khu chung chung để RAG + LLM tra cứu cẩm nang địa điểm chi tiết
        nearby_exploration_keywords = [
            "gần đây", "xung quanh", "quanh đây", "gần khách sạn", "ngoại khu", "chợ đêm",
            "chơi gì", "ăn gì ở đâu", "đi đâu chơi", "địa điểm du lịch", "địa điểm tham quan",
            "có gì chơi", "quanh khách sạn", "nearby", "around here", "night market", "sightseeing"
        ]
        if any(kw in prompt_lower for kw in nearby_exploration_keywords):
            logger.info(f"[OllamaService Fast-Path Bypass] Nearby exploration query detected, delegating to RAG: '{prompt[:40]}'")
            return None

        # 1. Đối soát nhanh từ Dynamic Scenarios Cache trong RAM (do Admin quản lý qua API/DB)
        dynamic_hit = scenario_service.match_fast_path(prompt, lang_code)
        if dynamic_hit:
            return dynamic_hit

        # 2. Lời chào chung theo thời gian thực (Real-time Clock Greetings)
        if re.search(r"^(xin chào|xin chao|chào em|chao em|chào robot|chao robot|chào bạn|chao ban|chào rora|chao rora|hello|hi|hey|good morning|good afternoon|good evening)[\?\.\!\s]*$", prompt_lower):
            return (time_greeting_en if is_en else time_greeting_vi), lang_name, lang_code, None, None

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
            if hotel_facts:
                prompt += f"\n{hotel_facts}\n"
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
            if hotel_facts:
                prompt += f"\n{hotel_facts}\n"

        if stored_room_number:
            prompt += f"\n[Thông tin phòng]: Quý khách ở phòng {stored_room_number}."

        emotion_str = (emotion or "").lower()
        if emotion_str in ["annoyed", "angry", "upset"]:
            prompt += "\n[Cảm xúc khách]: Khách đang chưa hài lòng, hãy phản hồi với thái độ xin lỗi và xoa dịu ân cần."
        elif emotion_str in ["happy", "pleased"]:
            prompt += "\n[Cảm xúc khách]: Khách đang rất vui vẻ, hãy phản hồi tươi vui và nhiệt tình."

        if rag_context:
            kb_label = "[Hotel Knowledge Base (Reference Facts)]" if lang_code == "en-US" else "[Cơ sở tri thức khách sạn (RAG)]"
            prompt += f"\n{kb_label}:\n{rag_context}"

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
        Async Generator sinh token theo thời gian thực từ Qwen/Groq/Gemini/Ollama (stream=True).
        Cơ chế Cascading 3 Tầng: Groq Cloud -> Google Gemini Cloud -> Ollama Local -> Offline Factsheet.
        """
        # 0. Kiểm tra Mega Fast-Path tức thì (< 1ms)
        fast_hit = self.check_fast_path(prompt, language)
        if fast_hit:
            reply, _, _ = fast_hit
            yield reply
            return

        # Tự động truy vấn tri thức RAG từ ChromaDB nếu chưa có sẵn
        if rag_context is None:
            try:
                from app.services.rag.chroma import query_rag_context
                rag_context = await query_rag_context(prompt)
            except Exception:
                rag_context = ""

        if not language or language.lower() in ["auto", ""]:
            lang_name, lang_code = self.detect_language(prompt)
        else:
            lang_name = language
            lang_code = "en-US" if (language.lower().startswith("en") or "english" in language.lower()) else "vi-VN"

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

        provider = (getattr(settings, "LLM_PROVIDER", "") or getattr(settings, "AI_PROVIDER", "") or "groq").lower()

        # =========================================================================
        # 1. TIER 1 (Ưu tiên 1): Groq Cloud Streaming siêu tốc (< 200ms TTFT)
        # =========================================================================
        if provider not in ["gemini", "ollama"] and bool(settings.GROQ_API_KEY):
            has_yielded_groq = False
            try:
                logger.info(f"[AI Stream Tier 1] Đang gọi Groq Cloud Stream (model: {settings.GROQ_MODEL})...")
                async for token in self._call_groq_stream(messages, max_tokens=150):
                    has_yielded_groq = True
                    yield token
                if has_yielded_groq:
                    return
            except Exception as e_groq:
                logger.warning(f"[AI Stream Tier 1] Groq Stream không khả dụng ({e_groq}), tự động fallback sang Gemini Cloud...")
                if has_yielded_groq:
                    return

        # =========================================================================
        # 2. TIER 2 (Ưu tiên 2): Google Gemini Cloud Streaming (Fallback từ Groq)
        # =========================================================================
        from app.services.ai.gemini_service import gemini_service
        if provider != "ollama" and gemini_service.is_configured:
            has_yielded_gemini = False
            try:
                logger.info("[AI Stream Tier 2] Đang gọi Gemini Cloud Stream...")
                async for token in gemini_service.generate_response_stream(
                    prompt=prompt,
                    rag_context=rag_context,
                    language=language,
                    emotion=emotion,
                    chat_history=chat_history,
                    stored_room_number=stored_room_number,
                ):
                    has_yielded_gemini = True
                    yield token
                if has_yielded_gemini:
                    return
            except Exception as e_gemini:
                logger.warning(f"[AI Stream Tier 2] Gemini Stream không khả dụng ({e_gemini}), tự động fallback sang Ollama Local...")
                if has_yielded_gemini:
                    return

        # =========================================================================
        # 3. TIER 3 (Ưu tiên 3): Ollama Local Streaming (Hoạt động 100% Offline)
        # =========================================================================
        try:
            logger.info(f"[AI Stream Tier 3] Đang gọi Ollama Local Stream (model: {self.model})...")
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
            return
        except Exception as e:
            logger.warning(f"[AI Stream Tier 3] Ollama offline ({e}), kích hoạt Smart Offline Knowledge Fallback...")
            fallback = self.generate_offline_fallback_response(
                prompt=prompt,
                lang_code=lang_code,
                rag_context=rag_context,
                stored_room_number=stored_room_number,
            )
            yield fallback

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
        Cơ chế Cascading 3 Tầng: Groq Cloud -> Google Gemini Cloud -> Ollama Local -> Offline Factsheet.
        """
        # 0. Kiểm tra Fast-Path trước (< 1ms)
        fast_hit = self.check_fast_path(prompt, language)
        if fast_hit:
            return fast_hit

        # Tự động truy vấn tri thức RAG từ ChromaDB nếu chưa có sẵn
        if rag_context is None:
            try:
                from app.services.rag.chroma import query_rag_context
                rag_context = await query_rag_context(prompt)
            except Exception:
                rag_context = ""

        if not language or language.lower() in ["auto", ""]:
            lang_name, lang_code = self.detect_language(prompt)
        else:
            lang_name = language
            lang_code = "en-US" if (language.lower().startswith("en") or "english" in language.lower()) else "vi-VN"

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

        provider = (getattr(settings, "LLM_PROVIDER", "") or getattr(settings, "AI_PROVIDER", "") or "groq").lower()

        # =========================================================================
        # 1. TIER 1 (Ưu tiên 1): Groq Cloud (< 300ms)
        # =========================================================================
        if provider not in ["gemini", "ollama"] and bool(settings.GROQ_API_KEY):
            try:
                logger.info(f"[AI Tier 1] Gửi Groq Cloud (model: {settings.GROQ_MODEL})...")
                groq_reply = await self._call_groq(messages, json_mode=False, max_tokens=150)
                if groq_reply and groq_reply.strip():
                    reply = self.format_and_clean_reply(groq_reply.strip(), lang_code)
                    if lang_code == "en-US" and not re.search(r"[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]", reply, re.IGNORECASE):
                        final_lang_name, final_lang_code = "English", "en-US"
                    else:
                        final_lang_name, final_lang_code = self.detect_language(reply)
                    logger.info("[AI Tier 1] Thành công từ Groq Cloud!")
                    return reply, final_lang_name, final_lang_code
                else:
                    logger.warning("[AI Tier 1] Groq Cloud phản hồi rỗng, tự động fallback sang Gemini Cloud...")
            except Exception as e_groq:
                logger.warning(f"[AI Tier 1] Groq Cloud không khả dụng ({e_groq}), tự động fallback sang Gemini Cloud...")

        # =========================================================================
        # 2. TIER 2 (Ưu tiên 2): Google Gemini Cloud (Fallback từ Groq)
        # =========================================================================
        from app.services.ai.gemini_service import gemini_service
        if provider != "ollama" and gemini_service.is_configured:
            try:
                logger.info("[AI Tier 2] Gửi Gemini Cloud (Fallback từ Groq)...")
                gemini_res = await gemini_service.generate_response(
                    prompt=prompt,
                    rag_context=rag_context,
                    language=language,
                    emotion=emotion,
                    chat_history=chat_history,
                    stored_room_number=stored_room_number,
                )
                if gemini_res and gemini_res[0]:
                    logger.info("[AI Tier 2] Thành công từ Gemini Cloud!")
                    return gemini_res
            except Exception as e_gemini:
                logger.warning(f"[AI Tier 2] Gemini Cloud không khả dụng ({e_gemini}), tự động fallback sang Ollama Local...")

        # =========================================================================
        # 3. TIER 3 (Ưu tiên 3): Ollama Local (Hoạt động 100% Offline)
        # =========================================================================
        try:
            logger.info(f"[AI Tier 3] Gửi Ollama Local (model: {self.model})...")
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

            raw_reply = response["message"]["content"].strip()
            reply = self.format_and_clean_reply(raw_reply, lang_code)

            if lang_code == "en-US" and not re.search(r"[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]", reply, re.IGNORECASE):
                final_lang_name, final_lang_code = "English", "en-US"
            else:
                final_lang_name, final_lang_code = self.detect_language(reply)
            logger.info("[AI Tier 3] Thành công từ Ollama Local!")
            return reply, final_lang_name, final_lang_code
        except Exception as e_ollama:
            logger.warning(f"[AI Tier 3] Ollama Local offline ({e_ollama}), kích hoạt Smart Offline Knowledge Fallback...")

        # =========================================================================
        # 4. TIER 4: Smart Offline Knowledge Fallback khi toàn bộ AI models gián đoạn
        # =========================================================================
        fallback = self.generate_offline_fallback_response(
            prompt=prompt,
            lang_code=lang_code,
            rag_context=rag_context,
            stored_room_number=stored_room_number,
        )
        return fallback, lang_name, lang_code

    def generate_offline_fallback_response(
        self,
        prompt: str,
        lang_code: str = "vi-VN",
        rag_context: Optional[str] = None,
        stored_room_number: Optional[str] = None,
    ) -> str:
        """
        Tự động phản hồi thông minh từ factsheet khách sạn Aurora khi Ollama local chưa khởi động.
        Đảm bảo zero-crash, zero-downtime cho bất kỳ ai clone dự án về mà chưa cài Ollama.
        """
        p_lower = prompt.lower().strip()
        is_en = lang_code == "en-US"

        # 0. Ưu tiên Fast-Path động do Admin quản lý từ DB
        fast_hit = scenario_service.match_fast_path(prompt, lang_code)
        if fast_hit:
            return fast_hit[0]

        # 0.1. Ưu tiên dữ liệu từ RAG (ChromaDB / Knowledge Vault) nếu có hoặc tự động truy vấn RAG
        if not rag_context:
            try:
                from app.services.rag.chroma import get_concierge_collection
                col = get_concierge_collection("concierge_kb")
                res = col.query(query_texts=[prompt], n_results=1)
                if res and res.get("documents") and len(res["documents"]) > 0:
                    docs = res["documents"][0]
                    if docs and len(docs[0].strip()) > 15:
                        rag_context = docs[0].strip()
            except Exception as e_rag:
                logger.debug(f"[Offline RAG Query Error]: {e_rag}")

        if rag_context and len(rag_context.strip()) > 20:
            clean_ctx = re.sub(r'[*#_`]', '', rag_context).strip()
            sentences = [s.strip() for s in clean_ctx.split('.') if len(s.strip()) > 15]
            if sentences:
                return f"Dạ theo thông tin khách sạn: {sentences[0]} ạ." if not is_en else f"According to hotel info: {sentences[0]}."

        # 1. Fallback nhã nhặn khi thông tin không có trong cả Fast-Path lẫn RAG
        return (
            "I have noted your request. Please contact the Front Desk at Level 1 or dial 0 from your room phone for immediate assistance!"
            if is_en else
            "Dạ Rora xin ghi nhận câu hỏi của quý khách. Quý khách vui lòng liên hệ Quầy Lễ tân sảnh tầng 1 hoặc gọi phím 0 từ điện thoại phòng để được hỗ trợ chu đáo nhất nhé ạ!"
        )

    async def extract_intent(self, user_speech: str) -> Dict[str, Any]:
        """
        Phân tích câu nói của khách để bóc tách ý định (action), số phòng (room_number), và yêu cầu/món đồ (items).
        Cascading Fallback: Groq Cloud -> Gemini Cloud -> Ollama Local -> Heuristic Keywords.
        """
        lower_speech = user_speech.lower().strip()
        extracted_room_regex = None
        match_room = re.search(r'(?:phòng|room|p\.)\s*([0-9]{3,4})', lower_speech)
        if match_room:
            extracted_room_regex = match_room.group(1)

        clean_items = re.sub(r'(?:phòng|room|p\.)\s*[0-9]{3,4}', '', user_speech, flags=re.IGNORECASE).strip()

        SERVICE_KEYWORDS = {
            "housekeeping": ["khăn", "dọn", "gối", "chăn", "nệm", "dọn phòng", "towel", "clean", "pillow", "blanket", "housekeeping"],
            "maintenance": ["hỏng", "sửa", "hư", "máy lạnh", "điều hòa", "bóng đèn", "vòi nước", "kẹt", "tivi", "remote", "broken", "repair", "ac", "air conditioner"],
            "bellman": ["hành lý", "vali", "xách đồ", "chở đồ", "xe đẩy", "luggage", "baggage", "bellman"],
            "room_service": ["đồ ăn", "nước uống", "thức ăn", "gọi món", "menu", "cơm", "phở", "bánh mì", "nước suối", "food", "drink", "room service"],
        }

        intent_prompt = f"""Bạn là bộ định tuyến AI của khách sạn Aurora Grand.
Hãy phân tích yêu cầu của khách: "{user_speech}"
Và trích xuất ra JSON duy nhất theo schema:
{{
  "action": "housekeeping" | "maintenance" | "bellman" | "room_service" | "provide_room_number" | "unknown",
  "room_number": "{extracted_room_regex if extracted_room_regex else ''}",
  "items": "mô tả đồ vật hoặc yêu cầu"
}}
Chỉ trả về JSON thuần túy, không có giải thích, không markdown backticks."""

        intent_messages = [
            {"role": "system", "content": "You are an AI intent classifier. Output strictly valid JSON."},
            {"role": "user", "content": intent_prompt}
        ]

        provider = (getattr(settings, "LLM_PROVIDER", "") or getattr(settings, "AI_PROVIDER", "") or "groq").lower()

        # =========================================================================
        # 1. TIER 1 (Ưu tiên 1): Groq Cloud bóc tách intent JSON (< 200ms)
        # =========================================================================
        if provider not in ["gemini", "ollama"] and bool(settings.GROQ_API_KEY):
            try:
                groq_content = await self._call_groq(intent_messages, json_mode=True, max_tokens=60)
                if groq_content:
                    parsed_json = json.loads(groq_content.strip())
                    if extracted_room_regex and not parsed_json.get("room_number"):
                        parsed_json["room_number"] = extracted_room_regex
                    logger.info(f"[Intent Router Tier 1] Groq phân tích thành công: action={parsed_json.get('action')}")
                    return parsed_json
            except Exception as e_groq:
                logger.warning(f"[Intent Router Tier 1] Groq lỗi ({e_groq}), tự động fallback sang Gemini Cloud...")

        # =========================================================================
        # 2. TIER 2 (Ưu tiên 2): Google Gemini Cloud bóc tách intent (Fallback từ Groq)
        # =========================================================================
        from app.services.ai.gemini_service import gemini_service
        if provider != "ollama" and gemini_service.is_configured:
            try:
                parsed_gemini = await gemini_service.extract_intent(user_speech=user_speech)
                if parsed_gemini and parsed_gemini.get("action") not in ["unknown", None]:
                    logger.info(f"[Intent Router Tier 2] Gemini phân tích thành công: action={parsed_gemini.get('action')}")
                    return parsed_gemini
            except Exception as e_gemini:
                logger.warning(f"[Intent Router Tier 2] Gemini lỗi ({e_gemini}), tự động fallback sang Ollama Local...")

        # =========================================================================
        # 3. TIER 3 (Ưu tiên 3): Ollama Local bóc tách intent (Offline)
        # =========================================================================
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
                timeout=15.0
            )
            content = response["message"]["content"].strip()
            parsed_json = json.loads(content)

            if extracted_room_regex and not parsed_json.get("room_number"):
                parsed_json["room_number"] = extracted_room_regex

            logger.info(f"[Intent Router Tier 3] Ollama phân tích thành công: action={parsed_json.get('action')}")
            return parsed_json
        except Exception as e_ollama:
            err_msg = repr(e_ollama) if not str(e_ollama) else str(e_ollama)
            logger.warning(f"[Intent Router Tier 3] Ollama Local offline ({err_msg}), fallback sang Heuristic Keyword...")

        # =========================================================================
        # 4. TIER 4 (Fallback cuối cùng): Heuristic Keywords khi toàn bộ LLM offline
        # =========================================================================
        fallback_action = "unknown"
        for act, kws in SERVICE_KEYWORDS.items():
            if any(k in lower_speech for k in kws):
                fallback_action = act
                break
        if fallback_action == "unknown" and extracted_room_regex:
            fallback_action = "provide_room_number"

        return {
            "action": fallback_action,
            "room_number": extracted_room_regex,
            "items": clean_items or user_speech,
        }

    async def get_embedding(self, text: str) -> List[float]:
        """
        Tạo Vector Embedding từ đoạn văn bản để lưu/tìm kiếm trong ChromaDB Vector Store.
        """
        try:
            response = await self._client.embeddings(
                model=self.embed_model or 'bge-m3',
                prompt=text
            )
            return response["embedding"]
        except Exception as e:
            logger.error(f"[OllamaService Error] Lỗi tạo vector embedding: {str(e)}")
            raise RuntimeError(f"Lỗi khi tạo embedding qua Ollama ({self.embed_model}): {str(e)}")


# Singleton Instance
ollama_service = OllamaService()
