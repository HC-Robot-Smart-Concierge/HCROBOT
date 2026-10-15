from typing import Optional, List, Sequence, Tuple
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_, func
from sqlalchemy.orm import selectinload

from app.models.support_request import SupportRequest
from app.models.service_type import ServiceType
from app.models.department import Department
from app.repositories.base import BaseRepository


class SupportRequestRepository(BaseRepository[SupportRequest]):
    """
    Repository for managing SupportRequest domain entities across all operational
    departments (Reception, Housekeeping, Bell, Maintenance, Concierge, Taxi, Room Service).
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db, SupportRequest)

    async def get_by_id_or_code(self, identifier: str) -> Optional[SupportRequest]:
        """
        Finds a SupportRequest by system UUID id, or by ticket_code (e.g. REC-123, REQ-REC-123).
        Handles prefix normalizations gracefully.
        """
        target = identifier.strip()
        clean = (
            target.replace("REQ-", "")
            .replace("REC-", "")
            .replace("HK-", "")
            .replace("BELL-", "")
            .replace("MNT-", "")
            .replace("TX-", "")
            .replace("ORD-", "")
            .strip()
        )

        candidates = [
            target,
            clean,
            f"REC-{clean}",
            f"HK-{clean}",
            f"BELL-{clean}",
            f"MNT-{clean}",
            f"TX-{clean}",
            f"ORD-{clean}",
            f"REQ-{clean}",
        ]

        stmt = select(SupportRequest).where(
            or_(
                SupportRequest.id.in_(candidates),
                SupportRequest.ticket_code.in_(candidates),
            )
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_active_by_department(
        self,
        department_ids: List[str],
        service_type_ids: List[str],
    ) -> Optional[SupportRequest]:
        """
        Retrieves the highest priority/most recent in-progress or pending request
        excluding finalized statuses.
        """
        excluded_statuses = [
            "completed",
            "done",
            "cancelled",
            "delivered",
            "hoàn tất",
            "đã hoàn thành",
            "hủy",
        ]
        stmt = (
            select(SupportRequest)
            .where(
                or_(
                    SupportRequest.department_id.in_(department_ids),
                    SupportRequest.service_type_id.in_(service_type_ids),
                ),
                func.lower(SupportRequest.status).notin_(excluded_statuses),
            )
            .order_by(
                desc(func.lower(SupportRequest.status) == "in progress"),
                desc(SupportRequest.created_at),
            )
            .limit(1)
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_recent_by_department(
        self,
        department_ids: List[str],
        service_type_ids: List[str],
        limit: int = 10,
    ) -> Sequence[SupportRequest]:
        """
        Retrieves recent requests for the given department / service types.
        """
        stmt = (
            select(SupportRequest)
            .where(
                or_(
                    SupportRequest.department_id.in_(department_ids),
                    SupportRequest.service_type_id.in_(service_type_ids),
                )
            )
            .order_by(desc(SupportRequest.created_at))
            .limit(limit)
        )
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def close_expired_pending(
        self,
        department_ids: List[str],
        service_type_ids: List[str],
        cutoff_time: datetime,
        new_status: str = "Missed",
    ) -> int:
        """Closes pending requests older than cutoff_time."""
        from sqlalchemy import update
        now = datetime.utcnow()
        stmt = (
            update(SupportRequest)
            .where(
                or_(
                    SupportRequest.department_id.in_(department_ids),
                    SupportRequest.service_type_id.in_(service_type_ids),
                ),
                SupportRequest.status == "Pending",
                SupportRequest.created_at < cutoff_time,
            )
            .values(status=new_status, updated_at=now)
        )
        res = await self.db.execute(stmt)
        await self.db.commit()
        return res.rowcount or 0

    async def get_active_live_call(
        self,
        department_ids: List[str],
        service_type_ids: List[str],
        active_statuses: Optional[List[str]] = None,
    ) -> Optional[SupportRequest]:
        """Gets the most recent live call in pending or active status."""
        statuses = active_statuses or ["Pending", "In Progress", "Connected"]
        stmt = (
            select(SupportRequest)
            .where(
                or_(
                    SupportRequest.department_id.in_(department_ids),
                    SupportRequest.service_type_id.in_(service_type_ids),
                ),
                SupportRequest.status.in_(statuses),
            )
            .order_by(desc(SupportRequest.created_at))
            .limit(1)
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def count_active_live_calls(
        self,
        department_ids: List[str],
        service_type_ids: List[str],
        active_statuses: Optional[List[str]] = None,
    ) -> int:
        """Counts active calls."""
        statuses = active_statuses or ["Pending", "In Progress", "Connected"]
        stmt = (
            select(func.count(SupportRequest.id))
            .where(
                or_(
                    SupportRequest.department_id.in_(department_ids),
                    SupportRequest.service_type_id.in_(service_type_ids),
                ),
                SupportRequest.status.in_(statuses),
            )
        )
        res = await self.db.execute(stmt)
        return res.scalar() or 0

    async def list_by_department_and_status(
        self,
        department_ids: List[str],
        service_type_ids: List[str],
        status: Optional[str] = None,
    ) -> Sequence[SupportRequest]:
        """List requests by department and optional status."""
        stmt = (
            select(SupportRequest)
            .where(
                or_(
                    SupportRequest.department_id.in_(department_ids),
                    SupportRequest.service_type_id.in_(service_type_ids),
                )
            )
            .order_by(desc(SupportRequest.created_at))
        )
        if status and status not in ("All", ""):
            stmt = stmt.where(SupportRequest.status == status)
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def list_all_with_relations(self) -> Sequence[Tuple[SupportRequest, Optional[ServiceType], Optional[Department]]]:
        """
        Retrieves all support requests joined with ServiceType and Department for unified dashboards.
        """
        stmt = (
            select(SupportRequest, ServiceType, Department)
            .outerjoin(ServiceType, SupportRequest.service_type_id == ServiceType.id)
            .outerjoin(Department, SupportRequest.department_id == Department.id)
            .order_by(desc(SupportRequest.created_at))
        )
        res = await self.db.execute(stmt)
        return res.all()
