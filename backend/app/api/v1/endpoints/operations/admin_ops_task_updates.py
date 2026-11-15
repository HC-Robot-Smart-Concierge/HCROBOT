import asyncio
import re
from datetime import datetime
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories import (
    DirectiveRepository,
    RoomServiceRepository,
    StaffRepository,
    SupportRequestRepository,
    get_directive_repository,
    get_room_service_repository,
    get_staff_repository,
    get_support_request_repository,
)
from app.services.notification_manager import notification_manager
from .shared import TAG_OPS, create_department_notification

router = APIRouter()


async def _find_with_prefixes(lookup_fn, raw_id: str, no_req_id: str, core_id: str, *, min_core: int = 1):
    item = await lookup_fn(raw_id)
    if not item and no_req_id:
        item = await lookup_fn(no_req_id)
    if not item and core_id and len(core_id) >= min_core:
        item = await lookup_fn(core_id)
    return item


def _mark_extra_data_reject(record, reason: str) -> None:
    new_extra = dict(record.extra_data or {})
    new_extra["reject_reason"] = reason
    record.extra_data = new_extra
    try:
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(record, "extra_data")
    except Exception:
        pass


def _resolve_progress(target_progress_in: Any, st_lower: str, is_pending: bool) -> int:
    if target_progress_in is not None:
        try:
            return int(target_progress_in)
        except (ValueError, TypeError):
            return 50
    if st_lower in ["completed", "delivered", "done", "hoàn tất", "hoàn thành"]:
        return 100
    if st_lower in ["delivering", "đang giao", "giao phòng"]:
        return 85
    if st_lower in ["ready", "food ready", "đã nấu xong", "sẵn sàng", "món đã xong"]:
        return 75
    if st_lower in ["cooking", "in preparation", "đang nấu", "đang chế biến"]:
        return 50
    if st_lower in ["sent to kitchen", "sent_to_kitchen", "chờ bếp", "chuyển bếp"]:
        return 25
    if is_pending:
        return 0
    return 50


