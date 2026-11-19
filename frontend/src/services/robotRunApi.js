// The robot screen tells the backend a guest is engaged (ENGAGED, renewed) or done (DONE).
// The backend turns this into a renewable hold in the real-robot run's control file.
export async function reportGuest(state, idleMs = 0, robotId = 'RC-001') {
  const res = await fetch('/api/v1/workflows/runs/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ robot_id: robotId, state, idle_ms: Math.max(0, Math.round(idleMs)) }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
