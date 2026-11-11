// =====================================================================
// AURORA OS - CONCIERGE & LIVE SUPPORT API SERVICE
// Connects React Frontend with FastAPI Backend (/api/v1/operations/concierge)
// =====================================================================

const BASE_URL = '/api/v1/operations/concierge';
const DASHBOARD_URL = '/api/v1/operations/dashboard/concierge';

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
    console.warn(`[ConciergeAPI] Fallback for ${url}:`, error.message);
    return fallbackData;
  }
}

/**
 * 1. Lay so lieu Dashboard Concierge va phien Live Call moi nhat
 */
export async function fetchConciergeDashboard() {
  return await fetchWithFallback(DASHBOARD_URL, {}, {
    current_request: null,
    active_sessions_count: 0,
  });
}

/**
 * 2. Khoi tao phien ho tro Live Call / Video Call tu Robot Kiosk
 */
export async function createConciergeRequest(requestData) {
  return await fetchWithFallback(
    `${BASE_URL}/requests`,
    {
      method: 'POST',
      body: JSON.stringify(requestData),
    },
    {
      id: `CCG-${Date.now()}`,
      ticket_code: `CCG-${Math.floor(1000 + Math.random() * 9000)}`,
      ...requestData,
      status: 'Pending',
      created_at: new Date().toISOString(),
    }
  );
}

/**
 * 3. Cap nhat trang thai cuoc goi, phan cong hoac dong phien Live Call Concierge
 */
export async function updateConciergeRequest(requestId, updateData) {
  return await fetchWithFallback(
    `${BASE_URL}/requests/${encodeURIComponent(requestId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    },
    {
      id: requestId,
      ...updateData,
    }
  );
}

/**
 * 4. Lay danh sach tat ca cac phien HumanSupportSession va video record Cloudinary
 */
export async function fetchHumanSupportSessions(statusFilter = null, limit = 100, skip = 0) {
  const params = new URLSearchParams();
  if (statusFilter && statusFilter !== 'all') params.append('status_filter', statusFilter);
  if (limit) params.append('limit', limit);
  if (skip) params.append('skip', skip);
  const query = params.toString() ? `?${params.toString()}` : '';
  return await fetchWithFallback(`${BASE_URL}/sessions${query}`, {}, []);
}

/**
 * 4.1 Lay thong ke so lieu Video Call va Ban ghi WF-04 theo khoang ngay
 */
export async function fetchVideoCallMetrics(startDate = null, endDate = null) {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  const query = params.toString() ? `?${params.toString()}` : '';
  return await fetchWithFallback(`${BASE_URL}/video-calls/metrics${query}`, {}, {
    total_calls: 0,
    ready_recordings: 0,
    saving_recordings: 0,
    failed_recordings: 0,
    no_recordings: 0,
  });
}

/**
 * 4.2 Dong bo cac ban ghi video cu tu Cloudinary ve CSDL (Huong 1)
 */
export async function syncCloudinaryRecordings() {
  const token = localStorage.getItem('aurora_jwt_token');
  const response = await fetch(`${BASE_URL}/recordings/sync-cloudinary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Đồng bộ thất bại (mã lỗi: ${response.status})`);
  }

  return await response.json();
}

/**
 * 5. Upload video ghi hinh cuoc goi (WebM/MP4) len Cloudinary qua Backend
 */
export async function uploadCallRecording(sessionId, videoBlob, duration = 0, startedAt = null, endedAt = null, messages = null) {
  try {
    const formData = new FormData();
    formData.append('video_file', videoBlob, `call_${sessionId}.webm`);
    formData.append('duration', Math.round(duration || 0));
    if (startedAt) formData.append('call_started_at', startedAt);
    if (endedAt) formData.append('call_ended_at', endedAt);
    if (messages) {
      formData.append('messages', typeof messages === 'string' ? messages : JSON.stringify(messages));
    }

    const token = localStorage.getItem('aurora_jwt_token');
    const response = await fetch(`${BASE_URL}/recordings/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload recording failed! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[ConciergeAPI] Upload call recording error:', error);
    return {
      session_id: sessionId,
      recording_url: '',
      duration: duration || 0,
      storage_provider: 'failed',
      message: error.message,
    };
  }
}

/**
 * 6. Helper tao URL WebSocket Signaling cho cuoc goi WebRTC
 */
export function getCallSignalingWsUrl(sessionId, role = 'guest', name = 'Guest') {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}${BASE_URL}/ws/video-call/${encodeURIComponent(sessionId)}?role=${encodeURIComponent(role)}&name=${encodeURIComponent(name)}`;
}

