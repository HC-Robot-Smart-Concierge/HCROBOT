// =====================================================================
// AURORA OS - CONCIERGE & LIVE SUPPORT API SERVICE
// Connects React Frontend with FastAPI Backend (/api/v1/operations/concierge)
// =====================================================================

const BASE_URL = '/api/v1/operations/concierge';
const DASHBOARD_URL = '/api/v1/operations/dashboard/concierge';

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
    console.warn(`[ConciergeAPI] Fallback for ${url}:`, error.message);
    return fallbackData;
  }
}

/**
 * 1. Lay so lieu Dashboard Concierge va phien Live Call moi nhat
 */
export async function fetchConciergeDashboard() {
  return await fetchWithFallback(DASHBOARD_URL, {}, {
    current_request: null,
    active_sessions_count: 0,
  });
}

/**
 * 2. Khoi tao phien ho tro Live Call / Video Call tu Robot Kiosk
 */
export async function createConciergeRequest(requestData) {
  return await fetchWithFallback(
    `${BASE_URL}/requests`,
    {
      method: 'POST',
      body: JSON.stringify(requestData),
    },
    {
      id: `CCG-${Date.now()}`,
      ticket_code: `CCG-${Math.floor(1000 + Math.random() * 9000)}`,
      ...requestData,
      status: 'Pending',
      created_at: new Date().toISOString(),
    }
  );
}

/**
 * 3. Cap nhat trang thai cuoc goi, phan cong hoac dong phien Live Call Concierge
 */
export async function updateConciergeRequest(requestId, updateData) {
  return await fetchWithFallback(
    `${BASE_URL}/requests/${encodeURIComponent(requestId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    },
    {
      id: requestId,
      ...updateData,
    }
  );
}

/**
 * 4. Lay danh sach tat ca cac phien yeu cau Concierge
 */
export async function fetchConciergeRequests(params = {}) {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'All') query.append('status', params.status);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return await fetchWithFallback(`${BASE_URL}/requests${qs}`, {}, []);
}

/**
 * 5. Xem chi tiet mot phien yeu cau Concierge
 */
export async function fetchConciergeRequestById(requestId) {
  return await fetchWithFallback(`${BASE_URL}/requests/${encodeURIComponent(requestId)}`, {}, null);
}

