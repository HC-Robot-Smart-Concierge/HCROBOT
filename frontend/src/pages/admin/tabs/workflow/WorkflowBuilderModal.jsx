import React, { useEffect, useRef, useState } from 'react';
import { Plus, Layers, X } from 'lucide-react';
import { OTTO_STEP_TYPES } from './workflowConstants';
import { WorkflowStepBlock } from './WorkflowStepBlock';
import { WorkflowExecutionSettings } from './WorkflowExecutionSettings';
import { AdminPhysicalMapTab } from '../AdminPhysicalMapTab';
import { WorkflowStepNavigator } from './WorkflowStepNavigator';
import { selectedStepIndex, stepSetup } from '../../../../utils/workflowStepSetup';

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
  onAddStep,
  onRemoveStep,
  onMoveStep,
  onStepParamChange,
  onWorkflowMetaChange,
}) => {
  const [selectedStepType, setSelectedStepType] = useState('MOVE');
  const [routeStepId, setRouteStepId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [panel, setPanel] = useState('steps');
  const pendingAdd = useRef(false);
  const steps = workflow?.steps || [];

  useEffect(() => {
    setSelectedId(null); setPanel('steps'); setRouteStepId(null); pendingAdd.current = false;
  }, [workflow?.id, isOpen]);
  useEffect(() => {
    if (pendingAdd.current && steps.length) {
      setSelectedId(steps[steps.length - 1].step_id); setPanel('steps'); pendingAdd.current = false;
    }
  }, [steps]);

  if (!isOpen || !workflow) return null;
  const activeIndex = selectedStepIndex(steps, selectedId);
  const statuses = steps.map((step) => stepSetup(step, routes));
  const pendingRoute = steps.some((step) => step.type === 'FOLLOW_ROUTE' && !step.params?.route_id);

  const handleAddSelectedStep = () => {
    if (selectedStepType) {
      pendingAdd.current = true;
      onAddStep(selectedStepType);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Thiết lập workflow"
        className="w-[96vw] max-w-7xl rounded-2xl border shadow-2xl flex flex-col h-[94vh] max-h-[96vh] overflow-hidden"
        style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' }}
      >
        {/* Modal Header */}
        <div
          className="px-6 py-3.5 border-b flex items-center justify-between shrink-0"
          style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
        >
          <div>
            <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2" style={{ color: '#262626' }}>
              <Layers className="w-4 h-4 text-[#262626]" />
              <span>Cấu Hình Chu Trình Khối Lệnh (Workflow Builder)</span>
            </h3>
            <p className="text-[11px] sm:text-xs mt-0.5" style={{ color: '#8C8C8C' }}>
              Chọn bước bên trái để cấu hình. Rà chuột lên bước để xem mô tả ngắn.
            </p>
            {pendingRoute && <p className="mt-1 text-xs text-amber-800">Có thể lưu bản nháp trước, rồi sang Physical Map → Tuyến đường chọn workflow và bước để gán tuyến.</p>}
            {onSelectWorkflow && <select aria-label="Chọn workflow để cấu hình" value={workflow.id || ''} onChange={(e) => {
              const id = e.target.value;
              if (id === workflow.id) return;
              const original = workflows.find((item) => item.id === workflow.id);
              if (JSON.stringify(original) !== JSON.stringify(workflow) && !window.confirm('Chuyển workflow sẽ bỏ thay đổi chưa lưu. Tiếp tục?')) return;
              onSelectWorkflow(id);
            }} className="mt-2 bg-white/60 border border-stone-300 rounded-lg px-2 py-1 text-xs max-w-full">
              {!workflows.some((item) => item.id === workflow.id) && <option value={workflow.id || ''}>{workflow.name || 'Workflow mới'}</option>}
              {workflows.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer flex items-center gap-1.5 transition-colors shadow-xs hover:bg-[#FAF8F5]"
            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
          >
            <X className="w-3.5 h-3.5" />
            <span>Đóng</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          <WorkflowStepNavigator steps={steps} statuses={statuses} activeIndex={activeIndex} panel={panel} onPanelChange={setPanel} onStepSelect={(id) => { setSelectedId(id); setPanel('steps'); }} />
          <div aria-label="Cấu hình mục đang chọn" className="flex-1 min-w-0 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Metadata Form: Bố trí từng dòng riêng biệt */}
          {panel === 'workflow' && <div className="p-4 rounded-xl bg-white border border-stone-300 shadow-2xs space-y-3">
            {/* Dòng 1: Tên Kịch Bản & Trạng Thái Bật/Tắt */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Tên Kịch Bản:
                </label>
                <input
                  type="text"
                  value={workflow.name || ''}
                  onChange={(e) => onWorkflowMetaChange('name', e.target.value)}
                  placeholder="VD: Workflow 1: Đón tiếp và Chào mừng khách tại Cửa Sảnh..."
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-semibold focus:outline-none focus:border-stone-800 bg-stone-50/50 focus:bg-white"
                />
              </div>
              <div className="sm:self-end pb-0.5">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-stone-800 cursor-pointer px-3 py-2 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={workflow.is_active ?? true}
                    onChange={(e) => onWorkflowMetaChange('is_active', e.target.checked)}
                    className="w-4 h-4 rounded text-stone-900 cursor-pointer"
                  />
                  <span>Kích hoạt kịch bản (Bật)</span>
                </label>
              </div>
            </div>

            {/* Dòng 2: Mô Tả Kịch Bản */}
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                Mô Tả Kịch Bản:
              </label>
              <input
                type="text"
                value={workflow.description || ''}
                onChange={(e) => onWorkflowMetaChange('description', e.target.value)}
                placeholder="VD: Robot từ trạm chờ di chuyển ra Cửa chính đón khách mới vào sảnh, hướng dẫn tiện ích..."
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-stone-800 bg-stone-50/50 focus:bg-white"
              />
            </div>

            {/* Dòng 3: Kích Hoạt Bởi */}
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                Kích Hoạt Bởi:
              </label>
              <select
                value={workflow.trigger_type || 'AUTO_DETECT'}
                onChange={(e) => onWorkflowMetaChange('trigger_type', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-bold bg-white focus:outline-none focus:border-stone-800 cursor-pointer"
              >
                <option value="MANUAL">Thủ công</option>
                <option value="AUTO_DETECT">AI Phát Hiện Người (Auto)</option>
                <option value="MANUAL_DISPATCH">Lễ Tân Kích Hoạt (Manual)</option>
                <option value="KIOSK_TOUCH">Khách Chạm Màn Hình Kiosk</option>
                <option value="GUEST_TAP">Khách Chạm Màn Hình (Tap)</option>
                <option value="SCHEDULE">Theo Lịch Trình (Schedule)</option>
                <option value="PATROL_LOOP">Tuần Tra Lặp Lại & Phát Loa Quảng Bá (Patrol Loop)</option>
              </select>
            </div>
          </div>}

          {panel === 'schedule' && <>
            <label className="block text-xs font-bold text-stone-700 space-y-2"><span>Cách kích hoạt</span><select value={workflow.trigger_type || 'MANUAL'} onChange={(e) => onWorkflowMetaChange('trigger_type', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white"><option value="MANUAL">Thủ công</option><option value="SCHEDULE">Theo lịch</option>{!['MANUAL', 'SCHEDULE'].includes(workflow.trigger_type) && <option value={workflow.trigger_type}>Giữ: {workflow.trigger_type}</option>}</select></label>
            <WorkflowExecutionSettings workflow={workflow} onChange={onWorkflowMetaChange} />
          </>}

          {/* Thêm Khối Lệnh: Dạng Dropdown */}
          {panel === 'steps' && <div className="p-3.5 rounded-xl bg-white border border-stone-300 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Thêm Khối Lệnh Chuẩn Otto:
              </label>
              <span className="text-xs text-stone-500 font-semibold font-mono">
                Tổng số bước: {workflow.steps?.length || 0}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={selectedStepType}
                  onChange={(e) => setSelectedStepType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-bold bg-stone-50 hover:bg-white focus:bg-white focus:outline-none focus:border-stone-800 cursor-pointer shadow-2xs"
                >
                  {OTTO_STEP_TYPES.map((st) => (
                    <option key={st.type} value={st.type}>
                      {st.label} — {st.desc}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleAddSelectedStep}
                className="px-4 py-2 bg-[#262626] hover:bg-black text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm Khối Lệnh</span>
              </button>
            </div>
          </div>}

          {/* Scratch Blocks Stack */}
          {panel === 'steps' && <div className="space-y-3 pt-1">
            {activeIndex >= 0 && <div><h4 className="text-base font-bold text-stone-900">Cấu hình bước {activeIndex + 1}: {steps[activeIndex].title}</h4><p className="text-xs text-stone-500 mt-1">{OTTO_STEP_TYPES.find((item) => item.type === steps[activeIndex].type)?.desc}</p></div>}
            {activeIndex >= 0 && !statuses[activeIndex].ready && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p className="font-bold mb-1">Cần hoàn thiện</p><ul className="list-disc pl-4 space-y-1">{statuses[activeIndex].issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
            {workflow.steps && workflow.steps.length > 0 ? (
              workflow.steps.map((step, idx) => idx === activeIndex ? (
                <WorkflowStepBlock
                  key={step.step_id || idx}
                  step={step}
                  index={idx}
                  totalSteps={workflow.steps.length}
                  allSteps={workflow.steps}
                  waypoints={waypoints}
                  routes={routes}
                  onConfigureRoute={() => setRouteStepId(step.step_id)}
                  onParamChange={onStepParamChange}
                  onMoveUp={(i) => { setSelectedId(step.step_id); onMoveStep(i, -1); }}
                  onMoveDown={(i) => { setSelectedId(step.step_id); onMoveStep(i, 1); }}
                  onRemove={(index) => {
                    setSelectedId((steps[index + 1] || steps[index - 1])?.step_id || null);
                    onRemoveStep(index);
                  }}
                />
              ) : null)
            ) : (
              <div className="p-8 text-center text-stone-400 border-2 border-dashed border-stone-300 rounded-2xl text-xs font-semibold">
                Chưa có bước nào trong kịch bản. Nhấn các nút trên để thêm bước mới!
              </div>
            )}
          </div>}
          </div>
        </div>

        {routeStepId && <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950 p-3 gap-2">
          <div className="flex items-center justify-between gap-3 text-sm text-white"><p>Cấu hình tuyến cho bước đi theo tuyến · Lưu tuyến để gắn vào bước</p><button type="button" onClick={() => setRouteStepId(null)} className="px-4 py-2 rounded-lg bg-slate-700">Quay lại workflow</button></div>
          <div className="flex-1 min-h-0"><AdminPhysicalMapTab routeLibraryMode
            initialRoute={routes.find((r) => r.id === workflow.steps.find((s) => s.step_id === routeStepId)?.params?.route_id)}
            onRouteSaved={(route) => {
              const index = workflow.steps.findIndex((s) => s.step_id === routeStepId);
              if (index >= 0) {
                onStepParamChange(index, 'route_id', route.id);
                onStepParamChange(index, 'map_id', route.execution_config.route.map_id);
              }
              onRouteSaved?.(route); setRouteStepId(null);
            }}
          /></div>
        </div>}

        {/* Modal Footer */}
        <div
          className="px-5 py-3 border-t flex items-center justify-between shrink-0"
          style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold border cursor-pointer shadow-xs transition-colors hover:bg-[#FAF8F5]"
            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isLoading}
            className="px-5 py-2 rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 transition-colors hover:bg-[#363636]"
            style={{ backgroundColor: '#262626', borderColor: '#262626', color: '#FFFFFF' }}
          >
            {isLoading ? 'Đang lưu...' : pendingRoute ? 'Lưu bản nháp · cấu hình tuyến sau' : 'Lưu workflow'}
          </button>
        </div>
      </div>
    </div>
  );
};
