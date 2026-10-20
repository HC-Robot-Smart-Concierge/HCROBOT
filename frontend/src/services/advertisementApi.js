const API_BASE = '/api/v1/advertisements';

/**
 * Lấy danh sách toàn bộ quảng cáo cho Admin Tab
 */
export async function fetchAdvertisements() {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) {
      throw new Error(`Lỗi tải danh sách quảng cáo: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.error('fetchAdvertisements error:', err);
    throw err;
  }
}

/**
 * Lấy danh sách quảng cáo đang kích hoạt cho màn hình Robot
 */
export async function fetchActiveAdvertisements() {
  try {
    const res = await fetch(`${API_BASE}/active`);
    if (!res.ok) {
      throw new Error(`Lỗi tải quảng cáo active: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.error('fetchActiveAdvertisements error:', err);
    throw err;
  }
}

/**
 * Tải lên hình ảnh / video quảng cáo lên Cloudinary và lưu cấu hình
 * @param {FormData} formData
 */
export async function uploadAdvertisement(formData) {
  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.detail || 'Lỗi khi upload quảng cáo');
    }
    return await res.json();
  } catch (err) {
    console.error('uploadAdvertisement error:', err);
    throw err;
  }
}

/**
 * Tạo mới quảng cáo từ URL
 */
export async function createAdvertisement(payload) {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.detail || 'Lỗi khi tạo quảng cáo');
    }
    return await res.json();
  } catch (err) {
    console.error('createAdvertisement error:', err);
    throw err;
  }
}

/**
 * Cập nhật thông tin hoặc toggle bật/tắt quảng cáo
 */
export async function updateAdvertisement(adId, payload) {
  try {
    const res = await fetch(`${API_BASE}/${adId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.detail || 'Lỗi khi cập nhật quảng cáo');
    }
    return await res.json();
  } catch (err) {
    console.error('updateAdvertisement error:', err);
    throw err;
  }
}

/**
 * Xóa quảng cáo khỏi hệ thống và Cloudinary
 */
export async function deleteAdvertisement(adId) {
  try {
    const res = await fetch(`${API_BASE}/${adId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.detail || 'Lỗi khi xóa quảng cáo');
    }
    return await res.json();
  } catch (err) {
    console.error('deleteAdvertisement error:', err);
    throw err;
  }
}

/**
 * Đẩy quảng cáo trực tiếp xuống màn hình Robot tức thì
 */
export async function pushAdvertisementToRobot(adId) {
  try {
    const res = await fetch(`${API_BASE}/${adId}/push`, {
      method: 'POST',
    });
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson.detail || 'Lỗi khi đẩy quảng cáo xuống robot');
    }
    return await res.json();
  } catch (err) {
    console.error('pushAdvertisementToRobot error:', err);
    throw err;
  }
}
