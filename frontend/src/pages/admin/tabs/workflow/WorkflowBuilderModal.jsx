import React, { useEffect, useState } from 'react';
import { BatteryLow, CalendarClock, Layers, Settings2, Trash2, Workflow, X } from 'lucide-react';
import { OTTO_STEP_TYPES } from './workflowConstants';
import { WorkflowStepBlock } from './WorkflowStepBlock';
import { WorkflowExecutionSettings } from './WorkflowExecutionSettings';
import { WorkflowMetaPanel, WorkflowTriggerSelect } from './WorkflowMetaPanel';
import { WorkflowCanvas } from './canvas/WorkflowCanvas';
import { ParallelLanePanel } from './ParallelLanePanel';
import { AdminPhysicalMapTab } from '../AdminPhysicalMapTab';
import { selectedStepIndex, stepSetup } from '../../../../utils/workflowStepSetup';
import { isChargerMove } from '../../../../utils/workflowExecution';
import { BATTERY, GUEST_EVENT, SCREEN_LANE, eventBranch, removeBatteryBranch, setBatteryThreshold } from '../../../../utils/workflowGraph';
import { parallelOf } from '../../../../utils/workflowLanes';

const TABS = [
  ['steps', 'Sơ đồ', Workflow],
  ['workflow', 'Thông tin', Settings2],
  ['schedule', 'Lịch & lặp', CalendarClock],
];
const noop = () => {};

function BatteryBranchPanel({ workflow, onWorkflowChange, onSelect }) {
  const branch = eventBranch(workflow, 'LOW_BATTERY');
  if (!branch) return null;
  return <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3 text-xs">
    <h4 className="flex items-center gap-1.5 text-sm font-bold text-amber-900"><BatteryLow className="w-4 h-4" />Nhánh pin yếu</h4>
    <p className="text-amber-900">Khi pin (ước tính trên Pi 5) xuống dưới ngưỡng lúc xe thật đang chạy, robot hủy bước hiện tại, chạy các bước nối từ node này rồi kết thúc lượt chạy. Mỗi lượt chỉ kích hoạt một lần.</p>
    <label className="block space-y-1"><span className="font-semibold">Ngưỡng pin (%)</span>
      <input type="number" min="5" max="90" step="1" key={branch.threshold_percent} defaultValue={branch.threshold_percent ?? 20}
        onBlur={(e) => onWorkflowChange(setBatteryThreshold(workflow, e.target.value))}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5" /></label>
    <p className="text-amber-800">Nối dây từ node ⚡ tới node <b>Về trạm sạc gần nhất</b> (Thêm node → Xe thật).</p>
    <p className="text-amber-800">Đợt này mới vẽ và lưu được nhánh; xe thật sẽ chạy nhánh này ở đợt 2.</p>
    <button type="button" onClick={() => { onWorkflowChange(removeBatteryBranch(workflow)); onSelect(null); }}
      className="flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-1.5 font-bold text-rose-800 hover:bg-rose-50">
      <Trash2 className="w-3.5 h-3.5" />Xóa nhánh pin yếu</button>
  </section>;
}

