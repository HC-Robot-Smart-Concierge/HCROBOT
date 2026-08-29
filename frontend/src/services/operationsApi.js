// =====================================================================
// AURORA OS - HOTEL OPERATIONS & HCROBOT API SERVICE
// Connects React Frontend with FastAPI Backend (http://localhost:8000)
// =====================================================================

import {
  INITIAL_ROOM_SERVICE_DATA,
  INITIAL_HOUSEKEEPING_DATA,
  INITIAL_BELL_SERVICES_DATA,
  INITIAL_MAINTENANCE_DATA,
  INITIAL_MANAGER_DATA,
} from '../data/mockHotelData';

const BASE_URL = '/api/v1/operations';
const AUTH_URL = '/api/v1/auth';

/**
 * Generic fetch with fallback to provided mock data if offline or error occurs.
 */
async function fetchWithFallback(url, options = {}, fallbackData = null) {
  try {
    const token = localStorage.getItem('aurora_jwt_token');
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(`[OperationsAPI] Fallback for ${url}:`, error.message);
    return fallbackData;
  }
}

// ---------------------------------------------------------
// 1. Room Service / F&B
// ---------------------------------------------------------
export const fetchRoomServiceDashboard = async () => {
  return await fetchWithFallback(`${BASE_URL}/dashboard/room-service`, {}, INITIAL_ROOM_SERVICE_DATA);
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
    `${BASE_URL}/room-service/orders/${orderId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify(statusData),
    },
    { id: orderId, ...statusData }
  );
};

export const assignRobotToOrder = async (orderId, robotData) => {
  return await fetchWithFallback(
    `${BASE_URL}/room-service/orders/${orderId}/assign-robot`,
    {
      method: 'POST',
      body: JSON.stringify(robotData),
    },
    { id: orderId, status: 'Delivering', assigned_staff_name: robotData.robot_name }
  );
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
    `${BASE_URL}/housekeeping/requests/${requestId}/assign`,
    {
      method: 'PATCH',
      body: JSON.stringify(assignData),
    },
    { id: requestId, ...assignData }
  );
};

// ---------------------------------------------------------
// 3. Bell Services
// ---------------------------------------------------------
export const fetchBellServicesDashboard = async () => {
  return await fetchWithFallback(`${BASE_URL}/dashboard/bell-services`, {}, INITIAL_BELL_SERVICES_DATA);
};

export const createBellRequest = async (requestData) => {
  return await fetchWithFallback(
    `${BASE_URL}/bell-services/requests`,
    {
      method: 'POST',
      body: JSON.stringify(requestData),
    },
    { id: `BS-${Date.now()}`, ...requestData, status: 'Pending' }
  );
};

export const updateBellRequestStatus = async (requestId, statusData) => {
  return await fetchWithFallback(
    `${BASE_URL}/bell-services/requests/${requestId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify(statusData),
    },
    { id: requestId, ...statusData }
  );
};

// ---------------------------------------------------------
// 4. Maintenance
// ---------------------------------------------------------
export const fetchMaintenanceDashboard = async () => {
  return await fetchWithFallback(`${BASE_URL}/dashboard/maintenance`, {}, INITIAL_MAINTENANCE_DATA);
};

export const createMaintenanceRequest = async (requestData) => {
  return await fetchWithFallback(
    `${BASE_URL}/maintenance/requests`,
    {
      method: 'POST',
      body: JSON.stringify(requestData),
    },
    { id: `MN-${Date.now()}`, ...requestData, status: 'Pending' }
  );
};

export const updateMaintenanceStatus = async (requestId, status, assignedTo = null) => {
  return await fetchWithFallback(
    `${BASE_URL}/maintenance/requests/${requestId}/status?status=${encodeURIComponent(status)}${
      assignedTo ? `&assigned_to=${encodeURIComponent(assignedTo)}` : ''
    }`,
    {
      method: 'PATCH',
    },
    { id: requestId, status, assigned_to: assignedTo }
  );
};

// ---------------------------------------------------------
// 5. Management Hub
// ---------------------------------------------------------
export const fetchManagerHubDashboard = async () => {
  return await fetchWithFallback(`${BASE_URL}/dashboard/manager-hub`, {}, INITIAL_MANAGER_DATA);
};

export const createManagementDirective = async (directiveData) => {
  return await fetchWithFallback(
    `${BASE_URL}/manager-hub/directives`,
    {
      method: 'POST',
      body: JSON.stringify(directiveData),
    },
    { id: `DIR-${Date.now()}`, ...directiveData, status: 'Unassigned' }
  );
};

export const assignManagementDirective = async (directiveId, status = 'In Progress', assignedStaffName = null) => {
  return await fetchWithFallback(
    `${BASE_URL}/manager-hub/directives/${directiveId}/assign?status=${encodeURIComponent(
      status
    )}${assignedStaffName ? `&assigned_staff_name=${encodeURIComponent(assignedStaffName)}` : ''}`,
    {
      method: 'PATCH',
    },
    { id: directiveId, status, assigned_staff_name: assignedStaffName }
  );
};

// ---------------------------------------------------------
// 6. Unified Requests & Generic Database Update
// ---------------------------------------------------------
export const fetchUnifiedRequests = async () => {
  return await fetchWithFallback(`${BASE_URL}/all-requests`, {}, null);
};

export const updateGenericRequestStatus = async (ticketId, status, assignedTo = null) => {
  return await fetchWithFallback(
    `${BASE_URL}/generic-request/${encodeURIComponent(ticketId)}/status?status=${encodeURIComponent(
      status
    )}${assignedTo ? `&assigned_to=${encodeURIComponent(assignedTo)}` : ''}`,
    {
      method: 'PATCH',
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
  const token = localStorage.getItem('aurora_token');
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
  return await fetchWithFallback(`${BASE_URL}/staff`, {}, INITIAL_MANAGER_DATA.staffRoster);
};
