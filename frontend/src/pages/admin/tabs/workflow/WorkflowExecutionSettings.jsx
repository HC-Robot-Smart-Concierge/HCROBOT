import React, { useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { previewWorkflowSchedule } from '../../../../services/workflowApi';
import { executionConfig, executionError, WEEK_DAYS } from '../../../../utils/workflowExecution';

const inputClass = 'w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs focus:outline-none focus:border-stone-800';

export function WorkflowExecutionSettings({ workflow, onChange, compact = false }) {
  const config = executionConfig(workflow.execution_config);
  const scheduled = workflow.trigger_type === 'SCHEDULE';
  const [preview, setPreview] = useState([]);
  const [previewState, setPreviewState] = useState('');
  const error = executionError(workflow);
  const previewKey = JSON.stringify(config);

  useEffect(() => {
    setPreview([]);
    if (!scheduled || error) { setPreviewState(''); return undefined; }
    const controller = new AbortController();
    setPreviewState('Đang tính lịch…');
    const timer = setTimeout(() => {
      previewWorkflowSchedule(JSON.parse(previewKey), controller.signal)
        .then((data) => { if (!controller.signal.aborted) { setPreview(data.occurrences); setPreviewState(''); } })
        .catch((err) => { if (err.name !== 'AbortError') setPreviewState(err.message); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [previewKey, scheduled, error]);

  const update = (patch) => onChange('execution_config', { ...config, ...patch });
  const updateSchedule = (index, patch) => update({ schedules: config.schedules.map((item, i) => i === index ? { ...item, ...patch } : item) });

  return (
    <section className="rounded-xl border border-stone-300 bg-white p-4 space-y-4 shadow-2xs">
      <div className="flex items-start gap-2">
        <CalendarClock className="w-4 h-4 mt-0.5 text-stone-700" />
        <div>
          <h4 className="text-sm font-bold text-stone-900">Lịch chạy & số vòng</h4>
          <p className="text-xs text-stone-500 mt-1">{compact ? 'Đặt thời gian bắt đầu và cách lặp lại toàn bộ tuyến đường.' : 'Lịch kích hoạt workflow; các bước bên dưới mô tả robot làm gì trong mỗi vòng.'}</p>
        </div>
      </div>
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
        Bản thử: lưu cấu hình và xem lịch dự kiến. Chưa tự phát lệnh theo giờ; số vòng chưa được áp dụng khi bấm gửi robot.
      </div>
      <div className={`grid grid-cols-1 ${compact ? '' : 'sm:grid-cols-3'} gap-3`}>
        <label className="text-xs font-semibold text-stone-700 space-y-1">
          <span>Chế độ lặp</span>
          <select className={inputClass} value={config.repeat_mode} onChange={(e) => update({ repeat_mode: e.target.value })}>
            <option value="COUNT">Theo số vòng</option>
            <option value="CONTINUOUS">Liên tục đến khi dừng</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-stone-700 space-y-1">
          <span>Số vòng mỗi lượt</span>
          <input className={inputClass} type="number" min="1" max="1000" step="1" disabled={config.repeat_mode === 'CONTINUOUS'} value={config.repeat_count} onChange={(e) => update({ repeat_count: e.target.value === '' ? '' : Number(e.target.value) })} />
        </label>
        <label className="text-xs font-semibold text-stone-700 space-y-1">
          <span>Nghỉ giữa các vòng (giây)</span>
          <input className={inputClass} type="number" min="0" max="86400" step="1" value={config.interval_seconds} onChange={(e) => update({ interval_seconds: e.target.value === '' ? '' : Number(e.target.value) })} />
        </label>
      </div>
      {scheduled ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <h5 className="font-bold text-xs text-stone-700">Lịch lặp theo tuần</h5>
            <button type="button" disabled={config.schedules.length >= 20} onClick={() => update({ schedules: [...config.schedules, { time: '08:00', days: [0, 1, 2, 3, 4], timezone: 'Asia/Ho_Chi_Minh', enabled: true }] })} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg border border-stone-300 hover:bg-stone-50 disabled:opacity-40">
              <Plus className="w-3 h-3" /> Thêm lịch
            </button>
          </div>
          {!config.schedules.length && <p className="text-xs text-stone-500">Chưa có lịch. Thêm giờ và chọn các ngày muốn chạy.</p>}
          {config.schedules.map((schedule, index) => (
            <div key={index} className="rounded-lg border border-stone-200 p-3 space-y-3 bg-stone-50/60">
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs font-semibold space-y-1"><span>Giờ chạy</span><input aria-label={`Giờ chạy lịch ${index + 1}`} type="time" value={schedule.time} onChange={(e) => updateSchedule(index, { time: e.target.value })} className={inputClass} /></label>
                <label className="text-xs font-semibold space-y-1 flex-1 min-w-40"><span>Múi giờ</span><select className={inputClass} value={schedule.timezone} onChange={(e) => updateSchedule(index, { timezone: e.target.value })}><option value="Asia/Ho_Chi_Minh">Việt Nam (UTC+7)</option><option value="Asia/Bangkok">Bangkok (UTC+7)</option><option value="UTC">UTC</option></select></label>
                <label className="flex items-center gap-2 py-2 text-xs"><input type="checkbox" checked={schedule.enabled} onChange={(e) => updateSchedule(index, { enabled: e.target.checked })} /> Bật lịch</label>
                <button type="button" aria-label={`Xóa lịch ${index + 1}`} onClick={() => update({ schedules: config.schedules.filter((_, i) => i !== index) })} className="p-2 rounded-lg text-rose-700 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label={`Ngày chạy lịch ${index + 1}`}>
                {WEEK_DAYS.map((day, value) => <button type="button" key={day} aria-pressed={schedule.days.includes(value)} onClick={() => updateSchedule(index, { days: schedule.days.includes(value) ? schedule.days.filter((d) => d !== value) : [...schedule.days, value].sort() })} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${schedule.days.includes(value) ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-300'}`}>{day}</button>)}
              </div>
            </div>
          ))}
          <div className="border-t border-stone-200 pt-3 text-xs space-y-2" aria-live="polite">
            <p className="font-bold text-stone-700">5 lần kích hoạt dự kiến · hiển thị theo giờ Việt Nam</p>
            {!workflow.is_active && <p className="text-amber-800">Workflow đang tắt. Các mốc bên dưới chỉ là dự kiến khi bật lại.</p>}
            {previewState && <p className="text-stone-500">{previewState}</p>}
            {!previewState && !error && !preview.length && <p className="text-stone-500">Không có lịch đang bật.</p>}
            <ol className="space-y-1 text-stone-600">{preview.map((date) => <li key={date}>{new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(date))}</li>)}</ol>
          </div>
        </>
      ) : <p className="text-xs text-stone-500">Chọn “Theo Lịch Trình” ở mục Kích hoạt bởi để cấu hình giờ chạy. Các lịch đã lưu được giữ lại khi đổi cách kích hoạt.</p>}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    </section>
  );
}
