/**
 * Service tầng giao tiếp API quản lý Kịch bản hội thoại động (AI Scenarios & Fast-Path Rules).
 * Kết nối tới Backend FastAPI: /api/v1/ai/scenarios.
 */

const SCENARIOS_BASE_URL = '/api/v1/ai/scenarios';

/**
 * Lấy danh sách kịch bản hội thoại có hỗ trợ phân loại và tìm kiếm.
 */
export const fetchScenarios = async ({ category = '', isActive = null, search = '' } = {}) => {
  try {
    const params = new URLSearchParams();
    if (category && category !== 'All') params.append('category', category);
    if (isActive !== null && isActive !== undefined) params.append('is_active', isActive);
    if (search) params.append('search', search);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${SCENARIOS_BASE_URL}${qs}`);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    throw new Error(`Lỗi khi tải danh sách kịch bản: ${error.message}`);
  }
};

/**
 * Lấy chi tiết một kịch bản theo ID.
 */
export const fetchScenarioById = async (id) => {
  try {
    const res = await fetch(`${SCENARIOS_BASE_URL}/${id}`);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    throw new Error(`Lỗi khi lấy chi tiết kịch bản: ${error.message}`);
  }
};

/**
 * Tạo một kịch bản hội thoại mới (tự động nạp vào RAM cache).
 */
export const createScenario = async (scenarioData) => {
  try {
    const res = await fetch(SCENARIOS_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scenarioData),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error! status: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    throw new Error(`Lỗi khi tạo kịch bản: ${error.message}`);
  }
};

/**
 * Cập nhật kịch bản hội thoại (tự động cập nhật RAM cache).
 */
export const updateScenario = async (id, updateData) => {
  try {
    const res = await fetch(`${SCENARIOS_BASE_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error! status: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    throw new Error(`Lỗi khi cập nhật kịch bản: ${error.message}`);
  }
};

/**
 * Xóa một kịch bản hội thoại.
 */
export const deleteScenario = async (id) => {
  try {
    const res = await fetch(`${SCENARIOS_BASE_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error! status: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    throw new Error(`Lỗi khi xóa kịch bản: ${error.message}`);
  }
};

/**
 * Tải lại RAM Cache thủ công từ cơ sở dữ liệu.
 */
export const reloadScenariosCache = async () => {
  try {
    const res = await fetch(`${SCENARIOS_BASE_URL}/reload-cache`, {
      method: 'POST',
    });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    throw new Error(`Lỗi khi tải lại cache kịch bản: ${error.message}`);
  }
};
