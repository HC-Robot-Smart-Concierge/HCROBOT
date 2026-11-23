/**
 * Strict, non-faking service request dispatcher for Robot Kiosk voice flows
 * (both post-PIN completion and session-authenticated fallback).
 *
 * Ensures voice requests for Food, Room Service/Housekeeping/Laundry, Bellman,
 * Maintenance, and Reception persist cleanly to PostgreSQL and trigger the
 * corresponding department notifications instead of misrouting to Concierge Live Call.
 */

import {
  createBellRequest,
  createMaintenanceRequest,
  createRoomServiceOrder,
} from '../services/operationsApi';
import { createConciergeRequest } from '../services/conciergeApi';
import { bellRequestMessage } from '../components/robot/RobotBellmanMenuScreen';
import { INITIAL_FOOD_ITEMS } from '../components/robot/RobotFoodMenuScreen';
import { ROOM_SERVICE_CATALOG } from '../components/robot/RobotRoomServiceScreen';
import { matchCatalogItemsByVoice, normalizeVoiceText } from './menuVoiceAssistant';

const ROOM_SERVICE_AMENITY_HINTS = [
  'khan', 'goi', 'chan', 'men', 'nem', 'don phong', 've sinh', 'thu don', 'tinh dau',
  'giat', 'ui', 'ban ui', 'ban chai', 'kem danh rang', 'dao cao', 'dau goi', 'sua tam',
  'ao choang', 'dep', 'massage', 'spa', 'towel', 'pillow', 'blanket', 'clean', 'laundry',
  'iron', 'toothbrush', 'shampoo', 'slipper',
];

function isLostFoundItems(action, itemsText) {
  if (action === 'lost_found') return true;
  const norm = normalizeVoiceText(itemsText);
  return /(?:that lac|bi mat|mat do|mat vi|mat tui|mat dien thoai|mat the|mat chia|quen do|de quen|bo quen|roi do|lam roi|tim do|lost|missing|forgot)/.test(norm);
}

function isRoomAmenityRequest(action, itemsText) {
  if (['housekeeping', 'laundry', 'amenity_order'].includes(action)) return true;
  const norm = normalizeVoiceText(itemsText);
  return ROOM_SERVICE_AMENITY_HINTS.some((tok) => norm.includes(tok));
}

async function postReceptionRequestStrict(payload) {
  const token = localStorage.getItem('aurora_jwt_token');
  const response = await fetch('/api/v1/operations/reception/requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail || `HTTP error! status: ${response.status}`);
  }
  return data;
}

/**
 * Executes a room-verified voice service request against the proper department endpoint.
 * Returns { ticketCode, department, spokenMessage, rawResult }.
 */
