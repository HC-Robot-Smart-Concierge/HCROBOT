import React, { useState, useEffect } from 'react';
import {
  Play,
  Send,
  Edit3,
  Trash2,
  Plus,
  Power,
  Layers,
} from 'lucide-react';
import {
  fetchWorkflows,
  saveWorkflow,
  deleteWorkflow,
  fetchWaypoints,
  executeWorkflow,
} from '../../../services/workflowApi';
import { OTTO_STEP_TYPES } from './workflow/workflowConstants';
import { WorkflowBuilderModal } from './workflow/WorkflowBuilderModal';
import { WorkflowSimulatorModal } from './workflow/WorkflowSimulatorModal';
import { WorkflowSimulatorStudio } from './workflow/WorkflowSimulatorStudio';

import { useRobotControlText } from '../../../context/RobotControlLanguage';
import { executionError, executionSummary } from '../../../utils/workflowExecution';
import { explicitLinks } from '../../../utils/workflowGraph';
import { useWorkflowEditing } from './workflow/useWorkflowEditing';
import { expandWorkflowRoutes, unconfiguredRouteSteps } from '../../../utils/physicalMapRoute';
import { stepSetup } from '../../../utils/workflowStepSetup';
import { WorkflowRunsPanel } from './workflow/WorkflowRunsPanel';

export { OTTO_STEP_TYPES };

