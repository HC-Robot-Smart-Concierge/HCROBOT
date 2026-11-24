import React from 'react';

/** Name, description, on/off switch and trigger of a workflow (unchanged from the list editor). */
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
    </div>
  );
}