export async function dispatchVerifiedServiceRequest({
  action,
  roomNumber,
  itemsText = '',
  isEn = false,
  source = 'HCRobot Voice AI',
  precreatedResult = null,
}) {
  const room = String(roomNumber || '').trim();
  const text = String(itemsText || '').trim();

  if (action === 'maintenance') {
    const res = await createMaintenanceRequest({
      title: text || (isEn ? 'Room maintenance request' : 'Yêu cầu bảo trì phòng qua giọng nói'),
      category: 'general',
      location: room,
      description: text ? `Khách yêu cầu qua giọng nói: ${text}` : 'Khách yêu cầu bảo trì qua giọng nói',
      source,
      priority: 'NORMAL',
    });
    const code = res?.ticket_code || res?.id || '';
    const spokenMessage = res?.merged
      ? (isEn
          ? `The additional issue was added to repair request #${code}. No new ticket was created.`
          : `Đã bổ sung sự cố vào phiếu sửa chữa #${code}. Không tạo thêm phiếu mới.`)
      : res?.duplicate
        ? (isEn
            ? `Room ${room} already has an open repair request #${code}. No duplicate ticket was created.`
            : `Phòng ${room} đã có phiếu sửa chữa #${code} đang xử lý. Không tạo thêm phiếu mới.`)
        : (isEn
            ? `Your repair request #${code} for Room ${room} has been sent to Maintenance.`
            : `Phiếu sửa chữa #${code} cho Phòng ${room} đã được gửi tới bộ phận Kỹ thuật.`);
    return { ticketCode: code, department: 'Maintenance', spokenMessage, rawResult: res };
  }

  if (action === 'bellman' || action === 'lost_found') {
    if (precreatedResult?.ticket_code && action === 'bellman') {
      return {
        ticketCode: precreatedResult.ticket_code,
        department: 'Bell Services',
        spokenMessage: bellRequestMessage(precreatedResult, isEn),
        rawResult: precreatedResult,
      };
    }

    if (isLostFoundItems(action, text)) {
      const res = await createBellRequest({
        title: `Báo cáo đồ thất lạc Phòng ${room}: ${text || 'Thất lạc tài sản'}`,
        location: room,
        guest_name: `Guest (Room ${room})`,
        reporter: source,
        description: `Khách yêu cầu qua giọng nói: ${text || 'Báo mất / thất lạc đồ'}`,
        request_type: 'lost_found',
      });
      const code = res?.ticket_code || res?.id || '';
      return {
        ticketCode: code,
        department: 'Bell Services',
        spokenMessage: isEn
          ? `Your lost & found report for Room ${room} has been sent to Bell Services (ticket #${code}).`
          : `Dạ Rora đã tiếp nhận báo cáo đồ thất lạc của Phòng ${room} và chuyển tới bộ phận Bellman / Lễ tân, mã phiếu #${code}.`,
        rawResult: res,
      };
    }

    const res = await createBellRequest({
      title: text || (isEn ? 'Luggage assistance' : 'Hỗ trợ hành lý'),
      location: room,
      description: text || 'Hỗ trợ hành lý',
      service_key: 'auto',
      source,
    });
    return {
      ticketCode: res?.ticket_code || res?.id || '',
      department: 'Bell Services',
      spokenMessage: bellRequestMessage(res, isEn),
      rawResult: res,
    };
  }

  if (['housekeeping', 'laundry', 'room_service', 'food_order', 'amenity_order', 'restaurant'].includes(action)) {
    const isServiceReq = isRoomAmenityRequest(action, text);
    const catalog = isServiceReq ? ROOM_SERVICE_CATALOG : INITIAL_FOOD_ITEMS;
    const matched = matchCatalogItemsByVoice(text, catalog);
    const orderItems = matched.length > 0
      ? matched.map(({ item, qty }) => ({
          name: item.name,
          qty,
          ...(isServiceReq ? {} : { menu_item_id: item.id }),
        }))
      : [{ name: text || (isServiceReq ? 'Dịch vụ buồng phòng' : 'Đơn gọi món tại phòng'), qty: 1 }];

    const res = await createRoomServiceOrder({
      room_number: room,
      guest_name: `Khách Phòng ${room}`,
      items: orderItems,
      note: `${source}: ${text || orderItems.map((i) => i.name).join(', ')}`,
      is_service_request: isServiceReq,
    });

    const code = res?.order_number || res?.ticket_code || res?.id || '';
    const deptLabel = isServiceReq ? 'Room Service' : (isEn ? 'Kitchen' : 'Bếp');
    const summaryList = orderItems.map((i) => `${i.qty}x ${i.name}`).join(', ');
    return {
      ticketCode: code,
      department: isServiceReq ? 'Room Service' : 'Kitchen',
      spokenMessage: isEn
        ? `Your request (${summaryList}) for Room ${room} has been sent to ${deptLabel}${code ? ` (#${code})` : ''}.`
        : `Dạ yêu cầu (${summaryList}) cho Phòng ${room} đã được lưu và gửi tới bộ phận ${deptLabel}${code ? ` (mã #${code})` : ''} ạ.`,
      rawResult: res,
    };
  }

  if (action === 'concierge') {
    const res = await createConciergeRequest({
      title: text || `Yêu cầu hỗ trợ Concierge Phòng ${room}`,
      room_number: room || 'Main Lobby Kiosk',
      guest_name: room ? `Khách Phòng ${room}` : 'Khách tại Sảnh',
      description: `Khách yêu cầu qua giọng nói: ${text}`,
    });
    const code = res?.ticket_code || res?.id || '';
    return {
      ticketCode: code,
      department: 'Concierge',
      spokenMessage: isEn
        ? `Concierge has been notified for Room ${room}${code ? ` (#${code})` : ''}.`
        : `Dạ Rora đã gửi thông báo tới bộ phận Concierge cho Phòng ${room}${code ? ` (#${code})` : ''} ạ.`,
      rawResult: res,
    };
  }

  const res = await postReceptionRequestStrict({
    title: text ? `Yêu cầu Phòng ${room}: ${text.slice(0, 80)}` : `Yêu cầu hỗ trợ Phòng ${room}`,
    room_number: room || 'Lobby Desk',
    guest_name: room ? `Khách Phòng ${room}` : 'Hotel Guest',
    description: `Khách yêu cầu qua giọng nói (${action}): ${text}`,
    source,
  });
  const code = res?.ticket_code || res?.id || '';
  return {
    ticketCode: code,
    department: 'Reception',
    spokenMessage: isEn
      ? `Your request for Room ${room} has been recorded and sent to Reception${code ? ` (#${code})` : ''}.`
      : `Dạ Rora đã ghi nhận yêu cầu cho Phòng ${room} và chuyển tới bộ phận Lễ tân${code ? ` (mã #${code})` : ''} ạ.`,
    rawResult: res,
  };
}
