import time
import logging
import re
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


def extract_room_number(text: str, is_answering_room: bool = False) -> Optional[str]:
    """
    Bóc tách số phòng linh hoạt và chính xác từ câu nói của khách.
    Hỗ trợ:
      - Câu trả lời trực tiếp: "402", "dạ 402 ạ", "402 em", "402 nha", "là 402"
      - Cụm từ có tiền tố: "phòng 402", "phong 402", "p.402", "p402", "room 402", "số phòng 402"
      - Khẳng định cư trú: "tôi ở 402", "anh ở phòng 402", "mình ở 305", "em ở 402", "phòng của tôi là 402"
      - Lồng ghép trong câu yêu cầu: "Cho anh 2 khăn tắm phòng 402", "phòng 301 bị hỏng điều hòa"
    """
    if not text:
        return None

    clean = text.strip()

    # 1. Câu trả lời ngắn thuần túy số phòng: vd "402", "dạ 402", "402 ạ", "402 nha em", "là 402", "402 nhé"
    standalone = re.search(
        r'^(?:dạ|da|là|la|ở|o|số|so|phòng|phong|room)?\s*([1-9][0-9]{2,3})(?:\s+(?:ạ|a|nha|nhé|nhe|em|ơi|oi|nhá|rora|đó|do|nhé|nhá))*[\s\.\!\?]*$',
        clean,
        re.IGNORECASE
    )
    if standalone:
        return standalone.group(1)

    # 2. Các mẫu cụm từ chứa 'phòng' / 'room' / 'p.' / 'số phòng': vd "phòng 402", "room 402", "p.305", "số phòng của tôi là 402", "phòng em là 301"
    pattern_explicit = re.search(
        r'(?:phòng|phong|room|p\.|p|số phòng|so phong)\s*(?:(?:của\s+)?(?:tôi|em|anh|chị|mình|khách)\s*)?(?:là|la|số|so)?\s*([1-9][0-9]{2,3})\b',
        clean,
        re.IGNORECASE
    )
    if pattern_explicit:
        return pattern_explicit.group(1)

    # 3. Các mẫu cư trú: "tôi ở 402", "anh ở 402", "chị ở 402", "em ở 402", "mình ở 402", "i am in 402", "staying in 402"
    pattern_stay = re.search(
        r'(?:tôi ở|anh ở|chị ở|em ở|mình ở|toi o|anh o|chi o|em o|minh o|i am in|i\'m in|staying in)\s*(?:phòng|phong|room)?\s*([1-9][0-9]{2,3})\b',
        clean,
        re.IGNORECASE
    )
    if pattern_stay:
        return pattern_stay.group(1)

    # 4. Khi đang trong trạng thái chờ khách bổ sung số phòng (is_answering_room=True)
    if is_answering_room:
        # Bắt số 3-4 chữ số trong câu (ngoại trừ các năm dương lịch 2020-2035)
        matches = re.findall(r'\b([1-9][0-9]{2,3})\b', clean)
        for m in matches:
            if not (2020 <= int(m) <= 2035):
                return m

    return None


