import { OUTCOME, foldText, resolveNextStepIndex } from './workflowFlow';
import { isValidHotelRoom } from './roomHelper';

const DETAILS_SHOW_CONTENTS = new Set(['UI_SERVICE_FORM', 'SERVICE_FORM', 'UI_WAKEUP_FORM']);
const RECEIPT_SHOW_CONTENTS = new Set(['UI_CONFIRMATION', 'CONFIRMATION']);
const WAIT_SHOW_CONTENTS = new Set(['UI_WAITING_STAFF', 'CALL_STAFF_WAIT']);

const DEPARTMENT_KIND_MAP = {
  housekeeping: 'cleaning',
  buong_phong: 'cleaning',
  room_service: 'amenities',
  roomservice: 'amenities',
  phuc_vu_phong: 'amenities',
  food_and_beverage: 'food',
  f_b: 'food',
  kitchen: 'food',
  restaurant: 'food',
  nha_hang: 'food',
  bep: 'food',
  reception: 'reception',
  front_desk: 'reception',
  frontdesk: 'reception',
  le_tan: 'reception',
  tiep_tan: 'reception',
  bell_services: 'bell',
  bellservices: 'bell',
  bellman: 'bell',
  bell: 'bell',
  hanh_ly: 'bell',
  maintenance: 'maintenance',
  ky_thuat: 'maintenance',
  bao_tri: 'maintenance',
  taxi: 'taxi',
  concierge: 'concierge',
};

const KIND_DEPARTMENT_LABELS = {
  cleaning: 'Room Service',
  amenities: 'Room Service',
  food: 'Kitchen',
  taxi: 'Taxi / Concierge',
  wakeup: 'Reception',
  staff: 'Reception',
  reception: 'Reception',
  bell: 'Bell Services',
  maintenance: 'Maintenance',
  concierge: 'Concierge',
};

const NON_ROOM_KINDS = new Set(['staff', 'reception', 'concierge']);

const LOST_FOUND_REGEX =
  /(?:that lac|bi mat|mat do|mat vi|mat tui|mat dien thoai|mat the|mat chia|quen do|de quen|bo quen|roi do|lam roi|tim do|lost|missing|forgot)/i;

