// =====================================================================
// AURORA OS - LOGS & AUDIT TRAIL API SERVICE
// Connects React Frontend with FastAPI Backend (/api/v1/logs)
// =====================================================================

const BASE_URL = '/api/v1/logs';

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
    console.warn(`[LogsAPI] Fallback for ${url}:`, error.message);
    return fallbackData;
  }
}

/**
 * Lấy danh sách Logs phân trang và hỗ trợ bộ lọc (level, category, actor_type, department, search, v.v.)
 */
export const fetchLogs = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);
  if (params.level && params.level !== 'ALL') query.append('level', params.level);
  if (params.category && params.category !== 'ALL') query.append('category', params.category);
  if (params.actor_type && params.actor_type !== 'ALL') query.append('actor_type', params.actor_type);
  if (params.department && params.department !== 'ALL') query.append('department', params.department);
  if (params.search) query.append('search', params.search);
  if (params.correlation_id) query.append('correlation_id', params.correlation_id);
  if (params.robot_id) query.append('robot_id', params.robot_id);

  const qs = query.toString() ? `?${query.toString()}` : '';
  return await fetchWithFallback(`${BASE_URL}${qs}`, {}, { status: 'success', total: 0, items: [], total_pages: 1 });
};

/**
 * Thống kê tổng hợp KPIs cho trang Logs
 */
export const fetchLogStatistics = async () => {
  return await fetchWithFallback(`${BASE_URL}/statistics`, {}, {
    status: 'success',
    data: {
      total: 0,
      errors: 0,
      critical: 0,
      warnings: 0,
      ai_requests: 0,
      robot_events: 0,
      dispatch_events: 0,
    },
  });
};

/**
 * Truy vết toàn bộ vòng đời của một transaction qua correlation_id
 */
export const fetchLogTrace = async (correlationId) => {
  return await fetchWithFallback(`${BASE_URL}/trace/${encodeURIComponent(correlationId)}`, {}, null);
};

/**
 * Lấy danh sách Audit Trail bảo mật & cấu hình
 */
export const fetchAuditLogs = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);
  if (params.action) query.append('action', params.action);
  if (params.actor_id) query.append('actor_id', params.actor_id);
  if (params.resource_type) query.append('resource_type', params.resource_type);

  const qs = query.toString() ? `?${query.toString()}` : '';
  return await fetchWithFallback(`${BASE_URL}/audit-logs${qs}`, {}, { status: 'success', total: 0, items: [], total_pages: 1 });
};

/**
 * Lấy URL xuất file CSV hoặc JSON
 */
export const getLogExportUrl = (format = 'csv', filters = {}) => {
  const query = new URLSearchParams();
  query.append('format', format);
  if (filters.level && filters.level !== 'ALL') query.append('level', filters.level);
  if (filters.category && filters.category !== 'ALL') query.append('category', filters.category);
  if (filters.actor_type && filters.actor_type !== 'ALL') query.append('actor_type', filters.actor_type);
  if (filters.department && filters.department !== 'ALL') query.append('department', filters.department);
  if (filters.search) query.append('search', filters.search);

  return `${BASE_URL}/export?${query.toString()}`;
};