class SessionMemoryManager:
    """
    Quản lý bộ nhớ hội thoại & trạng thái slot (Số phòng, Ý định chờ) theo Session.
    Hỗ trợ cơ chế 3-Tier Session Reset (Thời gian chờ 90s, Ghi đè số phòng, Reset thủ công).
    """

    IDLE_TIMEOUT_SECONDS = 90  # 90 giây không tương tác sẽ tự động xóa bộ nhớ phiên

    def __init__(self):
        # Cache dạng Dict: { session_id: { "chat_history": [...], "room_number": "502", "pending_intent": {...}, "last_active": 1789231 } }
        self._sessions: Dict[str, Dict[str, Any]] = {}

    def _cleanup_expired_sessions(self):
        """Tự động dọn dẹp các session đã quá hạn 90 giây."""
        now = time.time()
        expired_keys = [
            sid
            for sid, sdata in self._sessions.items()
            if now - sdata.get("last_active", now) > self.IDLE_TIMEOUT_SECONDS
        ]
        for sid in expired_keys:
            logger.info(f"[SessionMemory] Session '{sid}' expired after {self.IDLE_TIMEOUT_SECONDS}s idle time.")
            del self._sessions[sid]

    def get_session(self, session_id: str = "default_session") -> Dict[str, Any]:
        """Lấy hoặc khởi tạo mới session data."""
        self._cleanup_expired_sessions()
        now = time.time()

        if session_id not in self._sessions:
            self._sessions[session_id] = {
                "chat_history": [],
                "room_number": None,
                "guest_name": None,
                "pending_intent": None,
                "last_active": now,
            }
        else:
            self._sessions[session_id]["last_active"] = now

        return self._sessions[session_id]

    def add_turn(self, session_id: str, role: str, content: str, language: str = "vi-VN", intent_action: Optional[str] = None):
        """Thêm 1 lượt nói (user/assistant) vào lịch sử phiên trong RAM."""
        session = self.get_session(session_id)
        session["chat_history"].append({
            "role": role,
            "content": content,
            "language": language,
            "intent_action": intent_action,
        })

        # Giữ tối đa 20 lượt nói gần nhất (10 cặp câu hỏi-đáp)
        if len(session["chat_history"]) > 20:
            session["chat_history"] = session["chat_history"][-20:]

    async def flush_session_to_db(self, db, session_id: str) -> bool:
        """
        Đóng gói toàn bộ hội thoại trong RAM của session và ghi xuống PostgreSQL một lần duy nhất (End-of-Session Bulk Persistence).
        Tiết kiệm tài nguyên DB, không gây độ trễ trong lúc robot đang hội thoại trực tiếp.
        """
        session = self._sessions.get(session_id)
        if not session:
            logger.info(f"[SessionMemory DB Flush] No active RAM session for '{session_id}', skipping flush.")
            return False

        chat_history = session.get("chat_history", [])
        if not chat_history:
            logger.info(f"[SessionMemory DB Flush] Session '{session_id}' has empty chat history, skipping flush.")
            return False

        try:
            from app.models.chat_session import ChatSession, ChatMessage
            from sqlalchemy.future import select

            result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
            db_session = result.scalars().first()

            room_num = session.get("room_number")
            guest_name = session.get("guest_name")

            if not db_session:
                db_session = ChatSession(
                    id=session_id,
                    room_number=room_num,
                    guest_name=guest_name,
                    is_active=False,
                )
                db.add(db_session)
                await db.flush()
            else:
                if room_num:
                    db_session.room_number = room_num
                if guest_name:
                    db_session.guest_name = guest_name
                db_session.is_active = False

            # Lấy danh sách tin nhắn hiện có của session để tránh trùng lặp
            existing_res = await db.execute(select(ChatMessage.text, ChatMessage.sender).where(ChatMessage.session_id == session_id))
            existing_pairs = set(existing_res.all())

            new_db_messages = []
            for item in chat_history:
                role = item.get("role", "user")
                content = item.get("content", "")
                lang = item.get("language", "vi-VN")
                intent = item.get("intent_action")

                if (content, role) not in existing_pairs:
                    new_db_messages.append(
                        ChatMessage(
                            session_id=session_id,
                            sender=role,
                            text=content,
                            language=lang,
                            intent_action=intent,
                        )
                    )

            if new_db_messages:
                db.add_all(new_db_messages)
                await db.commit()
                logger.info(f"[SessionMemory DB Flush] Successfully bulk saved {len(new_db_messages)} messages for session '{session_id}' to PostgreSQL.")
            else:
                await db.commit()
                logger.info(f"[SessionMemory DB Flush] All messages for session '{session_id}' were already synced.")

            return True
        except Exception as e:
            logger.error(f"[SessionMemory DB Flush Error] Failed to persist session '{session_id}': {e}")
            await db.rollback()
            return False

    async def save_turn_to_db(self, db, session_id: str, role: str, content: str, language: str = "vi-VN", room_number: Optional[str] = None):
        """[Deprecated] Lưu lẻ 1 lượt hội thoại vào DB. Nên dùng flush_session_to_db khi kết thúc phiên."""
        try:
            from app.models.chat_session import ChatSession, ChatMessage
            from sqlalchemy.future import select

            result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
            db_session = result.scalars().first()

            if not db_session:
                db_session = ChatSession(
                    id=session_id,
                    room_number=room_number,
                    is_active=True,
                )
                db.add(db_session)
                await db.flush()

            if room_number and db_session.room_number != room_number:
                db_session.room_number = room_number

            msg = ChatMessage(
                session_id=session_id,
                sender=role,
                text=content,
                language=language,
            )
            db.add(msg)
            await db.commit()
            logger.info(f"[SessionMemory DB] Persisted chat message ({role}) for session '{session_id}'")
        except Exception as e:
            logger.error(f"[SessionMemory DB Error] {e}")

    def get_history(self, session_id: str = "default_session") -> List[Dict[str, str]]:
        """Lấy danh sách lịch sử hội thoại."""
        session = self.get_session(session_id)
        return session.get("chat_history", [])

    def get_room_number(self, session_id: str = "default_session") -> Optional[str]:
        """Lấy số phòng hiện tại đã ghi nhớ."""
        session = self.get_session(session_id)
        return session.get("room_number")

    def set_room_number(self, session_id: str, room_number: Optional[str]) -> bool:
        """
        Cập nhật và lưu số phòng vào phiên hội thoại (Session Memory).
        Số phòng này được ghi nhớ xuyên suốt toàn bộ phiên nói chuyện đến khi hết phiên hoặc đổi phòng.
        Returns True nếu số phòng thay đổi.
        """
        if not room_number:
            return False

        clean_room = str(room_number).strip()
        session = self.get_session(session_id)
        old_room = session.get("room_number")

        if clean_room != old_room:
            logger.info(f"[SessionMemory] Room set/updated in session '{session_id}': {old_room} -> {clean_room}")
            session["room_number"] = clean_room
            return True

        return False

    def get_pending_intent(self, session_id: str = "default_session") -> Optional[Dict[str, Any]]:
        """Lấy ý định dịch vụ đang chờ bổ sung số phòng."""
        session = self.get_session(session_id)
        return session.get("pending_intent")

    def set_pending_intent(self, session_id: str, intent_data: Optional[Dict[str, Any]]):
        """Lưu ý định dịch vụ đang chờ khách cung cấp số phòng."""
        session = self.get_session(session_id)
        session["pending_intent"] = intent_data
        if intent_data:
            logger.info(f"[SessionMemory] Saved pending service intent for session '{session_id}': {intent_data.get('action')}")
        else:
            logger.info(f"[SessionMemory] Cleared pending intent for session '{session_id}'")

    def clear_pending_intent(self, session_id: str = "default_session"):
        """Xóa ý định dịch vụ chờ sau khi đã xử lý xong hoặc tạo ticket."""
        session = self.get_session(session_id)
        session["pending_intent"] = None

    def reset_session(self, session_id: str = "default_session"):
        """Xoá sạch bộ nhớ phiên (Dùng khi bấm nút Khách Mới / Đổi Phòng)."""
        if session_id in self._sessions:
            del self._sessions[session_id]
            logger.info(f"[SessionMemory] Session '{session_id}' manually reset.")

    async def get_all_db_sessions(self, db) -> List[Dict[str, Any]]:
        """Lấy danh sách các phiên hội thoại (Chat Sessions) đã lưu trong PostgreSQL."""
        from app.models.chat_session import ChatSession
        from sqlalchemy.future import select

        result = await db.execute(select(ChatSession).order_by(ChatSession.updated_at.desc()))
        sessions = result.scalars().all()
        return [
            {
                "id": s.id,
                "room_number": s.room_number,
                "guest_name": s.guest_name,
                "is_active": s.is_active,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            }
            for s in sessions
        ]

    async def get_db_session_messages(self, db, session_id: str) -> List[Dict[str, Any]]:
        """Lấy chi tiết danh sách tin nhắn hội thoại của một phiên từ PostgreSQL."""
        from app.models.chat_session import ChatMessage
        from sqlalchemy.future import select

        result = await db.execute(select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.id.asc()))
        messages = result.scalars().all()
        return [
            {
                "id": m.id,
                "session_id": m.session_id,
                "sender": m.sender,
                "text": m.text,
                "language": m.language,
                "intent_action": m.intent_action,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ]

    async def background_save_turn(self, session_id: str, user_turn: str, ai_turn: str, lang_code: str, room_number: Optional[str]):
        """Lưu lượt hội thoại vào PostgreSQL trong nền, không chặn thời gian phản hồi của Robot."""
        try:
            from app.core.database import AsyncSessionLocal
            async with AsyncSessionLocal() as bg_db:
                await self.save_turn_to_db(bg_db, session_id, "user", user_turn, language=lang_code, room_number=room_number)
                await self.save_turn_to_db(bg_db, session_id, "assistant", ai_turn, language=lang_code, room_number=room_number)
        except Exception as e:
            logger.warning(f"[SessionMemory Background Save Error] {e}")


# Singleton instance toàn hệ thống
session_manager = SessionMemoryManager()
