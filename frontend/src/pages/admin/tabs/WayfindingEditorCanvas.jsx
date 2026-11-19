import React, { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { WayfindingFloorLayout } from '../../../components/robot/WayfindingFloorLayout';
import { floorPolygonPoints, getFloorLabelMinimum, shouldRotateWayfindingFloor } from '../../../services/wayfindingGeometry';
import { GRID_SIZE, getEditorViewport, positionFloorElement, snapEditorPoint, zoomEditorViewport } from './wayfindingCanvasGeometry';

const fitted = { zoom: 1, x: 0, y: 0 };
const tool = 'rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 aria-pressed:border-sky-300 aria-pressed:bg-sky-50 aria-pressed:text-sky-800';

function svgPoint(svg, x, y, inverse) {
  const point = svg.createSVGPoint();
  point.x = x;
  point.y = y;
  return point.matrixTransform(inverse);
}

export const WayfindingEditorCanvas = forwardRef(function WayfindingEditorCanvas({ floor, layout, pointMode, selected, onSelect, onCommit, preview, previewStartX, onPreviewChange, onMapClick, areaPoints, onCloseArea, disabled, children }, ref) {
  const gridId = `wayfinding-grid-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const svgRef = useRef(null);
  const sceneRef = useRef(null);
  const gestureRef = useRef(null);
  const skipMapClick = useRef(false);
  const frameRef = useRef(0);
  const [view, setView] = useState(fitted);
  const [handTool, setHandTool] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panMode = handTool || spaceHeld;
  const [snapping, setSnapping] = useState(true);
  const [portraitPreview, setPortraitPreview] = useState(false);
  const [draft, setDraft] = useState(null);
  const [pointDraft, setPointDraft] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const viewport = getEditorViewport(floor, view);
  const rotatePreview = preview && shouldRotateWayfindingFloor(canvasSize, floor);
  const rotation = rotatePreview ? (previewStartX >= floor.width / 2 ? 90 : -90) : 0;
  const screenView = rotation === 90 ? {
    x: floor.height - viewport.y - viewport.height, y: viewport.x, width: viewport.height, height: viewport.width,
  } : rotation === -90 ? {
    x: viewport.y, y: floor.width - viewport.x - viewport.width, width: viewport.height, height: viewport.width,
  } : viewport;
  const sceneTransform = rotation === 90 ? `translate(${floor.height}, 0) rotate(90)` :
    rotation === -90 ? `translate(0, ${floor.width}) rotate(-90)` : undefined;
  const scale = Math.min(canvasSize.width / screenView.width, canvasSize.height / screenView.height) || 1;
  const drawingArea = Boolean(areaPoints);
  const gridActive = (layout || pointMode) && !preview && !panMode && !disabled;
  const editing = layout && gridActive && !drawingArea;
  const shown = draft ? { ...selected, ...draft.bounds } : selected;
  const renderedFloor = draft ? { ...floor, elements: floor.elements.map((item) => item.id === selected?.id ? shown : item) } : floor;

  const changeZoom = (factor) => setView((current) => zoomEditorViewport(floor, current, current.zoom * factor));
  useImperativeHandle(ref, () => ({
    zoomIn: () => changeZoom(1.3),
    zoomOut: () => changeZoom(1 / 1.3),
    fit: () => setView(fitted),
    toggleHand: () => setHandTool((current) => !current),
    toggleGrid: () => setSnapping((current) => !current),
    holdHand: setSpaceHeld,
  }));

  useEffect(() => {
    const svg = svgRef.current;
    const measure = () => setCanvasSize({ width: svg.clientWidth, height: svg.clientHeight });
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(svg);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  useEffect(() => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    cancelAnimationFrame(frameRef.current);
    setDraft(null);
    setPointDraft(null);
    if (svgRef.current.hasPointerCapture(gesture.pointerId)) svgRef.current.releasePointerCapture(gesture.pointerId);
  }, [floor, layout, pointMode, preview, rotation, panMode, disabled, drawingArea]);

  const beginGesture = (event, item, corner, target) => {
    if (disabled || gestureRef.current || ((item || target) && event.button !== 0)) return;
    const svg = svgRef.current;
    const matrix = sceneRef.current.getScreenCTM();
    if (!matrix) return;
    if (event.button === 1) event.preventDefault();
    event.stopPropagation();
    const inverse = matrix.inverse();
    const start = svgPoint(svg, event.clientX, event.clientY, inverse);
    if (item) onSelect(item.id);
    gestureRef.current = {
      pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
      inverse, start, item, corner, target, origin: viewport, zoom: view.zoom,
      tolerance: Math.min(28, 7 * Math.hypot(inverse.a, inverse.b)),
    };
    svg.setPointerCapture(event.pointerId);
    svg.focus({ preventScroll: true });
  };

  const beginPointDrag = (event, target) => {
    if (pointMode && !preview && !panMode) beginGesture(event, null, null, target);
  };

  const updateGesture = (event, commit = false) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const { clientX, clientY, altKey } = event;
    if (Math.hypot(clientX - gesture.clientX, clientY - gesture.clientY) < 3) {
      if (gesture.target) setPointDraft(null);
      else if (gesture.item) setDraft(null);
      else setView({ zoom: gesture.zoom, x: gesture.origin.x, y: gesture.origin.y });
      return;
    }

    const point = svgPoint(svgRef.current, clientX, clientY, gesture.inverse);
    const delta = { x: point.x - gesture.start.x, y: point.y - gesture.start.y };
    if (gesture.target) {
      const { id, coords, onCommit: commitPoint } = gesture.target;
      const next = snapEditorPoint({ x: coords.x + delta.x, y: coords.y + delta.y }, floor, snapping && !altKey ? GRID_SIZE : 0);
      if (!commit) setPointDraft({ id, coords: next });
      else if (next.x !== coords.x || next.y !== coords.y) commitPoint(next);
      return;
    }
    if (!gesture.item) {
      const viewport = getEditorViewport(floor, { zoom: gesture.zoom, x: gesture.origin.x - delta.x, y: gesture.origin.y - delta.y });
      setView({ zoom: gesture.zoom, x: viewport.x, y: viewport.y });
      return;
    }

    const next = positionFloorElement(floor, gesture.item, delta, gesture.corner, snapping && !altKey, gesture.tolerance);
    if (commit) {
      if (next && Object.keys(next.bounds).some((key) => next.bounds[key] !== gesture.item[key])) onCommit(gesture.item.id, next.bounds);
    } else {
      setDraft(next);
    }
  };

  const finishGesture = (event, commit) => {
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    cancelAnimationFrame(frameRef.current);
    if (gestureRef.current.target) skipMapClick.current = true;
    if (commit) updateGesture(event, true);
    gestureRef.current = null;
    setDraft(null);
    setPointDraft(null);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-2 py-2" aria-label="Công cụ bản đồ">
        <button type="button" className={tool} aria-label="Thu nhỏ bản đồ" disabled={view.zoom <= 1} onClick={() => changeZoom(1 / 1.3)}>−</button>
        <output aria-label="Mức thu phóng" className="w-12 text-center text-xs font-semibold tabular-nums text-slate-700">{Math.round(view.zoom * 100)}%</output>
        <button type="button" className={tool} aria-label="Phóng to bản đồ" disabled={view.zoom >= 5} onClick={() => changeZoom(1.3)}>+</button>
        <button type="button" className={tool} onClick={() => setView(fitted)}>Vừa khung</button>
        <button type="button" className={tool} aria-pressed={handTool} onClick={() => setHandTool(!handTool)}>{handTool ? 'Thoát kéo khung' : 'Kéo khung nhìn'}</button>
        {(layout || pointMode) && !preview && <button type="button" className={tool} title="Giữ Alt để tạm bỏ bám lưới" aria-pressed={snapping} onClick={() => setSnapping(!snapping)}>Bám lưới</button>}
        {preview && <div className="flex gap-1" aria-label="Chiều màn hình xem trước">
          <button type="button" className={tool} aria-pressed={!portraitPreview} onClick={() => { setPortraitPreview(false); setView(fitted); }}>Xem ngang</button>
          <button type="button" className={tool} aria-pressed={portraitPreview} onClick={() => { setPortraitPreview(true); setView(fitted); }}>Xem dọc</button>
        </div>}
        <button type="button" className={`${tool} ml-auto`} aria-pressed={preview} onClick={() => {
          if (!preview) setView(fitted);
          onPreviewChange(!preview);
        }}>{preview ? 'Quay lại chỉnh sửa' : 'Xem trước'}</button>
      </div>
      <svg
        ref={svgRef}
        tabIndex={0}
        aria-label={`Sơ đồ ${floor.name}`}
        viewBox={`${screenView.x} ${screenView.y} ${screenView.width} ${screenView.height}`}
        className={`mx-auto block w-full max-h-[72vh] touch-none bg-slate-100 ${panMode ? 'cursor-grab' : onMapClick && !preview && !disabled ? 'cursor-crosshair' : 'cursor-default'}`}
        style={{
          aspectRatio: preview ? (portraitPreview ? '9 / 16' : '16 / 9') : `${floor.width} / ${floor.height}`,
          maxWidth: preview ? (portraitPreview ? 'min(390px, 40.5vh)' : 'min(960px, 128vh)') : undefined,
        }}
        onPointerDownCapture={(event) => {
          skipMapClick.current = false;
          if (event.button === 1 || (panMode && event.button === 0)) beginGesture(event);
        }}
        onPointerDown={(event) => { if (editing && event.button === 0) onSelect(''); }}
        onPointerMove={(event) => {
          if (gestureRef.current?.pointerId !== event.pointerId) return;
          const pointer = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, altKey: event.altKey };
          cancelAnimationFrame(frameRef.current);
          frameRef.current = requestAnimationFrame(() => updateGesture(pointer));
        }}
        onPointerUp={(event) => finishGesture(event, true)}
        onPointerCancel={(event) => finishGesture(event, false)}
        onLostPointerCapture={(event) => finishGesture(event, false)}
        onAuxClick={(event) => { if (event.button === 1) event.preventDefault(); }}
        onClick={!preview && !panMode && !disabled && onMapClick ? (event) => {
          if (!skipMapClick.current) onMapClick(event, gridActive && snapping && !event.altKey ? GRID_SIZE : 0);
        } : undefined}
      >
        <g ref={sceneRef} transform={sceneTransform}>
          <WayfindingFloorLayout floor={renderedFloor} rotation={rotation} onElementPointerDown={editing ? (event, item) => beginGesture(event, item) : undefined}
            minLabelSize={preview ? getFloorLabelMinimum(canvasSize, screenView.width, screenView.height, 1) : undefined} />
          {gridActive && snapping && (
            <>
              <defs><pattern id={gridId} width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_SIZE} 0 H 0 V ${GRID_SIZE}`} fill="none" stroke="#64748B" strokeOpacity="0.22" strokeWidth="0.75" vectorEffect="non-scaling-stroke" />
              </pattern></defs>
              <rect width={floor.width} height={floor.height} fill={`url(#${gridId})`} pointerEvents="none" />
            </>
          )}
          {editing && draft && (
            <g pointerEvents="none" stroke="#0891B2" strokeWidth="1.5" strokeDasharray="6 5">
              {draft.guides.x !== undefined && <line x1={draft.guides.x} x2={draft.guides.x} y1="0" y2={floor.height} vectorEffect="non-scaling-stroke" />}
              {draft.guides.y !== undefined && <line x1="0" x2={floor.width} y1={draft.guides.y} y2={draft.guides.y} vectorEffect="non-scaling-stroke" />}
            </g>
          )}
          {editing && shown && (
            <g transform={`rotate(${shown.rotation || 0}, ${shown.x + shown.width / 2}, ${shown.y + shown.height / 2})`}>
              {shown.vertices ? (
                <polygon points={floorPolygonPoints(shown).map(({ x, y }) => `${x},${y}`).join(' ')} fill="none" pointerEvents="none"
                  stroke="#0284C7" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              ) : (
                <rect x={shown.x} y={shown.y} width={shown.width} height={shown.height} fill="none" pointerEvents="none" stroke="#0284C7" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              )}
              {(shown.vertices ? floorPolygonPoints(shown).map(({ x, y }, index) => [index, x, y]) : [
                ['nw', shown.x, shown.y], ['ne', shown.x + shown.width, shown.y],
                ['sw', shown.x, shown.y + shown.height], ['se', shown.x + shown.width, shown.y + shown.height],
              ]).map(([corner, x, y]) => (
                <g key={corner} style={{ cursor: shown.vertices ? 'move' : `${corner}-resize` }} onPointerDown={(event) => beginGesture(event, selected, corner)}>
                  <circle cx={x} cy={y} r={11 / scale} fill="transparent" />
                  <rect x={x - 3.5 / scale} y={y - 3.5 / scale} width={7 / scale} height={7 / scale} rx={1.5 / scale}
                    fill="white" stroke="#0284C7" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                </g>
              ))}
            </g>
          )}
          {areaPoints && !preview && (
            <g>
              <polyline points={areaPoints.map(({ x, y }) => `${x},${y}`).join(' ')} fill="none" stroke="#0284C7" strokeWidth="2"
                strokeDasharray="6 4" vectorEffect="non-scaling-stroke" pointerEvents="none" />
              {areaPoints.map(({ x, y }, index) => (
                <circle key={index} cx={x} cy={y} r={(index === 0 ? 7 : 4) / scale} fill={index === 0 ? '#0369A1' : '#fff'}
                  stroke="#0284C7" strokeWidth="2" vectorEffect="non-scaling-stroke"
                  pointerEvents={index === 0 && areaPoints.length >= 3 && !panMode ? undefined : 'none'}
                  className={index === 0 && areaPoints.length >= 3 ? 'cursor-pointer' : undefined}
                  onClick={index === 0 && areaPoints.length >= 3 ? (event) => { event.stopPropagation(); onCloseArea(); } : undefined} />
              ))}
            </g>
          )}
          <g pointerEvents={panMode ? 'none' : undefined}>{children(rotation, pointDraft, beginPointDrag, scale)}</g>
        </g>
      </svg>
    </div>
  );
});
