import {
  INITIAL_RECEPTION_DATA,
  INITIAL_ROOM_SERVICE_DATA,
  INITIAL_HOUSEKEEPING_DATA,
} from '../../data/mockHotelData';
import { BASE_URL, fetchWithFallback } from './operationsCore';

// ---------------------------------------------------------
// 0. Reception / Front Desk
// ---------------------------------------------------------
export const fetchReceptionDashboard = async () => {
  return await fetchWithFallback(
    `${BASE_URL}/dashboard/reception`,
    {},
    { current_request: null, recent_requests: [] }
  );
};

export const updateReceptionRequest = async (requestId, updateData) => {
  return await fetchWithFallback(
    `${BASE_URL}/tasks/${encodeURIComponent(requestId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    },
    { ...INITIAL_RECEPTION_DATA, ...updateData }
  );
};

export const createReceptionRequest = async (requestData) => {
  return await fetchWithFallback(
    `${BASE_URL}/reception/requests`,
    {
      method: 'POST',
      body: JSON.stringify(requestData),
    },
    { id: `REC-${Date.now()}`, ...requestData, status: 'Pending' }
  );
};

export const fetchReceptionRequestById = async (requestId) => {
  return await fetchWithFallback(
    `${BASE_URL}/reception/requests/${encodeURIComponent(requestId)}`,
    {},
    null
  );
};

// ---------------------------------------------------------
// 1. Room Service / F&B
// ---------------------------------------------------------
export const fetchRoomServiceDashboard = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const url = query ? `${BASE_URL}/dashboard/room-service?${query}` : `${BASE_URL}/dashboard/room-service`;
  return await fetchWithFallback(url, {}, INITIAL_ROOM_SERVICE_DATA);
};

export const createRoomServiceOrder = async (orderData) => {
  return await fetchWithFallback(
    `${BASE_URL}/room-service/orders`,
    {
      method: 'POST',
      body: JSON.stringify(orderData),
    },
    { id: `ORD-${Date.now()}`, ...orderData, status: 'Pending' }
  );
};

export const updateRoomServiceOrderStatus = async (orderId, statusData) => {
  return await fetchWithFallback(
    `${BASE_URL}/tasks/${encodeURIComponent(orderId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(statusData),
    },
    { id: orderId, ...statusData }
  );
};

export const fetchRoomServiceOrderById = async (orderId) => {
  return await fetchWithFallback(
    `${BASE_URL}/room-service/orders/${encodeURIComponent(orderId)}`,
    {},
    null
  );
};

export const fetchRoomOrdersHistory = async (roomNumber) => {
  return await fetchWithFallback(
    `${BASE_URL}/room-service/rooms/${encodeURIComponent(roomNumber)}/orders`,
    {},
    { room_number: roomNumber, total_orders: 0, total_amount: 0, ordered_items_summary: [], orders: [] }
  );
};

export const fetchRoomOrderedItemsSummary = async (roomNumber) => {
  const history = await fetchRoomOrdersHistory(roomNumber);
  return history?.ordered_items_summary || [];
};

// ---------------------------------------------------------
// 1B. Room Service Catalog Management (Thực đơn / Dịch vụ phòng)
// ---------------------------------------------------------
export const fetchRoomServiceCatalog = async ({ category = null, is_available = null } = {}) => {
  try {
    const params = new URLSearchParams();
    if (category && category !== 'All') params.append('category', category);
    if (is_available !== null && is_available !== undefined) params.append('is_available', is_available);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return await fetchWithFallback(`${BASE_URL}/room-service/services${qs}`, {}, []);
  } catch (error) {
    console.warn('[OperationsAPI] Error fetching room service catalog:', error.message);
    return [];
  }
};

export const createRoomServiceCatalogItem = async (itemData) => {
  try {
    return await fetchWithFallback(
      `${BASE_URL}/room-service/services`,
      {
        method: 'POST',
        body: JSON.stringify(itemData),
      },
      { id: `SVC-${Date.now()}`, ...itemData }
    );
  } catch (error) {
    console.error('[OperationsAPI] Error creating room service item:', error.message);
    throw error;
  }
};

export const updateRoomServiceCatalogItem = async (itemId, updateData) => {
  try {
    return await fetchWithFallback(
      `${BASE_URL}/room-service/services/${encodeURIComponent(itemId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(updateData),
      },
      { id: itemId, ...updateData }
    );
  } catch (error) {
    console.error('[OperationsAPI] Error updating room service item:', error.message);
    throw error;
  }
};

export const deleteRoomServiceCatalogItem = async (itemId) => {
  try {
    return await fetchWithFallback(
      `${BASE_URL}/room-service/services/${encodeURIComponent(itemId)}`,
      {
        method: 'DELETE',
      },
      { id: itemId, detail: 'Đã xóa dịch vụ' }
    );
  } catch (error) {
    console.error('[OperationsAPI] Error deleting room service item:', error.message);
    throw error;
  }
};

export const toggleRoomServiceCatalogItem = async (itemId) => {
  try {
    return await fetchWithFallback(
      `${BASE_URL}/room-service/services/${encodeURIComponent(itemId)}/toggle`,
      {
        method: 'PATCH',
      },
      { id: itemId }
    );
  } catch (error) {
    console.error('[OperationsAPI] Error toggling room service item:', error.message);
    throw error;
  }
};

// ---------------------------------------------------------
// 2. Housekeeping
// ---------------------------------------------------------
export const fetchHousekeepingDashboard = async () => {
  return await fetchWithFallback(`${BASE_URL}/dashboard/housekeeping`, {}, INITIAL_HOUSEKEEPING_DATA);
};

export const createHousekeepingRequest = async (requestData) => {
  return await fetchWithFallback(
    `${BASE_URL}/housekeeping/requests`,
    {
      method: 'POST',
      body: JSON.stringify(requestData),
    },
    { id: `HK-${Date.now()}`, ...requestData, status: 'Unassigned' }
  );
};

export const assignHousekeepingStaff = async (requestId, assignData) => {
  return await fetchWithFallback(
    `${BASE_URL}/tasks/${encodeURIComponent(requestId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(assignData),
    },
    { id: requestId, ...assignData }
  );
};

export const fetchHousekeepingRequestById = async (requestId) => {
  return await fetchWithFallback(
    `${BASE_URL}/housekeeping/requests/${encodeURIComponent(requestId)}`,
    {},
    null
  );
};

// ---------------------------------------------------------
// 3. Bell Services
// ---------------------------------------------------------
// Returns null when the backend is unreachable, so staff never see mock requests as real ones.
export const fetchBellServicesDashboard = async () => {
  return await fetchWithFallback(`${BASE_URL}/dashboard/bell-services`, {}, null);
};

// Throws on failure: a guest or staff member must not be told a request was sent when it was not.
export const createBellRequest = async (requestData) => {
  const token = localStorage.getItem('aurora_jwt_token');
  const response = await fetch(`${BASE_URL}/bell-services/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(requestData),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.id || !result?.ticket_code) {
    throw new Error('Unable to create Bell Services request');
  }
  return result;
};

export const fetchRoomBellStatus = async (roomNumber) => {
  return await fetchWithFallback(
    `${BASE_URL}/bell-services/rooms/${encodeURIComponent(roomNumber)}/status`,
    {},
    { room_number: roomNumber, pending_count: 0, in_progress_count: 0, completed_count: 0, requests: [] }
  );
};

export const updateBellRequestStatus = async (requestId, statusData) => {
  return await fetchWithFallback(
    `${BASE_URL}/tasks/${encodeURIComponent(requestId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(statusData),
    },
    { id: requestId, ...statusData }
  );
};

export const fetchBellRequestById = async (requestId) => {
  return await fetchWithFallback(
    `${BASE_URL}/bell-services/requests/${encodeURIComponent(requestId)}`,
    {},
    null
  );
};
