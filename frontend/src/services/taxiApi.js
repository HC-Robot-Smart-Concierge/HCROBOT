// =====================================================================
// AURORA OS - TAXI & TRANSPORTATION API SERVICE
// Connects React Frontend with FastAPI Backend (/api/v1/operations/taxi)
// =====================================================================

const BASE_URL = '/api/v1/operations/taxi';
const DASHBOARD_URL = '/api/v1/operations/dashboard/taxi';

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
    console.warn(`[TaxiAPI] Fallback for ${url}:`, error.message);
    return fallbackData;
  }
}

/**
 * 1. Lay so lieu tong quan Dashboard Dieu phoi Xe Taxi (KPIs, Cuoc xe)
 */
export async function fetchTaxiDashboard() {
  return await fetchWithFallback(DASHBOARD_URL, {}, {
    kpis: {
      totalRequests: 0,
      pendingRequests: 0,
      activeTrips: 0,
      completedTrips: 0,
    },
    requests: [],
  });
}

/**
 * 2. Lay danh sach tat ca yeu cau dat xe
 */
export async function fetchTaxiRequests(params = {}) {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'All') query.append('status', params.status);
  if (params.search) query.append('search', params.search);
  if (params.limit) query.append('limit', params.limit);
  const qs = query.toString() ? `?${query.toString()}` : '';
  return await fetchWithFallback(`${BASE_URL}/requests${qs}`, {}, []);
}

/**
 * 3. Tao moi yeu cau dat xe taxi / dua don san bay
 */
export async function createTaxiRequest(requestData) {
  return await fetchWithFallback(
    `${BASE_URL}/requests`,
    {
      method: 'POST',
      body: JSON.stringify(requestData),
    },
    {
      id: `TXI-${Date.now()}`,
      ticket_code: `TXI-${Math.floor(1000 + Math.random() * 9000)}`,
      ...requestData,
      status: 'Pending',
      created_at: new Date().toISOString(),
    }
  );
}

/**
 * 4. Cap nhat trang thai cuoc xe va dieu phoi tai xe
 */
export async function updateTaxiRequestStatus(requestId, status, assignedDriver = null) {
  return await fetchWithFallback(
    `${BASE_URL}/requests/${encodeURIComponent(requestId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        assigned_driver: assignedDriver,
      }),
    },
    {
      id: requestId,
      status,
      assigned_driver: assignedDriver,
    }
  );
}
