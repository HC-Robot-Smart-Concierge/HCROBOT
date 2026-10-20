// =====================================================================
// AURORA OS - STAFF DIRECTORY & WORKFORCE MANAGEMENT API SERVICE
// Connects React Frontend with FastAPI Backend (/api/v1/operations/accounts)
// =====================================================================

const BASE_URL = '/api/v1/operations/accounts';

/**
 * Generic fetch helper with fallback support for queries (GET)
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
    console.warn(`[StaffAPI] Fallback for ${url}:`, error.message);
    return fallbackData;
  }
}

/**
 * Mutation helper that throws descriptive errors on failure
 */
async function requestMutation(url, options = {}) {
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
    let errorDetail = `Lỗi máy chủ (${response.status})`;
    try {
      const errData = await response.json();
      if (errData?.detail) {
        errorDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {}
    throw new Error(errorDetail);
  }

  return await response.json();
}

/**
 * Lấy toàn bộ danh sách nhân viên từ backend
 */
export const fetchStaffRoster = async () => {
  return await fetchWithFallback(`${BASE_URL}`, {}, []);
};

/**
 * Tạo mới một nhân sự trong khách sạn
 */
export const createStaffMember = async (staffData) => {
  return await requestMutation(`${BASE_URL}`, {
    method: 'POST',
    body: JSON.stringify(staffData),
  });
};

/**
 * Cập nhật thông tin nhân sự, ca trực, hoặc cấu hình điều phối Robot Escalation
 */
export const updateStaffMember = async (staffId, updateData) => {
  return await requestMutation(`${BASE_URL}/${encodeURIComponent(staffId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updateData),
  });
};

/**
 * Xóa nhân sự theo ID
 */
export const deleteStaffMember = async (staffId) => {
  return await requestMutation(`${BASE_URL}/${encodeURIComponent(staffId)}`, {
    method: 'DELETE',
  });
};

/**
 * Lấy danh sách các phòng ban khách sạn chuẩn từ database (bảng departments)
 */
export const fetchDepartments = async () => {
  return await fetchWithFallback('/api/v1/operations/departments', {}, []);
};
