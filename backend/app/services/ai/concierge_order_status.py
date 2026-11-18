"""Async database query helper for room order and service request progress."""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, cast

logger = logging.getLogger(__name__)


async def query_room_order_status_db(room_num: str, is_en: bool = False, is_reject_inquiry: bool = False) -> Dict[str, Any]:
    """Helper truy vấn CSDL trạng thái phòng và đơn hàng F&B / dịch vụ gần nhất."""
    import re
    from sqlalchemy import select, desc, or_
    from sqlalchemy.orm import selectinload
    from app.core.database import AsyncSessionLocal
    from app.models.hotel import Room
    from app.models.room_service import RoomServiceOrder
    from app.models.support_request import SupportRequest

    clean_room = re.sub(r'[^0-9A-Za-z]', '', room_num).strip()
    if not clean_room:
        return {"exists": False, "is_occupied": False, "message": "Số phòng không hợp lệ."}

    try:
        async with AsyncSessionLocal() as db:
            stmt = select(Room).where((Room.room_number == clean_room) | (Room.id == clean_room))
            res = await db.execute(stmt)
            room = res.scalars().first()

            if not room:
                msg = f"Room {clean_room} does not exist in the hotel system." if is_en else f"Dạ phòng {clean_room} không tồn tại trên hệ thống khách sạn ạ."
                return {"exists": False, "is_occupied": False, "message": msg}

            if room.status != "OCCUPIED":
                msg = (
                    f"Room {room.room_number} is currently not checked in. Please visit the Front Desk reception to complete check-in before ordering services."
                    if is_en else
                    f"Dạ phòng {room.room_number} hiện chưa làm thủ tục nhận phòng. Quý khách vui lòng qua quầy Lễ tân để check-in rồi mới được đặt món nhé ạ."
                )
                return {
                    "exists": True,
                    "is_occupied": False,
                    "room_number": room.room_number,
                    "destination_key": "front_desk",
                    "message": msg,
                }

            # Tạo danh sách các biến thể số phòng để query linh hoạt
            room_clean_num = clean_room
            room_actual_num = room.room_number or clean_room
            room_variants = {
                room_actual_num,
                room_clean_num,
                f"Room {room_clean_num}",
                f"ROOM {room_clean_num}",
                f"Phòng {room_clean_num}",
                f"PHÒNG {room_clean_num}",
            }
            if room.id:
                room_variants.add(room.id)
            # Các trạng thái đang hoạt động (chưa hoàn tất/hủy)
            ACTIVE_STATUS_SET = {
                "pending", "waiting", "unassigned", "chờ tiếp nhận", "chờ xử lý",
                "calling", "đang gọi", "driver assigned", "on the way",
                "sent to kitchen", "sent_to_kitchen", "đã chuyển bếp",
                "cooking", "in preparation", "in_progress", "in progress", "bếp đang nấu", "đang xử lý",
                "ready", "food ready", "món đã nấu xong", "sẵn sàng",
                "delivering", "in transit", "đang giao", "đang giao phòng", "đang mang lên"
            }
            # Tìm danh sách đơn RoomServiceOrder
            stmt_order = (
                select(RoomServiceOrder)
                .options(selectinload(RoomServiceOrder.order_items))
                .where(
                    or_(
                        RoomServiceOrder.room_number.in_(room_variants),
                        RoomServiceOrder.room_number.ilike(f"%{room_clean_num}%"),
                        (RoomServiceOrder.room_id == room.id) if room.id else (RoomServiceOrder.room_id == -1),
                    )
                )
                .order_by(desc(RoomServiceOrder.created_at))
                .limit(10)
            )
            res_order = await db.execute(stmt_order)
            recent_orders = res_order.scalars().all()
            # Tìm danh sách yêu cầu SupportRequest
            stmt_req = (
                select(SupportRequest)
                .where(
                    or_(
                        SupportRequest.room_number.in_(room_variants),
                        SupportRequest.room_number.ilike(f"%{room_clean_num}%"),
                        (SupportRequest.room_id == room.id) if room.id else (SupportRequest.room_id == -1),
                    )
                )
                .order_by(desc(SupportRequest.created_at))
                .limit(10)
            )
            res_req = await db.execute(stmt_req)
            recent_requests = res_req.scalars().all()
            food_orders_list: List[Dict[str, Any]] = []
            service_orders_list: List[Dict[str, Any]] = []
            for ord_item in recent_orders:
                items_summary = ""
                if ord_item.order_items:
                    items_summary = ", ".join([f"{it.quantity}x {it.item_name}" for it in ord_item.order_items if it.item_name])
                elif (ord_item.status or "").lower().strip() in ["rejected", "cancelled"]:
                    items_summary = ""
                elif ord_item.note:
                    items_summary = ord_item.note

                cur_status = ord_item.status or "Pending"
                reject_reason = ord_item.note or ""

                # Đồng bộ trạng thái nếu SupportRequest liên kết đã hoàn tất, hủy hoặc từ chối
                matching_req = next(
                    (
                        r for r in recent_requests
                        if (ord_item.support_request_id and r.id == ord_item.support_request_id)
                        or (r.id == ord_item.id)
                        or (r.ticket_code and ord_item.order_number and ord_item.order_number in r.ticket_code)
                    ),
                    None
                )
                if matching_req and matching_req.status:
                    req_st = matching_req.status.strip()
                    req_st_lower = req_st.lower()
                    cur_st_lower = cur_status.lower()
                    if cur_st_lower in ("pending", "waiting", "unassigned") and req_st_lower not in ("pending", "waiting", "unassigned"):
                        cur_status = req_st
                        if req_st_lower in ("rejected", "cancelled"):
                            reject_reason = (
                                (matching_req.extra_data or {}).get("reject_reason")
                                or (matching_req.extra_data or {}).get("reason")
                                or matching_req.description
                                or reject_reason
                            )
                        try:
                            if ord_item.status != req_st:
                                ord_item.status = req_st
                                ord_item.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
                        except Exception:
                            pass

                # Lọc đơn chờ quá hạn (> 12 giờ): đơn pending từ hôm qua xem như hết hạn/hủy
                now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
                if ord_item.created_at and (now_utc - ord_item.created_at).total_seconds() > 12 * 3600:
                    if cur_status.lower() in ("pending", "waiting", "unassigned"):
                        cur_status = "Cancelled"

                data_entry = {
                    "order_number": ord_item.order_number,
                    "status": cur_status,
                    "created_at": ord_item.created_at,
                    "items_summary": items_summary,
                    "is_service_request": ord_item.is_service_request,
                    "progress": ord_item.progress or 0,
                    "note": ord_item.note or "",
                    "reject_reason": reject_reason,
                    "source_id": ord_item.id,
                }

                if ord_item.is_service_request:
                    service_orders_list.append(data_entry)
                else:
                    food_orders_list.append(data_entry)
            # Phân loại thêm từ SupportRequest nếu đơn tạo qua AI Chat hoặc kênh ngoài
            for req_item in recent_requests:
                t_code = req_item.ticket_code or req_item.id or ""
                # Bỏ qua nếu đã có trong danh sách từ RoomServiceOrder
                if any(t_code and (t_code in (fo.get("order_number") or "") or (fo.get("order_number") or "") in t_code or t_code == fo.get("source_id")) for fo in food_orders_list):
                    continue
                if any(t_code and (t_code in (so.get("order_number") or "") or (so.get("order_number") or "") in t_code or t_code == so.get("source_id")) for so in service_orders_list):
                    continue
                items_summary = req_item.title or ""
                if req_item.items and isinstance(cast(Any, req_item.items), list):
                    it_names = [f"{it.get('qty', 1)}x {it.get('name', '')}" for it in req_item.items if isinstance(cast(Any, it), dict) and it.get('name')]
                    if it_names:
                        items_summary = ", ".join(it_names)
                sr_reject = (
                    (req_item.extra_data or {}).get("reject_reason")
                    or (req_item.extra_data or {}).get("reason")
                    or req_item.description
                    or ""
                )
                sr_entry = {
                    "order_number": req_item.ticket_code,
                    "status": req_item.status or "Pending",
                    "created_at": req_item.created_at,
                    "items_summary": items_summary,
                    "progress": req_item.progress or 0,
                    "note": req_item.description or "",
                    "reject_reason": sr_reject,
                    "source_id": req_item.id,
                }
                dep_up = (req_item.department_id or "").upper()
                svc_up = (req_item.service_type_id or "").upper()
                tit_low = (req_item.title or "").lower()
                is_food_sr = False
                if any(k in dep_up for k in ["ROOMSERVICE", "F&B", "FB", "KITCHEN"]):
                    if not any(k in tit_low for k in ["dọn", "vệ sinh", "khăn", "gối", "chăn", "buồng"]):
                        is_food_sr = True
                elif any(k in svc_up for k in ["ROOM-SERVICE", "FOOD", "RESTAURANT"]):
                    is_food_sr = True
                elif req_item.items and len(req_item.items) > 0 and not any(k in tit_low for k in ["dọn", "vệ sinh"]):
                    is_food_sr = True
                if is_food_sr:
                    sr_entry["is_service_request"] = False
                    food_orders_list.append(sr_entry)
                else:
                    sr_entry["is_service_request"] = True
                    service_orders_list.append(sr_entry)
            # TÁCH ĐƠN ĐANG ACTIVE, ĐƠN REJECTED VÀ ĐƠN ĐÃ HOÀN THÀNH / HỦY
            REJECT_STATUS_SET = {"rejected", "cancelled", "declined", "từ chối", "đã hủy"}
            rejected_food = [f for f in food_orders_list if (f.get("status") or "").lower().strip() in REJECT_STATUS_SET]
            rejected_service = [s for s in service_orders_list if (s.get("status") or "").lower().strip() in REJECT_STATUS_SET]
            all_rejected = rejected_food + rejected_service
            all_rejected.sort(key=lambda x: x.get("created_at") or datetime.min, reverse=True)
            latest_rejected_data = all_rejected[0] if all_rejected else None
            latest_rejected_food = rejected_food[0] if rejected_food else None
            latest_rejected_service = rejected_service[0] if rejected_service else None
            active_food = [f for f in food_orders_list if (f.get("status") or "").lower().strip() in ACTIVE_STATUS_SET]
            completed_food = [f for f in food_orders_list if (f.get("status") or "").lower().strip() not in ACTIVE_STATUS_SET]
            active_service = [s for s in service_orders_list if (s.get("status") or "").lower().strip() in ACTIVE_STATUS_SET]
            completed_service = [s for s in service_orders_list if (s.get("status") or "").lower().strip() not in ACTIVE_STATUS_SET]
            # Nếu hỏi lý do từ chối: ưu tiên đơn bị từ chối gần nhất
            if is_reject_inquiry and latest_rejected_data:
                latest_food_data = latest_rejected_food if latest_rejected_food else (active_food[0] if active_food else (completed_food[0] if completed_food else None))
                latest_service_data = latest_rejected_service if latest_rejected_service else (active_service[0] if active_service else (completed_service[0] if completed_service else None))
                order_data = latest_rejected_data
            else:
                if active_food and completed_food:
                    t_act = active_food[0].get("created_at") or datetime.min
                    t_comp = completed_food[0].get("created_at") or datetime.min
                    # Nếu đơn active mới hơn hoặc bằng đơn hoàn tất -> báo đơn active
                    # Nếu đơn hoàn tất được tạo sau đơn active (khách vừa hoàn tất đơn mới) -> báo đơn hoàn tất mới nhất
                    latest_food_data = active_food[0] if t_act >= t_comp else completed_food[0]
                else:
                    latest_food_data = active_food[0] if active_food else (completed_food[0] if completed_food else None)

                if active_service and completed_service:
                    t_act_s = active_service[0].get("created_at") or datetime.min
                    t_comp_s = completed_service[0].get("created_at") or datetime.min
                    latest_service_data = active_service[0] if t_act_s >= t_comp_s else completed_service[0]
                else:
                    latest_service_data = active_service[0] if active_service else (completed_service[0] if completed_service else None)

                all_active = active_food + active_service
                all_active.sort(key=lambda x: x.get("created_at") or datetime.min, reverse=True)
                all_any = food_orders_list + service_orders_list
                all_any.sort(key=lambda x: x.get("created_at") or datetime.min, reverse=True)
                if all_active and all_any:
                    t_act_all = all_active[0].get("created_at") or datetime.min
                    t_any_all = all_any[0].get("created_at") or datetime.min
                    order_data = all_active[0] if t_act_all >= t_any_all else all_any[0]
                else:
                    order_data = all_active[0] if all_active else (all_any[0] if all_any else None)

            req_data = recent_requests[0] if recent_requests else None
            return {
                "exists": True,
                "is_occupied": True,
                "room_number": room.room_number,
                "latest_order": order_data,
                "latest_food_order": latest_food_data,
                "latest_service_order": latest_service_data,
                "latest_rejected_order": latest_rejected_data,
                "latest_rejected_food": latest_rejected_food,
                "latest_rejected_service": latest_rejected_service,
                "food_orders": food_orders_list,
                "service_orders": service_orders_list,
                "latest_request": req_data,
            }
    except Exception as ex:
        logger.warning(f"[ConciergeGraph] DB query error for room {clean_room}: {ex}")
        return {"exists": True, "is_occupied": True, "room_number": clean_room, "latest_order": None, "latest_request": None}