function normalizeDeptKey(value) {
  return foldText(value).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function guestRequestRequiresRoom(kind) {
  return !NON_ROOM_KINDS.has(kind);
}

export function departmentLabelForKind(kind) {
  return KIND_DEPARTMENT_LABELS[kind] || 'Reception';
}

export function guestRequestPhase(workflowId, step) {
  if (!step) return null;
  const params = step.params || {};
  const content = params.content_id || params.screen_mode;

  if (workflowId === 'wf-04-call-staff' && step.step_id === 'wf4-step-1' && step.type === 'COMMUNICATE') {
    return 'details';
  }
  if (step.type === 'SHOW') {
    if (DETAILS_SHOW_CONTENTS.has(content)) return 'details';
    if (WAIT_SHOW_CONTENTS.has(content)) return 'wait';
    if (RECEIPT_SHOW_CONTENTS.has(content)) return 'receipt';
    return null;
  }
  if (step.type === 'CREATE_REQUEST') {
    // Low-battery charging alert targets staff directly with no guest standing at the charger.
    if (params.service_type === 'ROBOT_CHARGING') return null;
    return 'confirm';
  }
  return null;
}

export function resolveCreateRequestConfig(workflowId, step) {
  const params = step?.params || {};
  const content = params.content_id || params.screen_mode;
  const serviceType = String(params.service_type || '').toUpperCase();
  const deptKey = normalizeDeptKey(params.target_department);

  let kind = 'cleaning';
  if (content === 'UI_WAKEUP_FORM' || serviceType === 'WAKEUP_CALL') {
    kind = 'wakeup';
  } else if (serviceType === 'CALL_STAFF' || workflowId === 'wf-04-call-staff') {
    kind = 'staff';
  } else if (serviceType === 'TAXI') {
    kind = 'taxi';
  } else if (content === 'UI_SERVICE_FORM' || content === 'SERVICE_FORM') {
    kind = 'cleaning';
  } else if (serviceType === 'HOUSEKEEPING') {
    kind = 'cleaning';
  } else if (deptKey && DEPARTMENT_KIND_MAP[deptKey]) {
    kind = DEPARTMENT_KIND_MAP[deptKey];
  }

  let selectableKinds = null;
  if (workflowId === 'wf-03-room-service' || content === 'UI_SERVICE_FORM' || content === 'SERVICE_FORM') {
    if (step?.type === 'SHOW' || step?.type === 'CREATE_REQUEST') {
      selectableKinds = ['cleaning', 'amenities', 'taxi'];
    }
  } else if (kind === 'cleaning' || kind === 'amenities') {
    selectableKinds = ['cleaning', 'amenities'];
  }

  const rawRoom = String(params.room_number || '').trim();
  const defaultRoom = params.room_source === 'verified_guest' ? '' : rawRoom;
  const defaultDetail = String(params.note || '').trim();

  return {
    kind,
    selectableKinds,
    needsRoom: guestRequestRequiresRoom(kind),
    defaultRoom: isValidHotelRoom(defaultRoom) ? defaultRoom : '',
    defaultLocation: defaultRoom,
    defaultDetail,
  };
}

export function hasFollowUpConfirmationStep(steps, currentIndex) {
  if (!Array.isArray(steps) || currentIndex < 0) return false;
  const nextIdx = resolveNextStepIndex(steps, currentIndex, { type: OUTCOME.DONE });
  if (nextIdx < 0 || !steps[nextIdx]) return false;
  const nextStep = steps[nextIdx];
  if (nextStep.type === 'COMMUNICATE') return true;
  if (nextStep.type === 'SHOW') {
    const content = nextStep.params?.content_id || nextStep.params?.screen_mode || '';
    return RECEIPT_SHOW_CONTENTS.has(content) || WAIT_SHOW_CONTENTS.has(content);
  }
  return false;
}

async function postOperationsJsonStrict(path, payload) {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('aurora_jwt_token') : null;
  const response = await fetch('/api/v1/operations/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.detail || 'Request failed: ' + response.status);
  }
  if (!result?.id) throw new Error('Missing request ID');
  return result;
}

// Workflow confirmation must use an actual server response, including on retry.
export async function submitGuestRequest({ kind, room, detail, time }) {
  const cleanRoom = String(room || '').trim();
  const cleanDetail = String(detail || '').trim();
  let path;
  let payload;

  switch (kind) {
    case 'taxi':
      path = 'taxi/requests';
      payload = {
        room_number: cleanRoom,
        destination: cleanDetail,
        pickup_location: 'Main Lobby',
        pickup_time: 'Immediate',
      };
      break;
    case 'cleaning':
    case 'amenities': {
      const name = cleanDetail || (kind === 'cleaning' ? 'Dọn phòng' : 'Yêu cầu tiện ích phòng');
      path = 'room-service/orders';
      payload = {
        room_number: cleanRoom,
        is_service_request: true,
        items: [{ name, qty: 1 }],
        note: cleanDetail || name,
      };
      break;
    }
    case 'food': {
      const itemName = cleanDetail || 'Đặt món ăn / đồ uống';
      path = 'room-service/orders';
      payload = {
        room_number: cleanRoom,
        is_service_request: false,
        items: [{ name: itemName, qty: 1 }],
        note: cleanDetail || itemName,
      };
      break;
    }
    case 'maintenance':
      path = 'maintenance/requests';
      payload = {
        title: cleanDetail || `Yêu cầu bảo trì phòng ${cleanRoom || 'Main Lobby'}`,
        category: 'general',
        location: cleanRoom || 'Main Lobby',
        description: cleanDetail || 'Yêu cầu hỗ trợ kỹ thuật từ Robot Kiosk',
        source: 'Robot Kiosk',
      };
      break;
    case 'bell': {
      const isLostFound = LOST_FOUND_REGEX.test(foldText(cleanDetail));
      path = 'bell-services/requests';
      payload = isLostFound
        ? {
            title: `Báo cáo đồ thất lạc Phòng ${cleanRoom}: ${cleanDetail || 'Thất lạc tài sản'}`,
            location: cleanRoom,
            guest_name: `Guest (Room ${cleanRoom})`,
            reporter: 'Robot Kiosk',
            description: cleanDetail || 'Báo mất / thất lạc đồ',
            request_type: 'lost_found',
            source: 'Robot Kiosk',
          }
        : {
            title: cleanDetail || 'Hỗ trợ hành lý',
            location: cleanRoom,
            description: cleanDetail || 'Hỗ trợ hành lý',
            request_type: 'luggage',
            service_key: 'auto',
            source: 'Robot Kiosk',
            reporter: 'Robot Kiosk',
          };
      break;
    }
    case 'concierge':
      path = 'concierge/requests';
      payload = {
        title: cleanDetail || 'Yêu cầu hỗ trợ Concierge',
        room_number: cleanRoom || 'Main Lobby Kiosk',
        guest_name: cleanRoom && isValidHotelRoom(cleanRoom) ? `Khách Phòng ${cleanRoom}` : 'Hotel Guest',
        description: cleanDetail || 'Khách yêu cầu hỗ trợ Concierge từ Robot Kiosk',
        notify: true,
      };
      break;
    case 'wakeup':
    case 'staff':
    case 'reception':
      path = 'reception/requests';
      payload = {
        room_number: cleanRoom || 'Lobby Desk',
        source: 'Robot Kiosk',
        title:
          kind === 'staff'
            ? 'Khách cần gặp nhân viên lễ tân'
            : kind === 'wakeup'
              ? 'Yêu cầu gọi báo thức lúc ' + time
              : cleanDetail
                ? `Yêu cầu Lễ tân: ${cleanDetail.slice(0, 80)}`
                : 'Yêu cầu hỗ trợ Lễ tân',
        description:
          kind === 'staff'
            ? cleanDetail
            : kind === 'wakeup'
              ? 'Phòng ' + cleanRoom + ' yêu cầu gọi báo thức lúc ' + time
              : cleanDetail || 'Khách cần nhân viên Lễ tân hỗ trợ tại sảnh',
      };
      break;
    default:
      throw new Error('Unknown service');
  }

  const result = await postOperationsJsonStrict(path, payload);
  return {
    id: result.id,
    code: result.ticket_code || result.order_number || result.id,
    department: departmentLabelForKind(kind),
  };
}

export async function submitSystemWorkflowRequest(step) {
  const params = step?.params || {};
  const location = String(params.room_number || 'Trạm Sạc Robot Sảnh').trim() || 'Trạm Sạc Robot Sảnh';
  const note = String(
    params.note || 'Robot sắp hết pin và đang chờ ở trạm sạc. Nhờ nhân viên cắm sạc cả pin động cơ và pin Pi 5.'
  ).trim();
  const result = await postOperationsJsonStrict('maintenance/requests', {
    title: 'Robot cần cắm sạc',
    category: 'robot_battery',
    location,
    description: note,
    source: 'Robot Kiosk',
  });
  return {
    id: result.id,
    code: result.ticket_code || result.id,
    department: 'Maintenance',
  };
}
