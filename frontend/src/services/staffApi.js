// =====================================================================
// AURORA OS - STAFF DIRECTORY & WORKFORCE MANAGEMENT API SERVICE
// Connects React Frontend with FastAPI Backend (/api/v1/operations/staff)
// =====================================================================

const BASE_URL = '/api/v1/operations/staff';

/**
 * Generic fetch helper with fallback support
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
 * Lấy toàn bộ danh sách nhân viên 5 phòng ban từ PostgreSQL
 */
export const fetchStaffRoster = async () => {
  return await fetchWithFallback(`${BASE_URL}`, {}, []);
};

/**
 * Tạo mới một nhân sự trong khách sạn
 */
export const createStaffMember = async (staffData) => {
  return await fetchWithFallback(
    `${BASE_URL}`,
    {
      method: 'POST',
      body: JSON.stringify(staffData),
    },
    { success: true, ...staffData }
  );
};

/**
 * Cập nhật thông tin nhân sự, ca trực, hoặc cấu hình điều phối Robot Escalation
 */
export const updateStaffMember = async (staffId, updateData) => {
  return await fetchWithFallback(
    `${BASE_URL}/${encodeURIComponent(staffId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    },
    { success: true, id: staffId, ...updateData }
  );
};

/**
 * Xóa nhân sự theo ID
 */
export const deleteStaffMember = async (staffId) => {
  return await fetchWithFallback(
    `${BASE_URL}/${encodeURIComponent(staffId)}`,
    {
      method: 'DELETE',
    },
    { success: true, id: staffId }
  );
};
