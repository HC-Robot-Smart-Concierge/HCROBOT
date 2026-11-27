// =====================================================================
// AURORA OS - TAXI & TRANSPORTATION API SERVICE
// Connects React Frontend with FastAPI Backend (/api/v1/operations/taxi)
// =====================================================================

const BASE_URL = '/api/v1/operations/taxi';
const DASHBOARD_URL = '/api/v1/operations/dashboard/taxi';

async function fetchJsonStrict(url, options = {}) {
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
    let detail = `HTTP error! status: ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody?.detail) {
        detail = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
      }
    } catch {
      // Ignore non-JSON error body
    }
    throw new Error(detail);
  }

  return await response.json();
}

async function fetchWithFallback(url, options = {}, fallbackData = null) {
  try {
    return await fetchJsonStrict(url, options);
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
  return await fetchJsonStrict(`${BASE_URL}/requests`, {
    method: 'POST',
    body: JSON.stringify(requestData),
  });
}

/**
 * 4. Cap nhat trang thai yeu cau taxi (Concierge nhan yeu cau -> Dang goi -> Thanh cong)
 */
export async function updateTaxiRequestStatus(requestId, status, note = null) {
  const payload = { status, note };
  try {
    const res = await fetchWithFallback(
      `${BASE_URL}/requests/${encodeURIComponent(requestId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      null
    );
    if (res && res.id) return res;
  } catch {
    // fallback
  }

  return await fetchWithFallback(
    `/api/v1/operations/tasks/${encodeURIComponent(requestId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    {
      id: requestId,
      status,
    }
  );
}

/**
 * 4b. Concierge nhap thong tin xe da dat giup khach va chuyen yeu cau sang Thanh cong.
 * Bao loi ro rang (khong fallback) de nhan vien biet thong tin chua duoc luu.
 */
export async function arrangeTaxiRequest(requestId, details = {}) {
  const clean = (value) => {
    const text = typeof value === 'string' ? value.trim() : value;
    return text ? text : null;
  };
  return await fetchJsonStrict(`${BASE_URL}/requests/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'Completed',
      taxi_company: clean(details.taxi_company),
      vehicle_type: clean(details.vehicle_type),
      license_plate: clean(details.license_plate),
      assigned_driver: clean(details.driver_name),
      driver_phone: clean(details.driver_phone),
      pickup_time: clean(details.pickup_time),
      arrangement_note: clean(details.note),
      arranged_by: clean(details.arranged_by),
    }),
  });
}

/**
 * 5. Xem chi tiet mot yeu cau dat xe taxi
 */
export async function fetchTaxiRequestById(requestId) {
  return await fetchWithFallback(`${BASE_URL}/requests/${encodeURIComponent(requestId)}`, {}, null);
}
