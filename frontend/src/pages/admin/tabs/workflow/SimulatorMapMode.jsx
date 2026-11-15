import React from 'react';
import { Edit3, Navigation } from 'lucide-react';

export function SimulatorMapMode({ mode, onChange, busy, language, showZones, onToggleZones }) {
  const vi = language === 'VI';
  return <div className="flex flex-wrap items-center gap-2">
    <div role="group" aria-label={vi ? 'Chế độ sa bàn' : 'Map interaction mode'} className="flex rounded-lg border border-stone-300 bg-[#F2EFE9] p-0.5">
      {[
        ['CONTROL', Navigation, vi ? 'Điều khiển robot' : 'Robot control'],
        ['EDIT', Edit3, vi ? 'Sửa zone / endpoint' : 'Edit zones / endpoints'],
      ].map(([value, Icon, label]) => <button key={value} type="button" aria-pressed={mode === value}
        disabled={value === 'EDIT' && busy} onClick={() => onChange(value)}
        title={value === 'EDIT' && busy ? (vi ? 'Dừng mô phỏng trước khi chỉnh sửa.' : 'Stop the simulation before editing.') : label}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${mode === value ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-200'}`}>
        <Icon size={13} />{label}
      </button>)}
    </div>
    <label className="flex items-center gap-1 text-[11px] text-stone-600">
      <input type="checkbox" checked={showZones} onChange={onToggleZones} />{vi ? 'Hiện vùng' : 'Show zones'}
    </label>
  </div>;
}
