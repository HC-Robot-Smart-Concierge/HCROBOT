const API_BASE = '/api/v1';

/**
 * Fetch all persistent LiDAR waypoints from database
 */
export async function fetchWaypoints() {
  const res = await fetch(`${API_BASE}/map/waypoints`);
  if (!res.ok) throw new Error('Không thể tải danh sách Waypoints');
  return res.json();
}

/**
 * Save (create or upsert) a waypoint coordinate
 */
export async function saveWaypoint(waypoint) {
  const res = await fetch(`${API_BASE}/map/waypoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(waypoint),
  });
  if (!res.ok) throw new Error('Lỗi khi lưu Waypoint');
  return res.json();
}

/**
 * Update an existing endpoint/waypoint by ID
 */
export async function updateWaypoint(waypointId, waypoint) {
  const res = await fetch(`${API_BASE}/map/waypoints/${waypointId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(waypoint),
  });
  if (!res.ok) throw new Error('Lỗi khi cập nhật Endpoint');
  return res.json();
}

/**
 * Delete a waypoint by ID
 */
export async function deleteWaypoint(waypointId) {
  const res = await fetch(`${API_BASE}/map/waypoints/${waypointId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Lỗi khi xóa Waypoint');
  return res.json();
}

/**
 * Fetch all Robot Workflows
 */
export async function fetchWorkflows() {
  const res = await fetch(`${API_BASE}/workflows`);
  if (!res.ok) throw new Error('Không thể tải danh sách Workflows');
  return res.json();
}

/**
 * Fetch a single workflow by ID
 */
export async function fetchWorkflowById(workflowId) {
  const res = await fetch(`${API_BASE}/workflows/${workflowId}`);
  if (!res.ok) throw new Error('Không thể tải chi tiết Workflow');
  return res.json();
}

/**
 * Create or save a workflow with steps
 */
export async function saveWorkflow(workflow) {
  const res = await fetch(`${API_BASE}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });
  if (!res.ok) throw new Error('Lỗi khi lưu Workflow');
  return res.json();
}

/**
 * Delete a workflow by ID
 */
export async function deleteWorkflow(workflowId) {
  const res = await fetch(`${API_BASE}/workflows/${workflowId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Lỗi khi xóa Workflow');
  return res.json();
}

/**
 * Execute or test-run a workflow
 */
export async function executeWorkflow(workflowId, payload = {}) {
  const res = await fetch(`${API_BASE}/workflows/${workflowId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Lỗi khi chạy Workflow');
  return res.json();
}

/**
 * Fetch all persistent functional zones from database
 */
export async function fetchZones() {
  const res = await fetch(`${API_BASE}/map/zones`);
  if (!res.ok) throw new Error('Không thể tải danh sách Vùng Chức Năng');
  return res.json();
}

/**
 * Save (create or upsert) a functional zone
 */
export async function saveZone(zone) {
  const res = await fetch(`${API_BASE}/map/zones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(zone),
  });
  if (!res.ok) throw new Error('Lỗi khi lưu Vùng Chức Năng');
  return res.json();
}

/**
 * Update an existing zone by ID
 */
export async function updateZone(zoneId, zone) {
  const res = await fetch(`${API_BASE}/map/zones/${zoneId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(zone),
  });
  if (!res.ok) throw new Error('Lỗi khi cập nhật Vùng Chức Năng');
  return res.json();
}

/**
 * Delete a zone by ID
 */
export async function deleteZone(zoneId) {
  const res = await fetch(`${API_BASE}/map/zones/${zoneId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Lỗi khi xóa Vùng Chức Năng');
  return res.json();
}

/**
 * Lưu bản đồ Occupancy Grid hiện tại vào CSDL và lưu file cố định
 */
export async function saveCurrentLidarMap(mapId = 'MAP-LOBBY-01', name = 'Bản đồ Sảnh Tầng 1 Main Lobby', floor = 'Sảnh Tầng 1') {
  const params = new URLSearchParams({ map_id: mapId, name, floor });
  const res = await fetch(`${API_BASE}/map/save_map?${params.toString()}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Không thể lưu bản đồ vào CSDL');
  return res.json();
}

/**
 * Nạp lại bản đồ cố định đã lưu từ CSDL/file
 */
export async function loadSavedLidarMap(mapId = 'MAP-LOBBY-01') {
  const params = new URLSearchParams({ map_id: mapId, lock: 'true' });
  const res = await fetch(`${API_BASE}/map/load_map?${params.toString()}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Không thể nạp bản đồ từ CSDL');
  return res.json();
}

/**
 * Bật/tắt chế độ khóa bản đồ tĩnh
 */
export async function toggleLidarMapLock(lock = null) {
  const params = lock !== null ? `?lock=${lock}` : '';
  const res = await fetch(`${API_BASE}/map/toggle_lock${params}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Không thể thay đổi trạng thái khóa bản đồ');
  return res.json();
}

/**
 * Lấy dữ liệu bản đồ SLAM Occupancy Grid 2D hiện tại
 */
export async function fetchCurrentMap() {
  const res = await fetch(`${API_BASE}/map/current`);
  if (!res.ok) throw new Error('Không thể tải dữ liệu bản đồ hiện tại');
  return res.json();
}

/**
 * Xác định URL WebSocket kết nối tới LiDAR SLAM service (tự động thích ứng localhost/LAN/Pi5)
 */
export function getMapWebSocketUrl() {
  const customIp = import.meta.env.VITE_PI5_IP;
  if (customIp && customIp !== 'localhost' && customIp !== '127.0.0.1' && customIp !== '100.73.245.66') {
    return `ws://${customIp}:8000/api/v1/map/ws`;
  }
  const loc = window.location;
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') {
    return `ws://127.0.0.1:8000/api/v1/map/ws`;
  }
  const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${loc.host}/api/v1/map/ws`;
}

export async function listSavedMaps() {
  const res = await fetch(`${API_BASE}/map/list_saved_maps`);
  if (!res.ok) throw new Error('Không thể lấy danh sách bản đồ đã lưu');
  return res.json();
}

