from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from app.services.notification_manager import notification_manager
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.operations import NotificationCreate, NotificationResponse
from app.repositories import NotificationRepository, get_notification_repository
from .shared import TAG_NOTIF, create_department_notification

router = APIRouter()

# 13. NOTIFICATION CENTER (Phòng ban & Toàn hệ thống)
# =====================================================================

@router.get("/notifications", response_model=List[NotificationResponse], tags=TAG_NOTIF)
async def get_notifications(
    department: Optional[str] = None,
    limit: int = 50,
    repo: NotificationRepository = Depends(get_notification_repository),
):
    """
    Lấy danh sách thông báo được phân tách theo phòng ban.
    - Nhân viên phòng ban nào sẽ nhận thông báo phòng ban đó + thông báo chung 'All'.
    - Quản trị viên/Executive nhận toàn bộ thông báo.
    """
    return await repo.list_notifications(department=department, limit=limit)


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
    repo: NotificationRepository = Depends(get_notification_repository),
):
    """Đánh dấu thông báo đã đọc hoặc chưa đọc."""
    notif = await repo.toggle_read(notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông báo")
    return notif


@router.post("/notifications/mark-all-read", tags=TAG_NOTIF)
async def mark_all_notifications_read(
    department: Optional[str] = None,
    repo: NotificationRepository = Depends(get_notification_repository),
):
    """Đánh dấu toàn bộ thông báo của phòng ban là đã đọc."""
    await repo.mark_all_read(department=department)
    return {"message": "Đã đánh dấu tất cả thông báo là đã đọc", "department": department}


@router.delete("/notifications/{notification_id}", tags=TAG_NOTIF)
async def delete_notification_item(
    notification_id: str,
    repo: NotificationRepository = Depends(get_notification_repository),
):
    """Xóa thông báo khỏi hệ thống."""
    notif = await repo.get_by_id(notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông báo")

    await repo.delete(notif, autocommit=True)
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




