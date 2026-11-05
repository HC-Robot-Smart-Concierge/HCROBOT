const API_BASE = '/api/v1';

const mapQuery = (mapId) => (mapId ? `?${new URLSearchParams({ map_id: mapId })}` : '');

/**
 * Fetch persistent LiDAR waypoints from database (only those of mapId when given)
 */
export async function fetchWaypoints(mapId = null) {
  const res = await fetch(`${API_BASE}/map/waypoints${mapQuery(mapId)}`);
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
export async function fetchZones(mapId = null) {
  const res = await fetch(`${API_BASE}/map/zones${mapQuery(mapId)}`);
  if (!res.ok) throw new Error('Không thể tải danh sách Vùng Chức Năng');
  return res.json();
}

/**
 * Danh sách map SLAM (.yaml + .pgm) kèm kích thước, độ phân giải và gốc tọa độ
 */
export async function listMapLayouts() {
  const res = await fetch(`${API_BASE}/map/layouts`);
  if (!res.ok) throw new Error('Không thể tải danh sách bản đồ');
  const data = await res.json();
  return data.maps || [];
}

/**
 * Giải mã PGM binary (P5) thành canvas để vẽ bằng drawImage (hàng 0 là đỉnh ảnh)
 */
export function decodePgmToCanvas(buffer) {
  const bytes = new Uint8Array(buffer);
  let pos = 0;
  const tokens = [];
  while (tokens.length < 4 && pos < bytes.length) {
    while (pos < bytes.length && /\s/.test(String.fromCharCode(bytes[pos]))) pos += 1;
    if (bytes[pos] === 0x23) {
      while (pos < bytes.length && bytes[pos] !== 0x0a) pos += 1;
      continue;
    }
    let token = '';
    while (pos < bytes.length && !/\s/.test(String.fromCharCode(bytes[pos]))) {
      token += String.fromCharCode(bytes[pos]);
      pos += 1;
    }
    tokens.push(token);
  }
  pos += 1; // một ký tự trắng ngăn header và pixel
  const [magic, w, h, maxVal] = tokens;
  const width = Number(w);
  const height = Number(h);
  if (magic !== 'P5' || !width || !height || Number(maxVal) > 255 || bytes.length < pos + width * height) {
    throw new Error('File PGM không hợp lệ');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  for (let i = 0; i < width * height; i += 1) {
    const v = bytes[pos + i];
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Tải ảnh map SLAM và trả về canvas sẵn sàng cho drawImage
 */
export async function fetchMapLayoutImage(mapId) {
  const res = await fetch(`${API_BASE}/map/layouts/${encodeURIComponent(mapId)}/image`);
  if (!res.ok) throw new Error(`Không tải được ảnh bản đồ "${mapId}"`);
  return decodePgmToCanvas(await res.arrayBuffer());
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
export async function saveCurrentLidarMap(mapId = 'phong_lam_viec', name = 'Bản đồ Phòng Làm Việc', floor = 'Phòng Làm Việc') {
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
export async function loadSavedLidarMap(mapId = 'phong_lam_viec') {
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

async function parseRos2RuntimeResponse(res, fallbackMessage) {
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Phản hồi lỗi từ backend có thể không phải JSON.
  }
  if (!res.ok) throw new Error(data?.detail || data?.message || fallbackMessage);
  return data;
}

export async function fetchRos2RuntimeStatus() {
  const res = await fetch(`${API_BASE}/map/ros2/runtime`);
  return parseRos2RuntimeResponse(res, 'Không đọc được trạng thái ROS 2/WSL2');
}

export async function startRos2Mapping() {
  const res = await fetch(`${API_BASE}/map/ros2/start_mapping`, { method: 'POST' });
  return parseRos2RuntimeResponse(res, 'Không khởi động được chế độ quét map');
}

export async function saveRos2Map(mapName) {
  const res = await fetch(`${API_BASE}/map/ros2/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: mapName }),
  });
  return parseRos2RuntimeResponse(res, 'Không lưu được bản đồ ROS 2');
}

// Xe THAT tu di quet map: backend chay start_wsl_slam.sh EXPLORE=1 (SLAM + Nav2 + frontier).
export async function startRos2Explore(mapName, autoSave = true) {
  const res = await fetch(`${API_BASE}/map/ros2/start_explore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: mapName || 'auto_explored_map', auto_save: autoSave }),
  });
  return parseRos2RuntimeResponse(res, 'Không khởi động được chế độ tự quét map');
}

// Dung xe tu quet: tat explorer + Nav2, gui stop toi Pi; GIU SLAM de con luu map.
export async function stopRos2Explore() {
  const res = await fetch(`${API_BASE}/map/ros2/stop_explore`, { method: 'POST' });
  return parseRos2RuntimeResponse(res, 'Không dừng được chế độ tự quét map');
}

export async function startRos2Navigation(mapName, piIp = null) {
  const res = await fetch(`${API_BASE}/map/ros2/start_navigation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: mapName, ...(piIp ? { pi_ip: piIp } : {}) }),
  });
  return parseRos2RuntimeResponse(res, 'Không khởi động được Navigation');
}

// Ghi lai mask vung cam (KEEP_OUT) cua map tu CSDL; Nav2 dang chay thi nap lai ngay.
export async function updateRos2KeepoutMask(mapName) {
  const res = await fetch(`${API_BASE}/map/ros2/keepout_mask/${encodeURIComponent(mapName)}`, {
    method: 'POST',
  });
  return parseRos2RuntimeResponse(res, 'Không cập nhật được vùng cấm cho Nav2');
}

