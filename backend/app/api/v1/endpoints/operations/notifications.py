from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from app.services.notification_manager import notification_manager
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc

from app.core.database import get_db
from app.models import Notification
from app.schemas.operations import NotificationCreate, NotificationResponse
from .shared import TAG_NOTIF

router = APIRouter()

# 13. NOTIFICATION CENTER (Phòng ban & Toàn hệ thống)
# =====================================================================

@router.get("/notifications", response_model=List[NotificationResponse], tags=TAG_NOTIF)
async def get_notifications(
    department: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách thông báo được phân tách theo phòng ban.
    - Nhân viên phòng ban nào sẽ nhận thông báo phòng ban đó + thông báo chung 'All'.
    - Quản trị viên/Executive nhận toàn bộ thông báo.
    """
    query = select(Notification)
    if department and department.strip().lower() not in ["all", "admin", "executive", "operations admin", "toàn bộ"]:
        dep_clean = department.strip().lower()
        dept_aliases = [dep_clean]
        if "f&b" in dep_clean or "room" in dep_clean or "ẩm thực" in dep_clean:
            dept_aliases.extend(["f&b", "room service", "room_service", "ẩm thực & f&b"])
        elif "housekeeping" in dep_clean or "buồng" in dep_clean:
            dept_aliases.extend(["housekeeping", "buồng phòng"])
        elif "bell" in dep_clean or "hành lý" in dep_clean:
            dept_aliases.extend(["bell services", "bellman", "bell_services", "vận chuyển hành lý"])
        elif "maint" in dep_clean or "kỹ thuật" in dep_clean or "bảo trì" in dep_clean:
            dept_aliases.extend(["maintenance", "kỹ thuật & bảo trì", "kỹ thuật"])
        elif "reception" in dep_clean or "lễ tân" in dep_clean or "front" in dep_clean:
            dept_aliases.extend(["reception", "lễ tân", "front desk"])

        query = query.where(
            (func.lower(Notification.department).in_(dept_aliases))
            | (Notification.department == "All")
        )

    query = query.order_by(desc(Notification.created_at)).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/notifications", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED, tags=TAG_NOTIF)
async def create_notification_endpoint(
    notif_in: NotificationCreate,
    db: AsyncSession = Depends(get_db),
):
    """Tạo thông báo mới cho phòng ban."""
    notif = await create_department_notification(
        db=db,
        department=notif_in.department,
        title=notif_in.title,
        description=notif_in.description,
        request_id=notif_in.request_id,
        request_type=notif_in.request_type,
        type=notif_in.type,
    )
    await db.commit()
    await db.refresh(notif)
    return notif


@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse, tags=TAG_NOTIF)
async def toggle_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Đánh dấu thông báo đã đọc hoặc chưa đọc."""
    res = await db.execute(select(Notification).where(Notification.id == notification_id))
    notif = res.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông báo")

    notif.is_read = not notif.is_read
    await db.commit()
    await db.refresh(notif)
    return notif


@router.post("/notifications/mark-all-read", tags=TAG_NOTIF)
async def mark_all_notifications_read(
    department: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Đánh dấu toàn bộ thông báo của phòng ban là đã đọc."""
    query = update(Notification).values(is_read=True)
    if department and department.strip().lower() not in ["all", "admin", "executive", "operations admin", "toàn bộ"]:
        dep_clean = department.strip().lower()
        dept_aliases = [dep_clean]
        if "f&b" in dep_clean or "room" in dep_clean:
            dept_aliases.extend(["f&b", "room service", "room_service"])
        elif "housekeeping" in dep_clean:
            dept_aliases.extend(["housekeeping", "buồng phòng"])
        elif "bell" in dep_clean:
            dept_aliases.extend(["bell services", "bellman", "bell_services"])
        elif "maint" in dep_clean:
            dept_aliases.extend(["maintenance", "kỹ thuật & bảo trì"])
        elif "reception" in dep_clean:
            dept_aliases.extend(["reception", "lễ tân"])

        query = query.where(
            (func.lower(Notification.department).in_(dept_aliases))
            | (Notification.department == "All")
        )

    await db.execute(query)
    await db.commit()
    return {"message": "Đã đánh dấu tất cả thông báo là đã đọc", "department": department}


@router.delete("/notifications/{notification_id}", tags=TAG_NOTIF)
async def delete_notification_item(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Xóa thông báo khỏi hệ thống."""
    res = await db.execute(select(Notification).where(Notification.id == notification_id))
    notif = res.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông báo")

    await db.delete(notif)
    await db.commit()
    return {"message": "Đã xóa thông báo thành công", "id": notification_id}


# =====================================================================
# REALTIME NOTIFICATION WEBSOCKET HUB
# =====================================================================

@router.websocket("/ws/notifications")
async def notification_websocket_endpoint(
    websocket: WebSocket,
    department: Optional[str] = Query("All"),
):
    """
    Kênh WebSocket kết nối Real-time cho Trung tâm Thông báo Phòng ban & Điều phối Nghiệp vụ.
    Param: ?department=Housekeeping / F%26B / Bell%20Services / Maintenance / Reception / All
    """
    dept_val = department or "All"
    await notification_manager.connect(websocket, department=dept_val)
    try:
        while True:
            # Lắng nghe keep-alive ping từ client hoặc yêu cầu đổi phòng ban
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        notification_manager.disconnect(websocket, department=dept_val)
    except Exception:
        notification_manager.disconnect(websocket, department=dept_val)




