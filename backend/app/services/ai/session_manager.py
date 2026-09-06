import time
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


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

    def add_turn(self, session_id: str, role: str, content: str):
        """Thêm 1 lượt nói (user/assistant) vào lịch sử phiên."""
        session = self.get_session(session_id)
        session["chat_history"].append({"role": role, "content": content})

        # Giữ tối đa 16 lượt nói gần nhất (8 cặp câu hỏi-đáp)
        if len(session["chat_history"]) > 16:
            session["chat_history"] = session["chat_history"][-16:]

    async def save_turn_to_db(self, db, session_id: str, role: str, content: str, language: str = "vi-VN", room_number: Optional[str] = None):
        """Lưu 1 lượt hội thoại vào PostgreSQL Database (bảng chat_sessions & chat_messages)."""
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
        Cập nhật số phòng. Nếu có số phòng mới khác số phòng cũ -> Ghi đè & Reset pending intent cũ.
        Returns True nếu số phòng thay đổi.
        """
        session = self.get_session(session_id)
        old_room = session.get("room_number")

        if room_number and room_number != old_room:
            logger.info(f"[SessionMemory] Room updated in session '{session_id}': {old_room} -> {room_number}")
            session["room_number"] = room_number
            return True

        if room_number:
            session["room_number"] = room_number

        return False

    def get_pending_intent(self, session_id: str = "default_session") -> Optional[Dict[str, Any]]:
        """Lấy ý định dịch vụ đang chờ số phòng."""
        session = self.get_session(session_id)
        return session.get("pending_intent")

    def set_pending_intent(self, session_id: str, intent_data: Optional[Dict[str, Any]]):
        """Lưu hoặc xoá ý định dịch vụ đang chờ số phòng."""
        session = self.get_session(session_id)
        session["pending_intent"] = intent_data

    def reset_session(self, session_id: str = "default_session"):
        """Xoá sạch bộ nhớ phiên (Dùng khi bấm nút Khách Mới / Đổi Phòng)."""
        if session_id in self._sessions:
            del self._sessions[session_id]
            logger.info(f"[SessionMemory] Session '{session_id}' manually reset.")


# Singleton instance toàn hệ thống
session_manager = SessionMemoryManager()
