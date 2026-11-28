import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlertTriangle, BatteryLow, CornerDownLeft, Flag, Monitor, Repeat, RotateCw, UserRound, Zap } from 'lucide-react';
import { isChargerMove } from '../../../../../utils/workflowExecution';
import { STEP_SCRATCH_THEMES, OTTO_STEP_TYPES } from '../workflowConstants';
import { triggerLabel } from '../WorkflowTriggerPanel';

export const OK_COLOR = '#16a34a';
export const ERROR_COLOR = '#dc2626';
export const BATTERY_COLOR = '#d97706';
export const SCREEN_COLOR = '#2563eb';
export const GUEST_COLOR = '#9333ea';
const OUTPUT_ROW = 22;
const HEADER = 58;

const handleStyle = (color) => ({ width: 11, height: 11, background: color, border: '2px solid #fff' });

function StartNode({ data, selected }) {
  return <div className={`relative rounded-xl bg-stone-900 text-white shadow ${selected ? 'ring-2 ring-offset-2 ring-stone-500' : ''}`}>
    <button type="button" onClick={(event) => { event.stopPropagation(); data.onConfigure(); }}
      className="nodrag nopan block w-full rounded-xl px-4 py-2 text-left text-xs" aria-label="Cấu hình Trigger">
      <span className="flex items-center gap-1.5 font-bold"><Zap className="h-3.5 w-3.5" />Trigger</span>
      <span className="mt-0.5 block max-w-36 truncate text-[10px] text-stone-300">
        {triggerLabel(data.triggerType)}{data.triggerType === 'SCHEDULE' && ` · ${data.scheduleCount} lịch`}
      </span>
    </button>
    <Handle type="source" id="ok" position={Position.Right} style={handleStyle(OK_COLOR)} />
  </div>;
}

function ScreenLaneNode({ selected }) {
  return <div className={`rounded-xl border-2 bg-blue-50 px-3 py-2 text-xs shadow min-w-[190px] ${selected ? 'border-blue-600 ring-2 ring-blue-300' : 'border-blue-400'}`}>
    <div className="flex items-center gap-1.5 font-bold text-blue-900"><Monitor className="w-4 h-4" />Làn Màn hình</div>
    <p className="mt-0.5 text-[10px] text-blue-700">Chạy cùng lúc với Làn Xe, lặp đến khi xe xong</p>
    <Handle type="source" id="ok" position={Position.Right} style={handleStyle(SCREEN_COLOR)} />
  </div>;
}

function GuestEventNode({ selected }) {
  return <div className={`rounded-xl border-2 bg-purple-50 px-3 py-2 text-xs shadow min-w-[190px] ${selected ? 'border-purple-600 ring-2 ring-purple-300' : 'border-purple-400'}`}>
    <div className="flex items-center gap-1.5 font-bold text-purple-900"><UserRound className="w-4 h-4" />Khi có người chắn đường</div>
    <p className="mt-0.5 text-[10px] text-purple-700">Dừng xe, tạm dừng quảng cáo, xong thì đi tiếp</p>
    <Handle type="source" id="ok" position={Position.Right} style={handleStyle(GUEST_COLOR)} />
  </div>;
}

function EndNode() {
  return <div className="flex items-center gap-1.5 rounded-full bg-white border-2 border-stone-800 text-stone-800 px-4 py-2 text-xs font-bold shadow">
    <Handle type="target" position={Position.Left} style={handleStyle('#57534e')} />
    <Flag className="w-3.5 h-3.5" />Kết thúc
  </div>;
}

function BatteryNode({ data, selected }) {
  return <div className={`rounded-xl border-2 bg-amber-50 px-3 py-2 text-xs shadow min-w-[190px] ${selected ? 'border-amber-600 ring-2 ring-amber-300' : 'border-amber-400'}`}>
    <div className="flex items-center gap-1.5 font-bold text-amber-900"><BatteryLow className="w-4 h-4" />Khi pin dưới</div>
    <label className="mt-1 flex items-center gap-1 text-amber-900">
      <input
        type="number" min="5" max="90" step="1" key={data.threshold} defaultValue={data.threshold}
        aria-label="Ngưỡng pin yếu (%)"
        onBlur={(e) => data.onThreshold?.(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="nodrag nopan w-14 rounded border border-amber-300 bg-white px-1 py-0.5 font-mono"
      />%
      <span className="text-[10px] text-amber-700">· bỏ dở tuyến</span>
    </label>
    <Handle type="source" id="ok" position={Position.Right} style={handleStyle(BATTERY_COLOR)} />
  </div>;
}

function StepNode({ data, selected }) {
  const { step, index, outputs, issues = [], lane } = data;
  const theme = STEP_SCRATCH_THEMES[step.type] || STEP_SCRATCH_THEMES.WAIT;
  const Icon = theme.icon;
  const typeLabel = OTTO_STEP_TYPES.find((t) => t.type === step.type)?.label || step.type;
  const retries = step.params?.on_error?.retry_count || 0;
  const charger = isChargerMove(step);
  const border = issues.length ? '#f59e0b' : selected ? theme.accent : theme.border;
  const height = HEADER + Math.max(0, outputs.length - 1) * OUTPUT_ROW;
  return <div
    title={issues.join('\n') || undefined}
    className={`relative rounded-xl bg-white shadow-sm text-xs w-[210px] ${selected ? 'ring-2 ring-stone-300' : ''}`}
    style={{ border: `2px solid ${border}`, minHeight: height }}
  >
    <Handle type="target" position={Position.Left} style={handleStyle('#57534e')} />
    <div className="flex items-start gap-2 px-3 pt-2 pr-14">
      <span className="mt-0.5 rounded-md p-1" style={{ background: `${theme.accent}15`, color: theme.accent }}><Icon className="w-3.5 h-3.5" /></span>
      <div className="min-w-0">
        <p className="font-bold text-stone-900 truncate">{index + 1}. {step.title || step.type}</p>
        <p className="text-[10px] text-stone-500 truncate">{charger ? 'Trạm sạc gần nhất (chọn lúc chạy)' : typeLabel}</p>
      </div>
    </div>
    <div className="flex flex-wrap gap-1 px-3 pb-2 pt-1">
      {lane === 'screen' && <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 text-[10px] text-blue-800"><Repeat className="w-3 h-3" />Màn hình</span>}
      {lane === 'guest' && <span className="inline-flex items-center gap-0.5 rounded bg-purple-50 px-1 text-[10px] text-purple-800"><CornerDownLeft className="w-3 h-3" />Gặp khách</span>}
      {retries > 0 && <span className="inline-flex items-center gap-0.5 rounded bg-sky-50 px-1 text-[10px] text-sky-800"><RotateCw className="w-3 h-3" />{retries}</span>}
      {issues.length > 0 && <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 text-[10px] text-amber-800"><AlertTriangle className="w-3 h-3" />Cần sửa</span>}
    </div>
    {outputs.map((out, i) => {
      const top = 24 + i * OUTPUT_ROW;
      const color = out.error ? ERROR_COLOR : OK_COLOR;
      return <React.Fragment key={out.handle}>
        {(out.label || out.error) && <span className="absolute right-3 text-[9px] font-semibold" style={{ top: top - 7, color }}>{out.error ? 'Lỗi' : out.label}</span>}
        <Handle type="source" id={out.handle} position={Position.Right} style={{ ...handleStyle(color), top }} />
      </React.Fragment>;
    })}
  </div>;
}

export const NODE_TYPES = {
  start: StartNode, end: EndNode, battery: BatteryNode, step: StepNode,
  screenLane: ScreenLaneNode, guestEvent: GuestEventNode,
};
