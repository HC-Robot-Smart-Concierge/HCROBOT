import React, { useEffect, useState } from 'react';
import { parseZoneSpeed } from './speedZones';

export default function SpeedZoneLimitInput({ zone, onCommit, motorMinSpeed, onDirty, onValidityChange }) {
  const [draft, setDraft] = useState(String(zone.speed_limit));
  const [error, setError] = useState('');
  useEffect(() => {
    setDraft(String(zone.speed_limit));
    setError('');
    onValidityChange(true);
  }, [zone.id, zone.speed_limit, onValidityChange]);
  useEffect(() => () => onValidityChange(true), [onValidityChange]);
  const commit = () => {
    const speed = parseZoneSpeed(draft);
    if (speed === null) {
      setError('Nhập từ 0.01 đến 1.00 m/s');
      return;
    }
    setError('');
    setDraft(speed.toFixed(2));
    if (speed !== Number(zone.speed_limit)) onCommit(speed);
  };
  return (
    <div className="shrink-0 px-2 py-1 rounded bg-slate-800 border border-amber-800/50">
      <label className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold">
        Tối đa:
        <input type="number" step="0.01" min="0.01" max="1.00"
          aria-label="Giới hạn tốc độ vùng (m/s)" aria-invalid={!!error}
          value={draft} onChange={(e) => {
            setDraft(e.target.value);
            const valid = parseZoneSpeed(e.target.value) !== null;
            setError(valid ? '' : 'Nhập từ 0.01 đến 1.00 m/s');
            onValidityChange(valid);
            onDirty();
          }} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          className="w-14 px-1 py-0.5 rounded text-center font-bold bg-slate-900 border border-slate-700 text-xs" />
        m/s
      </label>
      <span className={`block text-[9px] mt-1 ${error ? 'text-red-400' : 'text-slate-400'}`}>
        {error || 'Nhấn Lưu vùng để áp dụng'}
      </span>
      {Number.isFinite(motorMinSpeed) && Number(draft) < motorMinSpeed && (
        <span className="block text-[9px] mt-1 text-amber-300 max-w-52">
          Dưới sàn motor ước tính {motorMinSpeed.toFixed(2)} m/s: xe thật sẽ dừng.
        </span>
      )}
    </div>
  );
}
