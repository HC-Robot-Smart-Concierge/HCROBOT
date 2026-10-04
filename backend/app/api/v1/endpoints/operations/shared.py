import asyncio
import logging
import random
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.services.notification_manager import notification_manager
from app.models import (
    Staff,
    ManagementDirective,
    Notification,
    SupportRequest,
    ServiceType,
    Department,
)

# =====================================================================
# TAG CONSTANTS FOR SWAGGER UI DOCS
# =====================================================================

TAG_REC = ["05. Bộ phận Lễ tân & Đặt phòng (Front Desk & Reception)"]
TAG_HK = ["06. Bộ phận Buồng phòng (Housekeeping Operations)"]
TAG_BELL = ["07. Bộ phận Hành lý & Tiền sảnh (Bell Services)"]
TAG_MNT = ["08. Bộ phận Kỹ thuật & Bảo trì (Facility Maintenance)"]
TAG_ROOM_SERVICE = ["09. Bộ phận Phục vụ phòng (Room Service)"]
TAG_FB = TAG_ROOM_SERVICE  # Backward compatibility alias
TAG_KITCHEN = ["10. Bộ phận Bếp & Ẩm thực (Kitchen Operations & Menus)"]
TAG_KITCHEN_FOOD_CATALOG = TAG_KITCHEN
TAG_KITCHEN_MENU = TAG_KITCHEN
TAG_KITCHEN_BOOKING = TAG_KITCHEN
TAG_REST_BOOKING = TAG_KITCHEN
TAG_REST_FOOD_CATALOG = TAG_KITCHEN
TAG_REST_MENU = TAG_KITCHEN
TAG_REST = TAG_KITCHEN  # Backward compatibility alias
TAG_OPS = ["11. Quản lý Chung & Điều phối Nghiệp vụ (Operations & Directives)"]
TAG_ADMIN = ["12. Trung tâm Điều hành & Quản trị (Admin & Human Support)"]
TAG_NOTIF = ["13. Thông báo Hệ thống (Notifications)"]
TAG_STAFF = ["15. Quản lý Phòng ban & Nhân sự (Departments & Staff)"]
TAG_TAXI = ["16. Bộ phận Đặt xe & Vận chuyển (Taxi & Transportation)"]
TAG_CONCIERGE = ["17. Bộ phận Trợ lý Concierge & Live Call (Concierge & Live Support)"]



async def create_department_notification(
    db: AsyncSession,
    department: str,
    title: str,
    description: str,
    request_id: Optional[str] = None,
    request_type: Optional[str] = None,
    type: str = "Request",
) -> Notification:
    """Creates a persistent department-scoped notification for all department staff."""
    notif = Notification(
        department=department,
        title=title,
        description=description,
        request_id=request_id,
        request_type=request_type,
        type=type,
        is_read=False,
    )
    db.add(notif)
    try:
        await db.flush()
    except Exception:
        pass

    # Broadcast real-time qua WebSocket Hub (không chặn tiến trình DB)
    notif_data = {
        "id": str(notif.id) if notif.id else f"NOTIF-{random.randint(1000, 9999)}",
        "department": notif.department,
        "title": notif.title,
        "description": notif.description,
        "request_id": notif.request_id,
        "request_type": notif.request_type,
        "type": notif.type,
        "is_read": False,
        "created_at": datetime.utcnow().isoformat(),
    }
    asyncio.create_task(
        notification_manager.broadcast_notification(notif_data, department=department)
    )
    return notif


async def _fetch_all_raw_requests(db: AsyncSession) -> List[Dict[str, Any]]:
    """Helper to collect and normalize tasks across all operational tables including SupportRequest."""
    unified = []

    # 1. Fetch from SupportRequest table (HK, Bell, Taxi, Maintenance, Concierge, Reception)
    try:
        sr_stmt = (
            select(SupportRequest, ServiceType, Department)
            .outerjoin(ServiceType, SupportRequest.service_type_id == ServiceType.id)
            .outerjoin(Department, SupportRequest.department_id == Department.id)
            .order_by(desc(SupportRequest.created_at))
        )
        sr_res = await db.execute(sr_stmt)
        for sr, st, dep in sr_res.all():
            dep_code = (dep.code if dep else (st.code if st else "")).upper()
            if "HOUSEKEEPING" in dep_code:
                dept_label = "Housekeeping"
                tbl_type = "housekeeping"
            elif "BELL" in dep_code:
                dept_label = "Bell Services"
                tbl_type = "bell"
            elif "TAXI" in dep_code:
                dept_label = "Taxi"
                tbl_type = "taxi"
            elif "MAINTENANCE" in dep_code:
                dept_label = "Maintenance"
                tbl_type = "maintenance"
            elif "CONCIERGE" in dep_code:
                dept_label = "Concierge"
                tbl_type = "concierge"
            elif "RECEPTION" in dep_code:
                dept_label = "Reception"
                tbl_type = "reception"
            elif "FB" in dep_code or "ROOM_SERVICE" in dep_code:
                dept_label = "F&B"
                tbl_type = "room_service"
            else:
                dept_label = dep.name if dep else (st.name if st else "General")
                tbl_type = "support_request"

            raw_ticket = sr.ticket_code or sr.id
            ticket_display = f"REQ-{raw_ticket}" if not str(raw_ticket).startswith("REQ-") else raw_ticket

            room_str = sr.room_number or "Main Lobby"
            loc_label = f"ROOM {room_str}" if room_str.isdigit() else room_str

            unified.append({
                "id": ticket_display,
                "raw_id": sr.id,
                "department": dept_label,
                "table_type": tbl_type,
                "title": sr.title,
                "location": loc_label,
                "guestName": sr.guest_name or "Hotel Guest",
                "priority": sr.priority or (st.default_priority if st else "NORMAL"),
                "status": sr.status or "Pending",
                "time": sr.created_at.strftime("%I:%M %p").lstrip("0") if sr.created_at else "Recent",
                "assignedTo": sr.assigned_staff_name,
                "assigned_robot": sr.assigned_robot_id,
                "notes": sr.description,
                "source": sr.source or "From HCRobot",
                "created_at": sr.created_at,
            })
    except Exception as e:
        logger.error(f"Error fetching SupportRequests: {e}")

    # 2. Directives from ManagementDirective (Chỉ thị vận hành)
    try:
        dir_res = await db.execute(select(ManagementDirective).order_by(desc(ManagementDirective.created_at)))
        for d in dir_res.scalars().all():
            unified.append({
                "id": f"REQ-{d.code}",
                "raw_id": d.id,
                "department": d.department or "Directive",
                "table_type": "directive",
                "title": d.title,
                "location": d.location or "Main Hotel",
                "guestName": "Operations Directive",
                "priority": d.priority or "NORMAL",
                "status": d.status,
                "time": d.reported_time_label or (d.created_at.strftime("%I:%M %p").lstrip("0") if d.created_at else "Recent"),
                "assignedTo": d.assigned_staff_name,
                "assigned_robot": None,
                "notes": d.description,
                "source": f"Admin ({d.created_by})",
                "created_at": d.created_at,
            })
    except Exception as e:
        logger.error(f"Error fetching ManagementDirectives: {e}")


    # Sort all by created_at descending (latest first)
    unified.sort(key=lambda x: x.get("created_at") or datetime.min, reverse=True)
    return unified

