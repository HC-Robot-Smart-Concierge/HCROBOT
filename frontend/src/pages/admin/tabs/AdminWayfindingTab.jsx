import React, { useEffect, useReducer, useRef, useState } from 'react';
import { PlacePin } from '../../../components/robot/WayfindingPlace';
import { WayfindingEditorCanvas } from './WayfindingEditorCanvas';
import { getPastedElementBounds, positionFloorElement, rotateFloorElement, snapEditorPoint } from './wayfindingCanvasGeometry';
import { fetchWayfinding, publishWayfinding, uploadWayfindingImage } from '../../../services/wayfindingApi';
import { fitFloorElement, FLOOR_ELEMENT_TYPES, MAP_WIDTH, MAP_HEIGHT, PLACE_ICONS, normalizeFloorPolygon, resizeWayfindingFloor, routePath } from '../../../services/wayfindingGeometry';

const field = 'w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm';
const button = 'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600 disabled:opacity-40';
const activeButton = 'aria-pressed:border-sky-600 aria-pressed:bg-sky-50 aria-pressed:text-sky-900';
const disclosure = 'cursor-pointer px-3 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50';
const center = ({ width, height }) => ({ x: width / 2, y: height / 2 });
const newId = (prefix) => `${prefix}_${Array.from(crypto.getRandomValues(new Uint32Array(2)), (value) => value.toString(16).padStart(8, '0')).join('')}`;
const layoutColors = [
  ['Xanh lam nhạt', '#DFE6F1'], ['Xanh lá nhạt', '#D4EAE2'], ['Cát', '#EFE4D4'], ['Tím nhạt', '#E8E0F2'],
  ['Xám xanh', '#56657B'], ['Xanh đậm', '#263955'], ['Lam đá', '#334155'], ['Xanh ngọc đậm', '#0F766E'],
];
const shortcuts = [
  ['Thêm đối tượng', 'R phòng · W tường · L hành lang · N nhãn · A vẽ theo góc'],
  ['Sửa đối tượng', 'Mũi tên di chuyển 1 đơn vị · Shift + mũi tên đi 10 · Delete xóa'],
  ['Xoay', '[ / ] xoay 15° · Shift + [ / ] xoay 90°'],
  ['Nhân bản', 'Ctrl+C / Ctrl+X / Ctrl+V sao chép, cắt, dán · Ctrl+D nhân bản'],
  ['Lịch sử', 'Ctrl+Z hoàn tác · Ctrl+Shift+Z hoặc Ctrl+Y làm lại'],
  ['Thứ tự lớp', 'Page Up đưa lên trước · Page Down đưa ra sau'],
  ['Khung nhìn', '+ / − thu phóng · 0 vừa khung · H hoặc giữ Space để kéo · G bám lưới · P xem trước'],
  ['Kết thúc', 'Enter khép hình hoặc kết thúc vẽ tuyến · Esc hủy vẽ hoặc bỏ chọn · ? xem phím tắt'],
];
const arrowOffsets = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function editHistory(history, action) {
  const { present, past, future } = history;
  switch (action.type) {
    case 'reset':
      return { base: action.snapshot, present: action.snapshot, past: [], future: [] };
    case 'change': {
      const next = action.update(present);
      return next === present ? history : { ...history, present: next, past: [...past.slice(-39), present], future: [] };
    }
    case 'undo':
      return past.length ? { ...history, present: past.at(-1), past: past.slice(0, -1), future: [present, ...future] } : history;
    case 'redo':
      return future.length ? { ...history, present: future[0], past: [...past, present], future: future.slice(1) } : history;
    default:
      return history;
  }
}

function ImageField({ label, value, onUpload, onClear }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-semibold">
        {label}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-xs mt-1" onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onUpload(file);
        }} />
      </label>
      {value && onClear && (
        <div className="flex items-center gap-2">
          <img src={value} alt={label} className="h-12 w-16 rounded border object-contain" />
          <button type="button" className={button} onClick={onClear}>Bỏ ảnh</button>
        </div>
      )}
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }) {
  return (
    <label className="block text-sm">{label}
      <input key={value} className={field} type="number" min={min} max={max} defaultValue={Number(value.toFixed(2))}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
        onBlur={(event) => {
          const input = event.currentTarget;
          const next = Math.round(input.valueAsNumber);
          if (Number.isFinite(next) && next !== value && next >= min && next <= max) onChange(next);
          input.value = Number(value.toFixed(2));
        }} />
    </label>
  );
}

