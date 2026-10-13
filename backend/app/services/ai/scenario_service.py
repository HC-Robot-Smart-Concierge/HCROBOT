import datetime
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scenario import DialogueScenario
from app.schemas.scenario import DialogueScenarioCreate, DialogueScenarioUpdate

logger = logging.getLogger(__name__)


# Danh muc kich ban mac dinh ban dau (Seed Scenarios)
DEFAULT_SEED_SCENARIOS = [
    {
        "id": "scn-wifi",
        "title": "Mật khẩu Wi-Fi",
        "category": "facility",
        "match_keywords": ["wifi", "wi fi", "mật khẩu wifi", "pass wifi", "mạng internet", "mật khẩu mạng", "mạng wifi", "wifi password", "internet"],
        "match_type": "keyword",
        "response_vi": "Dạ wifi miễn phí tại sảnh và các phòng là 'Aurora_Guest', mật khẩu kết nối là 'aurora2026' ạ.",
        "response_en": "Complimentary Wi-Fi in the lobby and rooms is 'Aurora_Guest', with the password 'aurora2026'.",
        "action_type": "none",
        "action_payload": None,
        "is_fast_path": True,
        "is_active": True,
        "priority": 100,
    },
    {
        "id": "scn-wakeup",
        "title": "Gọi tên Robot (Wake-up call)",
        "category": "greeting",
        "match_keywords": ["hey rora", "chào rora", "chao rora", "rora ơi", "rora oi", "hello rora", "hi rora", "rora"],
        "match_type": "exact",
        "response_vi": "Dạ, Rora nghe đây ạ! Em có thể hỗ trợ gì cho quý khách?",
        "response_en": "Yes, Rora is here! How can I help you, guest?",
        "action_type": "none",
        "action_payload": None,
        "is_fast_path": True,
        "is_active": True,
        "priority": 95,
    },
    {
        "id": "scn-restaurant",
        "title": "Nhà hàng & Buffet sáng",
        "category": "facility",
        "match_keywords": ["buffet sáng", "ăn sáng", "nhà hàng ở đâu", "giờ ăn sáng", "breakfast", "buffet", "nhà hàng aurora"],
        "match_type": "keyword",
        "response_vi": "Dạ nhà hàng Aurora tọa lạc tại Tầng 2, phục vụ buffet sáng hàng ngày từ 6 giờ 30 đến 10 giờ sáng ạ. Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ!",
        "response_en": "Aurora Restaurant is located on Level 2, serving breakfast buffet daily from 6:30 AM to 10:00 AM. In addition, you can scan the QR code on the screen to save the directions!",
        "action_type": "show_map",
        "action_payload": {"destination_key": "restaurant"},
        "is_fast_path": True,
        "is_active": True,
        "priority": 85,
    },
    {
        "id": "scn-pool-gym",
        "title": "Hồ bơi vô cực & Phòng Gym",
        "category": "facility",
        "match_keywords": ["hồ bơi", "bể bơi", "swimming pool", "phòng gym", "tập gym", "thể hình", "hồ bơi ở đâu", "gym ở đâu"],
        "match_type": "keyword",
        "response_vi": "Dạ hồ bơi vô cực và phòng gym nằm tại Tầng 5. Hồ bơi mở từ 6 giờ sáng đến 22 giờ tối với khăn tắm miễn phí, còn phòng gym mở cửa 24/7 ạ. Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ!",
        "response_en": "The Infinity Pool and Gym are on Level 5. Pool hours are 6:00 AM to 10:00 PM with free towels, Gym is open 24/7. In addition, you can scan the QR code on the screen to save the directions!",
        "action_type": "show_map",
        "action_payload": {"destination_key": "infinity_pool"},
        "is_fast_path": True,
        "is_active": True,
        "priority": 85,
    },
    {
        "id": "scn-spa",
        "title": "Aurora Luxury Spa & Sauna",
        "category": "facility",
        "match_keywords": ["spa", "sauna", "massage", "xông hơi", "chăm sóc da", "spa ở đâu"],
        "match_type": "keyword",
        "response_vi": "Dạ Thảo Mộc Spa & Massage nằm tại Tầng 5 (cùng tầng với Hồ bơi vô cực), mở cửa phục vụ từ 9 giờ sáng đến 22 giờ tối hàng ngày ạ. Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ!",
        "response_en": "Aurora Luxury Spa & Sauna is on Level 5, open from 9:00 AM to 10:00 PM daily. In addition, you can scan the QR code on the screen to save the directions!",
        "action_type": "show_map",
        "action_payload": {"destination_key": "spa"},
        "is_fast_path": True,
        "is_active": True,
        "priority": 80,
    },
    {
        "id": "scn-checkin-out",
        "title": "Giờ nhận và trả phòng",
        "category": "faq",
        "match_keywords": ["nhận phòng", "trả phòng", "check in", "check out", "giờ nhận phòng", "giờ trả phòng", "check-in", "check-out"],
        "match_type": "keyword",
        "response_vi": "Dạ tiêu chuẩn nhận phòng là từ 14 giờ chiều và trả phòng trước 12 giờ trưa. Quý khách cần hỗ trợ thêm có thể bấm số 0 gặp Lễ tân ạ.",
        "response_en": "Standard check-in is from 2:00 PM, and check-out is before 12:00 PM noon. Please dial 0 for front desk assistance.",
        "action_type": "none",
        "action_payload": None,
        "is_fast_path": True,
        "is_active": True,
        "priority": 75,
    },
    {
        "id": "scn-live-call",
        "title": "Kết nối nhân viên / Video Call",
        "category": "service",
        "match_keywords": [
            "gặp người thật", "gặp nhân viên", "nói chuyện với nhân viên", "kết nối nhân viên",
            "video call", "live call", "gọi video", "gọi cho nhân viên", "gặp lễ tân", "gọi lễ tân",
            "cho tôi gặp nhân viên", "talk to human", "speak to human", "call staff"
        ],
        "match_type": "keyword",
        "response_vi": "Dạ em đang kết nối cuộc gọi video trực tiếp tới nhân viên Concierge cho quý khách ngay đây ạ, quý khách vui lòng đợi trong giây lát!",
        "response_en": "Certainly! I am connecting you to a live Concierge specialist via video call right away, please hold on for a moment!",
        "action_type": "trigger_video_call",
        "action_payload": None,
        "is_fast_path": True,
        "is_active": True,
        "priority": 90,
    },
    {
        "id": "scn-facilities-overview",
        "title": "Tổng quan Cơ sở vật chất & Tiện ích",
        "category": "facility",
        "match_keywords": ["tiện ích", "cơ sở vật chất", "khách sạn có gì", "giới thiệu khách sạn", "dịch vụ khách sạn", "ở đây có gì", "hotel amenities", "facilities"],
        "match_type": "keyword",
        "response_vi": "Dạ khách sạn Aurora Grand có đầy đủ tiện ích 5 sao: Nhà hàng buffet Á - Âu tại Tầng 2, Hồ bơi vô cực, Phòng Gym và Spa thư giãn tại Tầng 5, cùng Rooftop Coffee & Sky Bar tại Tầng 6. Quý khách cần em hỗ trợ chỉ đường tới khu vực nào ạ?",
        "response_en": "Aurora Grand Hotel offers full 5-star amenities: Buffet Restaurant on Level 2, Infinity Pool, Gym & Spa on Level 5, and Rooftop Coffee & Sky Bar on Level 6. Which area would you like me to guide you to?",
        "action_type": "none",
        "action_payload": None,
        "is_fast_path": True,
        "is_active": True,
        "priority": 90,
    },
    {
        "id": "scn-rooftop-coffee",
        "title": "Quán Rooftop Coffee & View",
        "category": "facility",
        "match_keywords": ["quán coffee", "quán cà phê", "quán cafe", "cà phê", "cafe", "coffee", "rooftop coffee", "uống cà phê"],
        "match_type": "keyword",
        "response_vi": "Dạ quán Rooftop Coffee nằm tại Tầng 6 (Sân thượng), mở cửa từ 7 giờ sáng đến 23 giờ đêm với view ngắm trọn toàn cảnh thành phố ạ. Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ!",
        "response_en": "Rooftop Coffee is located on Level 6 (Rooftop), open from 7:00 AM to 11:00 PM with panoramic skyline views. In addition, you can scan the QR code on the screen to save the directions!",
        "action_type": "show_map",
        "action_payload": {"destination_key": "rooftop_coffee"},
        "is_fast_path": True,
        "is_active": True,
        "priority": 88,
    },
    {
        "id": "scn-rooftop-bar",
        "title": "Sky Lounge Bar",
        "category": "facility",
        "match_keywords": ["quầy bar", "sky bar", "sky lounge", "uống rượu", "quán bar", "cocktail", "bar"],
        "match_type": "keyword",
        "response_vi": "Dạ Sky Lounge Bar nằm tại Tầng 6, mở cửa từ 16 giờ 30 chiều đến 1 giờ đêm phục vụ các loại cocktail và rượu vang thượng hạng với tầm nhìn ngắm trọn thành phố ạ. Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ!",
        "response_en": "Sky Lounge Bar is on Level 6, open from 4:30 PM to 1:00 AM midnight with breathtaking skyline views and premium beverages. In addition, you can scan the QR code on the screen to save the directions!",
        "action_type": "show_map",
        "action_payload": {"destination_key": "bar"},
        "is_fast_path": True,
        "is_active": True,
        "priority": 85,
    },
    {
        "id": "scn-karaoke",
        "title": "Phòng VIP Karaoke",
        "category": "facility",
        "match_keywords": ["karaoke", "hát", "phòng hát", "vip karaoke"],
        "match_type": "keyword",
        "response_vi": "Dạ phòng VIP Karaoke tọa lạc tại cuối hành lang Tầng 6, phục vụ từ 14 giờ chiều đến 0 giờ đêm với dàn âm thanh quốc tế ạ. Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ!",
        "response_en": "VIP Karaoke rooms are located at the end of Level 6 corridor, open from 2:00 PM to midnight with world-class sound systems. In addition, you can scan the QR code on the screen to save the directions!",
        "action_type": "show_map",
        "action_payload": {"destination_key": "karaoke"},
        "is_fast_path": True,
        "is_active": True,
        "priority": 80,
    },
    {
        "id": "scn-parking",
        "title": "Bãi đỗ xe ô tô (Hầm B2)",
        "category": "facility",
        "match_keywords": ["bãi xe", "đỗ xe", "gửi xe", "bãi đỗ xe", "hầm gửi xe", "ô tô", "xe hơi", "bãi ô tô", "hầm b2", "parking", "car park"],
        "match_type": "keyword",
        "response_vi": "Dạ bãi đỗ xe ô tô nằm tại Hầm B2, mở cửa 24/7 và hoàn toàn miễn phí cho khách lưu trú ạ. Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ!",
        "response_en": "Car parking is at Basement B2, open 24/7 and complimentary for staying guests. In addition, you can scan the QR code on the screen to save the directions!",
        "action_type": "show_map",
        "action_payload": {"destination_key": "parking_car"},
        "is_fast_path": True,
        "is_active": True,
        "priority": 80,
    },
    {
        "id": "scn-parking-bike",
        "title": "Bãi giữ xe máy (Hầm B1)",
        "category": "facility",
        "match_keywords": ["xe máy", "xe đạp", "gửi xe máy", "bãi xe máy", "hầm b1", "bãi giữ xe máy", "giữ xe máy", "motorbike"],
        "match_type": "keyword",
        "response_vi": "Dạ bãi giữ xe máy của khách sạn nằm tại Hầm B1, mở cửa 24/7 và hoàn toàn miễn phí cho quý khách lưu trú ạ. Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ!",
        "response_en": "Motorbike parking is at Basement B1, open 24/7 and complimentary for staying guests. In addition, you can scan the QR code on the screen to save the directions!",
        "action_type": "show_map",
        "action_payload": {"destination_key": "parking_bike"},
        "is_fast_path": True,
        "is_active": True,
        "priority": 85,
    },
    {
        "id": "scn-gift-shop",
        "title": "Cửa hàng lưu niệm (Gift Shop)",
        "category": "facility",
        "match_keywords": ["cửa hàng lưu niệm", "quà lưu niệm", "lưu niệm", "gift shop", "mua quà", "đặc sản", "souvenir"],
        "match_type": "keyword",
        "response_vi": "Dạ cửa hàng quà lưu niệm Gift Shop tọa lạc tại Tầng 6, mở cửa từ 8 giờ sáng đến 22 giờ tối với các sản phẩm quà tặng và đặc sản tinh tế ạ. Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ!",
        "response_en": "The Gift Shop is located on Level 6, open from 8:00 AM to 10:00 PM with premium souvenirs and gifts. In addition, you can scan the QR code on the screen to save the directions!",
        "action_type": "show_map",
        "action_payload": {"destination_key": "gift_shop"},
        "is_fast_path": True,
        "is_active": True,
        "priority": 85,
    },
]


