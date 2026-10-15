from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.base import BaseRepository
from app.repositories.support_request_repository import SupportRequestRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.room_service_repository import RoomServiceRepository
from app.repositories.staff_repository import StaffRepository
from app.repositories.kitchen_repository import KitchenRepository
from app.repositories.workflow_repository import WorkflowRepository
from app.repositories.directive_repository import DirectiveRepository
from app.repositories.support_session_repository import SupportSessionRepository
from app.repositories.map_repository import MapRepository
from app.repositories.audit_log_repository import AuditLogRepository


def get_support_request_repository(db: AsyncSession = Depends(get_db)) -> SupportRequestRepository:
    return SupportRequestRepository(db)


def get_notification_repository(db: AsyncSession = Depends(get_db)) -> NotificationRepository:
    return NotificationRepository(db)


def get_room_service_repository(db: AsyncSession = Depends(get_db)) -> RoomServiceRepository:
    return RoomServiceRepository(db)


def get_staff_repository(db: AsyncSession = Depends(get_db)) -> StaffRepository:
    return StaffRepository(db)


def get_kitchen_repository(db: AsyncSession = Depends(get_db)) -> KitchenRepository:
    return KitchenRepository(db)


def get_workflow_repository(db: AsyncSession = Depends(get_db)) -> WorkflowRepository:
    return WorkflowRepository(db)


def get_directive_repository(db: AsyncSession = Depends(get_db)) -> DirectiveRepository:
    return DirectiveRepository(db)


def get_support_session_repository(db: AsyncSession = Depends(get_db)) -> SupportSessionRepository:
    return SupportSessionRepository(db)


def get_map_repository(db: AsyncSession = Depends(get_db)) -> MapRepository:
    return MapRepository(db)


def get_audit_log_repository(db: AsyncSession = Depends(get_db)) -> AuditLogRepository:
    return AuditLogRepository(db)


__all__ = [
    "BaseRepository",
    "SupportRequestRepository",
    "NotificationRepository",
    "RoomServiceRepository",
    "StaffRepository",
    "KitchenRepository",
    "WorkflowRepository",
    "DirectiveRepository",
    "SupportSessionRepository",
    "MapRepository",
    "AuditLogRepository",
    "get_support_request_repository",
    "get_notification_repository",
    "get_room_service_repository",
    "get_staff_repository",
    "get_kitchen_repository",
    "get_workflow_repository",
    "get_directive_repository",
    "get_support_session_repository",
    "get_map_repository",
    "get_audit_log_repository",
]
