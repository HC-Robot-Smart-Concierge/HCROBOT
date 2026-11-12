import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Plus, Save, Trash2, MousePointer2 } from 'lucide-react';
import { fetchWorkflows, saveWorkflow, deleteWorkflow } from '../../../services/workflowApi';
import { newMapRoute, routePoint, routeWorkflow, moveRoutePoint } from '../../../utils/physicalMapRoute';

export function PhysicalMapRoutePlanner({ mapId, endpoints, draft, onDraftChange, onPickPoints, validatePoint, onRouteSaved }) {
  const [routes, setRoutes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const points = draft?.execution_config?.route?.points || [];

  useEffect(() => {
    let current = true;
    fetchWorkflows().then((list) => {
      if (current) setRoutes(list.filter((wf) => wf.execution_config?.route?.map_id === mapId));
    }).catch((err) => { if (current) setMessage(err.message); });
    return () => { current = false; };
  }, [mapId]);

  const update = (key, value) => onDraftChange((previous) => ({ ...previous, [key]: value }));
  const updatePoints = (next) => onDraftChange((previous) => ({ ...previous,
    execution_config: { ...previous.execution_config, route: { ...previous.execution_config.route, points: next } },
  }));
  const addEndpoint = () => {
    const ep = endpoints.find((item) => item.id === selectedEndpoint);
    if (!ep) return;
    const error = validatePoint(ep);
    if (error) { setMessage(error); return; }
    updatePoints([...points, routePoint(ep.x, ep.y, ep)]);
    setMessage('');
  };
  const save = async () => {
    setBusy(true); setMessage('');
    try {
      const payload = routeWorkflow({ ...draft, trigger_type: 'MANUAL' });
      const invalid = points.map(validatePoint).find(Boolean);
      if (invalid) throw new Error(invalid);
      const saved = await saveWorkflow(payload);
      onDraftChange(saved);
      setRoutes((list) => [...list.filter((wf) => wf.id !== saved.id), saved]);
      setMessage('Đã lưu tuyến vào thư viện. Chọn tuyến này trong bước Đi theo tuyến của workflow.');
      onRouteSaved?.(saved);
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!draft.id || !window.confirm(`Xóa tuyến “${draft.name}” khỏi thư viện?`)) return;
    setBusy(true);
    try {
      await deleteWorkflow(draft.id);
      setRoutes((list) => list.filter((wf) => wf.id !== draft.id));
      onDraftChange(null); setMessage('Đã xóa tuyến.');
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  };

  return <div className="space-y-3 text-xs">
    <p className="text-slate-400">Bản đồ: <strong className="text-cyan-300">{mapId}</strong>. Lưu tuyến để dùng trong bước Đi theo tuyến. Lịch chạy đặt ở workflow.</p>
    <div className="flex gap-2">
      <select aria-label="Tuyến đã lưu" value={draft?.id || ''} disabled={busy} onChange={(e) => {
        if (draft && !window.confirm('Mở tuyến khác? Thay đổi chưa lưu của tuyến hiện tại sẽ bị bỏ.')) return;
        onDraftChange(e.target.value ? JSON.parse(JSON.stringify(routes.find((wf) => wf.id === e.target.value))) : null); setMessage('');
      }} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 p-2">
        <option value="">Chọn tuyến đã lưu ({routes.length})</option>
        {routes.map((wf) => <option value={wf.id} key={wf.id}>{wf.name}</option>)}
      </select>
      <button type="button" disabled={busy} onClick={() => {
        if (draft && !window.confirm('Tạo tuyến mới? Thay đổi chưa lưu của tuyến hiện tại sẽ bị bỏ.')) return;
        onDraftChange(newMapRoute(mapId)); setMessage('');
      }} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-cyan-700 font-bold"><Plus className="w-3 h-3" />Tạo tuyến</button>
    </div>
    {message && <p role="status" className="rounded-lg border border-cyan-900 bg-cyan-950/40 p-2 text-cyan-200">{message}</p>}
    {draft && <fieldset disabled={busy} className="min-w-0 space-y-3">
      <label className="block space-y-1"><span className="font-bold">Tên tuyến</span><input value={draft.name} maxLength={150} onChange={(e) => update('name', e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2" /></label>
      <button type="button" onClick={onPickPoints} className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 py-2.5 font-bold"><MousePointer2 className="w-4 h-4" />Chọn các điểm trên map</button>
      <p className="text-slate-400 text-[11px]">Bấm điểm mốc để thêm vào tuyến, hoặc bấm chỗ trống để đặt điểm trung gian. Thao tác này chỉ vẽ tuyến, không ra lệnh di chuyển.</p>
      <div className="flex gap-2"><select aria-label="Thêm điểm mốc vào tuyến" value={selectedEndpoint} onChange={(e) => setSelectedEndpoint(e.target.value)} className="min-w-0 flex-1 p-2 rounded-lg bg-slate-800 border border-slate-700"><option value="">Chọn điểm mốc…</option>{endpoints.map((ep) => <option key={ep.id} value={ep.id}>{ep.name}</option>)}</select><button type="button" disabled={!selectedEndpoint || points.length >= 200} onClick={addEndpoint} className="px-3 rounded-lg border border-slate-600 disabled:opacity-40">Thêm</button></div>
      <ol className="space-y-2 max-h-64 overflow-y-auto">
        {points.map((point, index) => <li key={point.id} className="flex items-center gap-2 rounded-lg border border-slate-700 p-2 bg-slate-800/60">
          <span className="bg-cyan-600 rounded-full w-5 h-5 flex items-center justify-center shrink-0 font-bold">{index + 1}</span>
          <div className="min-w-0 flex-1"><p className="truncate font-bold">{point.name}</p><p className="text-[10px] text-slate-400">({point.x.toFixed(2)}, {point.y.toFixed(2)}) m</p></div>
          <button type="button" aria-label={`Đưa điểm ${index + 1} lên`} disabled={!index} onClick={() => updatePoints(moveRoutePoint(points, index, -1))} className="disabled:opacity-20"><ArrowUp className="w-3.5 h-3.5" /></button>
          <button type="button" aria-label={`Đưa điểm ${index + 1} xuống`} disabled={index === points.length - 1} onClick={() => updatePoints(moveRoutePoint(points, index, 1))} className="disabled:opacity-20"><ArrowDown className="w-3.5 h-3.5" /></button>
          <button type="button" aria-label={`Xóa điểm ${index + 1}`} onClick={() => updatePoints(points.filter((_, i) => i !== index))}><Trash2 className="w-3.5 h-3.5 text-rose-400" /></button>
        </li>)}
      </ol>
      <p className="text-slate-400 text-[11px]">{points.length} điểm · Đường nối thể hiện thứ tự đi; đường tránh vật cản sẽ do Nav2 tính. Muốn quay về, thêm điểm đầu vào cuối tuyến.</p>
      <p className="text-[11px] text-slate-400">Tuyến dùng chung: khi sửa tuyến, các workflow tham chiếu tuyến sẽ dùng nội dung mới.</p>
      <div className="flex gap-2"><button type="button" disabled={busy || points.length < 2} onClick={save} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-700 disabled:opacity-40 font-bold"><Save className="w-4 h-4" />{busy ? 'Đang xử lý…' : onRouteSaved ? 'Lưu & dùng tuyến này' : 'Lưu tuyến'}</button>{draft.id && <button type="button" disabled={busy} onClick={remove} aria-label="Xóa tuyến" className="px-3 rounded-lg border border-rose-800 text-rose-400"><Trash2 className="w-4 h-4" /></button>}</div>
    </fieldset>}
  </div>;
}