export const AdminWorkflowTab = () => {
  const rc = useRobotControlText();
  const [workflows, setWorkflows] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [waypoints, setWaypoints] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [startedRunId, setStartedRunId] = useState(null);

  // View state: 'list' (Quản lý kịch bản) | 'simulator' (Phòng giả lập Gazebo & Kiosk)
  const [activeView, setActiveView] = useState('list');

  // Editor State
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const editing = useWorkflowEditing(setEditingWorkflow, setIsEditorOpen);

  // Simulation State
  const [simulatingWorkflow, setSimulatingWorkflow] = useState(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const getTriggerLabel = (type) => {
    switch (type) {
      case 'GUEST_TAP':
        return 'Chạm Màn Hình';
      case 'KIOSK_TOUCH':
        return 'Chạm Màn Hình Kiosk';
      case 'SCHEDULE':
        return 'Lịch Định Kỳ';
      case 'PATROL_LOOP':
        return 'Tuần Tra Lặp Lại';
      case 'MANUAL':
      case 'MANUAL_DISPATCH':
      default:
        return 'Thủ Công';
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [workflowResult, waypointResult] = await Promise.allSettled([fetchWorkflows(), fetchWaypoints()]);
      const errors = [];
      if (workflowResult.status === 'fulfilled') {
        const wfList = workflowResult.value || [];
        setWorkflows(wfList.filter((wf) => !wf.execution_config?.route));
        setRoutes(wfList.filter((wf) => wf.is_active && wf.execution_config?.route));
      } else errors.push(`Không tải được workflow: ${workflowResult.reason.message}`);
      if (waypointResult.status === 'fulfilled') setWaypoints(waypointResult.value || []);
      else errors.push(`Không tải được điểm mốc: ${waypointResult.reason.message}`);
      if (errors.length) showNotification(errors.join(' · '));
    } catch (err) {
      showNotification(`Lỗi tải dữ liệu: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveWorkflow = async () => {
    const pendingRoutes = unconfiguredRouteSteps(editingWorkflow);
    for (const step of editingWorkflow.steps || []) {
      if (step.type !== 'FOLLOW_ROUTE') continue;
      if (step.params?.route_id && !routes.some((r) => r.id === step.params.route_id)) { showNotification('Tuyến đã chọn không còn khả dụng. Chọn lại hoặc để trống để cấu hình sau trên Map.'); return; }
      if (!Number.isInteger(step.params.repeat_count) || step.params.repeat_count < 1 || step.params.repeat_count > 100) { showNotification('Số vòng của bước Đi theo tuyến phải từ 1 đến 100.'); return; }
    }
    const configError = executionError(editingWorkflow, { allowDraft: pendingRoutes.length > 0 || !editingWorkflow.is_active, forSave: true });
    if (configError) {
      showNotification(configError);
      return;
    }
    if (!editingWorkflow.name.trim()) {
      showNotification('Vui lòng nhập tên kịch bản workflow');
      return;
    }
    try {
      setIsLoading(true);
      // Canvas links are explicit so steps reached only by a branch never fall through.
      const toSave = explicitLinks(editingWorkflow);
      await saveWorkflow(pendingRoutes.length ? { ...toSave, is_active: false } : toSave);
      showNotification(pendingRoutes.length
        ? `Đã lưu bản nháp "${editingWorkflow.name}". Sang Physical Map → Tuyến đường, chọn workflow và bước để gán tuyến.`
        : `Đã lưu kịch bản "${editingWorkflow.name}" thành công!`);
      setIsEditorOpen(false);
      setEditingWorkflow(null);
      await loadData();
    } catch (err) {
      showNotification('Lỗi khi lưu: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWorkflow = async (id, name) => {
    if (!window.confirm(`Xác nhận xóa kịch bản "${name}"?`)) return;
    try {
      setIsLoading(true);
      await deleteWorkflow(id);
      showNotification(`Đã xóa kịch bản "${name}"`);
      await loadData();
    } catch (err) {
      showNotification('Lỗi khi xóa: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (wf) => {
    if (!wf.is_active && unconfiguredRouteSteps(wf).length) {
      showNotification('Workflow còn bước chưa có tuyến. Sang Physical Map → Tuyến đường để cấu hình tham số trước khi bật.');
      return;
    }
    try {
      await saveWorkflow({ ...wf, is_active: !wf.is_active });
      await loadData();
    } catch (err) {
      showNotification('Lỗi cập nhật: ' + err.message);
    }
  };

  const hasRunConfiguration = (wf) => {
    const error = executionError(wf);
    if (error) { showNotification(error); return false; }
    if (!wf.steps?.length) { showNotification('Thêm ít nhất một bước trước khi chạy workflow.'); return false; }
    const index = wf.steps.findIndex((step) => !stepSetup(step, routes).ready);
    if (index >= 0) {
      showNotification(`Bước ${index + 1} cần cấu hình: ${stepSetup(wf.steps[index], routes).issues.join(' ')}`);
      return false;
    }
    return true;
  };

  const handleTestRun = (wf) => {
    if (!hasRunConfiguration(wf)) return;
    try { setSimulatingWorkflow(expandWorkflowRoutes(wf, routes)); setActiveView('simulator'); }
    catch (err) { showNotification(err.message); }
  };

  const handleDispatchToRobot = async (wf) => {
    if (!hasRunConfiguration(wf)) return;
    try {
      const result = await executeWorkflow(wf.id, { robot_id: 'RC-001' });
      if (result.run_id) setStartedRunId(result.run_id);
      showNotification(result.message || 'Đã gửi workflow.');
    } catch (err) {
      showNotification(`Không gửi được workflow: ${err.message}`);
    }
  };

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
      style={{ color: '#262626' }}
    >
      {/* Toast Notification */}
      {notification && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-3"
          style={{ backgroundColor: '#262626', color: '#F2EFE9', borderColor: '#BFBFBD' }}
        >
          {notification}
        </div>
      )}

      {/* Thanh Điều Hướng 2 Tab: Danh Sách Kịch Bản & Giả Lập */}
      <div
        className="px-3 sm:px-5 border-b flex items-center justify-between gap-2 shrink-0 select-none"
        style={{ height: 'var(--admin-header-height, 4rem)', backgroundColor: '#F2EFE9', borderColor: 'var(--admin-header-border, #BFBFBD)' }}
      >
        <div role="group" aria-label={rc('Workflow views')} className="flex items-center gap-1.5">
          <button
            type="button"
            aria-pressed={activeView === 'list'}
            onClick={() => setActiveView('list')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeView === 'list'
                ? 'bg-[#262626] text-white shadow-xs'
                : 'text-[#262626] hover:bg-[#F2EFE9] border border-transparent hover:border-[#BFBFBD]'
            }`}
          >
            <span>{rc('Workflow list')}</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                activeView === 'list'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#F2EFE9] text-[#262626] border border-[#BFBFBD]'
              }`}
            >
              {workflows.length}
            </span>
          </button>

          <button
            type="button"
            aria-pressed={activeView === 'simulator'}
            onClick={() => setActiveView('simulator')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'simulator'
                ? 'bg-[#262626] text-white shadow-xs'
                : 'text-[#262626] hover:bg-[#F2EFE9] border border-transparent hover:border-[#BFBFBD]'
            }`}
          >
            <span>{rc('Simulator')}</span>
          </button>
        </div>

        {activeView === 'list' && (
          <div className="flex items-center gap-2">
          <button type="button" onClick={editing.openRouteWorkflow} className="rounded-lg border border-cyan-800 px-3 py-1.5 text-xs font-bold text-cyan-900">Tạo workflow chạy tuyến</button>
          <button
            type="button"
            onClick={editing.openCreate} title={rc('New workflow')} aria-label={rc('New workflow')}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-2xs hover:bg-[#363636]"
            style={{ backgroundColor: '#262626', color: '#FFFFFF', borderColor: '#262626' }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{rc('New workflow')}</span>
          </button>
          </div>
        )}
      </div>

      {/* Content Body: Simulator Studio hoặc Workflow Cards Grid */}
      {activeView === 'simulator' ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <WorkflowSimulatorStudio
            workflows={workflows}
            initialWorkflowId={simulatingWorkflow?.id || (workflows.length > 0 ? workflows[0].id : null)}
            onClose={() => {
              setActiveView('list');
              loadData();
            }}
            onNotify={showNotification}
            onWorkflowUpdated={(updatedWf) => {
              if (!updatedWf || !updatedWf.id) return;
              setWorkflows((prev) =>
                prev.map((w) => (w.id === updatedWf.id ? updatedWf : w))
              );
            }}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4" style={{ backgroundColor: '#F2EFE9' }}>
        <WorkflowRunsPanel key={startedRunId || 'latest'} runId={startedRunId || undefined} />
        {/* Workflow Cards Grid - 2 Cột rộng rãi, màu xám #E9E5DC đồng bộ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.length === 0 ? (
            <div
              className="col-span-full p-8 text-center rounded-xl border text-xs"
              style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#8C8C8C' }}
            >
              Chưa có kịch bản nào. Nhấn "+ Tạo kịch bản mới" để bắt đầu cấu hình.
            </div>
          ) : (
            workflows.map((wf) => {
              const stepCount = wf.steps?.length || 0;
              return (
                <div
                  key={wf.id}
                  className="p-5 rounded-xl border flex flex-col justify-between space-y-3.5 transition-all hover:shadow-md"
                  style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
                >
                  <div>
                    {/* Top Status & Trigger Header */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
                        style={{
                          backgroundColor: wf.is_active ? '#F2EFE9' : '#FAF8F5',
                          color: wf.is_active ? '#262626' : '#8C8C8C',
                          borderColor: '#BFBFBD',
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: wf.is_active ? '#262626' : '#BFBFBD' }}
                        />
                        {wf.is_active ? 'ĐANG KÍCH HOẠT' : 'TẠM TẮT'}
                      </span>
                      <span className="text-[10px] font-mono font-medium" style={{ color: '#8C8C8C' }}>
                        {getTriggerLabel(wf.trigger_type)}
                      </span>
                    </div>

                    {/* Workflow Title & Description */}
                    <h3 className="font-bold text-sm leading-snug line-clamp-2" style={{ color: '#262626' }}>
                      {wf.name}
                    </h3>
                    <p className="text-[11px] line-clamp-2 min-h-[32px] mt-1.5 leading-relaxed" style={{ color: '#8C8C8C' }}>
                      {wf.description || 'Chưa có mô tả chi tiết'}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-stone-600">{executionSummary(wf)}</p>
                    {unconfiguredRouteSteps(wf).length > 0 && <p className="mt-1 text-[11px] text-amber-800">Bản nháp · Chờ gán tuyến cho {unconfiguredRouteSteps(wf).length} bước tại Physical Map.</p>}

                    {/* Steps Pipeline Preview */}
                    <div className="mt-3 pt-2.5 border-t flex items-center justify-between text-xs" style={{ borderColor: '#BFBFBD' }}>
                      <span className="text-[11px] font-medium" style={{ color: '#8C8C8C' }}>
                        Quy trình: <strong style={{ color: '#262626' }}>{stepCount} bước</strong>
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {(wf.steps || []).slice(0, 6).map((s, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold border"
                            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
                          >
                            {s.type}
                          </span>
                        ))}
                        {stepCount > 6 && (
                          <span className="text-[10px] font-bold" style={{ color: '#8C8C8C' }}>
                            +{stepCount - 6}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2.5 border-t flex items-center justify-between gap-2" style={{ borderColor: '#BFBFBD' }}>
                    {/* Left: Execution Triggers */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTestRun(wf)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer hover:bg-[#F2EFE9] transition-colors flex items-center gap-1.5 shadow-2xs"
                        style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
                        title="Chạy thử mô phỏng kịch bản"
                      >
                        <Play className="w-3 h-3 fill-[#262626] text-[#262626]" />
                        <span>{rc('Simulator')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDispatchToRobot(wf)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer hover:bg-[#363636] transition-colors flex items-center gap-1.5 shadow-2xs"
                        style={{ backgroundColor: '#262626', borderColor: '#262626', color: '#FFFFFF' }}
                        title={wf.execution_config?.execution_mode === 'ROBOT' ? 'Tạo lượt chạy trên xe thật' : 'Gửi kịch bản tới màn hình Robot'}
                      >
                        <Send className="w-3 h-3" />
                        <span>{wf.execution_config?.execution_mode === 'ROBOT' ? 'Chạy xe thật' : 'Gửi màn hình'}</span>
                      </button>
                    </div>

                    {/* Right: Management Controls */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(wf)}
                        className="p-1.5 rounded-lg border cursor-pointer hover:bg-[#F2EFE9] transition-colors"
                        style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' }}
                        title={wf.is_active ? 'Tắt kịch bản' : 'Kích hoạt kịch bản'}
                      >
                        <Power className={`w-3.5 h-3.5 ${wf.is_active ? 'text-emerald-700' : 'text-[#8C8C8C]'}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => editing.openEdit(wf)}
                        className="p-1.5 rounded-lg border cursor-pointer hover:bg-[#F2EFE9] transition-colors"
                        style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
                        title="Chỉnh sửa kịch bản"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWorkflow(wf.id, wf.name)}
                        className="p-1.5 rounded-lg border cursor-pointer hover:bg-red-100 hover:border-red-300 hover:text-red-700 transition-colors"
                        style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#8C8C8C' }}
                        title="Xóa kịch bản"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      )}

      {/* MODAL 1: WORKFLOW BUILDER (Scratch-style block editor) */}
      <WorkflowBuilderModal
        isOpen={isEditorOpen}
        workflow={editingWorkflow}
        workflows={workflows}
        onSelectWorkflow={(id) => {
          const selected = workflows.find((item) => item.id === id);
          if (selected) editing.openEdit(selected);
        }}
        waypoints={waypoints}
        routes={routes}
        onRouteSaved={(route) => setRoutes((previous) => [...previous.filter((r) => r.id !== route.id), route])}
        isLoading={isLoading}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingWorkflow(null);
        }}
        onSave={handleSaveWorkflow}
        onWorkflowChange={editing.replaceWorkflow}
        onRemoveStep={editing.removeStep}
        onStepParamChange={editing.changeStepParam}
        onWorkflowMetaChange={editing.changeMeta}
      />

      {/* MODAL 2: WORKFLOW SIMULATOR (Live Robot reactions & laptop audio) */}
      <WorkflowSimulatorModal
        workflow={simulatingWorkflow}
        isOpen={isSimulatorOpen}
        onClose={() => {
          setIsSimulatorOpen(false);
          setSimulatingWorkflow(null);
        }}
      />
    </div>
  );
};
