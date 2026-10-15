from typing import Optional, List, Sequence, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.workflow import RobotWaypoint, RobotZone
from app.models.map import Map
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

    # ---------------- SLAM Map Records ----------------

    async def get_map_by_id(self, map_id: str) -> Optional[Map]:
        """Fetch SLAM map record by ID."""
        stmt = select(Map).where(Map.id == map_id.strip())
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def upsert_map(
        self,
        map_id: str,
        name: str,
        floor: str,
        resolution: float,
        width: int,
        height: int,
        origin_x: float,
        origin_y: float,
        image_url: str,
    ) -> Map:
        """Upsert a SLAM occupancy grid map metadata."""
        db_map = await self.get_map_by_id(map_id)
        if db_map:
            db_map.name = name
            db_map.floor = floor
            db_map.resolution = resolution
            db_map.width = width
            db_map.height = height
            db_map.origin_x = origin_x
            db_map.origin_y = origin_y
            db_map.image_url = image_url
        else:
            db_map = Map(
                id=map_id,
                name=name,
                floor=floor,
                resolution=resolution,
                width=width,
                height=height,
                origin_x=origin_x,
                origin_y=origin_y,
                image_url=image_url,
            )
            self.db.add(db_map)
        await self.db.commit()
        await self.db.refresh(db_map)
        return db_map
