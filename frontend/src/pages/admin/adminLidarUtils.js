export const PI5_IP = import.meta.env.VITE_PI5_IP || '100.99.72.51';
export const PI5_API =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/v1/operations/robot/pi5'
    : (import.meta.env.VITE_PI5_API_URL || `http://${PI5_IP}:8000/api/v1`);
// Tu quet xe that: tu luc bam den khi frontier_explorer chay mat ~20-30 s
// (kiem tra Pi/LiDAR/encoder + bat Nav2 + dem nguoc 10 s an toan).
export const EXPLORE_START_GRACE_MS = 60000;
export const ROSBRIDGE_DEFAULT_URL = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://127.0.0.1:9090';

// Trạng thái nguồn Pi 5 do robot/scripts/pi_power_monitor.py phân loại.
export const PI_POWER_BADGES = {
  OK: { label: 'Stable', className: 'bg-emerald-100 text-emerald-800' },
  LOW_VOLTAGE: { label: 'Low voltage', className: 'bg-amber-100 text-amber-800' },
  UNDERVOLTAGE: { label: 'Undervoltage', className: 'bg-red-100 text-red-700 animate-pulse' },
  UNDERVOLTAGE_OCCURRED: { label: 'Past undervoltage', className: 'bg-amber-100 text-amber-800' },
  THROTTLED: { label: 'Throttled', className: 'bg-amber-100 text-amber-800' },
  UNAVAILABLE: { label: 'Unavailable', className: 'bg-stone-100 text-stone-600' },
  OFFLINE: { label: 'Pi offline', className: 'bg-stone-100 text-stone-600' },
};

export const formatPowerValue = (value, digits, unit) => (
  typeof value === 'number' ? `${value.toFixed(digits)}${unit}` : '---'
);

export const formatDuration = (minutes, rc) => {
  if (typeof minutes !== 'number') return '---';
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${mins} ${rc('min')}`;
};
