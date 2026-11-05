/**
 * Utility to format ISO timestamp or date into relative time-ago string (Vietnamese / English).
 * Automatically normalizes UTC timestamps without trailing 'Z' to avoid UTC+7 skew.
 */
export const formatTimeAgo = (dateInput, fallback = 'Vừa đặt', lang = 'vi') => {
  if (!dateInput) return fallback;

  // If already a relative formatted string, preserve it
  if (typeof dateInput === 'string' && /^(vừa đặt|just now|\d+\s*(?:phút|giờ|ngày|mins?|hours?|days?)\s*(?:trước|ago))/i.test(dateInput.trim())) {
    return dateInput.trim();
  }

  try {
    let normalized = String(dateInput).trim();

    // Chuẩn hoá khoảng trắng giữa ngày và giờ thành ký tự 'T' chuẩn ISO
    normalized = normalized.replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/, '$1T$2');

    // If ISO date string without explicit timezone, treat as UTC from backend datetime.utcnow()
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(normalized) && !normalized.endsWith('Z') && !/[+-]\d{2}(?::\d{2})?$/.test(normalized)) {
      normalized += 'Z';
    }

    const date = new Date(normalized);
    if (isNaN(date.getTime())) {
      return typeof dateInput === 'string' && dateInput.trim() ? dateInput : fallback;
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const isEn = String(lang).toLowerCase().startsWith('en');

    // Sai lệch nhỏ giữa đồng hồ server và client (< 60s) coi như vừa đặt
    if (diffMs >= -60000 && diffMs < 60000) {
      return isEn ? 'Just now' : 'Vừa đặt';
    }

    // Nếu thời gian nằm ở tương lai quá 1 phút do lệch múi giờ, hiển thị giờ phút cụ thể thay vì báo vừa đặt
    if (diffMs < -60000) {
      return date.toLocaleTimeString(isEn ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 60) {
      return isEn ? `${diffMinutes} min${diffMinutes > 1 ? 's' : ''} ago` : `${diffMinutes} phút trước`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return isEn ? `${diffHours} hour${diffHours > 1 ? 's' : ''} ago` : `${diffHours} giờ trước`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      return isEn ? `${diffDays} day${diffDays > 1 ? 's' : ''} ago` : `${diffDays} ngày trước`;
    }

    return date.toLocaleDateString(isEn ? 'en-US' : 'vi-VN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fallback;
  }
};
