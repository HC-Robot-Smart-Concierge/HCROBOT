import React from 'react';

export function PhysicalMapWorkflowRunControls({ workflow, issue, needsSave, busy, feedback, onActivate, onStart }) {
  const enabled = workflow.is_active && workflow.execution_config?.execution_mode === 'ROBOT';
  return <section className="space-y-2 rounded-lg border border-emerald-800 bg-emerald-950/20 p-3">
    <h4 className="font-bold text-emerald-200">Chạy workflow · {workflow.name}</h4>
    <p className="text-[11px] text-slate-300">{enabled ? 'Đã kích hoạt trên xe thật.' : 'Lưu gán tuyến cho từng bước, sau đó kích hoạt workflow trên xe thật.'}</p>
    {feedback && <p role="status" className="rounded border border-cyan-800 bg-slate-900 p-2 text-[11px] text-cyan-200">{feedback}</p>}
    {needsSave && <p className="text-[11px] text-amber-300">Lưu tuyến & gán vào bước trước khi chạy.</p>}
    {issue && <p className="text-[11px] text-amber-300">{issue}</p>}
    {!enabled && <>
      {workflow.trigger_type === 'SCHEDULE' && <p className="text-[11px] text-amber-300">Kích hoạt cũng bật lịch chạy đã lưu của workflow này.</p>}
      <button type="button" disabled={busy || needsSave || Boolean(issue)} onClick={onActivate} className="w-full rounded-lg border border-emerald-600 px-3 py-2 font-bold text-emerald-200 disabled:opacity-40">Kích hoạt workflow trên xe thật</button>
    </>}
    <button type="button" disabled={busy || needsSave || Boolean(issue) || !enabled} onClick={onStart} className="w-full rounded-lg bg-emerald-700 px-3 py-2.5 font-bold text-white disabled:opacity-40">Bắt đầu workflow</button>
    <p className="text-[11px] text-slate-400">Chạy toàn bộ workflow theo thứ tự các bước. Robot chỉ chạy khi Navigation đúng map, định vị và encoder hợp lệ.</p>
  </section>;
}
