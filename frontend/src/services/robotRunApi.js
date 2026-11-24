// The robot screen tells the backend about a guest during a parallel run:
// REQUEST stops the vehicle, ENGAGED keeps it stopped, DONE lets it continue.
export async function reportGuest(state, idleMs = 0, robotId = 'RC-001') {
  const res = await fetch('/api/v1/workflows/runs/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ robot_id: robotId, state, idle_ms: Math.min(600000, Math.max(0, Math.round(idleMs))) }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
