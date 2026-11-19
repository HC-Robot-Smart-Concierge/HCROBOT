import React from 'react';
import { ShieldAlert } from 'lucide-react';

const ACTIONS = [
  { value: 'STOP', label: 'Dừng lượt chạy' },
  { value: 'CONTINUE', label: 'Bỏ qua, đi tiếp' },
  { value: 'ERROR_BRANCH', label: 'Đi nhánh lỗi (cổng đỏ)' },
];
const clamp = (value, low, high, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : fallback;
};
const inputClass = 'w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs';

/** n8n-style "On error" settings for a real-robot MOVE / FOLLOW_ROUTE step. */
export function StepErrorSettings({ step, allSteps = [], onChange }) {
  const policy = { retry_count: 0, retry_wait_sec: 5, action: 'STOP', ...(step.params?.on_error || {}) };
  const update = (patch) => {
    const next = { ...policy, ...patch };
    if (next.action !== 'ERROR_BRANCH') delete next.next_step_id;
    else if (!next.next_step_id) next.next_step_id = 'END';
    onChange(next);
  };
  return <section className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 space-y-2 text-xs">
    <h4 className="flex items-center gap-1.5 font-bold text-stone-800"><ShieldAlert className="w-4 h-4 text-rose-600" />Khi lỗi</h4>
    <p className="text-stone-500">Áp dụng cho lỗi điều hướng (Nav2 bỏ cuộc, mất định vị). Lỗi encoder, mất kết nối backend hay bấm Dừng luôn dừng ngay.</p>
    <div className="grid grid-cols-2 gap-2">
      <label className="space-y-1"><span className="block font-semibold">Thử lại (lần)</span>
        <input type="number" min="0" max="5" step="1" className={inputClass} value={policy.retry_count}
          onChange={(e) => update({ retry_count: clamp(e.target.value, 0, 5, 0) })} /></label>
      <label className="space-y-1"><span className="block font-semibold">Chờ giữa mỗi lần (giây)</span>
        <input type="number" min="1" max="60" step="1" className={inputClass} value={policy.retry_wait_sec}
          onChange={(e) => update({ retry_wait_sec: clamp(e.target.value, 1, 60, 5) })} /></label>
    </div>
    <label className="block space-y-1"><span className="block font-semibold">Sau đó</span>
      <select className={inputClass} value={policy.action} onChange={(e) => update({ action: e.target.value })}>
        {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
      </select></label>
    {policy.action === 'ERROR_BRANCH' && <label className="block space-y-1"><span className="block font-semibold">Nhánh lỗi đi tới</span>
      <select className={inputClass} value={policy.next_step_id || 'END'} onChange={(e) => update({ next_step_id: e.target.value })}>
        <option value="END">Kết thúc</option>
        {allSteps.filter((s) => s.step_id !== step.step_id).map((s, i) => <option key={s.step_id} value={s.step_id}>{s.title || `Bước ${i + 1}`}</option>)}
      </select>
      <span className="block text-stone-500">Hoặc kéo dây từ cổng đỏ trên sơ đồ.</span></label>}
  </section>;
}
