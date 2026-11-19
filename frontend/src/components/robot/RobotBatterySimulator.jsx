import React, { useCallback, useEffect, useState } from 'react';
import { BatteryMedium } from 'lucide-react';
import { fetchPiBattery, syncPiBattery } from '../../services/robotBatteryApi';

const POLL_MS = 5000;
const TONES = {
  light: { box: 'border-stone-300 bg-white text-stone-800', muted: 'text-stone-500', track: 'accent-stone-800' },
  dark: { box: 'border-slate-700 bg-slate-900/60 text-slate-100', muted: 'text-slate-400', track: 'accent-emerald-500' },
};

/**
 * Simulated battery for demos: writes the Pi 5 estimate, which the robot screen and
 * real-robot workflow runs both read. Sends only when the slider is released.
 */
export function RobotBatterySimulator({ threshold = 20, variant = 'light' }) {
  const tone = TONES[variant] || TONES.light;
  const [battery, setBattery] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async (signal) => {
    try {
      const next = await fetchPiBattery(signal);
      if (!signal?.aborted) setBattery(next);
    } catch {
      if (!signal?.aborted) setBattery({ available: false, percent: null, minutes_per_percent: null });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    const timer = setInterval(() => load(controller.signal), POLL_MS);
    return () => { controller.abort(); clearInterval(timer); };
  }, [load]);

  const available = Boolean(battery?.available) && battery.percent !== null;
  const shown = draft ?? (available ? Math.round(battery.percent) : 0);

  const commit = async () => {
    if (draft === null || busy) return;
    const target = draft;
    if (!battery?.minutes_per_percent) {
      setMessage('Chưa đọc được tốc độ tụt pin từ Pi 5, thử lại sau vài giây.');
      setDraft(null);
      return;
    }
    setBusy(true);
    try {
      await syncPiBattery(target, battery.minutes_per_percent);
      setMessage(target < threshold
        ? `Đã đặt pin ${target}% (dưới ${threshold}%): lượt chạy có nhánh pin yếu sẽ về trạm sạc.`
        : `Đã đặt pin ${target}%.`);
      await load();
    } catch (err) {
      setMessage(`Không ghi được pin vào Pi 5: ${err.message}`);
    } finally {
      setDraft(null);
      setBusy(false);
    }
  };

  return <section aria-label="Pin giả lập" className={`rounded-lg border p-3 space-y-2 text-xs ${tone.box}`}>
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 font-bold"><BatteryMedium className="w-4 h-4" />Pin giả lập (ghi vào Pi 5)</span>
      <span className={`font-mono font-bold ${shown < threshold && available ? 'text-amber-500' : ''}`}>{available ? `${shown}%` : '—'}</span>
    </div>
    <div className="relative pt-1">
      <input
        type="range" min="0" max="100" step="1" value={shown}
        disabled={!available || busy}
        aria-label="Phần trăm pin giả lập"
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        className={`w-full ${tone.track} disabled:opacity-40`}
      />
      <span aria-hidden="true" className="absolute top-0 h-5 border-l-2 border-amber-500" style={{ left: `${threshold}%` }} />
    </div>
    <p className={tone.muted}>
      {available ? `Vạch vàng: ngưỡng ${threshold}%. Kéo rồi thả chuột để gửi.` : 'Pi 5 chưa kết nối.'}
    </p>
    {message && <p role="status" className={tone.muted}>{message}</p>}
  </section>;
}
