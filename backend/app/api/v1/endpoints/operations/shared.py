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
    SupportRequest,
    ServiceType,
    Department,
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
TAG_STAFF = ["15. Quản lý Phòng ban & Nhân sự (Departments & Staff)"]


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

    # 1. Fetch from new SupportRequest table (5 canonical service categories: HK, Bell, Taxi, Maintenance, Reception)
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
            elif "BELL" in dep_code:
                dept_label = "Bell Services"
            elif "TAXI" in dep_code:
                dept_label = "Taxi"
            elif "MAINTENANCE" in dep_code:
                dept_label = "Maintenance"
            elif "RECEPTION" in dep_code:
                dept_label = "Reception"
            elif "FB" in dep_code or "ROOM_SERVICE" in dep_code:
                dept_label = "F&B"
            else:
                dept_label = dep.name if dep else (st.name if st else "General")

            raw_ticket = sr.ticket_code or sr.id
            ticket_display = f"REQ-{raw_ticket}" if not str(raw_ticket).startswith("REQ-") else raw_ticket

            unified.append({
                "id": ticket_display,
                "raw_id": sr.id,
                "department": dept_label,
                "table_type": "support_request",
                "title": sr.title,
                "location": sr.room_number or "Lobby",
                "guestName": sr.guest_name or "Hotel Guest",
                "priority": sr.priority or (st.default_priority if st else "NORMAL"),
                "status": sr.status or "Pending",
                "time": "Recent",
                "assignedTo": sr.assigned_staff_name,
                "assigned_robot": sr.assigned_robot_id,
                "notes": sr.description,
                "source": sr.source or "From HCRobot",
                "created_at": sr.created_at,
            })
    except Exception as e:
        # Prevent failure if schema is updating
        pass

    # 2. Orders from RoomServiceOrder (F&B / ẩm thực phòng)
    try:
        orders_res = await db.execute(select(RoomServiceOrder).order_by(desc(RoomServiceOrder.created_at)))
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
    except Exception:
        pass

    # 3. Directives from ManagementDirective (Chỉ thị vận hành)
    try:
        dir_res = await db.execute(select(ManagementDirective).order_by(desc(ManagementDirective.created_at)))
        for d in dir_res.scalars().all():
            unified.append({
                "id": f"REQ-{d.code}",
                "raw_id": d.id,
                "department": d.department or "Directive",
                "table_type": "directive",
                "title": d.title,
                "location": d.location,
                "guestName": "Operations Directive",
                "priority": d.priority or "NORMAL",
                "status": d.status,
                "time": d.reported_time_label,
                "assignedTo": d.assigned_staff_name,
                "assigned_robot": None,
                "notes": d.description,
                "source": f"Admin ({d.created_by})",
                "created_at": d.created_at,
            })
    except Exception:
        pass

    # 4. Backward-compatibility: Legacy operational tables (if any rows exist)
    try:
        hk_res = await db.execute(select(HousekeepingRequest).order_by(desc(HousekeepingRequest.created_at)))
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
    except Exception:
        pass

    try:
        bell_res = await db.execute(select(BellRequest).order_by(desc(BellRequest.created_at)))
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
    except Exception:
        pass

    try:
        maint_res = await db.execute(select(MaintenanceRequest).order_by(desc(MaintenanceRequest.created_at)))
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
    except Exception:
        pass

    try:
        reception_res = await db.execute(select(ReceptionRequest).order_by(desc(ReceptionRequest.created_at)))
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
    except Exception:
        pass

    # Sort all by created_at descending (latest first)
    unified.sort(key=lambda x: x.get("created_at") or datetime.min, reverse=True)
    return unified
