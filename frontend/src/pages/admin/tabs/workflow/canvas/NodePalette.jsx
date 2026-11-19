import React, { useState } from 'react';
import { BatteryCharging, BatteryLow, Plus, UserRound, X } from 'lucide-react';
import { OTTO_STEP_TYPES, STEP_SCRATCH_THEMES } from '../workflowConstants';

const ROBOT_TYPES = new Set(['MOVE', 'FOLLOW_ROUTE', 'WAIT']);

export function createStep(type, overrides = {}) {
  const def = OTTO_STEP_TYPES.find((item) => item.type === type);
  return {
    step_id: `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    title: def?.label || type,
    params: JSON.parse(JSON.stringify(def?.defaultParams || {})),
    ...overrides,
  };
}

/** Real robot: drives to the CHARGER endpoint of the run's map (resolved by the backend). */
export function createChargerStep() {
  return createStep('MOVE', {
    title: 'Về trạm sạc',
    params: { target_type: 'CHARGER', target_value: 'CHARGER_STATION', waypoint_name: 'Trạm sạc (theo map)', speed: 0.35, timeout_sec: 120 },
  });
}

export function NodePalette({ robotMode, hasBatteryBranch, hasGuestBranch, onAdd, onAddBattery, onAddGuest }) {
  const [open, setOpen] = useState(false);
  const pick = (action) => { action(); setOpen(false); };
  return <div className="absolute left-3 top-3 z-10">
    <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
      className="flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-xs font-bold text-white shadow hover:bg-black">
      {open ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}Thêm node
    </button>
    {open && <div role="menu" className="mt-2 w-72 max-h-[60vh] overflow-y-auto rounded-xl border border-stone-300 bg-white p-2 shadow-xl space-y-1">
      {robotMode && <>
        <p className="px-2 pt-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">Xe thật</p>
        <button type="button" role="menuitem" onClick={() => pick(() => onAdd(createChargerStep()))}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-stone-100">
          <BatteryCharging className="w-4 h-4 text-emerald-700" /><span><b>Về trạm sạc</b><br /><span className="text-stone-500">Đi tới điểm Trạm sạc trên map</span></span>
        </button>
        {!hasBatteryBranch && <button type="button" role="menuitem" onClick={() => pick(onAddBattery)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-amber-50">
          <BatteryLow className="w-4 h-4 text-amber-600" /><span><b>Nhánh pin yếu</b><br /><span className="text-stone-500">Khi pin dưới ngưỡng thì bỏ dở tuyến</span></span>
        </button>}
        {!hasGuestBranch && <button type="button" role="menuitem" onClick={() => pick(onAddGuest)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-sky-50">
          <UserRound className="w-4 h-4 text-sky-600" /><span><b>Khi gặp khách</b><br /><span className="text-stone-500">Dừng để màn hình trò chuyện, xong đi tiếp</span></span>
        </button>}
        <p className="px-2 pt-2 text-[10px] font-bold uppercase tracking-wide text-stone-500">Khối lệnh</p>
      </>}
      {OTTO_STEP_TYPES.map((item) => {
        const Icon = (STEP_SCRATCH_THEMES[item.type] || STEP_SCRATCH_THEMES.WAIT).icon;
        const unsupported = robotMode && !ROBOT_TYPES.has(item.type);
        return <button key={item.type} type="button" role="menuitem" onClick={() => pick(() => onAdd(createStep(item.type)))}
          title={unsupported ? 'Xe thật chưa chạy được loại bước này' : item.desc}
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-stone-100 ${unsupported ? 'opacity-50' : ''}`}>
          <Icon className="w-4 h-4 text-stone-600" /><span className="truncate">{item.label}</span>
        </button>;
      })}
    </div>}
  </div>;
}
