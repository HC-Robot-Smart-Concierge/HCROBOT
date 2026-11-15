import { bellRequestMessage } from '../../components/robot/RobotBellmanMenuScreen';
import { createConciergeRequest } from '../../services/conciergeApi';
import { createBellRequest, createMaintenanceRequest } from '../../services/operationsApi';

/**
 * Handles direct ticket submission for maintenance/bellman requests when the guest's
 * room PIN has already been verified during the current kiosk session.
 */
export async function resolvePreVerifiedServiceTickets({
  chatRes,
  query,
  spokenRoomDetected,
  authenticatedRoom,
  isCurrentRequest,
}) {
  // The client may already have a verified room before the AI session does.
  // Wait for the actual ticket result before speaking a success message.
  const pendingMaintenance = (chatRes.pending_service_action || chatRes.action) === 'maintenance';
  const maintenanceRoom =
    chatRes.target_room_number || chatRes.current_room_number || spokenRoomDetected || authenticatedRoom;

  if (
    chatRes.require_room_pin &&
    pendingMaintenance &&
    authenticatedRoom &&
    String(maintenanceRoom).trim() === String(authenticatedRoom).trim()
  ) {
    const english = chatRes.detected_language === 'English';
    try {
      const items = chatRes.pending_service_items || query;
      const result = await createMaintenanceRequest({
        title: items,
        category: 'general',
        location: String(authenticatedRoom).trim(),
        description: items,
        source: 'HCRobot Voice AI (Session Authenticated)',
      });
      chatRes.ticket_code = result.ticket_code;
      chatRes.response = result.merged
        ? english
          ? `The additional issue was added to repair request #${result.ticket_code}. No new ticket was created.`
          : `Đã bổ sung sự cố vào phiếu sửa chữa #${result.ticket_code}. Không tạo thêm phiếu mới.`
        : result.duplicate
          ? english
            ? `This issue already has an open request #${result.ticket_code}. No new ticket was created.`
            : `Sự cố này đã có phiếu #${result.ticket_code} đang xử lý. Không tạo thêm phiếu mới.`
          : english
            ? `Your repair request #${result.ticket_code} has been sent to Maintenance.`
            : `Phiếu sửa chữa #${result.ticket_code} đã được gửi tới bộ phận kỹ thuật.`;
    } catch {
      chatRes.response = english
        ? 'Could not submit the repair request. Please try again.'
        : 'Chưa gửi được yêu cầu sửa chữa. Vui lòng thử lại.';
    }
    chatRes.require_room_pin = false;
    chatRes.audio_base64 = null;
    if (!isCurrentRequest()) return false;
  }

  // Same for Bellman: the kiosk already verified this room, so send the request directly
  // (service_key "auto" lets the backend classify the guest's words) instead of asking for a PIN.
  const pendingBellman = (chatRes.pending_service_action || chatRes.action) === 'bellman';
  const bellmanRoom =
    chatRes.target_room_number || chatRes.current_room_number || spokenRoomDetected || authenticatedRoom;

  if (
    chatRes.require_room_pin &&
    pendingBellman &&
    authenticatedRoom &&
    String(bellmanRoom).trim() === String(authenticatedRoom).trim()
  ) {
    const english = chatRes.detected_language === 'English';
    try {
      const items = chatRes.pending_service_items || query;
      const lowerBellItems = String(items || '').toLowerCase();
      const isLostFound = [
        'thất lạc', 'that lac', 'mất đồ', 'mat do', 'quên đồ', 'quen do',
        'rơi đồ', 'roi do', 'tìm đồ', 'tim do', 'bỏ quên', 'bo quen', 'lost', 'missing', 'forgot',
      ].some((k) => lowerBellItems.includes(k));

      if (isLostFound) {
        const result = await createBellRequest({
          title: `Báo cáo đồ thất lạc Phòng ${String(authenticatedRoom).trim()}: ${items}`,
          location: String(authenticatedRoom).trim(),
          guest_name: `Guest (Room ${String(authenticatedRoom).trim()})`,
          reporter: 'HCRobot Voice AI (Session Authenticated)',
          description: `Khách yêu cầu qua giọng nói: ${items}`,
          request_type: 'lost_found',
        });
        chatRes.ticket_code = result.ticket_code;
        chatRes.response = english
          ? `Your lost & found report for Room ${authenticatedRoom} has been sent to Bell Services (ticket #${result.ticket_code}).`
          : `Dạ Rora đã tiếp nhận báo cáo đồ thất lạc của Phòng ${authenticatedRoom} và chuyển tới bộ phận Bellman / Lost & Found, mã phiếu #${result.ticket_code}.`;
      } else {
        const result = await createBellRequest({
          title: items,
          location: String(authenticatedRoom).trim(),
          description: items,
          service_key: 'auto',
          source: 'HCRobot Voice AI (Session Authenticated)',
        });
        chatRes.ticket_code = result.ticket_code;
        chatRes.response = bellRequestMessage(result, english);
      }
    } catch {
      chatRes.response = english
        ? 'Could not send your luggage request. Please try again.'
        : 'Chưa gửi được yêu cầu hành lý. Quý khách vui lòng thử lại.';
    }
    chatRes.require_room_pin = false;
    chatRes.audio_base64 = null;
    if (!isCurrentRequest()) return false;
  }

  return true;
}

