import React from 'react';

export function WorkflowTriggerSelect({ workflow, onWorkflowMetaChange }) {
  const savedType = workflow.trigger_type;
  const value = !savedType || savedType === 'AUTO_DETECT' ? 'MANUAL' : savedType;
  return (
    <label className="block text-xs font-bold text-stone-700 space-y-1">
      <span>Kích hoạt bởi</span>
      <select value={value} onChange={(e) => onWorkflowMetaChange('trigger_type', e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white">
        <option value="MANUAL">Thủ công</option>
        <option value="SCHEDULE">Theo lịch</option>
        {!['MANUAL', 'SCHEDULE'].includes(value) && <option value={value}>Giữ thiết lập cũ ({value})</option>}
      </select>
    </label>
  );
}

export function WorkflowMetaPanel({ workflow, onWorkflowMetaChange }) {
  return (
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

      <WorkflowTriggerSelect workflow={workflow} onWorkflowMetaChange={onWorkflowMetaChange} />
    </div>
  );
}