export function AdminWayfindingTab() {
  const [history, dispatch] = useReducer(editHistory, { base: null, present: null, past: [], future: [] });
  const snapshot = history.present;
  const dirty = snapshot !== history.base;
  const [floorId, setFloorId] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [mode, setMode] = useState('layout');
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [elementId, setElementId] = useState('');
  const clipboardRef = useRef(null);
  const canvasRef = useRef(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [areaPoints, setAreaPoints] = useState([]);
  const [areaKind, setAreaKind] = useState('room');
  const [areaError, setAreaError] = useState('');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async (signal) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await fetchWayfinding(signal);
      if (signal?.aborted) return;
      dispatch({ type: 'reset', snapshot: data });
      setFloorId(data.lobbyFloorId);
      setPlaceId('');
      setMode('layout');
      setSelectedPoint(null);
      setElementId('');
      setAreaPoints([]);
      setAreaError('');
      setPreview(false);
    } catch (err) {
      if (!signal?.aborted) setError(err.message);
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, []);

  const change = (update) => {
    dispatch({ type: 'change', update });
    setMessage('');
  };

  if (!snapshot) {
    return <section className="p-6"><h1 className="text-xl font-bold">Bản đồ chỉ đường</h1>
      {error ? <p role="alert" className="my-3 text-red-700">{error}</p> : <p className="my-3">Đang tải bản đồ…</p>}
      {error && <button type="button" className={button} disabled={busy} onClick={() => load()}>Thử lại</button>}
    </section>;
  }

  const floorIndex = snapshot.floors.findIndex((floor) => floor.id === floorId);
  const floor = snapshot.floors[floorIndex];
  const places = snapshot.destinations.filter((place) => place.floorId === floorId);
  const place = places.find((item) => item.id === placeId);
  const elementIndex = floor.elements.findIndex((item) => item.id === elementId);
  const element = floor.elements[elementIndex];
  const isLobby = floorId === snapshot.lobbyFloorId;
  const editingLobby = mode === 'lobbyRoute';
  const drawingArea = mode === 'polygon';
  const floorPanel = ['floor', 'entry', 'start', 'lobbyRoute'].includes(mode);
  const editingObjects = mode === 'layout' || mode === 'places';
  const drawing = mode === 'route' || editingLobby;
  const pointMode = drawing || mode === 'entry' || mode === 'start' ? mode : !floorPanel && !drawingArea ? 'places' : null;
  const returnMode = floorPanel ? 'floor' : place && !drawingArea ? 'places' : 'layout';
  const points = editingLobby ? snapshot.lobbyRoute : mode === 'route' && place ? place.points ?? [] : place?.points;
  const start = isLobby ? snapshot.lobbyStart : floor.entry;
  const end = editingLobby ? floor.entry : place?.coords;

  const updateFloor = (patch) => change((data) => ({
    ...data, floors: data.floors.map((item) => item.id === floor.id ? { ...item, ...patch } : item),
  }));
  const updateElement = (patch, id = elementId) => change((data) => ({
    ...data, floors: data.floors.map((item) => item.id === floor.id ? {
      ...item, elements: item.elements.map((element) => element.id === id ? { ...element, ...patch } : element),
    } : item),
  }));
  const updatePlace = (patch, id = place?.id) => change((data) => ({
    ...data, destinations: data.destinations.map((item) => item.id === id ? { ...item, ...patch } : item),
  }));
  const updatePoints = (next) => {
    const resolve = (previous) => typeof next === 'function' ? next(previous) : next;
    change((data) => editingLobby ? { ...data, lobbyRoute: resolve(data.lobbyRoute) } : {
      ...data, destinations: data.destinations.map((item) => item.id === place?.id ? {
        ...item, points: resolve(item.points || []),
      } : item),
    });
  };

  const selectFloor = (id, nextPanel = 'layout') => {
    setFloorId(id);
    setPlaceId('');
    setMode(nextPanel);
    setSelectedPoint(null);
    setElementId('');
    setAreaPoints([]);
    setAreaError('');
  };
  const selectElement = (id) => {
    setElementId(id);
    setPlaceId('');
    setMode('layout');
    setSelectedPoint(null);
  };
  const selectPlace = (id) => {
    setPlaceId(id);
    setElementId('');
    setMode(id ? 'places' : 'layout');
    setSelectedPoint(null);
  };

  const openMode = (nextMode) => {
    setMode(nextMode);
    setSelectedPoint(null);
    setAreaPoints([]);
    setAreaError('');
  };

  const restore = (action) => {
    const next = action === 'undo' ? history.past.at(-1) : history.future[0];
    if (busy || !next) return;
    const nextFloor = next.floors.find((item) => item.id === floorId);
    if (!nextFloor) {
      selectFloor(next.lobbyFloorId);
    } else {
      if (!nextFloor.elements.some((item) => item.id === elementId)) setElementId('');
      if (placeId && !next.destinations.some((item) => item.id === placeId && item.floorId === floorId)) {
        setPlaceId('');
        if (!floorPanel && !drawingArea) setMode('layout');
      }
    }
    setSelectedPoint(null);
    setMessage('');
    dispatch({ type: action });
  };

  const upload = async (file, apply) => {
    setBusy(true);
    setError('');
    try {
      const { url } = await uploadWayfindingImage(file);
      apply(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addFloor = () => {
    const id = newId('floor');
    const name = `Tầng mới ${snapshot.floors.length + 1}`;
    const size = { width: MAP_WIDTH, height: MAP_HEIGHT };
    change((data) => ({ ...data, floors: [...data.floors, {
      id, name, level: name, ...size, background: '#F4F6FA', elements: [], entry: center(size),
    }] }));
    selectFloor(id);
  };
  const addElement = (kind) => {
    if (floor.elements.length >= 250) return;
    const [label, color, defaultWidth, defaultHeight] = FLOOR_ELEMENT_TYPES[kind];
    const id = newId('object');
    const width = Math.min(defaultWidth, Math.floor(floor.width / 3));
    const height = Math.min(defaultHeight, Math.floor(floor.height / 3));
    updateFloor({ elements: [...floor.elements, {
      id, kind, color, width, height, x: Math.floor((floor.width - width) / 2), y: Math.floor((floor.height - height) / 2),
      text: kind === 'room' || kind === 'label' ? label : '',
    }] });
    selectElement(id);
  };

  const removeElement = () => {
    updateFloor({ elements: floor.elements.filter((item) => item.id !== elementId) });
    setElementId('');
  };

  const pasteElement = (source, positions) => {
    if (floor.elements.length >= 250) {
      setMessage('Tầng này đã đủ 250 đối tượng.');
      return;
    }
    const bounds = getPastedElementBounds(source, floor, positions?.get(floorId));
    const id = newId('object');
    updateFloor({ elements: [...floor.elements, { ...source, ...bounds, id }] });
    positions?.set(floorId, bounds);
    selectElement(id);
  };

  const setElementRotation = (degrees) => {
    const patch = rotateFloorElement(floor, element, degrees);
    if (!patch) {
      setMessage('Góc này vượt kích thước tầng. Hãy thu nhỏ đối tượng trước khi xoay.');
      return;
    }
    updateElement(patch);
  };

  const editElementBounds = (patch) => {
    const bounds = fitFloorElement({ ...element, ...patch }, floor);
    if (bounds) updateElement({ ...patch, ...bounds });
    else setMessage('Kích thước này vượt giới hạn của tầng.');
  };

  const handleEditorShortcut = (event) => {
    if (event.defaultPrevented || busy || event.altKey || event.target.closest('input, textarea, [contenteditable]')) return;
    const key = event.key.toLowerCase();
    const editingLayout = !preview && editingObjects;
    if (event.ctrlKey || event.metaKey) {
      if (key === 'z' || key === 'y') {
        event.preventDefault();
        restore(key === 'y' || event.shiftKey ? 'redo' : 'undo');
      } else if (editingLayout && !event.shiftKey) {
        if ((key === 'c' || key === 'x') && element && !window.getSelection()?.toString()) {
          event.preventDefault();
          if (event.repeat) return;
          clipboardRef.current = { element, positions: new Map() };
          if (key === 'x') removeElement();
          setMessage(key === 'x' ? 'Đã cắt đối tượng. Bấm Ctrl+V để dán.' : 'Đã sao chép đối tượng. Bấm Ctrl+V để dán.');
        } else if (key === 'v' && clipboardRef.current) {
          event.preventDefault();
          if (!event.repeat) pasteElement(clipboardRef.current.element, clipboardRef.current.positions);
        } else if (key === 'd' && element) {
          event.preventDefault();
          if (!event.repeat) pasteElement(element);
        }
      }
      return;
    }
    if (event.target.closest('select') && key !== 'delete' && key !== 'backspace') return;
    const canvas = canvasRef.current;
    let action;
    if (key === '+' || key === '=') action = canvas?.zoomIn;
    else if (key === '-') action = canvas?.zoomOut;
    else if (key === '0') action = canvas?.fit;
    else if (key === 'h') action = canvas?.toggleHand;
    else if (key === 'g' && (!floorPanel || pointMode) && !preview) action = canvas?.toggleGrid;
    else if (key === ' ' && canvas && !event.target.closest('button, summary')) action = () => canvas.holdHand(true);
    else if (key === '?') action = () => setShortcutsOpen((current) => !current);
    else if (key === 'p' && !drawingArea) action = () => {
      if (!preview) canvas?.fit();
      setPreview(!preview);
    };
    else if (key === 'escape') action = () => {
      if (preview) setPreview(false);
      else if (drawingArea || drawing || ['pin', 'entry', 'start'].includes(mode)) openMode(returnMode);
      else if (editingLayout) selectElement('');
    };
    else if (key === 'enter' && drawingArea && areaPoints.length >= 3) action = closeArea;
    else if (key === 'enter' && drawing) action = () => openMode(returnMode);
    else if (editingLayout) {
      const shape = { r: 'room', w: 'wall', l: 'corridor', n: 'label' }[key];
      if (shape) action = () => addElement(shape);
      else if (key === 'a' && floor.elements.length < 250) action = () => openMode('polygon');
      else if (element && (key === 'delete' || key === 'backspace')) action = removeElement;
      else if (element && arrowOffsets[event.key]) {
        const [x, y] = arrowOffsets[event.key];
        const distance = event.shiftKey ? 10 : 1;
        action = () => {
          const { bounds } = positionFloorElement(floor, element, { x: x * distance, y: y * distance }, null, false, 0);
          if (bounds.x !== element.x || bounds.y !== element.y) updateElement(bounds);
        };
      } else if (element && (event.code === 'BracketLeft' || event.code === 'BracketRight')) {
        const degrees = event.shiftKey ? 90 : 15;
        action = () => setElementRotation((element.rotation || 0) + (event.code === 'BracketLeft' ? -degrees : degrees));
      } else if (element && key === 'pageup' && elementIndex < floor.elements.length - 1) action = () => moveElementLayer(1);
      else if (element && key === 'pagedown' && elementIndex > 0) action = () => moveElementLayer(-1);
    }
    if (!action) return;
    event.preventDefault();
    if (!event.repeat || arrowOffsets[event.key]) action();
  };

  const closeArea = () => {
    if (busy || !drawingArea || floor.elements.length >= 250) return;
    const bounds = normalizeFloorPolygon(areaPoints);
    if (!bounds) {
      setAreaError('Hãy tạo ít nhất ba góc và kiểm tra để các cạnh không cắt hoặc đè lên nhau.');
      return;
    }
    const id = newId('object');
    updateFloor({ elements: [...floor.elements, {
      ...bounds, id, kind: areaKind, color: FLOOR_ELEMENT_TYPES[areaKind][1], text: '',
    }] });
    openMode('layout');
    selectElement(id);
  };
  const moveElementLayer = (offset) => {
    const elements = [...floor.elements];
    elements.splice(elementIndex, 1);
    elements.splice(elementIndex + offset, 0, element);
    updateFloor({ elements });
  };
  const moveFloor = (offset) => {
    const floors = [...snapshot.floors];
    floors.splice(floorIndex, 1);
    floors.splice(floorIndex + offset, 0, floor);
    change((data) => ({ ...data, floors }));
  };
  const addPlace = () => {
    const id = newId('place');
    change((data) => ({ ...data, destinations: [...data.destinations, {
      id, name: 'Địa điểm mới', floorId, coords: center(floor), icon: 'pin', enabled: false, points: null,
    }] }));
    selectPlace(id);
    openMode('pin');
  };

  const clickMap = (event, grid = 0) => {
    const svg = event.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix || busy) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const { x, y } = point.matrixTransform(matrix.inverse());
    if (x < 0 || x > floor.width || y < 0 || y > floor.height) return;
    const coords = snapEditorPoint({ x, y }, floor, grid);
    if (drawingArea) {
      const point = coords;
      const previous = areaPoints.findIndex((item) => item.x === point.x && item.y === point.y);
      if (previous === 0 && areaPoints.length >= 3) closeArea();
      else if (previous !== -1) setAreaError('Góc này đã có trên đường viền. Chọn một vị trí khác.');
      else if (areaPoints.length >= 64) setAreaError('Đã đủ 64 góc. Hãy khép hình hoặc bỏ một góc.');
      else {
        setAreaPoints([...areaPoints, point]);
        setAreaError('');
      }
      return;
    }
    if (mode === 'entry') {
      updateFloor({ entry: coords });
      openMode('floor');
    }
    if (mode === 'start') {
      change((data) => ({ ...data, lobbyStart: coords }));
      openMode('floor');
    }
    if (mode === 'pin' && place) {
      updatePlace({ coords });
      openMode('places');
    }
    if (drawing && points) {
      if (selectedPoint !== null) {
        updatePoints(points.map((point, index) => index === selectedPoint ? coords : point));
        setSelectedPoint(null);
      } else if (points.length < 200) {
        updatePoints([...points, coords]);
      }
    }
  };

  const mapHint = {
    layout: element ? (element.vertices ? 'Kéo khu vực để di chuyển hoặc kéo từng góc để chỉnh đường viền.' : 'Kéo đối tượng để di chuyển. Kéo góc để đổi kích thước.') : 'Chọn một hình hoặc ghim để chỉnh trực tiếp trên sơ đồ.',
    polygon: 'Bấm từng góc theo thứ tự quanh khu vực. Bấm góc đầu hoặc chọn Khép hình để hoàn tất.',
    places: place ? 'Kéo ghim để đổi vị trí. Chọn Vẽ đường đi để chỉnh tuyến.' : 'Bấm hoặc kéo ghim trên sơ đồ để chỉnh địa điểm.',
    pin: 'Bấm vào vị trí bạn muốn đặt ghim trên sơ đồ.',
    route: 'Bấm để thêm điểm dọc đường. Kéo điểm để chỉnh tuyến.',
    floor: 'Chỉnh thông tin tầng hoặc chọn một mốc để đặt lại trên sơ đồ.',
    entry: 'Bấm vào vị trí cửa thang máy trên sơ đồ.',
    start: 'Bấm vào điểm khách bắt đầu đi từ sảnh.',
    lobbyRoute: 'Bấm để thêm điểm từ sảnh đến thang máy. Kéo điểm để chỉnh tuyến.',
  }[mode];

  const publish = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      dispatch({ type: 'reset', snapshot: await publishWayfinding(snapshot) });
      setMessage('Đã công bố bản đồ chỉ đường.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-[1500px] p-4 md:p-6" onKeyDown={handleEditorShortcut}
      onKeyUp={(event) => { if (event.code === 'Space') canvasRef.current?.holdHand(false); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) canvasRef.current?.holdHand(false); }}>
      <header className="flex flex-wrap items-center gap-3 justify-between mb-4">
        <div><h1 className="text-xl font-bold">Bản đồ chỉ đường</h1>
          <p className={`mt-1 text-sm ${dirty ? 'font-semibold text-amber-800' : 'text-stone-600'}`}>{dirty ? 'Có thay đổi chưa công bố' : `Phiên bản ${snapshot.revision}`}</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={busy || !history.past.length} onClick={() => restore('undo')}>Hoàn tác</button>
          <button type="button" className={button} disabled={busy || !history.future.length} onClick={() => restore('redo')}>Làm lại</button>
          <button type="button" className={button} disabled={busy} onClick={() => {
            if (!dirty || window.confirm('Tải lại sẽ bỏ các thay đổi chưa công bố. Tiếp tục?')) load();
          }}>Tải lại</button>
          <button type="button" className={`${button} !border-sky-800 !bg-sky-800 !text-white hover:!bg-sky-900`} disabled={busy || !dirty} onClick={publish}>Công bố cho khách</button>
        </div>
      </header>
      {message && <p role="status" className="mb-3 text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mb-3 text-red-800 whitespace-pre-line">{error}</p>}
      <details className="mb-4 rounded-lg border border-stone-300 bg-white" open={shortcutsOpen}
        onToggle={(event) => setShortcutsOpen(event.currentTarget.open)}>
        <summary className={disclosure}>Phím tắt <kbd className="ml-1 rounded border border-stone-300 px-1">?</kbd></summary>
        <dl className="grid gap-3 px-3 pb-3 text-sm sm:grid-cols-2">
          {shortcuts.map(([label, keys]) => (
            <div key={label}><dt className="font-semibold">{label}</dt><dd className="text-stone-600">{keys}</dd></div>
          ))}
        </dl>
        <p className="px-3 pb-3 text-xs text-stone-600">Trên Mac, dùng ⌘ thay cho Ctrl.</p>
      </details>
      <fieldset disabled={busy} className="min-w-0">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-stone-300 bg-white p-3">
          <label className="block w-full text-sm font-semibold sm:w-64">Tầng đang chỉnh
            <select className={`${field} mt-1`} value={floorId} onChange={(event) => selectFloor(event.target.value, floorPanel ? 'floor' : 'layout')}>
              {snapshot.floors.map((item) => <option key={item.id} value={item.id}>{item.name}{item.id === snapshot.lobbyFloorId ? ' · Sảnh' : ''}</option>)}
            </select>
          </label>
          <nav className="flex flex-wrap gap-1 rounded-lg bg-stone-100 p-1" aria-label="Nội dung chỉnh sửa">
            {[
              ['layout', 'Chỉnh bản đồ'], ['floor', 'Cài đặt tầng'],
            ].map(([id, label]) => (
              <button type="button" key={id} aria-pressed={floorPanel === (id === 'floor')} className={`${button} ${activeButton}`} onClick={() => {
                setPreview(false);
                openMode(id === 'layout' && place ? 'places' : id);
              }}>{label}</button>
            ))}
          </nav>
        </div>
        <div className={`grid gap-4 ${preview ? '' : 'lg:grid-cols-[minmax(0,1fr)_19rem]'}`}>
          <div className="self-start space-y-3 rounded-xl border border-stone-300 bg-stone-50 p-3">
            {!preview && editingObjects && (
              <div className="flex flex-wrap gap-1.5" aria-label="Thêm vào bản đồ">
                {Object.entries(FLOOR_ELEMENT_TYPES).map(([kind, [label]]) => (
                  <button type="button" key={kind} className={button} disabled={floor.elements.length >= 250} onClick={() => addElement(kind)}>+ {label}</button>
                ))}
                <button type="button" className={button} disabled={floor.elements.length >= 250} onClick={() => openMode('polygon')}>Vẽ theo góc</button>
                <button type="button" className={button} onClick={addPlace}>+ Địa điểm</button>
              </div>
            )}
            <div className="flex items-start justify-between gap-3">
              <p className="my-1 text-sm text-slate-700" role="status">{preview ? 'Đang xem trước bản đồ dành cho khách.' : mapHint}</p>
              {!preview && drawing && <button type="button" className={`${button} shrink-0`} onClick={() => openMode(returnMode)}>Xong</button>}
            </div>
            <WayfindingEditorCanvas ref={canvasRef} key={floor.id} floor={floor} layout={editingObjects || drawingArea}
              pointMode={pointMode} selected={element} onSelect={selectElement}
              onCommit={(id, patch) => updateElement(patch, id)} preview={preview} previewStartX={start.x} onPreviewChange={setPreview}
              onMapClick={drawing || drawingArea || ['pin', 'entry', 'start'].includes(mode) ? clickMap : undefined}
              areaPoints={drawingArea ? areaPoints : null} onCloseArea={closeArea} disabled={busy}>
              {(rotation, movedPoint, beginPointDrag, scale) => {
                const visiblePoints = movedPoint ? points?.map((point, index) => movedPoint.id === `route:${index}` ? movedPoint.coords : point) : points;
                const visibleEnd = !editingLobby && place && movedPoint?.id === `place:${place.id}` ? movedPoint.coords : end;
                const showRoute = visiblePoints && visibleEnd && (preview ? (editingLobby || place?.enabled) : drawing || (!floorPanel && !drawingArea));
                return <>
                  {showRoute && <>
                    <path d={routePath(start, visiblePoints, visibleEnd)} fill="none" stroke="#0284c7" strokeWidth="12" strokeLinejoin="round" pointerEvents="none" />
                    {!preview && editingObjects && place && <path d={routePath(start, visiblePoints, visibleEnd)}
                      fill="none" stroke="transparent" strokeWidth="8" vectorEffect="non-scaling-stroke" pointerEvents="stroke"
                      className="cursor-pointer" role="button" tabIndex={0} aria-label="Chỉnh đường đi"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => { event.stopPropagation(); openMode('route'); }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openMode('route');
                        }
                      }} />}
                  </>}
                  {(showRoute || (!preview && floorPanel)) && (
                    <circle cx={start.x} cy={start.y} r="15" fill="#047857" stroke="white" strokeWidth="4" pointerEvents="none" />
                  )}
                  {!preview && floorPanel && (
                    <circle cx={floor.entry.x} cy={floor.entry.y} r="13" fill="#a16207" stroke="white" strokeWidth="4" />
                  )}
                  {(preview || (!floorPanel && !drawingArea)) && places.map((item) => {
                    const id = `place:${item.id}`;
                      return <PlacePin key={item.id} place={movedPoint?.id === id ? { ...item, coords: movedPoint.coords } : item} rotation={-rotation}
                        selected={!preview && placeId === item.id}
                      onSelect={() => { if (!busy && (item.id !== placeId || !drawing)) selectPlace(item.id); }}
                      onDragStart={!preview && (!drawing || placeId === item.id) ? (event) => {
                        if (busy || event.button !== 0) return;
                        if (!drawing) selectPlace(item.id);
                        beginPointDrag(event, { id, coords: item.coords, onCommit: (coords) => updatePlace({ coords }, item.id) });
                      } : undefined} />;
                  })}
                  {!preview && drawing && visiblePoints?.map((point, index) => (
                    <g key={index} role="button" tabIndex={0} aria-label={`Điểm tuyến ${index + 1}`} className="cursor-move" onPointerDown={(event) => {
                      if (busy || event.button !== 0) return;
                      setSelectedPoint(index);
                      beginPointDrag(event, { id: `route:${index}`, coords: point, onCommit: (coords) => {
                        updatePoints((items) => items.map((item, i) => i === index ? coords : item));
                        setSelectedPoint(null);
                      } });
                    }} onClick={(event) => {
                      event.stopPropagation();
                      setSelectedPoint(index);
                    }} onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedPoint(index);
                      }
                    }}>
                      <circle cx={point.x} cy={point.y} r={Math.max(24, 12 / scale)} fill="transparent" />
                      <circle cx={point.x} cy={point.y} r="17" fill={selectedPoint === index ? '#a16207' : '#0369a1'} stroke="white" strokeWidth="4" />
                      <text x={point.x} y={point.y} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="20">{index + 1}</text>
                    </g>
                  ))}
                </>;
              }}
            </WayfindingEditorCanvas>
            {!preview && drawing && points && (
              <div className="flex flex-wrap gap-2 items-center">
                {mode === 'route' && place?.points === null && (
                  <button type="button" className={button} onClick={() => { updatePoints([]); openMode('places'); }}>Dùng đường thẳng</button>
                )}
                <button type="button" className={button} disabled={!points.length} onClick={() => {
                  const target = selectedPoint ?? points.length - 1;
                  updatePoints(points.filter((_, index) => index !== target));
                  setSelectedPoint(null);
                }}>{selectedPoint === null ? 'Bỏ điểm cuối' : `Bỏ điểm ${selectedPoint + 1}`}</button>
              </div>
            )}
          </div>
          {!preview && <div className="space-y-4">
            {floorPanel && <div className="rounded-xl border border-stone-300 bg-white p-3 space-y-3">
              <h2 className="text-base font-semibold">Cài đặt tầng</h2>
              <label className="block text-sm">Tên tầng<input className={field} value={floor.name} onChange={(event) => updateFloor({ name: event.target.value })} /></label>
              <label className="block text-sm">Nhãn ngắn<input className={field} value={floor.level} onChange={(event) => updateFloor({ level: event.target.value })} /></label>
              <button type="button" className={button} onClick={addFloor}>Thêm tầng</button>
              <details className="rounded-lg border border-stone-200">
                <summary className={disclosure}>Kích thước, màu nền và thứ tự</summary>
                <div className="space-y-3 px-3 pb-3">
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className={button} disabled={floorIndex === 0} onClick={() => moveFloor(-1)}>Đưa tầng lên</button>
                    <button type="button" className={button} disabled={floorIndex === snapshot.floors.length - 1} onClick={() => moveFloor(1)}>Đưa tầng xuống</button>
                    <button type="button" className={`${button} text-red-700`} disabled={isLobby || places.length > 0} onClick={() => {
                      change((data) => ({ ...data, floors: data.floors.filter((item) => item.id !== floorId) }));
                      selectFloor(snapshot.lobbyFloorId, 'floor');
                    }}>Xóa tầng trống</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField label="Rộng sơ đồ" value={floor.width} min={320} max={6000} onChange={(width) => {
                      if (width !== floor.width) change((data) => resizeWayfindingFloor(data, floor.id, width, floor.height));
                    }} />
                    <NumberField label="Cao sơ đồ" value={floor.height} min={320} max={6000} onChange={(height) => {
                      if (height !== floor.height) change((data) => resizeWayfindingFloor(data, floor.id, floor.width, height));
                    }} />
                  </div>
                  <p className="text-xs text-stone-600">Đổi kích thước sẽ co giãn cả bố cục, ghim và tuyến trên tầng.</p>
                  <label className="flex items-center gap-2 text-sm">Màu nền<input type="color" value={floor.background} onChange={(event) => updateFloor({ background: event.target.value })} /></label>
                </div>
              </details>
              <div className="space-y-2 border-t border-stone-200 pt-3">
                <h3 className="text-sm font-semibold">Các mốc chỉ đường</h3>
                <button type="button" aria-pressed={mode === 'entry'} className={`${button} ${activeButton}`} onClick={() => openMode('entry')}>Đặt cửa thang máy</button>
                {isLobby && <div className="flex flex-wrap gap-2">
                  <button type="button" aria-pressed={mode === 'start'} className={`${button} ${activeButton}`} onClick={() => openMode('start')}>Đặt điểm xuất phát</button>
                  <button type="button" aria-pressed={editingLobby} className={`${button} ${activeButton}`} onClick={() => openMode('lobbyRoute')}>Vẽ đường đến thang máy</button>
                </div>}
              </div>
            </div>}
            {drawingArea && <div className="rounded-xl border border-stone-300 bg-white p-3 space-y-3">
              <h2 className="text-base font-semibold">Vẽ khu vực theo góc</h2>
              <label className="block text-sm">Loại khu vực
                <select className={field} value={areaKind} onChange={(event) => setAreaKind(event.target.value)}>
                  <option value="room">Phòng / khu vực</option>
                  <option value="corridor">Hành lang</option>
                </select>
              </label>
              <p className="text-sm text-stone-600">Đã đặt {areaPoints.length} góc.</p>
              {areaError && <p role="alert" className="text-sm text-red-700">{areaError}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`${button} !border-sky-800 !bg-sky-800 !text-white`} disabled={areaPoints.length < 3} onClick={closeArea}>Khép hình</button>
                <button type="button" className={button} disabled={!areaPoints.length} onClick={() => {
                  setAreaPoints(areaPoints.slice(0, -1));
                  setAreaError('');
                }}>Bỏ góc cuối</button>
                <button type="button" className={button} onClick={() => openMode('layout')}>Hủy</button>
              </div>
            </div>}
            {!floorPanel && !drawingArea && <div className="rounded-xl border border-stone-300 bg-white p-3 space-y-3">
              <h2 className="text-base font-semibold">Thuộc tính</h2>
              <div className="flex flex-wrap items-end gap-2">
                <label className="block min-w-[9rem] flex-1 text-sm">Đối tượng trên tầng
                  <select className={field} value={element ? `shape:${element.id}` : place ? `place:${place.id}` : ''}
                    onChange={(event) => {
                      const [kind, id] = event.target.value.split(':');
                      if (kind === 'place') selectPlace(id);
                      else selectElement(id || '');
                    }}>
                    <option value="">Chọn hình hoặc địa điểm</option>
                    {floor.elements.length > 0 && <optgroup label="Hình và nhãn">
                      {floor.elements.map((item, index) => <option key={item.id} value={`shape:${item.id}`}>{item.text || `${FLOOR_ELEMENT_TYPES[item.kind][0]} ${index + 1}`}</option>)}
                    </optgroup>}
                    {places.length > 0 && <optgroup label="Địa điểm">
                      {places.map((item) => <option key={item.id} value={`place:${item.id}`}>{item.name}</option>)}
                    </optgroup>}
                  </select>
                </label>
                {element && <button type="button" className={`${button} shrink-0 !border-red-200 text-red-700 hover:!bg-red-50`} onClick={removeElement}>Xóa đối tượng</button>}
              </div>
              {element && <>
                <div className="flex flex-wrap items-end gap-2">
                  <button type="button" className={button} aria-label="Xoay trái 15 độ" onClick={() => setElementRotation((element.rotation || 0) - 15)}>↶ 15°</button>
                  <button type="button" className={button} aria-label="Xoay phải 15 độ" onClick={() => setElementRotation((element.rotation || 0) + 15)}>↷ 15°</button>
                  <div className="w-20"><NumberField label="Góc (°)" value={element.rotation || 0} min={0} max={359} onChange={setElementRotation} /></div>
                </div>
                {element.vertices ? <p className="text-xs text-stone-600">Dùng + Nhãn để đặt tên vào phần rộng của khu vực.</p> : (
                  <label className="block text-sm">Chữ hiển thị<input className={field} maxLength={100} value={element.text || ''} onChange={(event) => updateElement({ text: event.target.value })} /></label>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {(element.kind === 'wall' || element.kind === 'label' ? layoutColors.slice(4) : layoutColors.slice(0, 4)).map(([label, color]) => (
                    <button key={color} type="button" title={label} aria-label={label} aria-pressed={color.toLowerCase() === element.color.toLowerCase()}
                      className="size-6 rounded-full border border-slate-300 aria-pressed:ring-2 aria-pressed:ring-sky-600 aria-pressed:ring-offset-1"
                      style={{ backgroundColor: color }} onClick={() => updateElement({ color })} />
                  ))}
                  <label className="flex items-center gap-2 text-xs">Màu riêng<input type="color" value={element.color} onChange={(event) => updateElement({ color: event.target.value })} /></label>
                </div>
                <details className="rounded-lg border border-stone-200">
                  <summary className={disclosure}>Vị trí và kích thước chính xác</summary>
                  <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                    <NumberField label="Vị trí X" value={element.x} min={0} max={floor.width - element.width} onChange={(x) => editElementBounds({ x })} />
                    <NumberField label="Vị trí Y" value={element.y} min={0} max={floor.height - element.height} onChange={(y) => editElementBounds({ y })} />
                    <NumberField label="Chiều rộng" value={element.width} min={1} max={floor.width - element.x} onChange={(width) => editElementBounds({ width })} />
                    <NumberField label="Chiều cao" value={element.height} min={1} max={floor.height - element.y} onChange={(height) => editElementBounds({ height })} />
                  </div>
                  <div className="flex flex-wrap gap-1 px-3 pb-3">
                    <button type="button" className={button} disabled={elementIndex === floor.elements.length - 1} onClick={() => moveElementLayer(1)}>Đưa lên trước</button>
                    <button type="button" className={button} disabled={elementIndex === 0} onClick={() => moveElementLayer(-1)}>Đưa ra sau</button>
                  </div>
                </details>
              </>}
              {place && <>
                <label className="block text-sm">Tên địa điểm<input className={field} value={place.name} onChange={(event) => updatePlace({ name: event.target.value })} /></label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" aria-pressed={mode === 'pin'} className={`${button} ${activeButton}`} onClick={() => openMode('pin')}>Đặt ghim</button>
                  <button type="button" aria-pressed={mode === 'route'} className={`${button} ${activeButton}`} onClick={() => openMode('route')}>Vẽ đường đi</button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Kích thước icon</span>
                  <div className="flex items-center gap-2">
                    <button type="button" className={button} aria-label="Thu nhỏ icon" disabled={(place.iconScale ?? 1) <= 0.5}
                      onClick={() => updatePlace({ iconScale: Math.max(0.5, (place.iconScale ?? 1) - 0.25) })}>−</button>
                    <output aria-label="Kích thước icon" className="min-w-[3rem] text-center text-xs font-semibold tabular-nums">{Math.round((place.iconScale ?? 1) * 100)}%</output>
                    <button type="button" className={button} aria-label="Phóng to icon" disabled={(place.iconScale ?? 1) >= 2}
                      onClick={() => updatePlace({ iconScale: Math.min(2, (place.iconScale ?? 1) + 0.25) })}>+</button>
                  </div>
                </div>
                <label className="flex gap-2 text-sm items-center"><input type="checkbox" checked={place.enabled} disabled={place.points === null} onChange={(event) => updatePlace({ enabled: event.target.checked })} /> Cho khách xem chỉ đường</label>
                {place.points === null && <p className="text-xs text-stone-600">Vẽ đường đi trước khi bật chỉ đường.</p>}
                <ImageField label="Ảnh địa điểm" value={place.photo} onUpload={(file) => upload(file, (photo) => updatePlace({ photo }))} onClear={() => updatePlace({ photo: null })} />
                <details className="rounded-lg border border-stone-200">
                  <summary className={disclosure}>Biểu tượng và thông tin khác</summary>
                  <div className="space-y-3 px-3 pb-3">
                    <label className="block text-sm">Chuyển sang tầng khác
                      <select className={field} value={floorId} onChange={(event) => {
                        const nextFloor = event.target.value;
                        if (!window.confirm('Chuyển tầng sẽ đặt lại ghim và tuyến của địa điểm. Tiếp tục?')) return;
                        updatePlace({ floorId: nextFloor, coords: center(snapshot.floors.find((item) => item.id === nextFloor)), points: null, enabled: false, step1Text: '', step2Text: '' });
                        setFloorId(nextFloor);
                        selectPlace(place.id);
                      }}>
                        {snapshot.floors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm">Icon ghim<select className={field} value={place.iconImage ? '' : place.icon} onChange={(event) => updatePlace({ icon: event.target.value, iconImage: null })}>
                      {place.iconImage && <option value="" disabled>Icon đã tải lên</option>}
                      {Object.entries(PLACE_ICONS).map(([key, [icon, label]]) => <option key={key} value={key}>{icon} {label}</option>)}
                    </select></label>
                    <ImageField label="Icon tải lên" value={place.iconImage} onUpload={(file) => upload(file, (iconImage) => updatePlace({ iconImage }))} onClear={() => updatePlace({ iconImage: null })} />
                    <label className="block text-sm">Hướng dẫn từ sảnh<textarea className={field} value={place.step1Text || ''} onChange={(event) => updatePlace({ step1Text: event.target.value })} /></label>
                    {!isLobby && <label className="block text-sm">Hướng dẫn tại tầng đích<textarea className={field} value={place.step2Text || ''} onChange={(event) => updatePlace({ step2Text: event.target.value })} /></label>}
                    <button type="button" className={`${button} text-red-700`} onClick={() => {
                      change((data) => ({ ...data, destinations: data.destinations.filter((item) => item.id !== placeId) }));
                      selectPlace('');
                    }}>Xóa địa điểm</button>
                  </div>
                </details>
              </>}
            </div>}
          </div>}
        </div>
      </fieldset>
    </section>
  );
}
