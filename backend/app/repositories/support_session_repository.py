from typing import Optional, Sequence
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_, func

from app.models.support import HumanSupportSession
from app.models.chat_session import ChatSession, ChatMessage
from app.repositories.base import BaseRepository


class SupportSessionRepository(BaseRepository[HumanSupportSession]):
    """
    Repository for HumanSupportSession entities (live video calls, Cloudinary recordings) and chat metrics.
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db, HumanSupportSession)

    async def list_sessions(
        self,
        limit: int = 50,
        status: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> Sequence[HumanSupportSession]:
        """Fetch human support sessions ordered by creation date."""
        active_status = status_filter if status_filter is not None else status
        stmt = select(HumanSupportSession).order_by(desc(HumanSupportSession.created_at)).limit(limit)
        if active_status and active_status.lower() != "all":
            stmt = stmt.where(HumanSupportSession.status.ilike(f"%{active_status}%"))
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_by_id_or_code(self, identifier: str) -> Optional[HumanSupportSession]:
        """Fetch session by ID, session_code, or linked_request_id."""
        target = identifier.strip()
        stmt = select(HumanSupportSession).where(
            or_(
                HumanSupportSession.id == target,
                HumanSupportSession.session_code == target,
                HumanSupportSession.linked_request_id == target,
                HumanSupportSession.room_number.ilike(f"%{target}%"),
            )
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_linked_request(self, request_id: str) -> Optional[HumanSupportSession]:
        """Fetch session linked to a specific support request ID."""
        stmt = select(HumanSupportSession).where(HumanSupportSession.linked_request_id == request_id)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def count_chat_sessions(self) -> int:
        """Count total AI chat sessions."""
        try:
            stmt = select(func.count(ChatSession.id))
            res = await self.db.execute(stmt)
            return res.scalar() or 0
        except Exception:
            return 0

    async def count_chat_messages(self) -> int:
        """Count total AI chat messages."""
        try:
            stmt = select(func.count(ChatMessage.id))
            res = await self.db.execute(stmt)
            return res.scalar() or 0
        except Exception:
            return 0
