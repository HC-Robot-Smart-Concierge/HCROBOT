"""Bilingual formatting helpers for room order and service status responses."""

from typing import Any, Dict, Optional

from app.services.ai.session_manager import session_manager


def format_order_status_reply(
    target_ord: Optional[Dict[str, Any]],
    is_service_mode: bool,
    current_room: Optional[str],
    session_id: str,
    is_en: bool,
    is_reject_inquiry: bool,
    is_taxi_inquiry: bool,
    matched_by_taxi: Optional[Dict[str, Any]],
    is_maintenance_inquiry: bool,
    matched_by_maintenance: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """Format the resolved room order/ticket state into a bilingual concierge reply."""
    STATUS_VN_MAP = {
        "pending": "đang chờ tiếp nhận",
        "waiting": "đang chờ xử lý",
        "unassigned": "đang chờ phân công",
        "sent to kitchen": "đã chuyển tới nhà bếp và đang chờ chế biến",
        "sent_to_kitchen": "đã chuyển tới nhà bếp và đang chờ chế biến",
        "cooking": "đang được các đầu bếp trực tiếp chế biến trong bếp, sắp hoàn tất",
        "in preparation": "đang được chế biến",
        "in progress": "đang được thực hiện",
        "in_progress": "đang được thực hiện",
        "assigned": "đã phân công nhân viên",
        "ready": "đã làm xong, đang chuẩn bị mang lên phòng",
        "food ready": "đã nấu xong, đang chuẩn bị mang lên phòng",
        "delivering": "đang trên đường giao lên phòng",
        "driver assigned": "đã có tài xế nhận cuốc và đang chuẩn bị đón quý khách",
        "on the way": "xe taxi đang trên đường di chuyển đến sảnh đón quý khách",
        "completed": "đã hoàn thành và giao thành công lên phòng",
        "delivered": "đã giao thành công lên phòng",
        "done": "đã hoàn tất thành công",
        "cancelled": "đã được hủy",
        "rejected": "tạm thời chưa thể phục vụ",
    }
    STATUS_EN_MAP = {
        "pending": "pending in queue",
        "waiting": "waiting to be processed",
        "unassigned": "waiting for staff assignment",
        "sent to kitchen": "sent to the kitchen and queued for preparation",
        "sent_to_kitchen": "sent to the kitchen and queued for preparation",
        "cooking": "being freshly prepared by our chefs in the kitchen",
        "in preparation": "in preparation",
        "in progress": "in progress",
        "in_progress": "in progress",
        "assigned": "assigned to staff",
        "ready": "ready and waiting for delivery",
        "food ready": "finished and ready for delivery",
        "delivering": "out for delivery to your room right now",
        "completed": "delivered successfully",
        "delivered": "delivered successfully",
        "done": "completed",
        "cancelled": "cancelled",
        "rejected": "declined",
    }
    if is_service_mode:
        if target_ord:
            st = (target_ord.get("status") or "").lower().strip()
            items_summary = target_ord.get("items_summary", "")
            items_desc = f" ({items_summary})" if items_summary else ""
            raw_rej = (target_ord.get("reject_reason") or target_ord.get("note") or "").strip()
            is_maintenance_item = bool(
                is_maintenance_inquiry
                or matched_by_maintenance
                or "mn-" in str(target_ord.get("order_number") or "").lower()
                or "mn-" in str(target_ord.get("ticket_code") or "").lower()
                or any(k in str(items_summary).lower() for k in ["sửa", "bảo trì", "kỹ thuật", "điều hòa", "máy lạnh", "nước", "điện", "khóa", "maintenance", "repair"])
            )
            is_taxi_item = bool(
                is_taxi_inquiry
                or matched_by_taxi
                or "taxi" in str(items_summary).lower()
                or "tx-" in str(target_ord.get("order_number") or "").lower()
                or "tx-" in str(target_ord.get("ticket_code") or "").lower()
                or "taxi" in str(target_ord.get("title") or "").lower()
            )
            if is_maintenance_item:
                if is_en:
                    mnt_st_map_en = {
                        "pending": f"Your maintenance request for Room {current_room}{items_desc} has been received and is queued for our Technical Team.",
                        "waiting": f"Your maintenance request for Room {current_room}{items_desc} is waiting to be processed by our Technical Team.",
                        "unassigned": f"Your maintenance request for Room {current_room}{items_desc} is waiting for technician assignment.",
                        "in progress": f"Our Maintenance technician has been dispatched and is currently handling the repair for Room {current_room}{items_desc}.",
                        "in_progress": f"Our Maintenance technician has been dispatched and is currently handling the repair for Room {current_room}{items_desc}.",
                        "assigned": f"Our Maintenance technician has been dispatched and is currently handling the repair for Room {current_room}{items_desc}.",
                        "completed": f"The maintenance and repair for Room {current_room}{items_desc} has been successfully completed by our Technical Team!",
                        "success": f"The maintenance and repair for Room {current_room}{items_desc} has been successfully completed by our Technical Team!",
                        "done": f"The maintenance and repair for Room {current_room}{items_desc} has been successfully completed by our Technical Team!",
                        "cancelled": f"Your maintenance request for Room {current_room}{items_desc} was cancelled.",
                        "rejected": f"Your maintenance request for Room {current_room}{items_desc} could not be fulfilled at this time.",
                    }
                    status_reply = mnt_st_map_en.get(st, f"Your maintenance request for Room {current_room}{items_desc} is currently {st}.")
                else:
                    mnt_st_map_vn = {
                        "pending": f"Dạ yêu cầu bảo trì sửa chữa của phòng {current_room}{items_desc} đã được tiếp nhận và đang chờ đội kỹ thuật phân công nhân viên lên xử lý ạ.",
                        "waiting": f"Dạ yêu cầu bảo trì sửa chữa của phòng {current_room}{items_desc} đang chờ kỹ thuật viên tiếp nhận xử lý ạ.",
                        "unassigned": f"Dạ yêu cầu bảo trì của phòng {current_room}{items_desc} đang chờ kỹ thuật viên tiếp nhận xử lý ạ.",
                        "in progress": f"Dạ kỹ thuật viên đã tiếp nhận và đang tiến hành kiểm tra, sửa chữa cho phòng {current_room}{items_desc} rồi ạ.",
                        "in_progress": f"Dạ kỹ thuật viên đã tiếp nhận và đang tiến hành kiểm tra, sửa chữa cho phòng {current_room}{items_desc} rồi ạ.",
                        "assigned": f"Dạ kỹ thuật viên đã tiếp nhận và đang tiến hành kiểm tra, sửa chữa cho phòng {current_room}{items_desc} rồi ạ.",
                        "completed": f"Dạ sự cố kỹ thuật của phòng {current_room}{items_desc} đã được nhân viên kỹ thuật hoàn tất sửa chữa thành công rồi ạ!",
                        "success": f"Dạ sự cố kỹ thuật của phòng {current_room}{items_desc} đã được nhân viên kỹ thuật hoàn tất sửa chữa thành công rồi ạ!",
                        "done": f"Dạ sự cố kỹ thuật của phòng {current_room}{items_desc} đã được hoàn tất sửa chữa thành công rồi ạ!",
                        "cancelled": f"Dạ yêu cầu bảo trì của phòng {current_room}{items_desc} đã được hủy rồi ạ.",
                        "rejected": f"Dạ yêu cầu bảo trì của phòng {current_room}{items_desc} tạm thời chưa được đáp ứng. Quý khách vui lòng liên hệ Lễ tân nhé ạ.",
                    }
                    status_reply = mnt_st_map_vn.get(st, f"Dạ yêu cầu bảo trì của phòng {current_room}{items_desc} hiện đang ở trạng thái: {st} ạ.")
            elif is_taxi_item:
                if is_en:
                    taxi_st_map_en = {
                        "pending": f"Your taxi request for Room {current_room} has been received and is waiting for Concierge to call the taxi.",
                        "waiting": f"Your taxi request for Room {current_room} is waiting for Concierge to call.",
                        "unassigned": f"Your taxi request for Room {current_room} is waiting for Concierge to call.",
                        "calling": f"Our Concierge team has received your request and is currently calling a taxi for Room {current_room}. Please wait a moment.",
                        "đang gọi": f"Our Concierge team has received your request and is currently calling a taxi for Room {current_room}. Please wait a moment.",
                        "in progress": f"Our Concierge team has received your request and is currently calling a taxi for Room {current_room}. Please wait a moment.",
                        "in_progress": f"Our Concierge team has received your request and is currently calling a taxi for Room {current_room}. Please wait a moment.",
                        "driver assigned": f"Our Concierge team has contacted the taxi company and a driver is on the way for Room {current_room}.",
                        "on the way": f"The taxi is on the way to the lobby entrance for Room {current_room}.",
                        "completed": f"Our Concierge team has successfully arranged a taxi for Room {current_room}. Please head to the main lobby to meet your ride!",
                        "success": f"Our Concierge team has successfully arranged a taxi for Room {current_room}. Please head to the main lobby to meet your ride!",
                        "thành công": f"Our Concierge team has successfully arranged a taxi for Room {current_room}. Please head to the main lobby to meet your ride!",
                        "done": f"Our Concierge team has successfully arranged a taxi for Room {current_room}.",
                        "cancelled": f"Your taxi request for Room {current_room} was cancelled.",
                        "rejected": f"Your taxi request for Room {current_room} could not be fulfilled at this time.",
                    }
                    status_reply = taxi_st_map_en.get(st, f"Your taxi request for Room {current_room} is currently {st}.")
                else:
                    taxi_st_map_vn = {
                        "pending": f"Dạ yêu cầu gọi xe taxi của phòng {current_room} đang chờ nhân viên Concierge tiếp nhận để gọi xe cho quý khách ạ.",
                        "waiting": f"Dạ yêu cầu gọi xe taxi của phòng {current_room} đang chờ Concierge gọi xe ạ.",
                        "unassigned": f"Dạ yêu cầu gọi xe taxi của phòng {current_room} đang chờ nhân viên tiếp nhận gọi xe ạ.",
                        "calling": f"Dạ bộ phận Concierge đã tiếp nhận yêu cầu và đang gọi xe taxi cho phòng {current_room} rồi ạ. Quý khách vui lòng đợi trong giây lát ạ.",
                        "đang gọi": f"Dạ bộ phận Concierge đã tiếp nhận yêu cầu và đang gọi xe taxi cho phòng {current_room} rồi ạ. Quý khách vui lòng đợi trong giây lát ạ.",
                        "in progress": f"Dạ bộ phận Concierge đã tiếp nhận yêu cầu và đang gọi xe taxi cho phòng {current_room} rồi ạ. Quý khách vui lòng đợi trong giây lát ạ.",
                        "in_progress": f"Dạ bộ phận Concierge đã tiếp nhận yêu cầu và đang gọi xe taxi cho phòng {current_room} rồi ạ. Quý khách vui lòng đợi trong giây lát ạ.",
                        "driver assigned": f"Dạ Concierge đã liên hệ xong hãng xe và tài xế đang chuẩn bị đón phòng {current_room} ạ.",
                        "on the way": f"Dạ xe taxi đang di chuyển đến sảnh đón phòng {current_room} rồi ạ.",
                        "completed": f"Dạ bộ phận Concierge đã gọi xe taxi thành công cho phòng {current_room} rồi ạ. Quý khách vui lòng chuẩn bị ra sảnh đón xe nhé!",
                        "success": f"Dạ bộ phận Concierge đã gọi xe taxi thành công cho phòng {current_room} rồi ạ. Quý khách vui lòng chuẩn bị ra sảnh đón xe nhé!",
                        "thành công": f"Dạ bộ phận Concierge đã gọi xe taxi thành công cho phòng {current_room} rồi ạ. Quý khách vui lòng chuẩn bị ra sảnh đón xe nhé!",
                        "done": f"Dạ bộ phận Concierge đã gọi xe taxi thành công cho phòng {current_room} rồi ạ.",
                        "cancelled": f"Dạ yêu cầu gọi xe taxi của phòng {current_room} đã được hủy rồi ạ.",
                        "rejected": f"Dạ yêu cầu gọi xe taxi của phòng {current_room} tạm thời chưa được đáp ứng. Quý khách vui lòng liên hệ quầy Concierge nhé ạ.",
                    }
                    status_reply = taxi_st_map_vn.get(st, f"Dạ yêu cầu gọi xe của phòng {current_room} hiện đang ở trạng thái: {st} ạ.")
            elif is_en:
                if is_reject_inquiry and not raw_rej:
                    rej_en = " without a specific reason noted"
                else:
                    rej_en = f" with reason: '{raw_rej}'" if raw_rej else ""
                svc_map = {
                    "pending": f"Your room service request for Room {current_room}{items_desc} has been received and is queued for Housekeeping service.",
                    "waiting": f"Your room service request for Room {current_room}{items_desc} is waiting to be processed.",
                    "unassigned": f"Your room service request for Room {current_room}{items_desc} is waiting for staff assignment.",
                    "sent to kitchen": f"Your request for Room {current_room}{items_desc} has been forwarded and is queued for service.",
                    "sent_to_kitchen": f"Your request for Room {current_room}{items_desc} has been forwarded and is queued for service.",
                    "cooking": f"Our housekeeping staff is currently preparing items and servicing Room {current_room}{items_desc}.",
                    "in progress": f"Our housekeeping staff is currently servicing Room {current_room}{items_desc}.",
                    "in_progress": f"Our housekeeping staff is currently servicing Room {current_room}{items_desc}.",
                    "assigned": f"Our housekeeping staff has been assigned and is on the way to Room {current_room}{items_desc}.",
                    "ready": f"Your requested items for Room {current_room}{items_desc} are prepared and being delivered.",
                    "delivering": f"Our room service staff is on the way to Room {current_room}{items_desc} right now!",
                    "completed": f"Your room service request for Room {current_room}{items_desc} has been completed successfully. Have a wonderful stay!",
                    "delivered": f"Your room service request for Room {current_room}{items_desc} has been delivered successfully. Have a wonderful stay!",
                    "done": f"Your room service request for Room {current_room}{items_desc} has been completed successfully.",
                    "cancelled": f"Your room service request for Room {current_room} was cancelled{rej_en}.",
                    "rejected": f"Your room service request for Room {current_room}{items_desc} was declined{rej_en}. Please contact the front desk for assistance.",
                }
                st_en = STATUS_EN_MAP.get(st, st)
                status_reply = svc_map.get(st, f"Your room service request for Room {current_room}{items_desc} is currently {st_en}.")
            else:
                if is_reject_inquiry and not raw_rej:
                    rej_vn = " nhưng nhân viên chưa ghi chú lý do cụ thể ạ"
                else:
                    rej_vn = f' với lý do: "{raw_rej}"' if raw_rej else ""
                svc_map = {
                    "pending": f"Dạ yêu cầu phục vụ phòng của phòng {current_room}{items_desc} đã được tiếp nhận và đang trong hàng đợi xử lý của bộ phận buồng phòng ạ.",
                    "waiting": f"Dạ yêu cầu phục vụ phòng của phòng {current_room}{items_desc} đang chờ nhân viên tiếp nhận xử lý ạ.",
                    "unassigned": f"Dạ yêu cầu phục vụ phòng của phòng {current_room}{items_desc} đang chờ phân công nhân viên phụ trách ạ.",
                    "sent to kitchen": f"Dạ yêu cầu phục vụ phòng của phòng {current_room}{items_desc} đã được chuyển tới bộ phận chuyên trách xử lý ạ.",
                    "sent_to_kitchen": f"Dạ yêu cầu phục vụ phòng của phòng {current_room}{items_desc} đã được chuyển tới bộ phận chuyên trách xử lý ạ.",
                    "cooking": f"Dạ nhân viên buồng phòng đang tiến hành chuẩn bị đồ và xử lý yêu cầu dọn phòng {items_desc} cho phòng {current_room} rồi ạ, sắp hoàn tất rồi ạ.",
                    "in progress": f"Dạ nhân viên buồng phòng đang trực tiếp dọn dẹp và phục vụ yêu cầu {items_desc} tại phòng {current_room} rồi ạ.",
                    "in_progress": f"Dạ nhân viên buồng phòng đang trực tiếp dọn dẹp và phục vụ yêu cầu {items_desc} tại phòng {current_room} rồi ạ.",
                    "assigned": f"Dạ nhân viên buồng phòng chuyên trách đã tiếp nhận yêu cầu {items_desc} cho phòng {current_room} và đang chuẩn bị thực hiện ạ.",
                    "ready": f"Dạ các vật dụng yêu cầu cho phòng {current_room}{items_desc} đã được chuẩn bị xong, đang chuẩn bị mang lên phòng ạ.",
                    "delivering": f"Dạ nhân viên phục vụ phòng đang mang đồ di chuyển lên phòng {current_room} cho quý khách rồi ạ!",
                    "completed": f"Dạ yêu cầu phục vụ phòng {items_desc} của phòng {current_room} đã được hoàn tất thành công rồi ạ. Chúc quý khách có thời gian nghỉ dưỡng thoải mái!",
                    "delivered": f"Dạ yêu cầu phục vụ phòng {items_desc} của phòng {current_room} đã được hoàn tất thành công rồi ạ. Chúc quý khách có thời gian nghỉ dưỡng thoải mái!",
                    "done": f"Dạ yêu cầu phục vụ phòng {items_desc} của phòng {current_room} đã hoàn tất thành công rồi ạ.",
                    "cancelled": f"Dạ yêu cầu dịch vụ phòng của phòng {current_room} đã được hủy{rej_vn} rồi ạ.",
                    "rejected": f"Dạ yêu cầu phục vụ phòng {items_desc} của phòng {current_room} đã bị từ chối{rej_vn}. Quý khách vui lòng liên hệ quầy Lễ tân hoặc chọn tiện ích khác để được hỗ trợ nhé ạ.",
                }
                st_vn = STATUS_VN_MAP.get(st, st)
                status_reply = svc_map.get(st, f"Dạ yêu cầu dịch vụ của phòng {current_room}{items_desc} hiện {st_vn} ạ.")
        else:
            if is_reject_inquiry:
                status_reply = (
                    f"I checked and there are currently no declined room service requests for Room {current_room}."
                    if is_en else
                    f"Dạ em kiểm tra thấy hiện tại phòng {current_room} không có yêu cầu phục vụ phòng nào bị từ chối ạ."
                )
            else:
                status_reply = (
                    f"I checked and there are currently no active housekeeping or room service requests for Room {current_room}. Would you like to request amenities from our Utilities menu?"
                    if is_en else
                    f"Dạ em kiểm tra thấy hiện tại phòng {current_room} không có yêu cầu dọn phòng hoặc dịch vụ phòng nào đang chờ xử lý ạ. Quý khách có thể yêu cầu dọn phòng hoặc thêm khăn tắm trong menu Tiện ích nhé ạ!"
                )
    elif target_ord:
        st = (target_ord.get("status") or "").lower().strip()
        items_summary = target_ord.get("items_summary", "")
        items_desc = f" ({items_summary})" if items_summary else ""
        raw_rej = (target_ord.get("reject_reason") or target_ord.get("note") or "").strip()
        if is_en:
            if is_reject_inquiry and not raw_rej:
                rej_en = " without a specific reason noted"
            else:
                rej_en = f" with reason: '{raw_rej}'" if raw_rej else ""
            ord_map = {
                "pending": f"Your food order for Room {current_room}{items_desc} has been received by the kitchen and is in the queue.",
                "waiting": f"Your food order for Room {current_room}{items_desc} is waiting to be processed by the kitchen.",
                "sent to kitchen": f"Your food order for Room {current_room}{items_desc} has been sent to the kitchen and the chefs are preparing to cook.",
                "sent_to_kitchen": f"Your food order for Room {current_room}{items_desc} has been sent to the kitchen and the chefs are preparing to cook.",
                "cooking": f"The chefs are currently preparing your food order for Room {current_room}{items_desc} in the kitchen.",
                "in preparation": f"The kitchen is currently preparing your food order for Room {current_room}{items_desc}.",
                "in progress": f"The kitchen is currently working on your food order for Room {current_room}{items_desc}.",
                "in_progress": f"The kitchen is currently working on your food order for Room {current_room}{items_desc}.",
                "ready": f"Your food order for Room {current_room}{items_desc} has been finished by the kitchen and is waiting for delivery.",
                "food ready": f"Your food order for Room {current_room}{items_desc} is ready and waiting for delivery.",
                "delivering": f"Your food order for Room {current_room}{items_desc} is on its way to your room right now!",
                "completed": f"Your food order for Room {current_room}{items_desc} has been delivered successfully. Enjoy your meal!",
                "delivered": f"Your food order for Room {current_room}{items_desc} has been delivered successfully. Enjoy your meal!",
                "done": f"Your food order for Room {current_room}{items_desc} has been completed successfully.",
                "cancelled": f"Your food order for Room {current_room} was cancelled{rej_en}.",
                "rejected": f"Your food order for Room {current_room}{items_desc} was declined by the kitchen{rej_en}. Would you like to select another dish from our menu?",
            }
            st_en = STATUS_EN_MAP.get(st, st)
            status_reply = ord_map.get(st, f"Your food order for Room {current_room}{items_desc} is currently {st_en}.")
        else:
            if is_reject_inquiry and not raw_rej:
                rej_vn = " nhưng nhân viên chưa ghi chú lý do cụ thể ạ"
            else:
                    rej_vn = f' với lý do: "{raw_rej}"' if raw_rej else ""
            ord_map = {
                "pending": f"Dạ đơn món của phòng {current_room}{items_desc} đã được nhà bếp tiếp nhận và đang xếp hàng chờ nấu ạ.",
                "waiting": f"Dạ đơn món của phòng {current_room}{items_desc} đang chờ nhà bếp xử lý ạ.",
                "sent to kitchen": f"Dạ đơn món của phòng {current_room}{items_desc} đã được chuyển tới nhà bếp và các đầu bếp đang chuẩn bị chế biến ạ.",
                "sent_to_kitchen": f"Dạ đơn món của phòng {current_room}{items_desc} đã được chuyển tới nhà bếp và các đầu bếp đang chuẩn bị chế biến ạ.",
                "cooking": f"Dạ món ăn của phòng {current_room}{items_desc} hiện đang được các đầu bếp trực tiếp chế biến trong bếp, sắp xong rồi ạ.",
                "in preparation": f"Dạ món ăn của phòng {current_room}{items_desc} hiện đang được chế biến trong bếp, sắp xong rồi ạ.",
                "in progress": f"Dạ món ăn của phòng {current_room}{items_desc} hiện đang được thực hiện trong nhà bếp ạ.",
                "in_progress": f"Dạ món ăn của phòng {current_room}{items_desc} hiện đang được thực hiện trong nhà bếp ạ.",
                "ready": f"Dạ món ăn của phòng {current_room}{items_desc} đã được nhà bếp làm xong, đang chuẩn bị giao lên phòng cho quý khách rồi ạ.",
                "food ready": f"Dạ món ăn của phòng {current_room}{items_desc} đã được nấu xong, đang chuẩn bị giao lên phòng cho quý khách rồi ạ.",
                "delivering": f"Dạ món ăn của phòng {current_room}{items_desc} đang trên đường được giao lên phòng cho quý khách rồi ạ!",
                "completed": f"Dạ đơn món của phòng {current_room}{items_desc} đã hoàn thành và được giao thành công lên phòng rồi ạ. Chúc quý khách ngon miệng!",
                "delivered": f"Dạ đơn món của phòng {current_room}{items_desc} đã hoàn thành và được giao thành công lên phòng rồi ạ. Chúc quý khách ngon miệng!",
                "done": f"Dạ đơn món của phòng {current_room}{items_desc} đã hoàn tất thành công rồi ạ.",
                "cancelled": f"Dạ đơn món của phòng {current_room} đã được hủy{rej_vn} rồi ạ.",
                "rejected": f"Dạ đơn món của phòng {current_room}{items_desc} đã bị nhà bếp từ chối{rej_vn}. Quý khách có muốn chọn món khác trên màn hình để đặt không ạ?",
            }
            st_vn = STATUS_VN_MAP.get(st, st)
            status_reply = ord_map.get(st, f"Dạ đơn đặt món của phòng {current_room}{items_desc} hiện {st_vn} ạ.")
    else:
        if is_reject_inquiry:
            status_reply = (
                f"I checked and there are currently no declined kitchen orders for Room {current_room}."
                if is_en else
                f"Dạ em kiểm tra thấy hiện tại phòng {current_room} không có đơn đặt món nào bị nhà bếp từ chối cả ạ."
            )
        else:
            status_reply = (
                f"I checked and there are currently no active kitchen orders for Room {current_room}. Would you like to order something from our menu?"
                if is_en else
                f"Dạ em kiểm tra thấy hiện tại phòng {current_room} không có đơn đặt món nào trong nhà bếp ạ. Quý khách có muốn chọn món trên màn hình để đặt không ạ?"
            )
    # Giữ lại room_number trong session để phục vụ xuyên suốt phiên của khách hiện tại
    if current_room:
        session_manager.set_room_number(session_id, current_room)
    return {
        "missing_room_number": False,
        "room_number": current_room,
        "response": status_reply,
        "destination_key": None,
        "require_room_pin": False,
    }
