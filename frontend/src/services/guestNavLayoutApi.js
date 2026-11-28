// Layout chỉ đường cho khách, vẽ chồng lên map Nav2 (toạ độ mét). Bảng riêng ở backend.
const API_BASE = '/api/v1/guest-nav';

const authHeaders = () => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('aurora_jwt_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Trả về layout hoặc null nếu map chưa có layout. */
export async function fetchGuestNavLayout(mapId) {
  const res = await fetch(`${API_BASE}/layouts/${encodeURIComponent(mapId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Không tải được layout (${res.status})`);
  return res.json();
}

export async function saveGuestNavLayout(mapId, layout) {
  const res = await fetch(`${API_BASE}/layouts/${encodeURIComponent(mapId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(layout),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = Array.isArray(err.detail) ? err.detail.map((d) => d.msg).join('; ') : err.detail;
    throw new Error(detail || `Lưu thất bại (${res.status})`);
  }
  return res.json();
}

export async function deleteGuestNavLayout(mapId) {
  const res = await fetch(`${API_BASE}/layouts/${encodeURIComponent(mapId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Xoá thất bại (${res.status})`);
  }
  return res.json();
}
