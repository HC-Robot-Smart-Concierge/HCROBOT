// =====================================================================
// AURORA OS - HOTEL OPERATIONS & HCROBOT API SERVICE
// Connects React Frontend with FastAPI Backend (http://localhost:8000)
// =====================================================================

import { BASE_URL, fetchWithFallback, requestRobotJson } from './operations/operationsCore';

export * from './operations/operationsFrontDeskApi';
export * from './operations/operationsMaintenanceAndTasksApi';
export * from './operations/operationsAdminApi';

// ---------------------------------------------------------
// 7. Room PIN Verification & Guest Check-In / Check-Out
// ---------------------------------------------------------

/**
 * Xác thực mã PIN 4 số hoặc 4 số cuối CCCD/Hộ chiếu hoặc thẻ NFC tại Robot Kiosk
 */
export const verifyRoomPin = async (roomNumber, pin = null, action = null, items = null, note = null, tagCode = null, skipTicketCreation = false, sessionId = null) => {
  const response = await fetch(`${BASE_URL}/rooms/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room_number: String(roomNumber),
      pin: pin ? String(pin) : null,
      tag_code: tagCode ? String(tagCode) : null,
      tagCode: tagCode ? String(tagCode) : null,
      nfc_card_uid: tagCode ? String(tagCode) : null,
      action,
      items,
      note,
      skip_ticket_creation: Boolean(skipTicketCreation),
      create_ticket: !skipTicketCreation,
      session_id: sessionId ? String(sessionId) : null,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail = errorData.detail;
    const msg = typeof detail === 'object' && detail ? detail.message : (detail || 'Mã PIN phòng không chính xác. Quý khách vui lòng thử lại sau.');
    const err = new Error(msg);
    err.data = typeof detail === 'object' ? detail : errorData;
    err.not_checked_in = Boolean(err.data?.not_checked_in);
    err.destination_key = err.data?.destination_key || (err.not_checked_in ? 'front_desk' : null);
    err.room_number = err.data?.room_number || roomNumber;
    throw err;
  }

  return await response.json();
};

/**
 * Xác thực bằng thẻ từ NFC / NDEF tagCode tại Robot Kiosk (Hỗ trợ quẹt tự động không cần nhập số phòng)
 */
export const verifyRoomNfc = async (tagCode, roomNumber = null, action = null, items = null, note = null, skipTicketCreation = false, sessionId = null) => {
  const response = await fetch(`${BASE_URL}/rooms/verify-nfc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_code: String(tagCode),
      tagCode: String(tagCode),
      nfc_card_uid: String(tagCode),
      room_number: roomNumber ? String(roomNumber) : null,
      action,
      items,
      note,
      skip_ticket_creation: Boolean(skipTicketCreation),
      create_ticket: !skipTicketCreation,
      session_id: sessionId ? String(sessionId) : null,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Thẻ NFC hoặc tagCode không hợp lệ hoặc phòng chưa check-in.');
  }

  return await response.json();
};

/**
 * Lấy danh sách toàn bộ phòng và trạng thái check-in, mã PIN
 */
export const fetchAllRooms = async () => {
  return await fetchWithFallback(`${BASE_URL}/rooms`, {}, []);
};

/**
 * Lễ tân thực hiện Check-in và cấp mã PIN phòng
 */
export const checkInRoom = async (roomId, checkInData) => {
  const response = await fetch(`${BASE_URL}/rooms/${encodeURIComponent(roomId)}/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(checkInData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi khi thực hiện Check-in.');
  }

  return await response.json();
};

/**
 * Lễ tân thực hiện Check-out và hủy mã PIN phòng
 */
export const checkOutRoom = async (roomId) => {
  const response = await fetch(`${BASE_URL}/rooms/${encodeURIComponent(roomId)}/check-out`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi khi thực hiện Check-out.');
  }

  return await response.json();
};

/**
 * Đồng bộ danh sách phòng trực tiếp từ file RAG hệ thống
 */
export const syncRoomsFromRAG = async () => {
  const response = await fetch(`${BASE_URL}/rooms/sync-rag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi khi đồng bộ phòng từ file RAG.');
  }

  return await response.json();
};

// ---------------------------------------------------------
// 11. Robot Profile, Job Execution History & Maintenance (RC-001)
// ---------------------------------------------------------
export const fetchRobotProfile = async (robotId = 'RC-001') => {
  return await requestRobotJson(`${BASE_URL}/robot/profile?robot_id=${encodeURIComponent(robotId)}`);
};

export const updateRobotProfile = async (profileData, robotId = 'RC-001') => {
  return await requestRobotJson(`${BASE_URL}/robot/profile?robot_id=${encodeURIComponent(robotId)}`, {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
};

export const fetchRobotJobs = async (params = {}) => {
  const query = new URLSearchParams();
  query.append('robot_id', params.robotId || 'RC-001');
  if (params.status && params.status !== 'ALL') query.append('status', params.status);
  if (params.triggerType && params.triggerType !== 'ALL') query.append('trigger_type', params.triggerType);
  if (params.limit) query.append('limit', String(params.limit));
  if (params.offset) query.append('offset', String(params.offset));
  return await requestRobotJson(`${BASE_URL}/robot/jobs?${query.toString()}`);
};

export const fetchRobotJobDetail = async (jobId) => {
  return await requestRobotJson(`${BASE_URL}/robot/jobs/${encodeURIComponent(jobId)}`);
};

export const createRobotJob = async (jobData) => {
  return await requestRobotJson(`${BASE_URL}/robot/jobs`, {
    method: 'POST',
    body: JSON.stringify(jobData),
  });
};

export const fetchRobotMaintenance = async (params = {}) => {
  const query = new URLSearchParams();
  query.append('robot_id', params.robotId || 'RC-001');
  if (params.status && params.status !== 'all') query.append('status', params.status);
  if (params.component && params.component !== 'all') query.append('component', params.component);
  return await requestRobotJson(`${BASE_URL}/robot/maintenance?${query.toString()}`);
};

export const createRobotMaintenance = async (payload) => {
  return await requestRobotJson(`${BASE_URL}/robot/maintenance`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateRobotMaintenance = async (scheduleId, payload) => {
  return await requestRobotJson(`${BASE_URL}/robot/maintenance/${encodeURIComponent(scheduleId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export const deleteRobotMaintenance = async (scheduleId) => {
  return await requestRobotJson(`${BASE_URL}/robot/maintenance/${encodeURIComponent(scheduleId)}`, {
    method: 'DELETE',
  });
};
