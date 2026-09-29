import React from 'react';
import { Plus } from 'lucide-react';
import { OTTO_STEP_TYPES, STEP_SCRATCH_THEMES } from './workflowConstants';
import { WorkflowStepBlock } from './WorkflowStepBlock';

export const WorkflowBuilderModal = ({
  isOpen,
  workflow,
  waypoints = [],
  isLoading = false,
  onClose,
  onSave,
  onAddStep,
  onRemoveStep,
  onMoveStep,
  onStepParamChange,
  onWorkflowMetaChange,
}) => {
  if (!isOpen || !workflow) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div
        className="max-w-4xl w-full rounded-2xl border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{ backgroundColor: '#FAF8F5', borderColor: '#BFBFBD' }}
      >
        {/* Modal Header */}
        <div className="px-5 py-3 border-b flex items-center justify-between shrink-0 bg-[#E9E5DC]" style={{ borderColor: '#BFBFBD' }}>
          <div>
            <h3 className="font-extrabold text-sm text-[#262626] flex items-center gap-2">
              <span>🧩</span>
              <span>Cấu Hình Chu Trình Khối Lệnh (Workflow Builder)</span>
            </h3>
            <p className="text-[11px] text-stone-500">
              Điền tham số trực tiếp trên từng khối lệnh giống Scratch để điều khiển trạng thái Robot
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg text-xs font-bold border border-stone-400 bg-white hover:bg-stone-100 cursor-pointer text-stone-800"
          >
            ✕ Đóng
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* Metadata: Name, Description, Trigger Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-white border border-stone-300 shadow-sm">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Tên Kịch Bản:</label>
              <input
                type="text"
                value={workflow.name || ''}
                onChange={(e) => onWorkflowMetaChange('name', e.target.value)}
                placeholder="VD: Chào đón khách tại sảnh..."
                className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-semibold focus:outline-none focus:border-stone-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Mô Tả Kịch Bản:</label>
              <input
                type="text"
                value={workflow.description || ''}
                onChange={(e) => onWorkflowMetaChange('description', e.target.value)}
                placeholder="VD: Chu trình tiếp đón và hướng dẫn..."
                className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-stone-800"
              />
            </div>
            <div className="flex items-center gap-3 pt-3 sm:pt-0">
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Kích Hoạt Bởi:</label>
                <select
                  value={workflow.trigger_type || 'AUTO_DETECT'}
                  onChange={(e) => onWorkflowMetaChange('trigger_type', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs font-bold bg-white focus:outline-none"
                >
                  <option value="AUTO_DETECT">🤖 AI Phát Hiện Người (Auto)</option>
                  <option value="MANUAL_DISPATCH">👤 Lễ Tân Kích Hoạt (Manual)</option>
                  <option value="KIOSK_TOUCH">👆 Khách Chạm Màn Hình Kiosk</option>
                </select>
              </div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-stone-800 cursor-pointer pt-4">
                <input
                  type="checkbox"
                  checked={workflow.is_active ?? true}
                  onChange={(e) => onWorkflowMetaChange('is_active', e.target.checked)}
                  className="w-4 h-4 rounded text-stone-900 cursor-pointer"
                />
                <span>Kích hoạt</span>
              </label>
            </div>
          </div>

          {/* Step Palette (Thêm khối) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-stone-700 uppercase tracking-wider">
                Thêm Khối Lệnh Chuẩn Otto:
              </span>
              <span className="text-[11px] text-stone-500 font-semibold">
                Tổng số bước: {workflow.steps?.length || 0}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {OTTO_STEP_TYPES.map((st) => {
                const theme = STEP_SCRATCH_THEMES[st.type] || STEP_SCRATCH_THEMES.MOVE;
                const Icon = theme.icon;

                return (
                  <button
                    key={st.type}
                    type="button"
                    onClick={() => onAddStep(st.type)}
                    className="p-2 rounded-xl text-white font-bold text-xs flex items-center justify-between shadow-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer border-b-2"
                    style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Icon className="w-3.5 h-3.5 opacity-90 shrink-0" />
                      <span className="truncate">{st.type}</span>
                    </div>
                    <Plus className="w-3 h-3 opacity-80 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scratch Blocks Stack */}
          <div className="space-y-2 pt-2">
            {workflow.steps && workflow.steps.length > 0 ? (
              workflow.steps.map((step, idx) => (
                <WorkflowStepBlock
                  key={step.step_id || idx}
                  step={step}
                  index={idx}
                  totalSteps={workflow.steps.length}
                  waypoints={waypoints}
                  onParamChange={onStepParamChange}
                  onMoveUp={(i) => onMoveStep(i, -1)}
                  onMoveDown={(i) => onMoveStep(i, 1)}
                  onRemove={onRemoveStep}
                />
              ))
            ) : (
              <div className="p-8 text-center text-stone-400 border-2 border-dashed border-stone-300 rounded-2xl text-xs font-semibold">
                Chưa có bước nào trong kịch bản. Nhấn các nút trên để thêm bước mới!
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t bg-[#E9E5DC] flex items-center justify-between shrink-0" style={{ borderColor: '#BFBFBD' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold border border-stone-400 bg-white hover:bg-stone-100 text-stone-700 cursor-pointer"
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isLoading}
            className="px-5 py-2 rounded-lg text-xs font-black bg-[#262626] hover:bg-stone-800 text-white shadow cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Đang lưu...' : 'Lưu Kịch Bản Vào Database'}
          </button>
        </div>
      </div>
    </div>
  );
};
