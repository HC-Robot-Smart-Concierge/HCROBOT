import React from 'react';
import { Zap } from 'lucide-react';
import { WorkflowScheduleSettings } from './WorkflowExecutionSettings';

const TRIGGERS = {
  MANUAL: 'Thủ công',
  SCHEDULE: 'Theo lịch',
  MANUAL_DISPATCH: 'Lễ tân kích hoạt',
  KIOSK_TOUCH: 'Khách chạm màn hình kiosk',
  GUEST_TAP: 'Khách chạm màn hình',
  PATROL_LOOP: 'Tuần tra lặp và phát loa quảng bá',
};

const triggerValue = (type) => type && type !== 'AUTO_DETECT' ? type : 'MANUAL';

export function triggerLabel(type) {
  const value = triggerValue(type);
  return Object.hasOwn(TRIGGERS, value) ? TRIGGERS[value] : 'Thiết lập cũ';
}

export function WorkflowTriggerPanel({ workflow, onWorkflowMetaChange }) {
  const value = triggerValue(workflow.trigger_type);

  return (
    <section className="space-y-4 rounded-xl border border-stone-300 bg-white p-4" aria-label="Cấu hình node kích hoạt">
      <h4 className="flex items-center gap-2 text-base font-bold text-stone-900"><Zap className="h-4 w-4" />Trigger</h4>
      <label className="block space-y-1 text-xs font-bold text-stone-700">
        <span>Cách khởi chạy</span>
        <select value={value} onChange={(event) => onWorkflowMetaChange('trigger_type', event.target.value)}
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2">
          {Object.entries(TRIGGERS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
          {!Object.hasOwn(TRIGGERS, value) && <option value={value}>Giữ thiết lập cũ ({value})</option>}
        </select>
      </label>
      {value === 'SCHEDULE' && <WorkflowScheduleSettings workflow={workflow} onChange={onWorkflowMetaChange} />}
    </section>
  );
}
