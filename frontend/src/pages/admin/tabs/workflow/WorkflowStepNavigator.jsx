import React from 'react';
import { Settings2, CalendarClock, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { OTTO_STEP_TYPES } from './workflowConstants';

export function WorkflowStepNavigator({ steps, statuses, activeIndex, panel, onPanelChange, onStepSelect }) {
  const incomplete = statuses.filter((status) => !status.ready).length;
  return <aside aria-label="Danh sách bước workflow" className="shrink-0 md:w-72 lg:w-80 border-b md:border-b-0 md:border-r border-stone-300 bg-[#EDE9E1] flex flex-col min-h-0 max-h-[35vh] md:max-h-none">
    <div className="p-3 space-y-2 shrink-0">
      {[['workflow', 'Thông tin workflow', Settings2], ['schedule', 'Lịch chạy & số vòng', CalendarClock]].map(([key, label, Icon]) => <button key={key} type="button" aria-pressed={panel === key} onClick={() => onPanelChange(key)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${panel === key ? 'bg-stone-800 text-white' : 'bg-white/60 text-stone-700 hover:bg-white'}`}><Icon className="w-4 h-4" />{label}</button>)}
    </div>
    <div className="px-4 py-2 flex justify-between text-[11px] font-bold text-stone-600"><span>CÁC BƯỚC ({steps.length})</span><span>{!steps.length ? 'Chưa có bước' : incomplete ? `${incomplete} cần cấu hình` : 'Đã cấu hình'}</span></div>
    <ol className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-2">
      {steps.map((step, index) => {
        const status = statuses[index];
        const active = panel === 'steps' && index === activeIndex;
        const definition = OTTO_STEP_TYPES.find((type) => type.type === step.type);
        return <li key={step.step_id}><button type="button" aria-pressed={active} title={`${definition?.desc || step.type}\n${status.summary}${status.issues.length ? `\n${status.issues.join(' ')}` : ''}`} onClick={() => onStepSelect(step.step_id)} className={`w-full text-left rounded-xl border p-3 flex items-start gap-2 transition-colors ${active ? 'bg-white border-cyan-700 ring-1 ring-cyan-700 shadow-sm' : 'bg-white/50 border-stone-300 hover:bg-white'}`}>
          <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-cyan-800 text-white' : 'bg-stone-200 text-stone-700'}`}>{index + 1}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-stone-900">{step.title || definition?.label || step.type}</span><span className="block truncate text-[11px] text-stone-500 mt-1">{status.summary}</span><span className={`flex items-center gap-1 text-[10px] font-semibold mt-1.5 ${status.ready ? 'text-emerald-700' : 'text-amber-800'}`}>{status.ready ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}{status.ready ? 'Đã cấu hình' : 'Cần cấu hình'}</span></span>
          {active && <ChevronRight className="w-4 h-4 shrink-0 text-cyan-800 mt-1" />}
        </button></li>;
      })}
      {!steps.length && <li className="text-xs text-stone-500 p-3">Chưa có bước. Thêm bước ở bên phải để bắt đầu.</li>}
    </ol>
    <button type="button" onClick={() => onPanelChange('steps')} className="m-3 mt-0 border border-stone-400 rounded-lg py-2 text-xs font-bold text-stone-700 hover:bg-white">Thêm / cấu hình bước</button>
  </aside>;
}
