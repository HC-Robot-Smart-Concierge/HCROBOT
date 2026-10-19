from typing import Optional, List, Sequence, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.workflow import RobotWaypoint, RobotZone
from app.repositories.base import BaseRepository


class MapRepository(BaseRepository[RobotWaypoint]):
    """
    Repository for Robot Waypoints, Functional Zones, and SLAM Maps.
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db, RobotWaypoint)

    # ---------------- Waypoints ----------------

    async def list_waypoints(self) -> Sequence[RobotWaypoint]:
        """Fetch all waypoints ordered by creation time."""
        stmt = select(RobotWaypoint).order_by(RobotWaypoint.created_at)
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_waypoint_by_id(self, waypoint_id: str) -> Optional[RobotWaypoint]:
        """Fetch a waypoint by ID."""
        stmt = select(RobotWaypoint).where(RobotWaypoint.id == waypoint_id.strip())
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def save_or_update_waypoint(
        self,
        id: str,
        name: str,
        x: float,
        y: float,
        yaw: float,
        floor: str,
        type: str = "WAYPOINT",
        description: str = "",
    ) -> RobotWaypoint:
        """Create or update a waypoint coordinate."""
        existing = await self.get_waypoint_by_id(id)
        if existing:
            existing.name = name
            existing.x = x
            existing.y = y
            existing.yaw = yaw
            existing.floor = floor
            existing.type = type or existing.type or "WAYPOINT"
            existing.description = description
            await self.db.commit()
            await self.db.refresh(existing)
            return existing
        else:
            new_wp = RobotWaypoint(
                id=id,
                name=name,
                x=x,
                y=y,
                yaw=yaw,
                floor=floor,
                type=type or "WAYPOINT",
                description=description,
            )
            self.db.add(new_wp)
            await self.db.commit()
            await self.db.refresh(new_wp)
            return new_wp

    async def delete_waypoint(self, waypoint_id: str) -> bool:
        """Delete a waypoint by ID."""
        existing = await self.get_waypoint_by_id(waypoint_id)
        if not existing:
            return False
        await self.db.delete(existing)
        await self.db.commit()
        return True

    # ---------------- Zones ----------------

    async def list_zones(self) -> Sequence[RobotZone]:
        """Fetch all functional zones ordered by creation time."""
        stmt = select(RobotZone).order_by(RobotZone.created_at)
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_zone_by_id(self, zone_id: str) -> Optional[RobotZone]:
        """Fetch a zone by ID."""
        stmt = select(RobotZone).where(RobotZone.id == zone_id.strip())
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def save_or_update_zone(
        self,
        id: str,
        name: str,
        x: float,
        y: float,
        width: float,
        height: float,
        type: str = "KEEP_OUT",
        speed_limit: float = 0.3,
        floor: str = "Sảnh Tầng 1",
        description: str = "",
    ) -> RobotZone:
        """Create or update a functional zone."""
        existing = await self.get_zone_by_id(id)
        if existing:
            existing.name = name
            existing.type = type or "KEEP_OUT"
            existing.x = x
            existing.y = y
            existing.width = width
            existing.height = height
            existing.speed_limit = speed_limit
            existing.floor = floor
            existing.description = description
            await self.db.commit()
            await self.db.refresh(existing)
            return existing
        else:
            new_z = RobotZone(
                id=id,
                name=name,
                type=type or "KEEP_OUT",
                x=x,
                y=y,
                width=width,
                height=height,
                speed_limit=speed_limit,
                floor=floor,
                description=description,
            )
            self.db.add(new_z)
            await self.db.commit()
            await self.db.refresh(new_z)
            return new_z

    async def delete_zone(self, zone_id: str) -> bool:
        """Delete a functional zone by ID."""
        existing = await self.get_zone_by_id(zone_id)
        if not existing:
            return False
        await self.db.delete(existing)
        await self.db.commit()
        return True