class ScenarioService:
    """
    Service quan ly kich ban hoi thoai dong va Fast-Path In-Memory Cache.
    Giup giam do tre ve < 1ms ma khong can hardcode cac chuoi van ban trong code Python.
    """

    def __init__(self):
        # In-Memory Cache de doi soat trong RAM (< 0.1ms)
        self._cache: List[Dict[str, Any]] = [dict(s) for s in DEFAULT_SEED_SCENARIOS]
        self._cache.sort(key=lambda x: x.get("priority", 0), reverse=True)
        self._is_initialized_from_db: bool = False

    def reload_cache_sync(self, scenarios_data: List[Dict[str, Any]]):
        """Cap nhat In-Memory Cache ngay lap tuc."""
        self._cache = scenarios_data
        self._cache.sort(key=lambda x: x.get("priority", 0), reverse=True)
        logger.info(f"[ScenarioService] Da cap nhat In-Memory Cache voi {len(self._cache)} kich ban.")

    async def initialize_cache(self, db: AsyncSession):
        """
        Khoi tao In-Memory Cache tu PostgreSQL.
        Neu co so du lieu chua co du lieu, tu dong seed cac kich ban mac dinh.
        """
        try:
            stmt = select(DialogueScenario)
            result = await db.execute(stmt)
            records = result.scalars().all()

            if not records:
                logger.info("[ScenarioService] Database chua co kich ban, tien hanh nạp seed data...")
                for s_data in DEFAULT_SEED_SCENARIOS:
                    item = DialogueScenario(
                        id=s_data["id"],
                        title=s_data["title"],
                        category=s_data["category"],
                        match_keywords=s_data["match_keywords"],
                        match_type=s_data["match_type"],
                        response_vi=s_data["response_vi"],
                        response_en=s_data.get("response_en"),
                        action_type=s_data.get("action_type", "none"),
                        action_payload=s_data.get("action_payload"),
                        is_fast_path=s_data.get("is_fast_path", True),
                        is_active=s_data.get("is_active", True),
                        priority=s_data.get("priority", 0),
                    )
                    db.add(item)
                await db.commit()

                # Doc lai sau khi seed
                result = await db.execute(select(DialogueScenario))
                records = result.scalars().all()

            cache_list = []
            for r in records:
                if r.is_active:
                    cache_list.append({
                        "id": r.id,
                        "title": r.title,
                        "category": r.category,
                        "match_keywords": r.match_keywords or [],
                        "match_type": r.match_type,
                        "response_vi": r.response_vi,
                        "response_en": r.response_en,
                        "action_type": r.action_type,
                        "action_payload": r.action_payload,
                        "is_fast_path": r.is_fast_path,
                        "is_active": r.is_active,
                        "priority": r.priority,
                    })

            self.reload_cache_sync(cache_list)
            self._is_initialized_from_db = True
        except Exception as e:
            logger.warning(f"[ScenarioService Warning] Khong the doc kich ban tu DB: {e}. Su dung seed cache.")

    def match_fast_path(
        self, prompt: str, lang_code: str = "vi-VN"
    ) -> Optional[Tuple[str, str, str, str, Optional[Dict[str, Any]]]]:
        """
        Doi soat nhanh (<1ms) cau hoi cua khach voi danh sach kich ban trong In-Memory RAM.
        Tra ve: (response_text, lang_name, lang_code, action_type, action_payload) neu khop.
        """
        if not prompt or not prompt.strip():
            return None

        # 1. Chuan hoa prompt
        prompt_lower = prompt.lower().strip()
        normalized = prompt_lower.replace("wi-fi", "wifi").replace("wi fi", "wifi")
        normalized = re.sub(r'[\?\.\,\!\\_\:\;]', ' ', normalized)
        normalized = re.sub(r'\s+', ' ', normalized).strip()

        is_en = (lang_code == "en-US")
        lang_name = "English" if is_en else "Tiếng Việt"

        # 2. Duyet cac kich ban da sap xep theo priority giam dan
        for scn in self._cache:
            if not scn.get("is_active", True) or not scn.get("is_fast_path", True):
                continue

            keywords = scn.get("match_keywords") or []
            match_type = scn.get("match_type", "keyword")

            is_matched = False
            if match_type == "exact":
                # Khop chinh xac hoac khop ca cau ngan
                for kw in keywords:
                    kw_clean = kw.lower().strip()
                    if normalized == kw_clean or prompt_lower == kw_clean:
                        is_matched = True
                        break
            elif match_type == "regex":
                # Khop theo bieu thuc chinh quy
                for pattern in keywords:
                    try:
                        if re.search(pattern, normalized, re.IGNORECASE) or re.search(pattern, prompt_lower, re.IGNORECASE):
                            is_matched = True
                            break
                    except Exception:
                        continue
            else:
                # Default: keyword search trong chuoi
                for kw in keywords:
                    kw_clean = kw.lower().strip()
                    if not kw_clean:
                        continue
                    # Kiem tra tu khoa ton tai trong cau
                    if kw_clean in normalized or kw_clean in prompt_lower:
                        is_matched = True
                        break

            if is_matched:
                action_type = scn.get("action_type", "none")
                action_payload = scn.get("action_payload")
                resp_text = (scn.get("response_en") if is_en and scn.get("response_en") else scn.get("response_vi")) or scn.get("response_vi")
                logger.info(f"[ScenarioService FastPath Hit] Matched scenario '{scn.get('id')}' - '{scn.get('title')}' in <1ms")
                return resp_text, lang_name, lang_code, action_type, action_payload

        # 3. Kiem tra loi chao theo buoi (Dynamic Time Greeting)
        hour = datetime.datetime.now().hour
        if re.search(r"^(xin chào|chào bạn|chào em|hello|hi|good morning|good afternoon|good evening)[\?\.\!\s]*$", normalized, re.IGNORECASE):
            if 5 <= hour < 11:
                reply = "Good morning! Welcome to Aurora Grand Hotel. How may I assist you today?" if is_en else "Dạ em chào buổi sáng quý khách! Chúc quý khách một ngày mới tốt lành tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
            elif 11 <= hour < 18:
                reply = "Good afternoon! Welcome to Aurora Grand Hotel. How may I assist you today?" if is_en else "Dạ em chào quý khách! Chúc quý khách một buổi chiều vui vẻ tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
            else:
                reply = "Good evening! Welcome to Aurora Grand Hotel. How may I assist you tonight?" if is_en else "Dạ em chào buổi tối quý khách! Chúc quý khách một buổi tối thư thái tại khách sạn Aurora. Quý khách cần em hỗ trợ gì ạ?"
            return reply, lang_name, lang_code, "none", None

        return None

    def get_hotel_facts_prompt(self, lang_code: str = "vi-VN") -> str:
        """
        Sinh prompt thong tin tien ich dong tu In-Memory Cache de nhồi vao System Prompt cua Ollama.
        Khong can hardcode trong code Python.
        """
        is_en = (lang_code == "en-US")
        active_facts = []

        for scn in self._cache:
            if not scn.get("is_active", True):
                continue
            cat = scn.get("category", "")
            if cat in ["facility", "faq"]:
                resp = scn.get("response_en") if is_en and scn.get("response_en") else scn.get("response_vi")
                title = scn.get("title")
                if resp:
                    active_facts.append(f"- {title}: {resp}")

        if not active_facts:
            return ""

        header = "HOTEL AMENITIES & FACTS (CONFIGURED BY ADMIN):\n" if is_en else "THÔNG TIN TIỆN ÍCH KHÁCH SẠN (DO ADMIN THIẾT LẬP):\n"
        return header + "\n".join(active_facts)

    # ------------------------------------------------------------------------
    # DATABASE CRUD OPERATIONS
    # ------------------------------------------------------------------------

    async def list_scenarios(
        self,
        db: AsyncSession,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[DialogueScenario]:
        """Lay danh sach tat ca kich ban tu co so du lieu."""
        try:
            stmt = select(DialogueScenario).order_by(DialogueScenario.priority.desc(), DialogueScenario.created_at.desc())
            if category and category.lower() != "all":
                stmt = stmt.where(DialogueScenario.category == category)
            if is_active is not None:
                stmt = stmt.where(DialogueScenario.is_active == is_active)
            if search and search.strip():
                kw = f"%{search.strip()}%"
                stmt = stmt.where(
                    (DialogueScenario.title.ilike(kw)) |
                    (DialogueScenario.response_vi.ilike(kw))
                )

            result = await db.execute(stmt)
            return list(result.scalars().all())
        except Exception as e:
            logger.error(f"[ScenarioService list_scenarios Error] {e}")
            raise

    async def get_scenario(self, db: AsyncSession, scenario_id: str) -> Optional[DialogueScenario]:
        """Lay chi tiet mot kich ban theo ID."""
        try:
            stmt = select(DialogueScenario).where(DialogueScenario.id == scenario_id)
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"[ScenarioService get_scenario Error] {e}")
            raise

    async def create_scenario(self, db: AsyncSession, data: DialogueScenarioCreate) -> DialogueScenario:
        """Tao kich ban moi va cap nhat In-Memory Cache."""
        try:
            item = DialogueScenario(
                title=data.title,
                category=data.category,
                match_keywords=data.match_keywords,
                match_type=data.match_type,
                response_vi=data.response_vi,
                response_en=data.response_en,
                action_type=data.action_type,
                action_payload=data.action_payload,
                is_fast_path=data.is_fast_path,
                is_active=data.is_active,
                priority=data.priority,
            )
            db.add(item)
            await db.commit()
            await db.refresh(item)

            # Cap nhat lai In-Memory Cache
            await self.initialize_cache(db)
            return item
        except Exception as e:
            await db.rollback()
            logger.error(f"[ScenarioService create_scenario Error] {e}")
            raise

    async def update_scenario(
        self, db: AsyncSession, scenario_id: str, data: DialogueScenarioUpdate
    ) -> Optional[DialogueScenario]:
        """Cap nhat kich ban va reload In-Memory Cache."""
        try:
            item = await self.get_scenario(db, scenario_id)
            if not item:
                return None

            update_dict = data.model_dump(exclude_unset=True)
            for k, v in update_dict.items():
                setattr(item, k, v)
            item.updated_at = datetime.datetime.utcnow()

            await db.commit()
            await db.refresh(item)

            # Cap nhat lai In-Memory Cache
            await self.initialize_cache(db)
            return item
        except Exception as e:
            await db.rollback()
            logger.error(f"[ScenarioService update_scenario Error] {e}")
            raise

    async def delete_scenario(self, db: AsyncSession, scenario_id: str) -> bool:
        """Xoa kich ban khoi DB va reload In-Memory Cache."""
        try:
            item = await self.get_scenario(db, scenario_id)
            if not item:
                return False

            await db.delete(item)
            await db.commit()

            # Cap nhat lai In-Memory Cache
            await self.initialize_cache(db)
            return True
        except Exception as e:
            await db.rollback()
            logger.error(f"[ScenarioService delete_scenario Error] {e}")
            raise


# Singleton instance cho toan ung dung
scenario_service = ScenarioService()
