import hashlib
import json
import logging
import re
from typing import Optional, Any, Dict
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger("app.services.cache.redis_service")


class RedisService:
    """
    Dịch vụ quản trị kết nối và bộ nhớ đệm phân tán Redis Cloud cho HC-Robot.
    Hỗ trợ:
    1. AI Query Cache: Trả lời siêu tốc (< 5ms) cho các câu hỏi phổ biến của khách sạn.
    2. TTS Audio Cache: Lưu trữ audio chunk MP3 để phát lại tức thì không cần gọi Edge-TTS.
    3. Session State Cache: Duy trì ngữ cảnh phiên hội thoại & số phòng bền vững khi restart server.
    """

    def __init__(self):
        self.redis_url = settings.REDIS_URL
        self.enabled = bool(settings.ENABLE_REDIS and self.redis_url)
        self.default_ttl = settings.REDIS_CACHE_TTL or 86400  # 24 giờ
        self._client: Optional[aioredis.Redis] = None
        self._is_connected = False
        self._connection_warned = False

    def get_client(self) -> Optional[aioredis.Redis]:
        """Khởi tạo hoặc trả về client async Redis với connection pool tối ưu."""
        if not self.enabled:
            return None

        if self._client is None and self.redis_url:
            try:
                self._client = aioredis.from_url(
                    self.redis_url,
                    decode_responses=False,  # Binary safe cho cả Text JSON lẫn Audio MP3 bytes
                    socket_connect_timeout=2.5,
                    socket_timeout=3.0,
                    retry_on_timeout=True,
                    max_connections=20,
                )
                self._is_connected = True
            except Exception as e:
                logger.warning(f"[RedisService] Không thể khởi tạo Redis connection pool: {e}")
                self._client = None
                self._is_connected = False
        return self._client

    async def ping(self) -> bool:
        """Kiểm tra kết nối tới Redis Cloud."""
        client = self.get_client()
        if not client:
            return False
        try:
            res = await client.ping()
            self._is_connected = bool(res)
            return self._is_connected
        except Exception as e:
            if not self._connection_warned:
                logger.warning(f"[RedisService Ping Error]: {e}")
                self._connection_warned = True
            self._is_connected = False
            return False

    @staticmethod
    def normalize_query(query: str) -> str:
        """Chuẩn hóa câu truy vấn để tăng tỷ lệ trúng cache (Cache Hit Ratio)."""
        if not query:
            return ""
        # 1. Chuyển chữ thường
        q = query.strip().lower()
        # 2. Xóa các ký tự đặc biệt, dấu câu cuối câu
        q = re.sub(r'[?.!,;:"\'()\[\]{}]', '', q)
        # 3. Gom nhiều khoảng trắng thành 1
        q = re.sub(r'\s+', ' ', q).strip()
        return q

    def _get_query_cache_key(self, query: str, language: str) -> str:
        clean = self.normalize_query(query)
        q_hash = hashlib.md5(clean.encode("utf-8")).hexdigest()
        lang_tag = "en" if "en" in language.lower() else "vi"
        return f"hcrobot:ai:{lang_tag}:{q_hash}"

    # =========================================================================
    # 1. AI QUERY & FAST RESPONSE CACHE
    # =========================================================================

    async def get_ai_cache(self, query: str, language: str = "vi") -> Optional[Dict[str, Any]]:
        """Lấy câu trả lời AI đã cache từ Redis (< 5ms)."""
        client = self.get_client()
        if not client:
            return None

        # Không cache nếu câu có trích dẫn số phòng cụ thể (mang tính cá nhân)
        if re.search(r'\b(phòng|room)\s*\d{3,4}\b', query.lower()):
            return None

        try:
            key = self._get_query_cache_key(query, language)
            raw = await client.get(key)
            if raw:
                data = json.loads(raw.decode("utf-8"))
                logger.info(f"[RedisCache HIT] AI query: '{query[:35]}...' -> Trả lời tức thì từ Redis")
                return data
        except Exception as e:
            logger.debug(f"[RedisCache] get_ai_cache error: {e}")
        return None

    async def set_ai_cache(
        self,
        query: str,
        language: str,
        response_data: Dict[str, Any],
        ttl: Optional[int] = None,
    ) -> bool:
        """Lưu câu trả lời của AI vào Redis."""
        client = self.get_client()
        if not client or not response_data:
            return False

        # Không cache câu lệnh gắn liền với số phòng cụ thể
        if re.search(r'\b(phòng|room)\s*\d{3,4}\b', query.lower()):
            return False

        try:
            key = self._get_query_cache_key(query, language)
            payload = json.dumps(response_data, ensure_ascii=False)
            expire_secs = ttl or self.default_ttl
            await client.setex(key, expire_secs, payload.encode("utf-8"))
            return True
        except Exception as e:
            logger.debug(f"[RedisCache] set_ai_cache error: {e}")
            return False

    # =========================================================================
    # 2. TTS AUDIO CHUNK CACHE (MP3 BINARY)
    # =========================================================================

    async def get_tts_audio(self, cache_key: str) -> Optional[bytes]:
        """Lấy đoạn âm thanh MP3 binary từ Redis (< 5ms)."""
        client = self.get_client()
        if not client:
            return None
        try:
            key = f"hcrobot:tts:{cache_key}"
            audio_bytes = await client.get(key)
            if audio_bytes and len(audio_bytes) > 0:
                return audio_bytes
        except Exception as e:
            logger.debug(f"[RedisCache] get_tts_audio error: {e}")
        return None

    async def set_tts_audio(self, cache_key: str, audio_bytes: bytes, ttl: int = 604800) -> bool:
        """Lưu đoạn âm thanh MP3 binary vào Redis (mặc định 7 ngày)."""
        client = self.get_client()
        if not client or not audio_bytes:
            return False
        try:
            key = f"hcrobot:tts:{cache_key}"
            await client.setex(key, ttl, audio_bytes)
            return True
        except Exception as e:
            logger.debug(f"[RedisCache] set_tts_audio error: {e}")
            return False

    # =========================================================================
    # 3. SESSION & ROOM MEMORY CACHE
    # =========================================================================

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Lấy thông tin phiên hội thoại từ Redis."""
        client = self.get_client()
        if not client or not session_id:
            return None
        try:
            key = f"hcrobot:session:{session_id}"
            raw = await client.get(key)
            if raw:
                return json.loads(raw.decode("utf-8"))
        except Exception as e:
            logger.debug(f"[RedisCache] get_session error: {e}")
        return None

    async def set_session(self, session_id: str, data: Dict[str, Any], ttl: int = 3600) -> bool:
        """Lưu thông tin phiên hội thoại vào Redis (mặc định 60 phút)."""
        client = self.get_client()
        if not client or not session_id:
            return False
        try:
            key = f"hcrobot:session:{session_id}"
            payload = json.dumps(data, ensure_ascii=False)
            await client.setex(key, ttl, payload.encode("utf-8"))
            return True
        except Exception as e:
            logger.debug(f"[RedisCache] set_session error: {e}")
            return False

    async def delete_session(self, session_id: str) -> bool:
        """Xóa phiên hội thoại khỏi Redis."""
        client = self.get_client()
        if not client or not session_id:
            return False
        try:
            key = f"hcrobot:session:{session_id}"
            await client.delete(key)
            return True
        except Exception as e:
            logger.debug(f"[RedisCache] delete_session error: {e}")
            return False


# Singleton Instance
redis_service = RedisService()
