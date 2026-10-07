import React, { useState, useEffect } from 'react';
import {
  Play,
  Send,
  Edit3,
  Trash2,
  Plus,
  Power,
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

export { OTTO_STEP_TYPES };

export const AdminWorkflowTab = () => {
  const [workflows, setWorkflows] = useState([]);
  const [waypoints, setWaypoints] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Editor State
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Simulation State
  const [simulatingWorkflow, setSimulatingWorkflow] = useState(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const getTriggerLabel = (type) => {
    switch (type) {
      case 'AUTO_DETECT':
        return 'Tự Động Nhận Diện';
      case 'GUEST_TAP':
        return 'Chạm Màn Hình';
      case 'SCHEDULE':
        return 'Lịch Định Kỳ';
      case 'MANUAL':
      default:
        return 'Thủ Công';
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [wfList, wpList] = await Promise.all([fetchWorkflows(), fetchWaypoints()]);
      setWorkflows(wfList || []);
      setWaypoints(wpList || []);
    } catch {
      showNotification('Lỗi khi tải danh sách kịch bản hoặc waypoints.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingWorkflow({
      id: `wf-${Date.now().toString(36)}`,
      name: 'Kịch bản phục vụ khách mới',
      description: 'Mô tả chu trình hoạt động của robot...',
      trigger_type: 'AUTO_DETECT',
      is_active: true,
      steps: [
        {
          step_id: `step-${Date.now()}-1`,
          type: 'MOVE',
          title: 'Di chuyển lại gần khách tại Sảnh',
          params: { ...OTTO_STEP_TYPES[0].defaultParams },
        },
        {
          step_id: `step-${Date.now()}-2`,
          type: 'GREET',
          title: 'Chào hỏi và biểu cảm',
          params: { ...OTTO_STEP_TYPES[1].defaultParams },
        },
        {
          step_id: `step-${Date.now()}-3`,
          type: 'SPEAK',
          title: 'Phát âm thanh giới thiệu',
          params: { ...OTTO_STEP_TYPES[2].defaultParams },
        },
      ],
    });
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (wf) => {
    setEditingWorkflow(JSON.parse(JSON.stringify(wf)));
    setIsEditorOpen(true);
  };

  const handleSaveWorkflow = async () => {
    if (!editingWorkflow.name.trim()) {
      showNotification('Vui lòng nhập tên kịch bản workflow');
      return;
    }
    try {
      setIsLoading(true);
      await saveWorkflow(editingWorkflow);
      showNotification(`Đã lưu kịch bản "${editingWorkflow.name}" thành công!`);
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
    try {
      await saveWorkflow({ ...wf, is_active: !wf.is_active });
      await loadData();
    } catch (err) {
      showNotification('Lỗi cập nhật: ' + err.message);
    }
  };

  const handleTestRun = (wf) => {
    setSimulatingWorkflow(wf);
    setIsSimulatorOpen(true);
  };

  const handleDispatchToRobot = async (wf) => {
    try {
      const bc = new BroadcastChannel('hcrobot_workflow_channel');
      bc.postMessage({ type: 'EXECUTE_WORKFLOW', workflow: wf });
      bc.close();
    } catch {
      // BroadcastChannel fallback
    }

    try {
      await executeWorkflow(wf.id, { robot_id: 'RC-001' });
      showNotification(`Đã phát lệnh kịch bản "${wf.name}" tới màn hình Robot!`);
    } catch {
      showNotification(`Đã gửi lệnh nội bộ tới màn hình Robot: "${wf.name}"`);
    }
  };

  // Step operations in builder
  const handleAddStep = (stepType) => {
    const stepDef = OTTO_STEP_TYPES.find((s) => s.type === stepType);
    if (!stepDef) return;

    const newStep = {
      step_id: `step-${Date.now()}`,
      type: stepDef.type,
      title: stepDef.label,
      params: { ...stepDef.defaultParams },
    };

    setEditingWorkflow({
      ...editingWorkflow,
      steps: [...(editingWorkflow.steps || []), newStep],
    });
  };

  const handleRemoveStep = (index) => {
    const updated = [...editingWorkflow.steps];
    updated.splice(index, 1);
    setEditingWorkflow({ ...editingWorkflow, steps: updated });
  };

  const handleMoveStep = (index, direction) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= editingWorkflow.steps.length) return;
    const updated = [...editingWorkflow.steps];
    const temp = updated[index];
    updated[index] = updated[newIdx];
    updated[newIdx] = temp;
    setEditingWorkflow({ ...editingWorkflow, steps: updated });
  };

  const handleStepParamChange = (stepIndex, paramKey, val) => {
    const updated = [...editingWorkflow.steps];
    updated[stepIndex] = {
      ...updated[stepIndex],
      params: {
        ...(updated[stepIndex].params || {}),
        [paramKey]: val,
      },
    };
    setEditingWorkflow({ ...editingWorkflow, steps: updated });
  };

  const handleWorkflowMetaChange = (key, val) => {
    setEditingWorkflow({ ...editingWorkflow, [key]: val });
  };

  return (
    <div className="w-full flex flex-col min-h-full pb-4" style={{ color: '#262626' }}>
      {/* Toast Notification */}
      {notification && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-3"
          style={{ backgroundColor: '#262626', color: '#F2EFE9', borderColor: '#BFBFBD' }}
        >
          {notification}
        </div>
      )}

      {/* Header Bar - seamlessly aligned with sidebar brand header */}
      <div
        className="h-16 px-5 border-b flex items-center justify-between gap-4 shrink-0 sticky top-0 z-20"
        style={{ borderColor: '#BFBFBD', backgroundColor: '#F2EFE9' }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold tracking-tight leading-tight truncate" style={{ color: '#262626' }}>
              Quản Lý Chu Trình Nhiệm Vụ Robot (Step Workflows)
            </h2>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold border shrink-0"
              style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
            >
              HOTEL CONCIERGE
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] font-normal truncate mt-0.5" style={{ color: '#8C8C8C' }}>
            Thiết lập kịch bản tự động tuần tự 8 bước: Move, Greet, Speak, Show, Listen, Recommend, Create Request, Feedback
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-3.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors whitespace-nowrap shrink-0 hover:bg-[#363636] flex items-center gap-1.5 shadow-2xs"
          style={{ backgroundColor: '#262626', color: '#F2EFE9', borderColor: '#262626' }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tạo kịch bản mới</span>
        </button>
      </div>

      {/* Content Body */}
      <div className="p-4 space-y-4">
        {/* Workflow Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {workflows.length === 0 ? (
            <div
              className="col-span-full p-8 text-center rounded-xl border text-xs"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#8C8C8C' }}
            >
              Chưa có kịch bản nào. Nhấn "+ Tạo kịch bản mới" để bắt đầu cấu hình.
            </div>
          ) : (
            workflows.map((wf) => {
              const stepCount = wf.steps?.length || 0;
              return (
                <div
                  key={wf.id}
                  className="p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all hover:shadow-md"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
                >
                  <div>
                    {/* Top Status & Trigger Header */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border"
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
                    <h3 className="font-bold text-sm leading-snug line-clamp-1" style={{ color: '#262626' }}>
                      {wf.name}
                    </h3>
                    <p className="text-[11px] line-clamp-2 min-h-[32px] mt-1 leading-relaxed" style={{ color: '#8C8C8C' }}>
                      {wf.description || 'Chưa có mô tả chi tiết'}
                    </p>

                    {/* Steps Pipeline Preview */}
                    <div className="mt-3 pt-2.5 border-t flex items-center justify-between text-xs" style={{ borderColor: '#E9E5DC' }}>
                      <span className="text-[11px] font-medium" style={{ color: '#8C8C8C' }}>
                        Quy trình: <strong style={{ color: '#262626' }}>{stepCount} bước</strong>
                      </span>
                      <div className="flex items-center gap-1">
                        {(wf.steps || []).slice(0, 4).map((s, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border"
                            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
                          >
                            {s.type}
                          </span>
                        ))}
                        {stepCount > 4 && (
                          <span className="text-[10px] font-bold" style={{ color: '#8C8C8C' }}>
                            +{stepCount - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer - Executive Design */}
                  <div className="pt-2.5 border-t flex items-center justify-between gap-2" style={{ borderColor: '#E9E5DC' }}>
                    {/* Left: Execution Triggers */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTestRun(wf)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer hover:bg-[#E9E5DC] transition-colors flex items-center gap-1.5 shadow-2xs"
                        style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
                        title="Chạy thử mô phỏng kịch bản"
                      >
                        <Play className="w-3 h-3 fill-[#262626] text-[#262626]" />
                        <span>Giả lập</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDispatchToRobot(wf)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer hover:bg-[#363636] transition-colors flex items-center gap-1.5 shadow-2xs"
                        style={{ backgroundColor: '#262626', borderColor: '#262626', color: '#F2EFE9' }}
                        title="Phát lệnh điều khiển trực tiếp tới màn hình Robot"
                      >
                        <Send className="w-3 h-3" />
                        <span>Gửi Robot</span>
                      </button>
                    </div>

                    {/* Right: Management Controls */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(wf)}
                        className="p-1.5 rounded-lg border cursor-pointer hover:bg-[#E9E5DC] transition-colors"
                        style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
                        title={wf.is_active ? 'Tắt kịch bản' : 'Kích hoạt kịch bản'}
                      >
                        <Power className={`w-3.5 h-3.5 ${wf.is_active ? 'text-[#262626]' : 'text-[#BFBFBD]'}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(wf)}
                        className="p-1.5 rounded-lg border cursor-pointer hover:bg-[#E9E5DC] transition-colors text-[#262626]"
                        style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
                        title="Chỉnh sửa kịch bản"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWorkflow(wf.id, wf.name)}
                        className="p-1.5 rounded-lg border cursor-pointer hover:bg-[#E9E5DC] transition-colors text-[#8C8C8C] hover:text-[#262626]"
                        style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' }}
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

      {/* MODAL 1: WORKFLOW BUILDER (Scratch-style block editor) */}
      <WorkflowBuilderModal
        isOpen={isEditorOpen}
        workflow={editingWorkflow}
        waypoints={waypoints}
        isLoading={isLoading}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingWorkflow(null);
        }}
        onSave={handleSaveWorkflow}
        onAddStep={handleAddStep}
        onRemoveStep={handleRemoveStep}
        onMoveStep={handleMoveStep}
        onStepParamChange={handleStepParamChange}
        onWorkflowMetaChange={handleWorkflowMetaChange}
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
