// Simulated battery: the Pi 5 keeps one time-based estimate that the robot screen,
// the admin pages and the real-robot workflow runs all read (via the backend proxy).
const PI5_PROXY = '/api/v1/operations/robot/pi5';

const finiteOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export async function fetchPiBattery(signal) {
  const res = await fetch(`${PI5_PROXY}/system/power`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const battery = (await res.json())?.battery;
  if (!battery?.available) return { available: false, percent: null, minutes_per_percent: null };
  return {
    available: true,
    percent: finiteOrNull(battery.percent),
    minutes_per_percent: finiteOrNull(battery.minutes_per_percent),
  };
}

/** Always send the current drain rate: a percent alone makes the Pi re-learn its drain rate. */
export async function syncPiBattery(percent, minutesPerPercent) {
  const res = await fetch(`${PI5_PROXY}/system/battery/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ percent, minutes_per_percent: minutesPerPercent }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'SUCCESS') throw new Error(data.message || data.detail || `HTTP ${res.status}`);
  return data.battery;
}
