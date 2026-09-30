import asyncio
import random
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.services.notification_manager import notification_manager
from app.models import (
    Staff,
    RoomServiceOrder,
    HousekeepingRequest,
    BellRequest,
    MaintenanceRequest,
    ManagementDirective,
    ReceptionRequest,
    Notification,
)

# =====================================================================
# TAG CONSTANTS FOR SWAGGER UI DOCS
# =====================================================================

TAG_REC = ["05. Bộ phận Lễ tân & Tiền sảnh (Reception Operations)"]
TAG_FB = ["06. Bộ phận Phục vụ phòng (F&B / Room Service)"]
TAG_HK = ["07. Bộ phận Buồng phòng (Housekeeping Operations)"]
TAG_BELL = ["08. Bộ phận Hành lý & Tiền sảnh (Bell Services)"]
TAG_MNT = ["09. Bộ phận Kỹ thuật & Bảo trì (Facility Maintenance)"]
TAG_REST = ["10. Bộ phận Nhà hàng (Restaurant - Đặt bàn & Đặt món)"]
TAG_OPS = ["11. Quản lý Chung & Điều phối Nghiệp vụ (Operations & Directives)"]
TAG_ADMIN = ["12. Trung tâm Điều hành & Quản trị (Admin & Human Support)"]
TAG_NOTIF = ["13. Thông báo Hệ thống (Notifications)"]
TAG_STAFF = ["15. Quản lý Nhân sự & Đội ngũ (Staff Directory)"]


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
    """Helper to collect and normalize tasks across all unified operational tables."""
    orders_res = await db.execute(select(RoomServiceOrder).order_by(desc(RoomServiceOrder.created_at)))
    from app.models.support_request import SupportRequest
    sr_res = await db.execute(select(SupportRequest).order_by(desc(SupportRequest.created_at)))
    dir_res = await db.execute(select(ManagementDirective).order_by(desc(ManagementDirective.created_at)))

    unified = []

    # 1. F&B Orders
    for o in orders_res.scalars().all():
        unified.append({
            "id": f"REQ-{o.order_number}",
            "raw_id": o.id,
            "department": "F&B",
            "table_type": "room_service",
            "title": f"Order #{o.order_number}: {', '.join([i.get('name', 'Item') for i in o.items]) if o.items else 'Room Service'}",
            "location": o.room_number,
            "guestName": "Room Guest",
            "priority": "NORMAL",
            "status": o.status,
            "time": o.created_at.strftime("%I:%M %p").lstrip("0") if o.created_at else "Recent",
            "assignedTo": o.assigned_staff_name,
            "assigned_robot": o.assigned_robot_id,
            "notes": o.note,
            "source": "Guest / Robot App",
            "created_at": o.created_at,
        })

    # 2. Unified Support Requests (Housekeeping, Bell Services, Maintenance, Reception)
    for s in sr_res.scalars().all():
        dept_id = (s.department_id or "").upper()
        code = (s.ticket_code or "").upper()

        if "HOUSEKEEPING" in dept_id or code.startswith("HK"):
            dept_name = "Housekeeping"
            tbl_type = "housekeeping"
        elif "BELL" in dept_id or code.startswith("BS"):
            dept_name = "Bell Services"
            tbl_type = "bell"
        elif "MAINTENANCE" in dept_id or code.startswith("MN"):
            dept_name = "Maintenance"
            tbl_type = "maintenance"
        elif "RECEPTION" in dept_id or code.startswith("REC") or code.startswith("REQ"):
            dept_name = "Reception"
            tbl_type = "reception"
        else:
            dept_name = s.department_id or "Operations"
            tbl_type = "support_request"

        room_str = s.room_number or "Main Lobby"
        if room_str.isdigit():
            loc_label = f"ROOM {room_str}"
        else:
            loc_label = room_str

        unified.append({
            "id": s.ticket_code if str(s.ticket_code).startswith("REQ-") else f"REQ-{s.ticket_code}",
            "raw_id": s.id,
            "department": dept_name,
            "table_type": tbl_type,
            "title": s.title,
            "location": loc_label,
            "guestName": s.guest_name or "Guest",
            "priority": s.priority or "NORMAL",
            "status": s.status or "Pending",
            "time": s.created_at.strftime("%I:%M %p").lstrip("0") if s.created_at else "Recent",
            "assignedTo": s.assigned_staff_name,
            "assigned_robot": s.assigned_robot_id,
            "notes": s.description,
            "source": s.source or "HCRobot",
            "created_at": s.created_at,
        })

    # 3. Management Directives
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
            "status": d.status or "Unassigned",
            "time": d.reported_time_label or (d.created_at.strftime("%I:%M %p").lstrip("0") if d.created_at else "Recent"),
            "assignedTo": d.assigned_staff_name,
            "assigned_robot": None,
            "notes": d.description,
            "source": f"Admin ({d.created_by})",
            "created_at": d.created_at,
        })

    return unified