@router.patch(
    "/tasks/{ticket_id}",
    tags=TAG_OPS,
    summary="Cập nhật trạng thái và phân công xử lý yêu cầu nghiệp vụ / Task toàn khách sạn",
)
@router.put(
    "/tasks/{ticket_id}",
    include_in_schema=False,
)
async def update_task_status(
    ticket_id: str,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    update_in: Optional[Dict[str, Any]] = None,
    db: AsyncSession = Depends(get_db),
    sr_repo: SupportRequestRepository = Depends(get_support_request_repository),
    directive_repo: DirectiveRepository = Depends(get_directive_repository),
    rs_repo: RoomServiceRepository = Depends(get_room_service_repository),
    staff_repo: StaffRepository = Depends(get_staff_repository),
):
    """
    Cập nhật trạng thái phiếu công việc (Pending, In Progress, Completed...) và nhân viên phụ trách.
    Đồng bộ trên toàn bộ cơ sở dữ liệu: bảng SupportRequest, RoomServiceOrder, và ManagementDirective.
    Hỗ trợ tất cả các phòng ban: Buồng phòng, Lễ tân, F&B/Room Service, Bellman, Kỹ thuật bảo trì, Taxi.
    """
    target_status = status if isinstance(status, str) else None
    target_assigned_to = assigned_to if isinstance(assigned_to, str) else None
    target_assigned_robot = None
    target_note = None
    target_progress_in = None

    payload = (
        update_in
        if isinstance(update_in, dict)
        else (update_in.dict() if hasattr(update_in, "dict") else {})
        if update_in is not None
        else {}
    )

    if payload:
        if not target_status:
            target_status = payload.get("status")
        if not target_assigned_to:
            target_assigned_to = (
                payload.get("assigned_to")
                or payload.get("assigned_staff_name")
                or payload.get("assigned_staff")
                or payload.get("assigned_driver")
                or payload.get("assigned_technician")
            )
        target_assigned_robot = (
            payload.get("assigned_robot")
            or payload.get("assigned_robot_id")
            or payload.get("assigned_robot_code")
        )
        target_note = (
            payload.get("reject_reason")
            or payload.get("rejection_reason")
            or payload.get("reason")
            or payload.get("cancel_reason")
            or payload.get("note")
            or payload.get("notes")
            or payload.get("description")
        )
        target_progress_in = payload.get("progress")

    if not target_status and target_assigned_to is None and target_assigned_robot is None and target_note is None and target_progress_in is None:
        raise HTTPException(status_code=400, detail="Không có thông tin cập nhật hợp lệ")

    raw_id = ticket_id.strip()
    no_req_id = raw_id[4:].strip() if raw_id.upper().startswith("REQ-") else raw_id
    core_id = re.sub(r"^(REQ-)?(ORD-|HK-|BS-|MN-|REC-|DIR-|OP-)?", "", raw_id, flags=re.IGNORECASE).strip()

    # 1. Tra cứu và cập nhật bảng SupportRequest (HK, Room Service, Bellman, Maintenance, Taxi, Reception...)
    sr = await _find_with_prefixes(sr_repo.get_by_id_or_code, raw_id, no_req_id, core_id, min_core=2)
    st_lower = target_status.lower().strip() if target_status else ""
    is_pending = st_lower in ["pending", "unassigned", "waiting", "chờ tiếp nhận"]
    target_progress = _resolve_progress(target_progress_in, st_lower, is_pending)

    if sr:
        if target_status:
            sr.status = target_status
            sr.progress = target_progress
        if target_assigned_to is not None:
            sr.assigned_staff_name = None if str(target_assigned_to).lower() in ("", "null", "none") else target_assigned_to
        elif is_pending and target_status:
            sr.assigned_staff_name = None
        if target_assigned_robot is not None:
            sr.assigned_robot_id = None if str(target_assigned_robot).lower() in ("", "null", "none") else target_assigned_robot
        if target_note is not None and str(target_note).strip():
            clean_note_str = str(target_note).strip()
            sr.description = clean_note_str
            if st_lower in ["rejected", "cancelled"]:
                _mark_extra_data_reject(sr, clean_note_str)

        # Cập nhật account_id nếu tìm thấy nhân viên tương ứng
        staff_ident = (payload.get("assigned_staff_id") if payload else None) or target_assigned_to
        if staff_ident and str(staff_ident).lower() not in ("", "null", "none"):
            found_staff = await staff_repo.get_by_identifier(str(staff_ident))
            if found_staff:
                sr.account_id = found_staff.id
        elif is_pending and target_status:
            sr.account_id = None

        sr.updated_at = datetime.utcnow()

        # Đồng bộ sang RoomServiceOrder nếu là đơn hàng ẩm thực
        rs_order = await rs_repo.find_order_by_linked_or_number(sr.id, raw_id)
        if not rs_order and no_req_id:
            rs_order = await rs_repo.find_order_by_linked_or_number(order_identifier=no_req_id)
        if not rs_order and core_id:
            rs_order = await rs_repo.find_order_by_linked_or_number(order_identifier=core_id)

        if rs_order:
            if target_status:
                rs_order.status = target_status
                rs_order.progress = target_progress
            if target_note is not None and str(target_note).strip():
                rs_order.note = str(target_note).strip()
            if target_assigned_to is not None:
                rs_order.assigned_staff_name = None if str(target_assigned_to).lower() in ("", "null", "none") else target_assigned_to
            elif is_pending and target_status:
                rs_order.assigned_staff_name = None
            rs_order.updated_at = datetime.utcnow()

        # Tự động gửi thông báo liên phòng ban theo chu trình Room Service & Kitchen
        ticket_label = sr.ticket_code or sr.id
        room_label = sr.room_number or "phòng khách"
        try:
            if st_lower in ["sent to kitchen", "sent_to_kitchen", "chờ bếp", "chuyển bếp"]:
                await create_department_notification(
                    db,
                    department="Kitchen",
                    title=f"Đơn Room Service #{ticket_label} chuyển Bếp",
                    description=f"{room_label}: {sr.title}. Bếp vui lòng tiếp nhận và làm món.",
                    request_id=sr.id,
                    request_type="Room Service",
                )
            elif st_lower in ["ready", "food ready", "đã nấu xong", "sẵn sàng", "món đã xong"]:
                await create_department_notification(
                    db,
                    department="Room Service",
                    title=f"Bếp đã làm xong món #{ticket_label}!",
                    description=f"Món ăn {room_label} đã sẵn sàng. Room Service vui lòng lấy món và chuẩn bị dụng cụ giao lên phòng.",
                    request_id=sr.id,
                    request_type="Room Service",
                )
            elif st_lower in ["completed", "delivered", "done", "hoàn tất", "hoàn thành"]:
                await create_department_notification(
                    db,
                    department="Room Service",
                    title=f"Đơn #{ticket_label} hoàn tất",
                    description=f"Đã giao món thành công lên {room_label}.",
                    request_id=sr.id,
                    request_type="Room Service",
                )
        except Exception:
            pass

        await db.commit()
        await db.refresh(sr)
        sr_result = {
            "success": True,
            "type": "support_request",
            "id": sr.id,
            "raw_id": sr.id,
            "ticket_code": sr.ticket_code or sr.id,
            "status": sr.status,
            "progress": sr.progress,
            "assigned_to": sr.assigned_staff_name,
            "assigned_staff": sr.assigned_staff_name,
            "assigned_staff_name": sr.assigned_staff_name,
            "assigned_driver": sr.assigned_staff_name,
            "assigned_technician": sr.assigned_staff_name,
            "assigned_robot": sr.assigned_robot_id,
            "notes": sr.description,
            "note": sr.description,
            "description": sr.description,
            "title": sr.title,
            "room_number": sr.room_number or "",
            "guest_name": sr.guest_name or "Hotel Guest",
            "guestName": sr.guest_name or "Hotel Guest",
            "guest_phone": getattr(sr, "guest_phone", None) or (sr.extra_data or {}).get("guest_phone"),
            "guestPhone": getattr(sr, "guest_phone", None) or (sr.extra_data or {}).get("guest_phone"),
            "room_phone": getattr(sr, "room_phone", None) or (sr.extra_data or {}).get("room_phone") or (f"Ext {sr.room_number}" if sr.room_number else None),
            "roomPhone": getattr(sr, "room_phone", None) or (sr.extra_data or {}).get("room_phone") or (f"Ext {sr.room_number}" if sr.room_number else None),
            "department_id": sr.department_id,
            "department": sr.department_id,
            "request_type": sr.service_type_id or "General",
            "created_at": sr.created_at.isoformat() if sr.created_at else None,
            "updated_at": sr.updated_at.isoformat() if sr.updated_at else None,
        }
        asyncio.create_task(notification_manager.broadcast_status_update(sr_result, department="All"))
        return sr_result

    # 2. Tra cứu và cập nhật bảng ManagementDirective (Chỉ thị vận hành)
    d = await _find_with_prefixes(directive_repo.get_by_id_or_code, raw_id, no_req_id, core_id)
    if d:
        if target_status:
            d.status = target_status
        if target_assigned_to:
            d.assigned_staff_name = target_assigned_to
        if target_note is not None and str(target_note).strip():
            d.description = str(target_note).strip()
        await db.commit()
        await db.refresh(d)
        d_result = {
            "success": True,
            "type": "directive",
            "id": d.id,
            "raw_id": d.id,
            "code": d.code,
            "ticket_code": d.code,
            "status": d.status,
            "assigned_to": d.assigned_staff_name,
            "notes": d.description,
            "note": d.description,
            "title": d.title,
            "department": d.department,
        }
        asyncio.create_task(notification_manager.broadcast_status_update(d_result, department="All"))
        return d_result

    # 3. Tra cứu trực tiếp bảng RoomServiceOrder (nếu không có trong SupportRequest)
    rso = await _find_with_prefixes(rs_repo.get_order_by_id_or_number, raw_id, no_req_id, core_id)
    if rso:
        if target_status:
            rso.status = target_status
            if target_status.lower() in ["completed", "ready", "delivered", "done"]:
                rso.progress = 100
        if target_note is not None and str(target_note).strip():
            rso.note = str(target_note).strip()
        if target_assigned_to:
            rso.assigned_staff_name = target_assigned_to

        # Dong bo nguoc sang SupportRequest neu don co support_request_id lien ket
        if rso.support_request_id:
            sr_linked = await sr_repo.get_by_id_or_code(rso.support_request_id)
            if sr_linked:
                if target_status:
                    sr_linked.status = target_status
                    sr_linked.progress = rso.progress
                if target_note is not None and str(target_note).strip():
                    sr_linked.description = str(target_note).strip()
                    if target_status and target_status.lower() in ["rejected", "cancelled"]:
                        _mark_extra_data_reject(sr_linked, str(target_note).strip())
                sr_linked.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(rso)
        rso_result = {
            "success": True,
            "type": "room_service_order",
            "id": rso.id,
            "raw_id": rso.id,
            "order_number": rso.order_number,
            "ticket_code": rso.order_number,
            "status": rso.status,
            "progress": rso.progress,
            "assigned_to": rso.assigned_staff_name,
            "room_number": rso.room_number,
            "note": rso.note,
            "notes": rso.note,
            "reject_reason": rso.note,
            "department": "F&B",
        }
        asyncio.create_task(notification_manager.broadcast_status_update(rso_result, department="All"))
        return rso_result

    raise HTTPException(status_code=404, detail=f"Không tìm thấy yêu cầu #{ticket_id}")


# Python alias for backward compatibility
update_generic_request_status = update_task_status
