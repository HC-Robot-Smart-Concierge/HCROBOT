import React, { useEffect, useState } from 'react';
import { fetchWorkflowRuns, cancelWorkflowRun } from '../../../../services/workflowApi';
import { currentWorkflowRunLog } from '../../../../utils/workflowRunLog';

const labels = { PENDING: 'Chờ thực thi', RUNNING: 'Đang chạy', CANCELLING: 'Đang dừng',
  CANCELLED: 'Đã dừng', COMPLETED: 'Hoàn thành', FAILED: 'Thất bại', SKIPPED: 'Bỏ qua do robot bận' };
const eventLabels = { STEP_RETRY: 'Thử lại', STEP_FAILED_HANDLED: 'Bỏ qua lỗi', EVENT_TRIGGERED: 'Pin yếu' };

export function WorkflowRunsPanel({ workflowId, runId } = {}) {
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setRuns([]); setError(''); setBusy(null);
    let timer;
    const poll = async () => {
      try {
        const data = await fetchWorkflowRuns(controller.signal);
        if (!controller.signal.aborted) { setRuns(currentWorkflowRunLog(data, workflowId, runId)); setError(''); }
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 3000);
      }
    };
    poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [workflowId, runId]);
  const stop = async (id) => {
    setBusy(id);
    try {
      const updated = await cancelWorkflowRun(id);
      setRuns((previous) => previous.map((run) => run.id === id ? updated : run));
      setError('');
    } catch (err) { setError(err.message); }
    finally { setBusy(null); }
  };
  return <section className="rounded-xl border border-stone-300 bg-white p-4 space-y-3">
    <h3 className="text-sm font-bold text-stone-800">Lượt chạy xe thật</h3>
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    {!runs.length && !error && <p className="text-xs text-stone-500">{runId ? 'Đang tải nhật ký lượt chạy mới…' : workflowId ? 'Chưa có lượt chạy. Bấm “Bắt đầu workflow” sau khi lưu tuyến và kích hoạt.' : 'Chưa có lượt chạy. Chọn chế độ Điều khiển xe thật trong Lịch chạy rồi lưu workflow.'}</p>}
    <ol className="space-y-2 max-h-80 overflow-y-auto">
      {runs.map((run) => <li key={run.id} className="rounded-lg border border-stone-200 p-3 text-xs space-y-1">
        <div className="flex items-center justify-between gap-3">
          <strong>{run.name} · {run.robot_id}</strong>
          <span className={run.status === 'FAILED' ? 'text-rose-700' : 'text-stone-600'}>{labels[run.status] || run.status}</span>
        </div>
        <p className="text-stone-500">{run.id} · {run.completed_steps} bước hoàn tất · {run.round_index} vòng hoàn tất</p>
        {run.status === 'RUNNING' && <p>Đang xử lý bước {run.current_step_index + 1}/{run.total_steps}</p>}
        {run.error && <p className={run.status === 'COMPLETED' ? 'text-amber-700' : 'text-rose-700'}>{run.error}</p>}
        {['PENDING', 'RUNNING', 'CANCELLING'].includes(run.status) && <button type="button" disabled={busy === run.id || run.status === 'CANCELLING'} onClick={() => stop(run.id)} className="rounded-lg border border-rose-300 px-3 py-1.5 text-rose-800 disabled:opacity-50">{run.status === 'CANCELLING' ? 'Chờ robot xác nhận dừng…' : 'Dừng lượt chạy'}</button>}
        {run.events?.length > 0 && <details><summary className="cursor-pointer text-stone-500">Nhật ký từng bước</summary><ol className="mt-2 space-y-1">{run.events.map((event, i) => <li key={i}>{eventLabels[event.type] || event.type} · vòng {event.round_index + 1} · bước {event.step_index + 1}{event.message ? ` · ${event.message}` : ''}</li>)}</ol></details>}
      </li>)}
    </ol>
  </section>;
}
