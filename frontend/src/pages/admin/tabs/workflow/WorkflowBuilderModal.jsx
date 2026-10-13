import React, { useState } from 'react';
import { Plus, Layers, X } from 'lucide-react';
import { OTTO_STEP_TYPES } from './workflowConstants';
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
  const [selectedStepType, setSelectedStepType] = useState('MOVE');

  if (!isOpen || !workflow) return null;

  const handleAddSelectedStep = () => {
    if (selectedStepType) {
      onAddStep(selectedStepType);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div
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
              Thiết lập tham số chi tiết trên từng khối lệnh để điều khiển trạng thái tự hành của Robot
            </p>
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
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Metadata Form: Bố trí từng dòng riêng biệt */}
          <div className="p-4 rounded-xl bg-white border border-stone-300 shadow-2xs space-y-3">
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
                <option value="AUTO_DETECT">AI Phát Hiện Người (Auto)</option>
                <option value="MANUAL_DISPATCH">Lễ Tân Kích Hoạt (Manual)</option>
                <option value="KIOSK_TOUCH">Khách Chạm Màn Hình Kiosk</option>
                <option value="GUEST_TAP">Khách Chạm Màn Hình (Tap)</option>
                <option value="SCHEDULE">Theo Lịch Trình (Schedule)</option>
              </select>
            </div>
          </div>

          {/* Thêm Khối Lệnh: Dạng Dropdown */}
          <div className="p-3.5 rounded-xl bg-white border border-stone-300 shadow-2xs">
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
          </div>

          {/* Scratch Blocks Stack */}
          <div className="space-y-3 pt-1">
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
            {isLoading ? 'Đang lưu...' : 'Lưu Kịch Bản Vào Database'}
          </button>
        </div>
      </div>
    </div>
  );
};
