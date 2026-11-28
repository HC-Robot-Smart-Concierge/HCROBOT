import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Save, Trash2, RotateCw, FlipHorizontal, Copy, MousePointer2, PenLine, Eye, EyeOff, RefreshCw, History, Info, Route, CopyPlus, Eraser, Undo2, Redo2, Sparkles,
} from 'lucide-react';
import { listMapLayouts } from '../../../services/workflowApi';
import { HOTEL_FLOORS, HOTEL_DESTINATIONS } from '../../../components/robot/FloorMap';
import { parsePgm, buildWalkableGrid, renderGuestImage } from '../../../services/robotFloorPose';
import { hasFloorSketch, buildFloorSketch } from '../../../services/floorSketches';
import { buildGuestView } from '../../../services/guestView';
import {
  DEFAULT_FLOOR_SIZE, floorLayoutKey, isFloorLayoutKey, floorMapFromLayout, rasterizeLayout, routeOnGrid,
} from '../../../services/layoutRouting';
import { fetchGuestNavLayout, saveGuestNavLayout, deleteGuestNavLayout } from '../../../services/guestNavLayoutApi';
import {
  NAV_SYMBOLS, NAV_THEME, NavObject, NavSymbolShape, cellToMeters, metersToCell, symbolName,
} from '../../../components/robot/guestNavSymbols';

const newId = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const snap = (v) => Math.round(v); // 1 ô = resolution (thường 5 cm)
const WALL_DEFAULT_M = 0.08;
const GROUND_FLOOR_ID = '3'; // Tầng Trệt = nơi robot đứng, dùng map Nav2
// Tầng khách sạn (trừ Tầng Trệt) -> layout vẽ trên khung trống
const HOTEL_FLOOR_OPTIONS = HOTEL_FLOORS.filter((f) => f.id !== GROUND_FLOOR_ID);
const floorIdOfKey = (key) => (isFloorLayoutKey(key) ? key.slice('floor-'.length) : GROUND_FLOOR_ID);
// Nháp chưa lưu được giữ trong trình duyệt để không mất khi trang tải lại
const draftKey = (mapId) => `hcrobot.guestNavDraft.${mapId}`;
const readDraft = (mapId) => {
  try { return JSON.parse(localStorage.getItem(draftKey(mapId)) || 'null'); } catch { return null; }
};
const clearDraft = (mapId) => { try { localStorage.removeItem(draftKey(mapId)); } catch { /* bỏ qua */ } };

async function resolveDefaultMapId(layouts) {
  try {
    const r = await fetch('/api/v1/map/ros2/runtime');
    const d = r.ok ? await r.json() : null;
    if (d?.active_map && layouts.some((m) => m.map_id === d.active_map)) return d.active_map;
  } catch {
    // bỏ qua
  }
  return layouts.find((m) => m.map_id === 'mapchinh')?.map_id || layouts[0]?.map_id || null;
}

