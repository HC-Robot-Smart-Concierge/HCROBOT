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
TAG_STAFF = ["14. Nhân sự & Quản lý Đội ngũ (Staff Directory)"]


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
    """Helper to collect and normalize tasks across all 6 operational tables."""
    orders_res = await db.execute(select(RoomServiceOrder).order_by(desc(RoomServiceOrder.created_at)))
    hk_res = await db.execute(select(HousekeepingRequest).order_by(desc(HousekeepingRequest.created_at)))
    bell_res = await db.execute(select(BellRequest).order_by(desc(BellRequest.created_at)))
    maint_res = await db.execute(select(MaintenanceRequest).order_by(desc(MaintenanceRequest.created_at)))
    reception_res = await db.execute(select(ReceptionRequest).order_by(desc(ReceptionRequest.created_at)))
    dir_res = await db.execute(select(ManagementDirective).order_by(desc(ManagementDirective.created_at)))

    unified = []

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
            "time": "Recent",
            "assignedTo": o.assigned_staff_name,
            "assigned_robot": o.assigned_robot_id,
            "notes": o.note,
            "source": "Guest / Robot App",
            "created_at": o.created_at,
        })

    for h in hk_res.scalars().all():
        unified.append({
            "id": f"REQ-{h.ticket_code}",
            "raw_id": h.id,
            "department": "Housekeeping",
            "table_type": "housekeeping",
            "title": h.title,
            "location": f"ROOM {h.room_number}" if not str(h.room_number).upper().startswith("ROOM") else h.room_number,
            "guestName": h.guest_name or "Guest",
            "priority": "NORMAL",
            "status": h.status,
            "time": h.time_label,
            "assignedTo": h.assigned_staff_name,
            "assigned_robot": None,
            "notes": h.description,
            "source": h.source or "HCRobot",
            "created_at": h.created_at,
        })

    for b in bell_res.scalars().all():
        unified.append({
            "id": f"REQ-{b.ticket_code}",
            "raw_id": b.id,
            "department": "Bell Services",
            "table_type": "bell",
            "title": b.title,
            "location": b.location,
            "guestName": b.guest_name or b.reporter or "Guest",
            "priority": "NORMAL",
            "status": b.status,
            "time": "Today",
            "assignedTo": b.assigned_to,
            "assigned_robot": b.assigned_robot_id,
            "notes": b.description,
            "source": "Front Desk / Robot",
            "created_at": b.created_at,
        })

    for m in maint_res.scalars().all():
        unified.append({
            "id": f"REQ-{m.ticket_code}",
            "raw_id": m.id,
            "department": "Maintenance",
            "table_type": "maintenance",
            "title": m.title,
            "location": m.location,
            "guestName": "Guest / Staff Reported",
            "priority": "NORMAL",
            "status": m.status,
            "time": m.reported_time_label,
            "assignedTo": m.assigned_to,
            "assigned_robot": None,
            "notes": m.description,
            "source": m.source or "HCRobot",
            "created_at": m.created_at,
        })

    for r in reception_res.scalars().all():
        unified.append({
            "id": r.ticket_code if str(r.ticket_code).startswith("REQ-") else f"REQ-{r.ticket_code}",
            "raw_id": r.id,
            "department": "Reception",
            "table_type": "reception",
            "title": r.title,
            "location": r.location,
            "guestName": r.guest_name or "Guest",
            "priority": "NORMAL",
            "status": r.status,
            "time": r.created_label,
            "assignedTo": r.assigned_to,
            "assigned_robot": None,
            "notes": r.description,
            "source": "Front Desk",
            "created_at": r.created_at,
        })

    for d in dir_res.scalars().all():
        unified.append({
            "id": f"REQ-{d.code}",
            "raw_id": d.id,
            "department": d.department or "Directive",
            "title": d.title,
            "location": d.location,
            "guestName": "Operations Directive",
            "priority": "NORMAL",
            "status": d.status,
            "time": d.reported_time_label,
            "assignedTo": d.assigned_staff_name,
            "assigned_robot": None,
            "notes": d.description,
            "source": f"Admin ({d.created_by})",
            "created_at": d.created_at,
        })

    return unified
