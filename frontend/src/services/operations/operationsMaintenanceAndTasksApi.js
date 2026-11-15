import { INITIAL_ROOM_SERVICE_DATA } from '../../data/mockHotelData';
import { AUTH_URL, BASE_URL, fetchWithFallback } from './operationsCore';

// ---------------------------------------------------------
// 4. Maintenance
// ---------------------------------------------------------
export const fetchMaintenanceDashboard = async () => {
  return await fetchWithFallback(`${BASE_URL}/dashboard/maintenance`, {}, null);
};

export const createMaintenanceRequest = async (requestData) => {
  const token = localStorage.getItem('aurora_jwt_token');
  const response = await fetch(`${BASE_URL}/maintenance/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(requestData),
  });
  const result = await response.json();
  if (!response.ok || !result?.id || !result?.ticket_code) {
    throw new Error('Unable to create maintenance request');
  }
  return result;
};

export const updateMaintenanceStatus = async (requestId, status, assignedTo = null) => {
  return await fetchWithFallback(
    `${BASE_URL}/maintenance/requests/${encodeURIComponent(requestId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        assigned_to: assignedTo,
      }),
    },
    { id: requestId, status, assigned_to: assignedTo }
  );
};

export const updateMaintenancePriority = async (requestId, priority) => {
  const token = localStorage.getItem('aurora_jwt_token');
  const response = await fetch(`${BASE_URL}/maintenance/requests/${encodeURIComponent(requestId)}/priority`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ priority }),
  });
  if (!response.ok) throw new Error('Could not update repair priority');
  return response.json();
};

export const fetchMaintenanceRequestById = async (requestId) => {
  return await fetchWithFallback(
    `${BASE_URL}/maintenance/requests/${encodeURIComponent(requestId)}`,
    {},
    null
  );
};

export const fetchMaintenanceCatalog = async ({ category = null, is_active = null } = {}) => {
  try {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (is_active !== null && is_active !== undefined) params.append('is_active', is_active);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return await fetchWithFallback(`${BASE_URL}/maintenance/catalog${qs}`, {}, []);
  } catch (error) {
    console.warn('[OperationsAPI] Error fetching maintenance catalog:', error.message);
    return [];
  }
};

export const createMaintenanceCatalogItem = async (itemData) => {
  try {
    return await fetchWithFallback(
      `${BASE_URL}/maintenance/catalog`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
      },
      { id: `MNT-${Date.now()}`, ...itemData, is_active: true }
    );
  } catch (error) {
    console.error('[OperationsAPI] Error creating maintenance catalog item:', error.message);
    throw error;
  }
};

export const updateMaintenanceCatalogItem = async (itemId, updateData) => {
  try {
    return await fetchWithFallback(
      `${BASE_URL}/maintenance/catalog/${encodeURIComponent(itemId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      },
      { id: itemId, ...updateData }
    );
  } catch (error) {
    console.error('[OperationsAPI] Error updating maintenance catalog item:', error.message);
    throw error;
  }
};

export const deleteMaintenanceCatalogItem = async (itemId) => {
  try {
    return await fetchWithFallback(
      `${BASE_URL}/maintenance/catalog/${encodeURIComponent(itemId)}`,
      {
        method: 'DELETE',
      },
      { message: 'Deleted', id: itemId }
    );
  } catch (error) {
    console.error('[OperationsAPI] Error deleting maintenance catalog item:', error.message);
    throw error;
  }
};

export const toggleMaintenanceCatalogItem = async (itemId) => {
  try {
    return await fetchWithFallback(
      `${BASE_URL}/maintenance/catalog/${encodeURIComponent(itemId)}/toggle`,
      {
        method: 'PATCH',
      },
      { id: itemId, is_active: true }
    );
  } catch (error) {
    console.error('[OperationsAPI] Error toggling maintenance catalog item:', error.message);
    throw error;
  }
};

export const fetchRoomMaintenanceStatus = async (roomNumber) => {
  try {
    return await fetchWithFallback(
      `${BASE_URL}/maintenance/rooms/${encodeURIComponent(roomNumber)}/status`,
      {},
      { room_number: roomNumber, total_requests: 0, pending_count: 0, in_progress_count: 0, completed_count: 0, requests: [] }
    );
  } catch (error) {
    console.warn('[OperationsAPI] Error fetching room maintenance status:', error.message);
    return { room_number: roomNumber, total_requests: 0, pending_count: 0, in_progress_count: 0, completed_count: 0, requests: [] };
  }
};

// ---------------------------------------------------------
// 5. Operational Directives
// ---------------------------------------------------------
export const createOperationalDirective = async (directiveData) => {
  return await fetchWithFallback(
    `${BASE_URL}/directives`,
    {
      method: 'POST',
      body: JSON.stringify(directiveData),
    },
    { id: `DIR-${Date.now()}`, ...directiveData, status: 'Unassigned' }
  );
};

// ---------------------------------------------------------
// 6. Unified Requests & Generic Database Update
// ---------------------------------------------------------
export const fetchUnifiedRequests = async () => {
  return await fetchWithFallback(`${BASE_URL}/tasks`, {}, []);
};

export const fetchRoomAllRequests = async (roomNumber) => {
  const tasks = await fetchWithFallback(
    `${BASE_URL}/tasks?room_number=${encodeURIComponent(roomNumber)}`,
    {},
    []
  );
  return {
    room_number: roomNumber,
    total_requests: Array.isArray(tasks) ? tasks.length : 0,
    requests: Array.isArray(tasks) ? tasks : [],
  };
};

export const fetchDepartmentTasks = async (department, status = null) => {
  const query = new URLSearchParams();
  if (department && department !== 'All') query.append('department', department);
  if (status && status !== 'All') query.append('status', status);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return await fetchWithFallback(`${BASE_URL}/tasks${qs}`, {}, []);
};

export const updateGenericRequestStatus = async (ticketId, status, assignedTo = null) => {
  return await fetchWithFallback(
    `${BASE_URL}/tasks/${encodeURIComponent(ticketId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        assigned_to: assignedTo,
      }),
    },
    { success: true, id: ticketId, status }
  );
};

export const restockInventory = async (stockId, addQuantity = 10) => {
  return await fetchWithFallback(
    `${BASE_URL}/stock/${encodeURIComponent(stockId)}/restock?add_quantity=${addQuantity}`,
    {
      method: 'PATCH',
    },
    { id: stockId, quantity: 20, level: 'normal' }
  );
};

// ---------------------------------------------------------
// 7. Staff Profile & Password Update in Database
// ---------------------------------------------------------
export const changeStaffPassword = async (currentPassword, newPassword, username = null) => {
  return await fetchWithFallback(
    `${AUTH_URL}/change-password`,
    {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        username,
      }),
    },
    { message: 'Mật khẩu đã được cập nhật!' }
  );
};

export const updateStaffProfile = async (profileData) => {
  const token = localStorage.getItem('aurora_jwt_token') || localStorage.getItem('aurora_token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return await fetchWithFallback(
    `${AUTH_URL}/profile`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(profileData),
    },
    profileData
  );
};

// ---------------------------------------------------------
// 8. Common Fleet & Staff
// ---------------------------------------------------------
export const fetchRobotFleet = async () => {
  return await fetchWithFallback(`${BASE_URL}/fleet`, {}, INITIAL_ROOM_SERVICE_DATA.deliveryFleet);
};

export const fetchStaffRoster = async () => {
  return await fetchWithFallback(`${BASE_URL}/staff`, {}, []);
};
