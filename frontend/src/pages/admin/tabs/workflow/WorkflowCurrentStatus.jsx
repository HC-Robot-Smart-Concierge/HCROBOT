import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { fetchCurrentWorkflows } from '../../../../services/workflowApi';

const DEVICES = [
  ['robot', 'Xe thật RC-001', 'Chưa có lượt chạy'],
  ['kiosk', 'Màn hình robot', 'Chưa nhận được tín hiệu'],
  ['phone_test', 'Điện thoại thử', 'Chưa nhận được tín hiệu'],
];

const STATUS_LABELS = { PENDING: 'Chờ khởi chạy', RUNNING: 'Đang chạy', CANCELLING: 'Đang dừng' };

export function useCurrentWorkflows() {
  const [current, setCurrent] = useState({ data: null, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    let timer;
    const refresh = async () => {
      try {
        const data = await fetchCurrentWorkflows(controller.signal);
        if (!controller.signal.aborted) setCurrent({ data, error: '' });
      } catch (error) {
        if (!controller.signal.aborted) setCurrent({ data: null, error: error.message });
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 3000);
      }
    };
    refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  return current;
}

export function WorkflowCurrentStatus({ current, compact = false }) {
  if (!current) return null;
  const { data, error } = current;

  if (compact) {
    const active = data ? DEVICES.filter(([key]) => data[key]?.workflow_id) : [];
    return <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-700" aria-label="Trạng thái workflow">
      {active.map(([key, label]) => <span key={key}>{label} · <strong>{data[key].workflow_name || data[key].workflow_id}</strong></span>)}
      {active.length === 0 && <span>{error || (data ? 'Chưa có workflow đang chạy' : 'Đang tải trạng thái workflow…')}</span>}
    </div>;
  }

  return <section className="rounded-xl border border-stone-300 bg-white p-4" aria-labelledby="workflow-current-heading">
    <h3 id="workflow-current-heading" className="flex items-center gap-2 text-sm font-bold text-stone-900">
      <Activity className="h-4 w-4" />Workflow hiện tại
    </h3>
    {!data ? <p className="mt-2 text-xs text-stone-600">{error || 'Đang tải trạng thái workflow…'}</p> :
      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        {DEVICES.map(([key, label, empty]) => {
          const device = data[key];
          return <div key={key} className="min-w-0 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs">
            <dt className="font-semibold text-stone-600">{label}</dt>
            {device?.workflow_id ? <dd className="mt-1 space-y-1">
              <p className="break-words font-bold text-stone-900">{device.workflow_name || device.workflow_id}</p>
              <p className="break-words text-emerald-800">
                {STATUS_LABELS[device.status]}
                {Number.isInteger(device.step_index) && ` · Bước ${device.step_index + 1}`}
                {device.step_title && ` · ${device.step_title}`}
              </p>
            </dd> : <dd className="mt-1 text-stone-600">{device ? 'Đang chờ workflow' : empty}</dd>}
          </div>;
        })}
      </dl>}
  </section>;
}
