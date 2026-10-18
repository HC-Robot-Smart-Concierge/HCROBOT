from typing import Optional, List, Sequence
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload

from app.models.staff import Staff
from app.models.department import Department
from app.models.service_type import ServiceType
from app.repositories.base import BaseRepository


class StaffRepository(BaseRepository[Staff]):
    """
    Repository for Staff personnel, Departments, and Service Types.
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db, Staff)

    # ---------------- Staff Members ----------------

    async def get_by_id(self, staff_id: str, load_department: bool = True) -> Optional[Staff]:
        """Fetch staff member by ID with optional department eager loading."""
        stmt = select(Staff).where(Staff.id == staff_id.strip())
        if load_department:
            stmt = stmt.options(selectinload(Staff.department_rel))
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_username(self, username: str, load_department: bool = False) -> Optional[Staff]:
        """Fetch staff member by clean username."""
        clean_user = username.strip().lower()
        stmt = select(Staff).where(func.lower(Staff.username) == clean_user)
        if load_department:
            stmt = stmt.options(selectinload(Staff.department_rel))
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_code(self, code: str) -> Optional[Staff]:
        """Fetch staff member by staff code."""
        stmt = select(Staff).where(Staff.code == code.strip())
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_identifier(self, identifier: str) -> Optional[Staff]:
        """Fetch staff member matching id, username, full_name, or code."""
        target = identifier.strip()
        stmt = select(Staff).where(
            or_(
                Staff.id == target,
                Staff.username == target,
                Staff.full_name == target,
                Staff.code == target,
            )
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def list_staff(
        self,
        department_id: Optional[str] = None,
        department: Optional[str] = None,
        status: Optional[str] = None,
        role: Optional[str] = None,
        include_inactive: bool = False,
    ) -> Sequence[Staff]:
        """Fetch staff roster with filters and eager loaded department_rel."""
        stmt = select(Staff).options(selectinload(Staff.department_rel))
        if not include_inactive:
            stmt = stmt.where(
                Staff.is_active == True,
                Staff.status != "deleted",
                Staff.status != "inactive",
            )
        if department_id and department_id not in ("All", ""):
            stmt = stmt.where(Staff.department_id == department_id.strip())
        elif department and department not in ("All", ""):
            stmt = stmt.join(Staff.department_rel).where(
                or_(
                    Department.name.ilike(f"%{department.strip()}%"),
                    Department.code.ilike(f"%{department.strip()}%"),
                )
            )

        if status and status not in ("All", ""):
            stmt = stmt.where(Staff.status == status.strip())
        if role and role not in ("All", ""):
            stmt = stmt.where(Staff.role == role.strip())

        stmt = stmt.order_by(Staff.department_id, Staff.full_name)

        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def soft_delete_staff(self, staff_id: str) -> Optional[Staff]:
        """Performs soft-delete on a staff account."""
        staff = await self.get_by_id(staff_id, load_department=False)
        if not staff:
            return None
        staff.is_active = False
        staff.status = "inactive"
        staff.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(staff)
        return staff

    async def count_active(self) -> int:
        """Count active staff members."""
        stmt = select(func.count(Staff.id)).where(Staff.is_active == True)
        res = await self.db.execute(stmt)
        return res.scalar() or 0

    async def count_fallback_agents(self) -> int:
        """Count active fallback agents."""
        stmt = select(func.count(Staff.id)).where(
            Staff.is_active == True,
            Staff.is_fallback_agent == True,
        )
        res = await self.db.execute(stmt)
        return res.scalar() or 0

    # ---------------- Departments ----------------

    async def list_departments(self, is_active: Optional[bool] = None) -> Sequence[Department]:
        """Fetch all departments with pre-loaded accounts and service_types."""
        stmt = (
            select(Department)
            .options(
                selectinload(Department.accounts),
                selectinload(Department.service_types),
            )
            .order_by(Department.code)
        )
        if is_active is not None:
            stmt = stmt.where(Department.is_active == is_active)
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_department_by_id_or_code(self, identifier: str) -> Optional[Department]:
        """Fetch department by UUID ID or uppercase code."""
        target = identifier.strip()
        stmt = (
            select(Department)
            .options(
                selectinload(Department.accounts),
                selectinload(Department.service_types),
            )
            .where(
                or_(
                    Department.id == target,
                    Department.code == target.upper(),
                )
            )
        )
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def find_department_by_code(self, code: str) -> Optional[Department]:
        """Fetch department by exact code."""
        stmt = select(Department).where(Department.code == code.strip().upper())
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def find_department_by_name_or_code(self, name_or_code: str) -> Optional[Department]:
        """Search department by partial name or exact code (case-insensitive)."""
        clean = name_or_code.strip().lower()
        stmt = select(Department).where(
            or_(
                func.lower(Department.name).like(f"%{clean}%"),
                func.lower(Department.code) == clean,
            )
        )
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def soft_delete_department(self, identifier: str) -> Optional[Department]:
        """Soft-deletes a department by marking is_active = False."""
        dept = await self.get_department_by_id_or_code(identifier)
        if not dept:
            return None
        dept.is_active = False
        dept.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(dept)
        return dept

    # ---------------- Service Types ----------------

    async def list_service_types(
        self,
        department_id: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Sequence[ServiceType]:
        """Fetch service types with optional department and active filter."""
        stmt = select(ServiceType).options(selectinload(ServiceType.department))
        if department_id:
            stmt = stmt.where(ServiceType.department_id == department_id.strip())
        if is_active is not None:
            stmt = stmt.where(ServiceType.is_active == is_active)
        stmt = stmt.order_by(ServiceType.code)
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def get_service_type_by_code(self, code: str) -> Optional[ServiceType]:
        """Fetch service type by exact code."""
        stmt = select(ServiceType).where(ServiceType.code == code.upper().strip())
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()
