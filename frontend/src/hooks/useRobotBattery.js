import { useEffect, useState } from 'react';

const PI5_IP = import.meta.env.VITE_PI5_IP || '100.99.72.51';
export const PI5_API_BASE = `http://${PI5_IP}:8000/api/v1`;

/**
 * Estimated battery % from the Pi 5 (time-based, no sensing circuit), polled from
 * /system/power. Null while the Pi is unreachable or has no estimate.
 */
export function useRobotBattery({ intervalMs = 15000 } = {}) {
  const [percent, setPercent] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const poll = async () => {
      try {
        const res = await fetch(`${PI5_API_BASE}/system/power`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const value = data?.battery?.available ? Number(data.battery.percent) : NaN;
        if (isMounted) setPercent(Number.isFinite(value) ? value : null);
      } catch {
        if (isMounted) setPercent(null);
      }
    };

    poll();
    const timer = setInterval(poll, intervalMs);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [intervalMs]);

  return percent;
}
