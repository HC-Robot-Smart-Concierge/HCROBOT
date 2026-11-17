import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Plus, Save, Trash2, MousePointer2 } from 'lucide-react';
import { fetchWorkflows, saveWorkflow, deleteWorkflow, bindWorkflowRoute, activatePhysicalWorkflow, executeWorkflow } from '../../../services/workflowApi';
import { newMapRoute, routePoint, routeWorkflow, moveRoutePoint, workflowRouteTargets, routeStepOnMap, routeIsClosed, closeRoutePoints, routePointRole, physicalWorkflowForMap } from '../../../utils/physicalMapRoute';
import { PhysicalMapWorkflowRunControls } from './PhysicalMapWorkflowRunControls';
import { WorkflowRunsPanel } from './workflow/WorkflowRunsPanel';

export function PhysicalMapRoutePlanner({ mapId, endpoints, draft, onDraftChange, onPickPoints, validatePoint, onRouteSaved, binding, onBindingChange }) {
  const [routes, setRoutes] = useState([]);
  const [allRoutes, setAllRoutes] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [startedRun, setStartedRun] = useState(null);
  const points = draft?.execution_config?.route?.points || [];
  const closed = routeIsClosed(points);
  const editablePoints = closed ? points.slice(0, -1) : points;
  const workflow = workflows.find((wf) => wf.id === binding?.workflowId);
  const routeSteps = (workflow?.steps || []).filter((step) => step.type === 'FOLLOW_ROUTE');
  const selectedStep = routeSteps.find((step) => step.step_id === binding?.stepId);
  const savedDraft = routes.find((route) => route.id === draft?.id);
  const needsSave = !draft?.id || selectedStep?.params?.route_id !== draft.id
    || JSON.stringify(savedDraft) !== JSON.stringify(draft);
  let runIssue = '';
  if (workflow) {
    try { physicalWorkflowForMap(workflow, allRoutes, mapId); }
    catch (err) { runIssue = err.message; }
  }

  const runAction = async (activate) => {
    if (busy || needsSave) return;
    setBusy(true); setMessage('');
    try {
      // Use the latest saved workflow, including route bindings edited elsewhere.
      const list = await fetchWorkflows();
      setWorkflows(workflowRouteTargets(list));
      setAllRoutes(list.filter((item) => item.execution_config?.route));
      const latest = list.find((item) => item.id === workflow.id);
      if (!latest) throw new Error('Workflow không còn tồn tại.');
      const candidate = physicalWorkflowForMap(latest, list.filter((item) => item.execution_config?.route), mapId);
      if (activate) {
        const updated = await activatePhysicalWorkflow(candidate);
        setWorkflows((previous) => previous.map((item) => item.id === updated.id ? updated : item));
        setMessage('Đã kích hoạt workflow trên xe thật. Bấm “Bắt đầu workflow” khi sẵn sàng.');
      } else {
        if (!latest.is_active || latest.execution_config?.execution_mode !== 'ROBOT') throw new Error('Kích hoạt workflow trên xe thật trước khi bắt đầu.');
        const result = await executeWorkflow(latest.id, { robot_id: latest.execution_config.robot_id || 'RC-001' });
        if (result.run_id) setStartedRun({ workflowId: latest.id, runId: result.run_id });
        setMessage(result.message || 'Đã tạo lượt chạy workflow.');
      }
    } catch (err) { setMessage(err.message); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    let current = true;
    fetchWorkflows().then((list) => {
      if (current) {
        setRoutes(list.filter((wf) => wf.execution_config?.route?.map_id === mapId));
        setAllRoutes(list.filter((wf) => wf.execution_config?.route));
        setWorkflows(workflowRouteTargets(list));
      }
    }).catch((err) => { if (current) setMessage(err.message); });
    return () => { current = false; };
  }, [mapId]);

  const selectStep = (wf, stepId) => {
    if (draft && points.length && !window.confirm('Đổi bước cần cấu hình? Thay đổi chưa lưu của tuyến hiện tại sẽ bị bỏ.')) return;
    if (!wf || !stepId) {
      onBindingChange?.({ workflowId: '', stepId: '', expectedRouteId: null });
      setMessage(''); return;
    }
    const target = routeStepOnMap(wf, stepId, allRoutes, mapId);
    onBindingChange?.({ workflowId: wf.id, stepId, expectedRouteId: target.step.params?.route_id || null });
    if (target.route) onDraftChange(JSON.parse(JSON.stringify(target.route)));
    else {
      const next = newMapRoute(mapId);
      next.name = `${wf.name} · ${target.step.title || 'Đi theo tuyến'} · ${mapId}`.slice(0, 150);
      onDraftChange(next);
    }
    setMessage(target.otherMap
      ? `Bước hiện có tuyến trên map ${target.otherMap}. Lưu gán ở đây sẽ thay tham số tuyến bằng tuyến của ${mapId}.`
      : `Đang cấu hình tham số tuyến cho bước “${target.step.title}”. Chọn các điểm trên map rồi lưu gán.`);
  };

  const update = (key, value) => onDraftChange((previous) => ({ ...previous, [key]: value }));
  const updatePoints = (next) => onDraftChange((previous) => ({ ...previous,
    execution_config: { ...previous.execution_config, route: { ...previous.execution_config.route,
      points: closed ? closeRoutePoints(next) : next } },
  }));
  const toggleClosed = () => {
    try {
      const next = closed ? points.slice(0, -1) : closeRoutePoints(points);
      onDraftChange((previous) => ({ ...previous, execution_config: { ...previous.execution_config,
        route: { ...previous.execution_config.route, points: next } } }));
      setMessage(routeIsClosed(next) ? 'Đã khép kín tuyến, chặng cuối quay về điểm đầu.' : 'Tuyến mở: chọn thêm điểm hoặc lưu với điểm cuối hiện tại.');
    } catch (err) { setMessage(err.message); }
  };
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
    let savedRoute = null;
    try {
      const payload = routeWorkflow({ ...draft, trigger_type: 'MANUAL' });
      if (payload.execution_config.route.map_id !== mapId) throw new Error('Tuyến đang sửa thuộc map khác. Tạo hoặc chọn tuyến trên map hiện tại.');
      if (binding?.workflowId && (!workflow || !selectedStep)) throw new Error('Chọn lại workflow và bước cần cấu hình.');
      const invalid = points.map(validatePoint).find(Boolean);
      if (invalid) throw new Error(invalid);
      const saved = await saveWorkflow(payload);
      savedRoute = saved;
      onDraftChange(saved);
      setRoutes((list) => [...list.filter((wf) => wf.id !== saved.id), saved]);
      setAllRoutes((list) => [...list.filter((wf) => wf.id !== saved.id), saved]);
      if (workflow && selectedStep) {
        const expectedRouteId = Object.prototype.hasOwnProperty.call(binding || {}, 'expectedRouteId')
          ? binding.expectedRouteId : selectedStep.params?.route_id;
        const updated = await bindWorkflowRoute(workflow.id, selectedStep.step_id, saved, expectedRouteId);
        setWorkflows((list) => list.map((wf) => wf.id === updated.id ? updated : wf));
        onBindingChange?.({ ...binding, expectedRouteId: saved.id });
        setMessage(`Đã lưu và gán tuyến cho “${updated.name}” → “${selectedStep.title}”. ${updated.is_active && updated.execution_config?.execution_mode === 'ROBOT' ? 'Bấm “Bắt đầu workflow” bên dưới để chạy.' : 'Cấu hình đủ các bước rồi bấm “Kích hoạt workflow trên xe thật” bên dưới.'}`);
      } else setMessage('Đã lưu tuyến. Chọn workflow và bước ở trên để gán tuyến, hoặc dùng tuyến từ trình dựng workflow.');
      onRouteSaved?.(saved);
    } catch (err) { setMessage(savedRoute ? `Đã lưu tuyến nhưng chưa gán vào workflow: ${err.message}` : err.message); }
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
    <p className="text-slate-400">Bản đồ: <strong className="text-cyan-300">{mapId}</strong>. Chọn workflow và bước Đi theo tuyến, rồi cấu hình tuyến như tham số của bước. Lịch chạy đặt ở workflow.</p>
    {!onRouteSaved && <div className="rounded-lg border border-cyan-900 bg-cyan-950/20 p-3 space-y-3">
      <label className="block space-y-1"><span className="font-bold">Workflow cần cấu hình tuyến</span>
        <select aria-label="Workflow cần cấu hình tuyến" value={workflow?.id || ''} disabled={busy} onChange={(e) => {
          const wf = workflows.find((item) => item.id === e.target.value);
          selectStep(wf, wf?.steps?.find((step) => step.type === 'FOLLOW_ROUTE')?.step_id);
        }} className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2">
          <option value="">Chỉ lưu tuyến, chưa gán workflow</option>
          {workflows.map((wf) => <option key={wf.id} value={wf.id}>{wf.name}{wf.is_active ? ' · đang bật' : ' · tạm tắt/bản nháp'}</option>)}
        </select>
      </label>
      {workflow && <label className="block space-y-1"><span className="font-bold">Bước nhận tham số tuyến</span>
        <select aria-label="Bước nhận tham số tuyến" value={selectedStep?.step_id || ''} disabled={busy} onChange={(e) => selectStep(workflow, e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2">
          <option value="">Chọn bước Đi theo tuyến…</option>
          {routeSteps.map((step) => <option key={step.step_id} value={step.step_id}>{step.title}{step.params?.route_id ? ' · đã có tuyến' : ' · chờ cấu hình'}</option>)}
        </select>
      </label>}
      <p className="text-slate-400 text-[11px]">{workflows.length ? 'Chỉ thay tuyến của bước được chọn; giữ nguyên các bước khác và lịch chạy.' : 'Tạo và lưu workflow có bước Đi theo tuyến trước. Có thể để trống tuyến khi lưu bản nháp.'}</p>
    </div>}
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
    {message && !(workflow && selectedStep) && <p role="status" className="rounded-lg border border-cyan-900 bg-cyan-950/40 p-2 text-cyan-200">{message}</p>}
    {draft && <fieldset disabled={busy} className="min-w-0 space-y-3">
      <label className="block space-y-1"><span className="font-bold">Tên tuyến</span><input value={draft.name} maxLength={150} onChange={(e) => update('name', e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2" /></label>
      <button type="button" disabled={closed} onClick={onPickPoints} className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 py-2.5 font-bold disabled:opacity-40"><MousePointer2 className="w-4 h-4" />Chọn các điểm trên map</button>
      <p className="text-slate-400 text-[11px]">Điểm đầu màu xanh lá, điểm cuối màu đỏ; các điểm ở giữa là điểm trung gian. Bấm lại điểm đầu để khép kín tuyến. Thao tác này chỉ vẽ tuyến, không ra lệnh di chuyển.</p>
      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-700 p-2">
        <span className={closed ? 'text-emerald-300 font-bold' : 'text-slate-300'}>{closed ? 'Tuyến khép kín · quay về điểm đầu' : 'Tuyến mở'}</span>
        <button type="button" disabled={!closed && (points.length < 2 || points.length >= 200)} onClick={toggleClosed} className="rounded border border-cyan-700 px-2 py-1 text-cyan-200 disabled:opacity-40">{closed ? 'Mở tuyến' : 'Khép kín tuyến'}</button>
      </div>
      <div className="flex gap-2"><select disabled={closed} aria-label="Thêm điểm mốc vào tuyến" value={selectedEndpoint} onChange={(e) => setSelectedEndpoint(e.target.value)} className="min-w-0 flex-1 p-2 rounded-lg bg-slate-800 border border-slate-700"><option value="">Chọn điểm mốc…</option>{endpoints.map((ep) => <option key={ep.id} value={ep.id}>{ep.name}</option>)}</select><button type="button" disabled={closed || !selectedEndpoint || points.length >= 200} onClick={addEndpoint} className="px-3 rounded-lg border border-slate-600 disabled:opacity-40">Thêm</button></div>
      <ol className="space-y-2 max-h-64 overflow-y-auto">
        {points.map((point, index) => <li key={point.id} className="flex items-center gap-2 rounded-lg border border-slate-700 p-2 bg-slate-800/60">
          <span className="bg-cyan-600 rounded-full w-5 h-5 flex items-center justify-center shrink-0 font-bold">{index + 1}</span>
          <div className="min-w-0 flex-1"><p className={`text-[10px] font-bold ${index === 0 ? 'text-emerald-300' : index === points.length - 1 ? 'text-rose-300' : 'text-cyan-300'}`}>{routePointRole(points, index)}</p><p className="truncate font-bold">{point.name === 'Điểm trung gian' ? `Vị trí ${closed && index === points.length - 1 ? 1 : index + 1}` : point.name}</p><p className="text-[10px] text-slate-400">({point.x.toFixed(2)}, {point.y.toFixed(2)}) m</p></div>
          {!(closed && index === points.length - 1) && <>
            <button type="button" aria-label={`Đưa điểm ${index + 1} lên`} disabled={!index} onClick={() => updatePoints(moveRoutePoint(editablePoints, index, -1))} className="disabled:opacity-20"><ArrowUp className="w-3.5 h-3.5" /></button>
            <button type="button" aria-label={`Đưa điểm ${index + 1} xuống`} disabled={index === editablePoints.length - 1} onClick={() => updatePoints(moveRoutePoint(editablePoints, index, 1))} className="disabled:opacity-20"><ArrowDown className="w-3.5 h-3.5" /></button>
            <button type="button" aria-label={`Xóa điểm ${index + 1}`} onClick={() => updatePoints(editablePoints.filter((_, i) => i !== index))}><Trash2 className="w-3.5 h-3.5 text-rose-400" /></button>
          </>}
        </li>)}
      </ol>
      <p className="text-slate-400 text-[11px]">{editablePoints.length} điểm{closed ? ' + chặng quay về điểm đầu' : ''} · Robot đi liên tục qua các điểm trung gian, chỉ căn hướng cuối tuyến. Nav2 tính đường tránh vật cản.</p>
      <p className="text-[11px] text-slate-400">Tuyến dùng chung: khi sửa tuyến, các workflow tham chiếu tuyến sẽ dùng nội dung mới.</p>
      <div className="flex gap-2"><button type="button" disabled={busy || points.length < 2} onClick={save} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-700 disabled:opacity-40 font-bold"><Save className="w-4 h-4" />{busy ? 'Đang xử lý…' : selectedStep ? 'Lưu tuyến & gán vào bước' : onRouteSaved ? 'Lưu & dùng tuyến này' : 'Lưu tuyến'}</button>{draft.id && <button type="button" disabled={busy} onClick={remove} aria-label="Xóa tuyến" className="px-3 rounded-lg border border-rose-800 text-rose-400"><Trash2 className="w-4 h-4" /></button>}</div>
    </fieldset>}
    {workflow && selectedStep && <>
      <PhysicalMapWorkflowRunControls workflow={workflow} issue={runIssue} needsSave={needsSave} busy={busy} feedback={message}
        onActivate={() => runAction(true)} onStart={() => runAction(false)} />
      <WorkflowRunsPanel key={`${workflow.id}:${startedRun?.workflowId === workflow.id ? startedRun.runId : ''}`}
        workflowId={workflow.id} runId={startedRun?.workflowId === workflow.id ? startedRun.runId : undefined} />
    </>}
  </div>;
}
