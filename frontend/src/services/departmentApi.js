// =====================================================================
// AURORA OS - DEPARTMENT MANAGEMENT API SERVICE
// Connects React Frontend with FastAPI Backend (/api/v1/operations/departments)
// =====================================================================

const BASE_URL = '/api/v1/operations/departments';

/**
 * Generic query fetch helper with fallback support
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
    console.warn(`[DepartmentAPI] Fallback for ${url}:`, error.message);
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
 * Lấy danh sách các phòng ban khách sạn từ database
 * @param {boolean|null} isActive Lọc theo trạng thái hoạt động: true/false/null
 */
export const fetchDepartments = async (isActive = null) => {
  const query = isActive !== null ? `?is_active=${isActive}` : '';
  return await fetchWithFallback(`${BASE_URL}${query}`, {}, []);
};

/**
 * Lấy chi tiết một phòng ban theo ID hoặc mã code
 */
export const fetchDepartmentDetail = async (departmentId) => {
  return await fetchWithFallback(`${BASE_URL}/${encodeURIComponent(departmentId)}`, {}, null);
};

/**
 * Thêm mới phòng ban khách sạn
 */
export const createDepartment = async (departmentData) => {
  return await requestMutation(`${BASE_URL}`, {
    method: 'POST',
    body: JSON.stringify(departmentData),
  });
};

/**
 * Cập nhật thông tin phòng ban
 */
export const updateDepartment = async (departmentId, updateData) => {
  return await requestMutation(`${BASE_URL}/${encodeURIComponent(departmentId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updateData),
  });
};

/**
 * Vô hiệu hóa phòng ban (Soft Delete)
 */
export const deleteDepartment = async (departmentId) => {
  return await requestMutation(`${BASE_URL}/${encodeURIComponent(departmentId)}`, {
    method: 'DELETE',
  });
};
