import React, { useState } from 'react';
import { BatteryCharging, BatteryLow, Plus, X } from 'lucide-react';
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

/** Real robot: drives to the charger nearest the robot, picked at run time (no coordinates). */
export function createChargerStep() {
  return createStep('MOVE', {
    title: 'Về trạm sạc gần nhất',
    params: { target_type: 'CHARGER', target_value: 'NEAREST_CHARGER', waypoint_name: 'Trạm sạc gần nhất', speed: 0.35, timeout_sec: 120 },
  });
}

export function NodePalette({ robotMode, hasBatteryBranch, onAdd, onAddBattery }) {
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
          <BatteryCharging className="w-4 h-4 text-emerald-700" /><span><b>Về trạm sạc gần nhất</b><br /><span className="text-stone-500">Chọn trạm sạc gần xe nhất lúc chạy</span></span>
        </button>
        {!hasBatteryBranch && <button type="button" role="menuitem" onClick={() => pick(onAddBattery)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-amber-50">
          <BatteryLow className="w-4 h-4 text-amber-600" /><span><b>Nhánh pin yếu</b><br /><span className="text-stone-500">Khi pin dưới ngưỡng thì bỏ dở tuyến</span></span>
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