export const WorkflowBuilderModal = ({
  isOpen,
  workflow,
  workflows = [],
  onSelectWorkflow,
  waypoints = [],
  routes = [],
  onRouteSaved,
  isLoading = false,
  onClose,
  onSave,
  onWorkflowChange = noop,
  onRemoveStep = noop,
  onStepParamChange = noop,
  onWorkflowMetaChange = noop,
}) => {
  const [routeStepId, setRouteStepId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [panel, setPanel] = useState('steps');
  const steps = workflow?.steps || [];

  useEffect(() => {
    setSelectedId(null); setPanel('steps'); setRouteStepId(null);
  }, [workflow?.id, isOpen]);

  if (!isOpen || !workflow) return null;
  const batterySelected = selectedId === BATTERY && Boolean(eventBranch(workflow, 'LOW_BATTERY'));
  const laneSelected = [SCREEN_LANE, GUEST_EVENT].includes(selectedId) && Boolean(parallelOf(workflow));
  const activeIndex = batterySelected || laneSelected ? -1 : selectedStepIndex(steps, selectedId);
  const active = activeIndex >= 0 ? steps[activeIndex] : null;
  const status = active ? stepSetup(active, routes) : null;
  const pendingRoute = steps.some((step) => step.type === 'FOLLOW_ROUTE' && !step.params?.route_id);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div role="dialog" aria-modal="true" aria-label="Thiết lập workflow"
        className="w-[98vw] max-w-[1600px] rounded-2xl border shadow-2xl flex flex-col h-[94vh] max-h-[96vh] overflow-hidden"
        style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' }}>
        <div className="px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
          <div className="min-w-0">
            <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2 text-[#262626]">
              <Layers className="w-4 h-4" /><span>Thiết lập workflow</span>
            </h3>
            <p className="text-[11px] sm:text-xs mt-0.5 text-[#8C8C8C]">Kéo dây giữa các cổng để nối bước. Node ⚡ là nhánh pin yếu. Chọn node để cấu hình.</p>
            {pendingRoute && <p className="mt-1 text-xs text-amber-800">Có thể lưu bản nháp trước, rồi sang Physical Map → Tuyến đường chọn workflow và bước để gán tuyến.</p>}
          </div>
          <div className="flex items-center gap-2">
            {onSelectWorkflow && <select aria-label="Chọn workflow để cấu hình" value={workflow.id || ''} onChange={(e) => {
              const id = e.target.value;
              if (id === workflow.id) return;
              const original = workflows.find((item) => item.id === workflow.id);
              if (JSON.stringify(original) !== JSON.stringify(workflow) && !window.confirm('Chuyển workflow sẽ bỏ thay đổi chưa lưu. Tiếp tục?')) return;
              onSelectWorkflow(id);
            }} className="bg-white/60 border border-stone-300 rounded-lg px-2 py-1.5 text-xs max-w-[240px]">
              {!workflows.some((item) => item.id === workflow.id) && <option value={workflow.id || ''}>{workflow.name || 'Workflow mới'}</option>}
              {workflows.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>}
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 hover:bg-[#FAF8F5]" style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}>
              <X className="w-3.5 h-3.5" /><span>Đóng</span>
            </button>
          </div>
        </div>

        <div role="tablist" aria-label="Phần cấu hình workflow" className="flex gap-1 px-4 pt-2 shrink-0 border-b border-stone-300">
          {TABS.map(([key, label, Icon]) => <button key={key} type="button" role="tab" aria-selected={panel === key} onClick={() => setPanel(key)}
            className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-xs font-bold ${panel === key ? 'bg-white text-stone-900 border border-b-0 border-stone-300' : 'text-stone-600 hover:bg-white/60'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>)}
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {panel === 'steps' && <>
            <div className="flex-1 min-h-[45vh] lg:min-h-0 border-b lg:border-b-0 lg:border-r border-stone-300">
              <WorkflowCanvas workflow={workflow} routes={routes} selectedId={selectedId}
                onSelect={setSelectedId} onChange={onWorkflowChange} />
            </div>
            <aside aria-label="Cấu hình mục đang chọn" className="nokey lg:w-[400px] shrink-0 min-h-0 overflow-y-auto p-4 space-y-4">
              {batterySelected && <BatteryBranchPanel workflow={workflow} onWorkflowChange={onWorkflowChange} onSelect={setSelectedId} />}
              {laneSelected && <ParallelLanePanel workflow={workflow} selectedId={selectedId} onWorkflowChange={onWorkflowChange} onSelect={setSelectedId} />}
              {active && <>
                <div><h4 className="text-base font-bold text-stone-900">Cấu hình bước {activeIndex + 1}: {active.title}</h4>
                  <p className="text-xs text-stone-500 mt-1">{OTTO_STEP_TYPES.find((item) => item.type === active.type)?.desc}</p></div>
                {!status.ready && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p className="font-bold mb-1">Cần hoàn thiện</p><ul className="list-disc pl-4 space-y-1">{status.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
                {isChargerMove(active) ? <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 space-y-3 text-xs">
                  <p className="text-emerald-900">Trạm sạc gần nhất được chọn lúc chạy (điểm Trạm sạc cùng map, gần xe nhất).</p>
                  <button type="button" onClick={() => { setSelectedId(null); onRemoveStep(activeIndex); }}
                    className="flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-1.5 font-bold text-rose-800 hover:bg-rose-50">
                    <Trash2 className="w-3.5 h-3.5" />Xóa node</button>
                </div> : <WorkflowStepBlock
                  key={active.step_id}
                  step={active}
                  index={activeIndex}
                  totalSteps={steps.length}
                  allSteps={steps}
                  waypoints={waypoints}
                  routes={routes}
                  allowGuestWait={workflow.execution_config?.execution_mode !== 'ROBOT'}
                  onConfigureRoute={() => setRouteStepId(active.step_id)}
                  onParamChange={onStepParamChange}
                  onMoveUp={noop}
                  onMoveDown={noop}
                  onRemove={(index) => { setSelectedId(null); onRemoveStep(index); }}
                />}
              </>}
              {!batterySelected && !laneSelected && !active && <div className="p-8 text-center text-stone-400 border-2 border-dashed border-stone-300 rounded-2xl text-xs font-semibold">
                Chưa có bước nào. Bấm “Thêm node” trên sơ đồ để thêm bước.
              </div>}
            </aside>
          </>}
          {panel !== 'steps' && <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
            {panel === 'workflow' && <WorkflowMetaPanel workflow={workflow} onWorkflowMetaChange={onWorkflowMetaChange} />}
            {panel === 'schedule' && <>
              <WorkflowTriggerSelect workflow={workflow} onWorkflowMetaChange={onWorkflowMetaChange} />
              <WorkflowExecutionSettings workflow={workflow} onChange={onWorkflowMetaChange} />
            </>}
          </div>}
        </div>

        {routeStepId && <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950 p-3 gap-2">
          <div className="flex items-center justify-between gap-3 text-sm text-white"><p>Cấu hình tuyến cho bước đi theo tuyến · Lưu tuyến để gắn vào bước</p><button type="button" onClick={() => setRouteStepId(null)} className="px-4 py-2 rounded-lg bg-slate-700">Quay lại workflow</button></div>
          <div className="flex-1 min-h-0"><AdminPhysicalMapTab routeLibraryMode
            initialRoute={routes.find((r) => r.id === steps.find((s) => s.step_id === routeStepId)?.params?.route_id)}
            onRouteSaved={(route) => {
              const index = steps.findIndex((s) => s.step_id === routeStepId);
              if (index >= 0) {
                onStepParamChange(index, 'route_id', route.id);
                onStepParamChange(index, 'map_id', route.execution_config.route.map_id);
              }
              onRouteSaved?.(route); setRouteStepId(null);
            }}
          /></div>
        </div>}

        <div className="px-5 py-3 border-t flex items-center justify-between shrink-0" style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-bold border shadow-xs hover:bg-[#FAF8F5]" style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}>
            Hủy Bỏ
          </button>
          <button type="button" onClick={onSave} disabled={isLoading} className="px-5 py-2 rounded-lg text-xs font-bold shadow-xs disabled:opacity-50 hover:bg-[#363636]" style={{ backgroundColor: '#262626', color: '#FFFFFF' }}>
            {isLoading ? 'Đang lưu...' : pendingRoute ? 'Lưu bản nháp · cấu hình tuyến sau' : 'Lưu workflow'}
          </button>
        </div>
      </div>
    </div>
  );
};