export const AdminGuestNavMapTab = ({ onNotify }) => {
  const [mapLayouts, setMapLayouts] = useState([]);
  const [navMapId, setNavMapId] = useState(null); // map Nav2 robot đang nạp = Tầng Trệt
  // Nội dung đang mở thuộc tầng nào: chỉ tự lưu nháp khi khớp, tránh ghi nhầm bản vẽ tầng cũ sang tầng mới
  const [contentKey, setContentKey] = useState(null);
  const [mapId, setMapId] = useState(null);
  const [mapImage, setMapImage] = useState(null); // dataURL ảnh Nav2
  const [objects, setObjects] = useState([]); // mét
  const [walls, setWalls] = useState([]); // mét
  const [savedAt, setSavedAt] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [tool, setTool] = useState('select'); // select | wall
  const [selected, setSelected] = useState(null); // {kind:'object'|'wall', id}
  const [draftWall, setDraftWall] = useState(null); // [[cx,cy],...]
  const [hover, setHover] = useState(null);
  const [ortho, setOrtho] = useState(true);
  const [showNav2, setShowNav2] = useState(true);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [floorSize, setFloorSize] = useState(DEFAULT_FLOOR_SIZE); // m, chỉ cho tầng khách sạn
  const [navPgm, setNavPgm] = useState(null); // PGM map Nav2 (để xem thử đường)
  const [previewKey, setPreviewKey] = useState(null); // destKey đang xem thử đường
  const [erased, setErased] = useState([]); // ô nền Nav2 đã tẩy (chỉ số y*width+x)
  const [eraseMode, setEraseMode] = useState('erase'); // erase | restore
  const [brush, setBrush] = useState(2); // bán kính đầu tẩy (ô)
  const [rawPgm, setRawPgm] = useState(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const isFloor = isFloorLayoutKey(mapId);
  const floorId = floorIdOfKey(mapId);
  const mapInfo = mapLayouts.find((m) => m.map_id === mapId);
  const map = useMemo(() => {
    if (isFloor) return floorMapFromLayout(floorSize, mapId);
    return mapInfo ? {
      mapId: mapInfo.map_id, width: mapInfo.width, height: mapInfo.height,
      resolution: mapInfo.resolution, originX: mapInfo.origin_x, originY: mapInfo.origin_y,
    } : null;
  }, [isFloor, floorSize, mapId, mapInfo]);
  // Điểm đến có sẵn của tầng đang vẽ
  // Tường mới: lab (map Nav2) dùng 8 cm, tầng khách sạn rộng hơn dùng 15 cm cho dễ nhìn
  const newWallM = isFloor ? 0.15 : WALL_DEFAULT_M;
  // Cỡ mặc định của ký hiệu: theo phòng lab (Nav2); tầng khách sạn thật lớn hơn ~3 lần
  const symScale = isFloor ? 3 : 1;
  const floorDestinations = useMemo(
    () => Object.values(HOTEL_DESTINATIONS).filter((d) => d.floorId === floorId),
    [floorId],
  );

  const notify = useCallback((text, type = 'success') => {
    setMessage({ text, type });
    onNotify?.(text, type);
    setTimeout(() => setMessage(null), 4000);
  }, [onNotify]);

  // Danh sách map Nav2 + map mặc định (map Nav2 đang nạp)
  useEffect(() => {
    listMapLayouts()
      .then(async (list) => {
        setMapLayouts(list);
        const nav = await resolveDefaultMapId(list);
        setNavMapId(nav);
        setMapId(nav);
      })
      .catch((e) => notify(e.message, 'error'));
  }, [notify]);

  const loadLayout = useCallback(async (id) => {
    const data = await fetchGuestNavLayout(id);
    const draft = readDraft(id);
    const savedTime = data?.updatedAt ? Date.parse(data.updatedAt + (data.updatedAt.endsWith('Z') ? '' : 'Z')) : 0;
    if (draft && draft.at > savedTime) {
      setObjects(draft.objects || []);
      setWalls(draft.walls || []);
      setErased(draft.erased || []);
      setDirty(true);
      setMessage({ text: 'Đã khôi phục bản vẽ chưa lưu lần trước. Bấm "Lưu & áp dụng" để lưu, hoặc "Tải lại" để bỏ.', type: 'success' });
    } else {
      clearDraft(id);
      setObjects(data?.objects || []);
      setWalls(data?.walls || []);
      setErased(data?.erased || []);
      setDirty(false);
    }
    setFloorSize({
      width: (draft && draft.at > savedTime ? draft.width : data?.width) || DEFAULT_FLOOR_SIZE.width,
      height: (draft && draft.at > savedTime ? draft.height : data?.height) || DEFAULT_FLOOR_SIZE.height,
    });
    setSavedAt(data?.updatedAt || null);
    setPreviewKey(null);
    setContentKey(id);
    setSelected(null);
    setDraftWall(null);
  }, []);

  useEffect(() => {
    if (!mapId) return;
    setContentKey(null);
    setMapImage(null);
    setNavPgm(null);
    setRawPgm(null); // tránh hiện nền Nav2 của Tầng Trệt trên tầng khác
    if (!isFloorLayoutKey(mapId)) {
      fetch(`/api/v1/map/layouts/${encodeURIComponent(mapId)}/image`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('Không tải được ảnh map'))))
        .then((buf) => {
          const pgm = parsePgm(buf);
          setRawPgm(pgm);
          setNavPgm(pgm);
        })
        .catch((e) => notify(e.message, 'error'));
    }
    loadLayout(mapId).catch((e) => notify(e.message, 'error'));
  }, [mapId, loadLayout, notify]);

  // Tự lưu nháp mỗi khi có thay đổi chưa lưu
  useEffect(() => {
    if (!mapId || !dirty || contentKey !== mapId) return;
    try { localStorage.setItem(draftKey(mapId), JSON.stringify({ at: Date.now(), walls, objects, erased, ...floorSize })); } catch { /* đầy bộ nhớ */ }
  }, [mapId, contentKey, dirty, walls, objects, erased, floorSize]);

  // Nền tham chiếu đã làm sạch (bỏ chấm lẻ, bỏ vùng chưa quét) + vùng Admin đã tẩy
  useEffect(() => {
    if (!rawPgm) { setMapImage(null); return undefined; }
    const t = setTimeout(() => {
      setMapImage(renderGuestImage(rawPgm, { floorColor: null, wallColor: '#A8A29E', minCluster: 3, erased }));
    }, 60);
    return () => clearTimeout(t);
  }, [rawPgm, erased]);

  // ---------- tính đường xem thử ----------
  // Tầng Trệt: lưới map Nav2 (giống robot). Tầng khác: lưới dựng từ tường/nội thất/cửa của layout.
  // Chỉ tính lại khi bản vẽ đứng yên 350 ms (không tính trong lúc đang kéo)
  const [settled, setSettled] = useState({ walls: [], objects: [] });
  useEffect(() => {
    const t = setTimeout(() => setSettled({ walls, objects }), 350);
    return () => clearTimeout(t);
  }, [walls, objects]);
  const routeGrid = useMemo(() => {
    if (!map) return null;
    if (isFloor) return rasterizeLayout(settled, map);
    return navPgm ? buildWalkableGrid(navPgm, Math.max(1, Math.round(0.1 / map.resolution))) : null;
  }, [map, isFloor, settled, navPgm]);
  const routeChecks = useMemo(() => {
    const out = {};
    const elevator = settled.objects.find((o) => o.type === 'elevator');
    if (!routeGrid || !elevator) return out;
    for (const d of settled.objects) {
      if (d.type === 'destination') out[d.id] = routeOnGrid(routeGrid, map, elevator, d);
    }
    return out;
  }, [routeGrid, map, settled]);
  const elevatorObj = objects.find((o) => o.type === 'elevator');
  const destinationObjs = objects.filter((o) => o.type === 'destination');
  const previewObj = destinationObjs.find((d) => d.id === previewKey);
  const previewRoute = previewObj ? routeChecks[previewObj.id] : null;

  // ---------- toạ độ ----------
  const toCell = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  };

  const touch = () => setDirty(true);

  // ---------- Hoàn tác / làm lại (Ctrl+Z / Ctrl+Y) ----------
  // Ghi 1 bước khi bản vẽ đứng yên 300 ms => 1 lần kéo chuột = 1 bước, không phải trăm bước nhỏ.
  const histRef = useRef({ undo: [], redo: [], committed: null, pending: null, timer: null, key: null, skip: false });
  const [histVer, setHistVer] = useState(0);
  const MAX_HISTORY = 100;
  useEffect(() => {
    // Nạp tầng mới => bắt đầu lịch sử mới
    const h = histRef.current;
    clearTimeout(h.timer);
    Object.assign(h, { undo: [], redo: [], pending: null, timer: null, skip: false, key: contentKey,
      committed: contentKey ? { walls, objects, erased, floorSize } : null });
    setHistVer((v) => v + 1);
  }, [contentKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const commitPending = () => {
    const h = histRef.current;
    clearTimeout(h.timer);
    h.timer = null;
    const cur = h.pending;
    h.pending = null;
    if (!cur || !h.committed || cur === h.committed) return;
    h.undo.push(h.committed);
    if (h.undo.length > MAX_HISTORY) h.undo.shift();
    h.redo = [];
    h.committed = cur;
    setHistVer((v) => v + 1);
  };
  useEffect(() => {
    const h = histRef.current;
    if (!contentKey || h.key !== contentKey) return;
    const cur = { walls, objects, erased, floorSize };
    if (h.skip) { h.skip = false; h.committed = cur; return; }
    h.pending = cur;
    clearTimeout(h.timer);
    h.timer = setTimeout(commitPending, 300);
  }, [walls, objects, erased, floorSize]); // eslint-disable-line react-hooks/exhaustive-deps
  const applySnapshot = (snap) => {
    histRef.current.skip = true;
    setWalls(snap.walls);
    setObjects(snap.objects);
    setErased(snap.erased);
    setFloorSize(snap.floorSize);
    setSelected(null);
    setDraftWall(null);
    touch();
  };
  const undo = () => {
    commitPending();
    const h = histRef.current;
    if (!h.undo.length) return;
    const prev = h.undo.pop();
    h.redo.push(h.committed);
    h.committed = prev;
    applySnapshot(prev);
    setHistVer((v) => v + 1);
  };
  const redo = () => {
    commitPending();
    const h = histRef.current;
    if (!h.redo.length) return;
    const next = h.redo.pop();
    h.undo.push(h.committed);
    h.committed = next;
    applySnapshot(next);
    setHistVer((v) => v + 1);
  };
  const canUndo = histVer >= 0 && (histRef.current.undo.length > 0 || Boolean(histRef.current.pending));
  const canRedo = histVer >= 0 && histRef.current.redo.length > 0;
  const updateObject = (id, patch) => {
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    touch();
  };
  const selectedObject = selected?.kind === 'object' ? objects.find((o) => o.id === selected.id) : null;

  const addSymbol = (sym) => {
    if (!map) return;
    const c = cellToMeters(map.width / 2, map.height / 2, map);
    const obj = {
      id: newId('obj'), type: sym.type,
      x: +c.x.toFixed(3), y: +c.y.toFixed(3), w: +(sym.w * symScale).toFixed(2), h: +(sym.h * symScale).toFixed(2),
      rotation: 0, flip: false, label: sym.label || null,
    };
    setObjects((prev) => [...prev, obj]);
    setSelected({ kind: 'object', id: obj.id });
    setTool('select');
    touch();
  };

  const removeSelected = () => {
    if (!selected) return;
    if (selected.kind === 'object') setObjects((prev) => prev.filter((o) => o.id !== selected.id));
    else setWalls((prev) => prev.filter((w) => w.id !== selected.id));
    setSelected(null);
    touch();
  };

  const duplicate = () => {
    if (!selectedObject || !map) return;
    const copy = { ...selectedObject, id: newId('obj'), x: selectedObject.x + 0.1, y: selectedObject.y - 0.1 };
    setObjects((prev) => [...prev, copy]);
    setSelected({ kind: 'object', id: copy.id });
    touch();
  };

  // ---------- vẽ tường ----------
  const wallPoint = (p) => {
    let x = snap(p.x);
    let y = snap(p.y);
    const last = draftWall?.[draftWall.length - 1];
    if (ortho && last) {
      if (Math.abs(x - last[0]) >= Math.abs(y - last[1])) y = last[1];
      else x = last[0];
    }
    return [x, y];
  };

  const finishWall = () => {
    if (draftWall && draftWall.length >= 2 && map) {
      const points = draftWall.map(([cx, cy]) => {
        const m = cellToMeters(cx, cy, map);
        return [+m.x.toFixed(3), +m.y.toFixed(3)];
      });
      const wall = { id: newId('wall'), points, thickness: newWallM };
      setWalls((prev) => [...prev, wall]);
      touch();
    }
    setDraftWall(null);
  };

  // ---------- cục tẩy ----------
  const applyBrush = (p) => {
    if (!map || isFloor) return;
    const cells = [];
    for (let y = Math.floor(p.y - brush); y <= Math.ceil(p.y + brush); y += 1) {
      for (let x = Math.floor(p.x - brush); x <= Math.ceil(p.x + brush); x += 1) {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        if (Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) <= brush) cells.push(y * map.width + x);
      }
    }
    setErased((prev) => {
      const set = new Set(prev);
      const before = set.size;
      if (eraseMode === 'erase') cells.forEach((c) => set.add(c)); else cells.forEach((c) => set.delete(c));
      return set.size === before && eraseMode === 'erase' ? prev : [...set];
    });
    touch();
  };

  // ---------- chuột ----------
  const onCanvasDown = (e) => {
    if (!map) return;
    const p = toCell(e);
    if (tool === 'erase') {
      dragRef.current = { kind: 'erase' };
      applyBrush(p);
      return;
    }
    if (tool === 'wall') {
      setDraftWall((prev) => [...(prev || []), wallPoint(p)]);
      return;
    }
    setSelected(null);
  };

  const startDrag = (e, kind, payload) => {
    if (tool !== 'select' || e.button !== 0) return;
    e.stopPropagation();
    dragRef.current = { kind, start: toCell(e), payload };
  };

  const onMove = (e) => {
    if (!map) return;
    const p = toCell(e);
    if (tool === 'wall') setHover(wallPoint(p));
    if (tool === 'erase') setHover([p.x, p.y]);
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'erase') { applyBrush(p); return; }
    const res = map.resolution;
    const dx = snap(p.x - d.start.x);
    const dy = snap(p.y - d.start.y);
    if (d.kind === 'move') {
      updateObject(d.payload.id, { x: +(d.payload.x + dx * res).toFixed(3), y: +(d.payload.y - dy * res).toFixed(3) });
    } else if (d.kind === 'resize') {
      // Chiếu vào trục đã xoay của vật thể (màn hình xoay ngược chiều map)
      const rad = ((d.payload.rotation || 0) * Math.PI) / 180;
      const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
      updateObject(d.payload.id, {
        w: +Math.max(res, d.payload.w + lx * res * 2).toFixed(3),
        h: +Math.max(res, d.payload.h + ly * res * 2).toFixed(3),
      });
    } else if (d.kind === 'wallpt') {
      const { wallId, index } = d.payload;
      const m = cellToMeters(snap(p.x), snap(p.y), map);
      setWalls((prev) => prev.map((w) => (w.id !== wallId ? w : {
        ...w, points: w.points.map((pt, i) => (i === index ? [+m.x.toFixed(3), +m.y.toFixed(3)] : pt)),
      })));
      touch();
    }
  };
  const onUp = () => { dragRef.current = null; };

  // ---------- phím tắt ----------
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return; // ô nhập dùng Ctrl+Z riêng của trình duyệt
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (tool === 'wall' && draftWall) setDraftWall((prev) => (prev && prev.length > 1 ? prev.slice(0, -1) : null));
        else if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
      if (tool === 'wall') {
        if (e.key === 'Enter') finishWall();
        if (e.key === 'Escape') setDraftWall(null);
        if (e.key === 'Backspace') setDraftWall((prev) => (prev && prev.length > 1 ? prev.slice(0, -1) : null));
        return;
      }
      if (!selected) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); }
      if (!selectedObject) return;
      if (e.key === 'r' || e.key === 'R') updateObject(selectedObject.id, { rotation: ((selectedObject.rotation || 0) + (e.shiftKey ? 90 : 270)) % 360 });
      if (e.key === 'f' || e.key === 'F') updateObject(selectedObject.id, { flip: !selectedObject.flip });
      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); duplicate(); }
      if (e.key.startsWith('Arrow') && map) {
        e.preventDefault();
        const step = map.resolution * (e.shiftKey ? 5 : 1);
        const [ddx, ddy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
        updateObject(selectedObject.id, { x: +(selectedObject.x + ddx).toFixed(3), y: +(selectedObject.y + ddy).toFixed(3) });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------- lưu ----------
  const handleSave = async () => {
    if (!mapId) return;
    if (contentKey !== mapId) { notify('Tầng đang được tải, thử lại sau giây lát.', 'error'); return; }
    setBusy(true);
    try {
      // Kèm "bản hiển thị cho khách" để trang QR trên điện thoại dùng layout mới (không cần tính đường)
      let guestView = null;
      try { guestView = buildGuestView({ walls, objects }, map, mapId); } catch (err) { console.warn('[guestView]', err); }
      const saved = await saveGuestNavLayout(mapId, { version: 1, walls, objects, ...(isFloor ? floorSize : { erased }), guestView });
      setSavedAt(saved.updatedAt);
      setDirty(false);
      clearDraft(mapId);
      notify(`Đã lưu layout cho map "${mapId}". Màn hình khách dùng ở lần chỉ đường tiếp theo.`);
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!mapId) return;
    if (!window.confirm(`Xoá layout chỉ đường của map "${mapId}"? Màn hình khách sẽ quay về hiển thị map Nav2.`)) return;
    try {
      await deleteGuestNavLayout(mapId);
      await loadLayout(mapId);
      notify('Đã xoá layout, màn hình khách quay về map Nav2.');
    } catch (e) {
      notify(e.message, 'error');
    }
  };

  // Sao chép layout từ tầng khác (chưa lưu, Admin sửa rồi mới lưu)
  const handleCopyFrom = async (sourceKey) => {
    if (!sourceKey || sourceKey === mapId) return;
    if ((walls.length || objects.length) && !window.confirm('Thay toàn bộ bản vẽ hiện tại bằng bản sao?')) return;
    try {
      const src = await fetchGuestNavLayout(sourceKey);
      if (!src || !((src.walls || []).length || (src.objects || []).length)) { notify('Tầng nguồn chưa có layout.', 'error'); return; }
      let dx = 0;
      let dy = 0;
      let size = { width: src.width || floorSize.width, height: src.height || floorSize.height };
      if (!isFloorLayoutKey(sourceKey)) {
        // Nguồn là Tầng Trệt (toạ độ map robot, có thể âm) -> dời về góc tầng, khung vừa khít + lề 0,5 m
        const xs = [];
        const ys = [];
        for (const w of src.walls || []) for (const [x, y] of w.points) { xs.push(x); ys.push(y); }
        for (const o of src.objects || []) {
          const r = Math.max(o.w, o.h) / 2;
          xs.push(o.x - r, o.x + r); ys.push(o.y - r, o.y + r);
        }
        const margin = 0.5;
        dx = margin - Math.min(...xs);
        dy = margin - Math.min(...ys);
        const fit = (v) => Math.max(2, Math.ceil((v + 2 * margin) * 2) / 2);
        size = { width: fit(Math.max(...xs) - Math.min(...xs)), height: fit(Math.max(...ys) - Math.min(...ys)) };
      }
      const r3 = (v) => +v.toFixed(3);
      setWalls((src.walls || []).map((w) => ({ ...w, id: newId('wall'), points: w.points.map(([x, y]) => [r3(x + dx), r3(y + dy)]) })));
      // Điểm đến là của tầng nguồn -> bỏ mã, Admin chọn lại cho tầng này
      setObjects((src.objects || []).map((o) => ({
        ...o, id: newId('obj'), x: r3(o.x + dx), y: r3(o.y + dy),
        ...(o.type === 'destination' ? { destKey: null, label: null } : {}),
      })));
      if (isFloor) setFloorSize(size);
      setSelected(null);
      touch();
      notify('Đã sao chép. Chọn lại mã cho các Điểm đến rồi bấm Lưu.');
    } catch (e) {
      notify(e.message, 'error');
    }
  };

  // Nạp bản phác thảo dựng từ ảnh mặt bằng cũ (chưa lưu, Admin xem rồi mới lưu)
  const handleLoadSketch = () => {
    const sketch = buildFloorSketch(floorId);
    if (!sketch) return;
    if ((walls.length || objects.length) && !window.confirm('Thay bản vẽ hiện tại bằng bản phác thảo từ map cũ?')) return;
    setWalls(sketch.walls);
    setObjects(sketch.objects);
    setFloorSize({ width: sketch.width, height: sketch.height });
    setSelected(null);
    setPreviewKey(null);
    touch();
    notify('Đã nạp bản phác thảo từ map cũ. Kiểm tra "Xem thử đường đi", chỉnh lại rồi bấm Lưu.');
  };

  const hasElevator = objects.some((o) => o.type === 'elevator');
  const groups = [...new Set(NAV_SYMBOLS.map((s) => s.group))];
  const ui = map ? Math.max(map.width, map.height) / 80 : 1; // hệ số kích thước nét UI
  const pad = 4 * ui;

  return (
    <div className="w-full h-full flex flex-col gap-3 p-4 overflow-hidden" style={{ background: '#F2EFE9' }}>
      {/* Thanh trên */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-extrabold text-stone-900 mr-1">Map chỉ đường</h2>
        <select
          value={mapId || ''}
          onChange={(e) => {
            if (dirty && !window.confirm('Có thay đổi chưa lưu. Bỏ qua và đổi tầng?')) return;
            // Đã đồng ý bỏ: xoá nháp tầng hiện tại, ngắt tự lưu cho tới khi tầng mới nạp xong
            if (dirty && mapId) clearDraft(mapId);
            setDirty(false);
            setContentKey(null);
            setMapId(e.target.value);
          }}
          className="px-2 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-bold"
        >
          {/* Đúng 8 tầng của khách sạn (khớp knowledge base RAG). Tầng Trệt = map Nav2 robot đang nạp. */}
          {HOTEL_FLOORS.map((f) => (f.id === GROUND_FLOOR_ID ? (
            navMapId && <option key={f.id} value={navMapId}>{f.name} · map robot: {navMapId}</option>
          ) : (
            <option key={f.id} value={floorLayoutKey(f.id)}>{f.name}</option>
          )))}
        </select>
        {isFloor && (
          <div className="flex items-center gap-1 text-xs font-bold text-stone-700">
            <span>Kích thước</span>
            {['width', 'height'].map((k, i) => (
              <React.Fragment key={k}>
                {i === 1 && <span>×</span>}
                <input type="number" min="2" max="500" step="0.5" value={floorSize[k]}
                  onChange={(e) => { const v = Number(e.target.value); if (v >= 2 && v <= 500) { setFloorSize((p) => ({ ...p, [k]: v })); touch(); } }}
                  className="w-14 px-1.5 py-1 rounded border border-stone-300 bg-white" />
              </React.Fragment>
            ))}
            <span>m</span>
          </div>
        )}
        {isFloor && (
          <select value="" onChange={(e) => handleCopyFrom(e.target.value)} title="Sao chép layout từ tầng khác"
            className="px-2 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-bold">
            <option value="">Sao chép từ tầng…</option>
            {navMapId && <option value={navMapId}>Tầng Trệt · Sảnh & Tiếp Tân (map robot)</option>}
            {HOTEL_FLOOR_OPTIONS.filter((f) => floorLayoutKey(f.id) !== mapId).map((f) => (
              <option key={f.id} value={floorLayoutKey(f.id)}>{f.name}</option>
            ))}
          </select>
        )}
        {isFloor && hasFloorSketch(floorId) && (
          <button type="button" onClick={handleLoadSketch} title="Dựng sẵn tường, cửa, icon, điểm đến theo ảnh mặt bằng cũ"
            className="px-2.5 py-1.5 rounded-lg border border-sky-300 bg-sky-50 text-sky-800 text-xs font-bold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Phác thảo từ map cũ
          </button>
        )}

        <div className="flex bg-white rounded-lg border border-stone-300 p-0.5">
          <button type="button" onClick={() => { setTool('select'); setDraftWall(null); }}
            className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 ${tool === 'select' ? 'bg-stone-900 text-white' : 'text-stone-600'}`}>
            <MousePointer2 className="w-3.5 h-3.5" /> Chọn
          </button>
          <button type="button" onClick={() => { setTool('wall'); setSelected(null); }}
            className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 ${tool === 'wall' ? 'bg-stone-900 text-white' : 'text-stone-600'}`}>
            <PenLine className="w-3.5 h-3.5" /> Vẽ tường
          </button>
          {!isFloor && (
            <button type="button" onClick={() => { setTool('erase'); setSelected(null); setDraftWall(null); setShowNav2(true); }}
              className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 ${tool === 'erase' ? 'bg-stone-900 text-white' : 'text-stone-600'}`}>
              <Eraser className="w-3.5 h-3.5" /> Tẩy nền
            </button>
          )}
        </div>
        {tool === 'erase' && (
          <div className="flex items-center gap-2 text-xs font-bold text-stone-700">
            <div className="flex bg-white rounded-lg border border-stone-300 p-0.5">
              {[['erase', 'Tẩy'], ['restore', 'Khôi phục']].map(([m, lb]) => (
                <button key={m} type="button" onClick={() => setEraseMode(m)}
                  className={`px-2 py-0.5 rounded-md ${eraseMode === m ? 'bg-stone-200 text-stone-900' : 'text-stone-500'}`}>{lb}</button>
              ))}
            </div>
            <label className="flex items-center gap-1">Cỡ
              <input type="range" min="1" max="8" value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="w-20" />
              <span className="w-8">{Math.round(brush * 2 * (map?.resolution || 0.05) * 100)} cm</span>
            </label>
            {erased.length > 0 && (
              <button type="button" onClick={() => { if (window.confirm('Khôi phục toàn bộ nền đã tẩy?')) { setErased([]); touch(); } }}
                className="px-2 py-1 rounded-lg border border-stone-300 bg-white flex items-center gap-1"><Undo2 className="w-3.5 h-3.5" /> Khôi phục hết</button>
            )}
          </div>
        )}
        {tool === 'wall' && (
          <label className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
            <input type="checkbox" checked={ortho} onChange={(e) => setOrtho(e.target.checked)} /> Khoá góc 90°
          </label>
        )}
        {!isFloor && (
          <button type="button" onClick={() => setShowNav2((v) => !v)}
            className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-bold flex items-center gap-1">
            {showNav2 ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />} Nền map Nav2
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {dirty ? <span className="text-[11px] font-bold text-amber-700">● Chưa lưu</span>
            : savedAt && <span className="text-[11px] text-stone-500">Đã lưu {new Date(savedAt).toLocaleString('vi-VN')}</span>}
          <button type="button" onClick={handleReset}
            className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-bold flex items-center gap-1 text-stone-700">
            <History className="w-3.5 h-3.5" /> Xoá layout
          </button>
          <div className="flex bg-white rounded-lg border border-stone-300">
            <button type="button" title="Hoàn tác (Ctrl+Z)" onClick={undo} disabled={!canUndo}
              className="px-2 py-1.5 disabled:opacity-30"><Undo2 className="w-3.5 h-3.5" /></button>
            <button type="button" title="Làm lại (Ctrl+Y / Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}
              className="px-2 py-1.5 border-l border-stone-300 disabled:opacity-30"><Redo2 className="w-3.5 h-3.5" /></button>
          </div>
          <button type="button" title="Tải lại bản đã lưu (bỏ nháp)" onClick={() => {
            if (!mapId) return;
            if (dirty && !window.confirm('Bỏ các thay đổi chưa lưu?')) return;
            clearDraft(mapId);
            loadLayout(mapId);
          }}
            className="px-2 py-1.5 rounded-lg border border-stone-300 bg-white"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={handleSave} disabled={busy || !mapId}
            className="px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {busy ? 'Đang lưu…' : 'Lưu & áp dụng'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`text-xs font-bold px-3 py-2 rounded-lg ${message.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{message.text}</div>
      )}

      <div className="flex-1 min-h-0 flex gap-3">
        {/* Thư viện ký hiệu */}
        <aside className="w-56 shrink-0 bg-white rounded-xl border border-stone-200 p-2 overflow-y-auto">
          {groups.map((g) => (
            <div key={g} className="mb-2">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500 px-1 py-1">{g}</div>
              <div className="grid grid-cols-3 gap-1">
                {NAV_SYMBOLS.filter((s) => s.group === g).map((s) => {
                  const pw = 20 * Math.min(1.6, s.w / Math.max(s.w, s.h));
                  const ph = 20 * Math.min(1.6, s.h / Math.max(s.w, s.h));
                  return (
                    <button key={s.type} type="button" onClick={() => addSymbol(s)} title={s.name}
                      className="flex flex-col items-center gap-0.5 p-1 rounded-lg border border-stone-200 hover:border-stone-500 hover:bg-stone-50">
                      <svg viewBox={`-2 -2 ${pw + 4} ${ph + 4}`} className="w-8 h-8">
                        {s.type === 'label'
                          ? <text x={pw / 2} y={ph / 2} textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="700">Aa</text>
                          : <NavSymbolShape type={s.type} w={pw} h={ph} u={1.2} />}
                      </svg>
                      <span className="text-[9px] font-bold text-stone-700 text-center leading-tight">{s.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-stone-500 leading-snug px-1 mt-2">
            <b>Vẽ tường:</b> bấm từng điểm, <b>Enter</b> để xong, <b>Backspace</b> bỏ điểm, <b>Esc</b> huỷ.<br />
            <b>Vật thể:</b> kéo để di chuyển, kéo chấm xanh đổi cỡ, <b>R</b> xoay, <b>F</b> lật chữ L, <b>Ctrl+D</b> nhân bản, <b>Delete</b> xoá, <b>Ctrl+Z</b> / <b>Ctrl+Y</b> hoàn tác / làm lại.
            Lưới bắt dính {map ? `${Math.round(map.resolution * 100)} cm` : ''}.
          </p>
        </aside>

        {/* Canvas */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-stone-200 overflow-hidden flex items-center justify-center p-2">
          {!map ? (
            <span className="text-sm text-stone-500">Đang tải map Nav2…</span>
          ) : (
            <svg
              ref={svgRef}
              viewBox={`${-pad} ${-pad} ${map.width + pad * 2} ${map.height + pad * 2}`}
              className={`w-full h-full ${tool === 'wall' ? 'cursor-crosshair' : tool === 'erase' ? 'cursor-none' : ''}`}
              preserveAspectRatio="xMidYMid meet"
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={() => { onUp(); setHover(null); }}
              onDoubleClick={() => tool === 'wall' && finishWall()}
              style={{ touchAction: 'none', userSelect: 'none' }}
            >
              <defs>
                <pattern id="gnav-grid" width={1 / map.resolution} height={1 / map.resolution} patternUnits="userSpaceOnUse">
                  <path d={`M${1 / map.resolution} 0 L0 0 0 ${1 / map.resolution}`} fill="none" stroke="#E7E5E4" strokeWidth={0.15 * ui} />
                </pattern>
              </defs>
              <rect x={-pad} y={-pad} width={map.width + pad * 2} height={map.height + pad * 2} fill={NAV_THEME.floor} onPointerDown={onCanvasDown} />
              {!isFloor && showNav2 && mapImage && (
                <image href={mapImage.url} x={mapImage.bbox.x} y={mapImage.bbox.y} width={mapImage.bbox.w} height={mapImage.bbox.h} opacity="0.7" style={{ pointerEvents: 'none' }} />
              )}
              <rect width={map.width} height={map.height} fill="url(#gnav-grid)" stroke="#A8A29E" strokeWidth={0.2 * ui} strokeDasharray={`${ui} ${ui}`} style={{ pointerEvents: 'none' }} />

              {/* Phòng */}
              <g style={{ pointerEvents: tool === 'select' ? 'auto' : 'none' }}>
                {objects.filter((o) => o.type === 'room').map((o) => (
                  <NavObject key={o.id} obj={o} map={map} selected={selected?.id === o.id} style={{ cursor: 'move' }}
                    onPointerDown={(e) => { setSelected({ kind: 'object', id: o.id }); startDrag(e, 'move', { ...o }); }} />
                ))}
              </g>

              {/* Tường */}
              {walls.map((w) => {
                const pts = w.points.map(([x, y]) => metersToCell(x, y, map));
                const isSel = selected?.id === w.id;
                return (
                  <g key={w.id}>
                    <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none"
                      stroke={isSel ? '#2563EB' : NAV_THEME.wall} strokeWidth={(w.thickness || WALL_DEFAULT_M) / map.resolution}
                      strokeLinecap="square" strokeLinejoin="miter"
                      style={{ cursor: tool === 'select' ? 'pointer' : 'inherit', pointerEvents: tool === 'select' ? 'stroke' : 'none' }}
                      onPointerDown={(e) => { if (tool !== 'select') return; e.stopPropagation(); setSelected({ kind: 'wall', id: w.id }); }} />
                    {isSel && pts.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={1.2 * ui} fill="#2563EB" stroke="#fff" strokeWidth={0.4 * ui} style={{ cursor: 'grab' }}
                        onPointerDown={(e) => startDrag(e, 'wallpt', { wallId: w.id, index: i })} />
                    ))}
                  </g>
                );
              })}

              {/* Vật thể */}
              <g style={{ pointerEvents: tool === 'select' ? 'auto' : 'none' }}>
                {objects.filter((o) => o.type !== 'room').map((o) => (
                  <NavObject key={o.id} obj={o} map={map} selected={selected?.id === o.id} style={{ cursor: 'move' }}
                    onPointerDown={(e) => { setSelected({ kind: 'object', id: o.id }); startDrag(e, 'move', { ...o }); }} />
                ))}
                {selectedObject && (() => {
                  const c = metersToCell(selectedObject.x, selectedObject.y, map);
                  const w = selectedObject.w / map.resolution;
                  const h = selectedObject.h / map.resolution;
                  const rad = (-(selectedObject.rotation || 0) * Math.PI) / 180;
                  const hx = c.x + (w / 2) * Math.cos(rad) - (h / 2) * Math.sin(rad);
                  const hy = c.y + (w / 2) * Math.sin(rad) + (h / 2) * Math.cos(rad);
                  return <circle cx={hx} cy={hy} r={1.3 * ui} fill="#2563EB" stroke="#fff" strokeWidth={0.4 * ui} style={{ cursor: 'nwse-resize' }}
                    onPointerDown={(e) => startDrag(e, 'resize', { ...selectedObject })} />;
                })()}
              </g>

              {/* Xem thử đường: thang máy -> điểm đến */}
              {previewRoute && (
                <g style={{ pointerEvents: 'none' }}>
                  <path d={previewRoute.pathString} fill="none" stroke="#7DD3FC" strokeWidth={0.3 / map.resolution} strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
                  <path d={previewRoute.pathString} fill="none" stroke="#0EA5E9" strokeWidth={0.12 / map.resolution} strokeLinecap="round" strokeLinejoin="round"
                    strokeDasharray={`${0.3 / map.resolution} ${0.2 / map.resolution}`} />
                </g>
              )}

              {/* Tường đang vẽ */}
              {tool === 'wall' && draftWall && (
                <polyline points={[...draftWall, ...(hover ? [hover] : [])].map((p) => p.join(',')).join(' ')}
                  fill="none" stroke="#2563EB" strokeWidth={newWallM / map.resolution} strokeLinecap="square" opacity="0.8" style={{ pointerEvents: 'none' }} />
              )}
              {tool === 'erase' && hover && (
                <circle cx={hover[0]} cy={hover[1]} r={brush} fill={eraseMode === 'erase' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)'}
                  stroke={eraseMode === 'erase' ? '#EF4444' : '#16A34A'} strokeWidth={0.25 * ui} style={{ pointerEvents: 'none' }} />
              )}
              {tool === 'wall' && hover && <circle cx={hover[0]} cy={hover[1]} r={0.8 * ui} fill="#2563EB" style={{ pointerEvents: 'none' }} />}
            </svg>
          )}
        </div>

        {/* Thuộc tính */}
        <aside className="w-56 shrink-0 bg-white rounded-xl border border-stone-200 p-3 overflow-y-auto text-xs">
          {!selected ? (
            <div className="space-y-2 text-stone-600">
              {!hasElevator && map && (
                <div className="text-[11px] font-semibold p-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 flex gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {isFloor
                    ? 'Chưa có icon Thang máy: tầng này chưa dùng được cho màn hình khách (đường đi xuất phát từ thang máy).'
                    : 'Chưa có icon Thang máy: màn hình khách sẽ dùng waypoint "Thang máy" của map (nếu có) làm đích.'}
                </div>
              )}
              <p>Chọn tường hoặc vật thể để chỉnh.</p>
              <p className="text-[11px]">{isFloor ? 'Tầng' : 'Map'} này có {walls.length} tường, {objects.length} vật thể.</p>

              {/* Xem thử đường đi */}
              <div className="pt-1 border-t border-stone-200">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500 py-1.5 flex items-center gap-1">
                  <Route className="w-3.5 h-3.5" /> Xem thử đường đi
                </div>
                {!hasElevator ? (
                  <p className="text-[11px] text-stone-500">Đặt icon Thang máy trước.</p>
                ) : destinationObjs.length === 0 ? (
                  <p className="text-[11px] text-stone-500">Chưa có Điểm đến. Thêm từ nhóm "Khu vực".</p>
                ) : (
                  <div className="space-y-1">
                    {destinationObjs.map((d) => {
                      const r = routeChecks[d.id];
                      const pending = !(d.id in routeChecks);
                      const name = HOTEL_DESTINATIONS[d.destKey]?.name || d.label || 'Chưa chọn mã';
                      return (
                        <button key={d.id} type="button" onClick={() => setPreviewKey(previewKey === d.id ? null : d.id)}
                          className={`w-full text-left px-2 py-1.5 rounded-lg border text-[11px] font-bold flex justify-between gap-1 ${previewKey === d.id ? 'border-sky-500 bg-sky-50' : 'border-stone-200 hover:bg-stone-50'}`}>
                          <span className={`truncate ${d.destKey ? '' : 'text-amber-700'}`}>{name}</span>
                          <span className={`shrink-0 ${pending ? 'text-stone-400' : r ? 'text-emerald-600' : 'text-red-600'}`}>
                            {pending ? '…' : r ? `${r.lengthM.toFixed(1)} m` : 'Không có đường'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {Object.values(routeChecks).some((r) => !r) && (
                  <p className="text-[10px] text-red-700 mt-1.5 leading-snug">Điểm đến đỏ không tới được: thường do phòng thiếu Cửa trên tường, hoặc điểm đến đặt trong tường/nội thất.</p>
                )}
              </div>

              <p className="text-[11px] text-stone-500 leading-snug">
                {isFloor
                  ? 'Đường đi cho khách được tự tính theo tường, cửa và nội thất lớn trên layout này (xuất phát từ icon Thang máy).'
                  : 'Layout lưu theo mét trong hệ toạ độ map Nav2 nên khớp vị trí robot. Đường đi vẫn tính trên map Nav2 thật.'}
              </p>
            </div>
          ) : selected.kind === 'wall' ? (
            (() => {
              const w = walls.find((x) => x.id === selected.id);
              if (!w) return null;
              return (
                <div className="space-y-2.5">
                  <div className="font-extrabold text-stone-900">Tường ({w.points.length} điểm)</div>
                  <label className="block">
                    <span className="text-[10px] font-bold text-stone-500">Độ dày (cm)</span>
                    <input type="number" min="1" max="100" value={Math.round((w.thickness || WALL_DEFAULT_M) * 100)}
                      onChange={(e) => { const v = Number(e.target.value); if (v > 0) { setWalls((prev) => prev.map((x) => (x.id === w.id ? { ...x, thickness: v / 100 } : x))); touch(); } }}
                      className="w-full mt-0.5 px-2 py-1 rounded border border-stone-300" />
                  </label>
                  <p className="text-[10px] text-stone-500">Kéo các chấm xanh để chỉnh điểm.</p>
                  <button type="button" onClick={removeSelected}
                    className="w-full py-1.5 rounded border border-red-300 text-red-600 font-bold flex items-center justify-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Xoá tường</button>
                </div>
              );
            })()
          ) : selectedObject && (
            <div className="space-y-2.5">
              <div className="font-extrabold text-stone-900">{symbolName(selectedObject.type)}</div>
              <label className="block">
                <span className="text-[10px] font-bold text-stone-500">Nhãn</span>
                <input value={selectedObject.label || ''} maxLength={80}
                  onChange={(e) => updateObject(selectedObject.id, { label: e.target.value || null })}
                  className="w-full mt-0.5 px-2 py-1 rounded border border-stone-300" />
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[['x', 'X (m)'], ['y', 'Y (m)'], ['w', 'Rộng (m)'], ['h', 'Dài (m)']].map(([k, lb]) => (
                  <label key={k} className="block">
                    <span className="text-[10px] font-bold text-stone-500">{lb}</span>
                    <input type="number" step="0.05" value={selectedObject[k]}
                      onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && (!['w', 'h'].includes(k) || v > 0)) updateObject(selectedObject.id, { [k]: v }); }}
                      className="w-full mt-0.5 px-2 py-1 rounded border border-stone-300" />
                  </label>
                ))}
              </div>
              <label className="block">
                <span className="text-[10px] font-bold text-stone-500">Góc (°)</span>
                <input type="number" step="15" value={selectedObject.rotation || 0}
                  onChange={(e) => updateObject(selectedObject.id, { rotation: Number(e.target.value) || 0 })}
                  className="w-full mt-0.5 px-2 py-1 rounded border border-stone-300" />
              </label>
              {selectedObject.type === 'destination' && (
                <label className="block">
                  <span className="text-[10px] font-bold text-stone-500">Điểm đến (mã có sẵn)</span>
                  <select value={selectedObject.destKey || ''}
                    onChange={(e) => {
                      const key = e.target.value || null;
                      const d = key ? HOTEL_DESTINATIONS[key] : null;
                      updateObject(selectedObject.id, { destKey: key, label: d ? d.name.replace(/\s*\(.*\)\s*$/, '') : null });
                    }}
                    className={`w-full mt-0.5 px-2 py-1 rounded border ${selectedObject.destKey ? 'border-stone-300' : 'border-amber-400 bg-amber-50'}`}>
                    <option value="">— Chọn —</option>
                    {floorDestinations.map((d) => {
                      const used = objects.some((o) => o.id !== selectedObject.id && o.destKey === d.id);
                      return <option key={d.id} value={d.id} disabled={used}>{d.name}{used ? ' (đã đặt)' : ''}</option>;
                    })}
                  </select>
                  {floorDestinations.length === 0 && <span className="text-[10px] text-stone-500">Tầng này chưa có điểm đến nào trong hệ thống.</span>}
                </label>
              )}
              {selectedObject.type === 'elevator' && (
                <p className="text-[10px] text-sky-800 bg-sky-50 border border-sky-200 rounded p-1.5 leading-snug">
                  Đây là đích chặng 1: robot chỉ đường từ vị trí hiện tại tới tâm icon này.
                </p>
              )}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                <button type="button" title="Xoay 90° (R)" onClick={() => updateObject(selectedObject.id, { rotation: ((selectedObject.rotation || 0) + 270) % 360 })}
                  className="py-1.5 rounded border border-stone-300 flex justify-center"><RotateCw className="w-4 h-4" /></button>
                <button type="button" title="Lật (F)" onClick={() => updateObject(selectedObject.id, { flip: !selectedObject.flip })}
                  className="py-1.5 rounded border border-stone-300 flex justify-center"><FlipHorizontal className="w-4 h-4" /></button>
                <button type="button" title="Nhân bản (Ctrl+D)" onClick={duplicate}
                  className="py-1.5 rounded border border-stone-300 flex justify-center"><Copy className="w-4 h-4" /></button>
                <button type="button" title="Xoá (Delete)" onClick={removeSelected}
                  className="py-1.5 rounded border border-red-300 text-red-600 flex justify-center"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default AdminGuestNavMapTab;
