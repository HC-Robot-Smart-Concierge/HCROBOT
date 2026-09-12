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