/**
 * Executes an authenticated voice service action directly without prompting the PIN modal.
 */
export function dispatchAuthenticatedVoiceService({
  actionToExecute,
  itemsToExecute,
  authenticatedRoom,
  handleTriggerTaxiBooking,
}) {
  if (['taxi', 'book_taxi', 'taxi_booking'].includes(actionToExecute)) {
    handleTriggerTaxiBooking(authenticatedRoom);
  } else if (actionToExecute === 'maintenance') {
    createMaintenanceRequest({
      title: itemsToExecute || 'Yêu cầu bảo trì phòng qua giọng nói',
      category: 'general',
      location: String(authenticatedRoom).trim(),
      description: `Khách yêu cầu qua giọng nói: ${itemsToExecute}`,
      source: 'HCRobot Voice AI (Session Authenticated)',
      priority: 'NORMAL',
    }).catch(() => {});
  } else if (actionToExecute === 'bellman' || actionToExecute === 'lost_found') {
    const lowerItems = String(itemsToExecute || '').toLowerCase();
    const isLostFound =
      actionToExecute === 'lost_found' ||
      ['thất lạc', 'mất đồ', 'quên đồ', 'rơi đồ', 'lost', 'missing', 'forgot'].some((k) =>
        lowerItems.includes(k)
      );
    createBellRequest({
      title: isLostFound
        ? `Báo cáo đồ thất lạc Phòng ${String(authenticatedRoom).trim()}: ${itemsToExecute}`
        : `Yêu cầu hỗ trợ hành lý Phòng ${String(authenticatedRoom).trim()}: ${itemsToExecute}`,
      location: `Room ${String(authenticatedRoom).trim()}`,
      guest_name: `Guest (Room ${String(authenticatedRoom).trim()})`,
      reporter: 'HCRobot Voice AI (Session Authenticated)',
      description: `Khách yêu cầu qua giọng nói: ${itemsToExecute}`,
      request_type: isLostFound ? 'lost_found' : 'luggage',
    }).catch(() => {});
  } else if (
    actionToExecute !== 'query_order_status' &&
    actionToExecute !== 'query_service_status' &&
    actionToExecute !== 'query_taxi_status' &&
    actionToExecute !== 'query_maintenance_status'
  ) {
    createConciergeRequest({
      title: `Yêu cầu ${actionToExecute} từ giọng nói Robot`,
      room_number: String(authenticatedRoom).trim(),
      guest_name: 'Khách lưu trú',
      description: `Khách yêu cầu qua giọng nói: ${itemsToExecute}`,
      department: actionToExecute,
    }).catch(() => {});
  }
}
