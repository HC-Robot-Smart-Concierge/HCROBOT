from fastapi import APIRouter

from .shared import (
    TAG_REC,
    TAG_FB,
    TAG_HK,
    TAG_BELL,
    TAG_MNT,
    TAG_REST,
    TAG_OPS,
    TAG_ADMIN,
    TAG_NOTIF,
    TAG_STAFF,
    create_department_notification,
    _fetch_all_raw_requests,
)
from .reception import router as reception_router
from .room_service import router as room_service_router
from .housekeeping import router as housekeeping_router
from .bell_services import router as bell_services_router
from .maintenance import router as maintenance_router
from .restaurant import router as restaurant_router
from .admin_ops import router as admin_ops_router
from .staff import router as staff_router
from .notifications import router as notifications_router
from .robot_control import router as robot_control_router

router = APIRouter()

router.include_router(reception_router)
router.include_router(room_service_router)
router.include_router(housekeeping_router)
router.include_router(bell_services_router)
router.include_router(maintenance_router)
router.include_router(restaurant_router)
router.include_router(admin_ops_router)
router.include_router(staff_router)
router.include_router(notifications_router)
router.include_router(robot_control_router)

__all__ = [
    "router",
    "create_department_notification",
    "_fetch_all_raw_requests",
    "TAG_REC",
    "TAG_FB",
    "TAG_HK",
    "TAG_BELL",
    "TAG_MNT",
    "TAG_REST",
    "TAG_OPS",
    "TAG_ADMIN",
    "TAG_NOTIF",
    "TAG_STAFF",
]
