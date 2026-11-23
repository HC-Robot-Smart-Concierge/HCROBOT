import React from 'react';
import { Columns2, Trash2 } from 'lucide-react';
import { GUEST_EVENT, disableParallel, setParallelSetting } from '../../../../utils/workflowGraph';
import { parallelOf } from '../../../../utils/workflowLanes';

const SETTINGS = [
  ['no_interaction_sec', 'Không tương tác thì đi tiếp sau (giây)', 5, 120, 20],
  ['max_hold_sec', 'Giữ xe tối đa (giây)', 30, 1800, 600],
  ['cooldown_sec', 'Sau khi đi tiếp, bỏ qua LiDAR trong (giây)', 0, 300, 30],
];

/** Settings of the parallel run, shown when the screen-lane or guest node is selected. */
export function ParallelLanePanel({ workflow, selectedId, onWorkflowChange, onSelect }) {
  const parallel = parallelOf(workflow);
  if (!parallel) return null;
  const guest = selectedId === GUEST_EVENT;
  return <section className="rounded-xl border border-blue-300 bg-blue-50 p-4 space-y-3 text-xs">
    <h4 className="flex items-center gap-1.5 text-sm font-bold text-blue-900">
      <Columns2 className="w-4 h-4" />{guest ? 'Khi có người chắn đường' : 'Làn Màn hình'}
    </h4>
    <p className="text-blue-900">{guest
      ? 'LiDAR thấy vật mới nằm trên tuyến, cách đầu xe tối đa 60 cm, thì xe dừng và chạy các bước nối từ node này. Khách chạm màn hình cũng làm xe dừng. Xong nhánh, xe đi tiếp từ điểm chưa qua.'
      : 'Các bước nối từ node này chạy trên màn hình cùng lúc với Làn Xe và lặp lại đến khi xe xong. Làn này chỉ nhận Hiển thị, Phát lời và Chờ.'}</p>
    {guest && <p className="text-amber-800">Hiện chỉ dùng LiDAR nên vali hoặc ghế mới đặt trên tuyến cũng làm xe dừng.</p>}
    {SETTINGS.map(([key, label, min, max, fallback]) => <label key={key} className="block space-y-1">
      <span className="font-semibold text-blue-950">{label}</span>
      <input type="number" min={min} max={max} step="1" key={parallel[key]} defaultValue={parallel[key] ?? fallback}
        onBlur={(e) => onWorkflowChange(setParallelSetting(workflow, key, e.target.value, min, max))}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="w-full rounded-lg border border-blue-300 bg-white px-2 py-1.5" />
    </label>)}
    <button type="button" onClick={() => { onWorkflowChange(disableParallel(workflow)); onSelect(null); }}
      className="flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-1.5 font-bold text-rose-800 hover:bg-rose-50">
      <Trash2 className="w-3.5 h-3.5" />Tắt chạy song song và xóa các bước của 2 làn này
    </button>
  </section>;
}
