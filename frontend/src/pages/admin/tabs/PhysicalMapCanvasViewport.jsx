import React from 'react';
import { MapPin, AlertTriangle, ZoomIn, ZoomOut, Maximize2, MoveHorizontal } from 'lucide-react';
import { DEFAULT_VIEW, MAX_ZOOM, fitWidthView, isDefaultView } from './physicalMapView';
import { ZONE_TEMPLATES } from './physicalMapConstants';

export function PhysicalMapCanvasViewport({
  children,
  addEndpointType, canvasHostRef, canvasRef, canvasSize, dragState, driveBlock, finishPolygon, handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp, handleCanvasPointerCancel, hoveredEndpointId, isAddEndpointMode, isPoseSetMode, isRosConnected, mapConfig, mapView, panel, robotPose, setDriveBlock, setHoveredEndpointId, setIsAddEndpointMode, setMapView, setZoneDraft, setZoneDrawType, setZoneEdgeHover, speedStatus, t, zoneCursor, zoneDraft, zoneDrawShape, zoneDrawType, zoomMapBy,
}) {
  return (
        <div className="flex-1 min-w-0 relative flex flex-col items-center justify-center p-3 bg-slate-950 overflow-hidden select-none">
          {/* Canvas Render Element */}
          {/* Khung chua canvas: kich thuoc do bang ResizeObserver -> canvas dung bang khung (map to ra
              khi thu gon panel ben phai). Canvas absolute de kich thuoc canvas khong day khung ra. */}
          <div ref={canvasHostRef} className="relative w-full flex-1 min-h-0">
          <canvas
            tabIndex={0}
            aria-label="Bản đồ: bấm cạnh đa giác để thêm đỉnh, kéo đỉnh để sửa, nhấn Delete để xóa đỉnh đã chọn"
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            onPointerDown={handleCanvasMouseDown}
            onPointerMove={handleCanvasMouseMove}
            onPointerUp={handleCanvasMouseUp}
            onPointerCancel={handleCanvasPointerCancel}
            onPointerLeave={() => {
              setHoveredEndpointId(null);
              setZoneEdgeHover(null);
              if (dragState?.type === 'PAN') handleCanvasMouseUp();
            }}
            style={{ touchAction: 'none', cursor: !zoneDrawType && !isPoseSetMode && !isAddEndpointMode ? (dragState ? 'grabbing' : zoneCursor || undefined) : undefined }}
            onContextMenu={(e) => e.preventDefault()}
            className={`absolute inset-0 w-full h-full rounded-xl border border-slate-800 shadow-2xl bg-slate-900 ${
              dragState?.type === 'PAN'
                ? 'cursor-grabbing'
                : zoneDrawType
                ? 'cursor-crosshair'
                : dragState
                ? 'cursor-grabbing'
                : isPoseSetMode
                ? 'cursor-crosshair'
                : isAddEndpointMode
                ? 'cursor-copy'
                : hoveredEndpointId
                ? 'cursor-pointer'
                : 'cursor-grab'
            } ${
              zoneDrawType
                ? 'ring-2 ring-amber-500/70'
                : isPoseSetMode
                ? 'ring-2 ring-emerald-500/70'
                : isAddEndpointMode
                ? 'ring-2 ring-blue-500/70'
                : ''
            }`}
          />
          {/* Zoom map: lan chuot = zoom quanh con tro; keo vung trong / chuot phai = di chuyen map */}
          <div
            role="group"
            aria-label="Thu phóng bản đồ"
            className="absolute bottom-3 right-3 z-20 flex flex-col items-stretch gap-1 p-1 rounded-lg bg-slate-950/90 border border-slate-700 shadow-xl text-slate-200"
          >
            <button
              type="button"
              onClick={() => zoomMapBy(1.25)}
              disabled={mapView.zoom >= MAX_ZOOM - 1e-6}
              className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Phóng to (hoặc lăn chuột lên trên map)"
              aria-label="Phóng to"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="text-center text-[10px] font-mono text-slate-400 select-none" aria-live="polite">
              {Math.round(mapView.zoom * 100)}%
            </div>
            <button
              type="button"
              onClick={() => zoomMapBy(0.8)}
              disabled={mapView.zoom <= 1 + 1e-6}
              className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Thu nhỏ (hoặc lăn chuột xuống)"
              aria-label="Thu nhỏ"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="h-px bg-slate-700 my-0.5" />
            <button
              type="button"
              onClick={() => setMapView(fitWidthView(canvasSize.width, canvasSize.height, mapConfig))}
              className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-slate-800 cursor-pointer"
              title="Vừa chiều ngang: map dọc phủ kín bề ngang, kéo lên/xuống để xem phần còn lại"
              aria-label="Vừa chiều ngang"
            >
              <MoveHorizontal className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setMapView(DEFAULT_VIEW)}
              disabled={isDefaultView(mapView)}
              className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Xem toàn bộ map (vừa khung)"
              aria-label="Xem toàn bộ map"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          </div>

          {/* Dong ho toc do (encoder) + huy hieu vung giam toc - de demo thay xe cham lai */}
          {isRosConnected && (
            <div
              className={`absolute top-3 right-3 z-20 px-3 py-2 rounded-lg border shadow-xl text-right transition-colors duration-300 ${
                speedStatus.active
                  ? 'bg-amber-950/95 border-amber-500 text-amber-100'
                  : 'bg-slate-950/90 border-slate-700 text-slate-100'
              }`}
              style={{ minWidth: 150 }}
            >
              <div className="text-[10px] uppercase tracking-wide opacity-70">Tốc độ xe</div>
              <div className="font-mono font-bold text-2xl leading-tight">
                {Math.abs(robotPose.linearVelocity || 0).toFixed(2)}
                <span className="text-xs font-semibold ml-1 opacity-70">m/s</span>
              </div>
              {speedStatus.active ? (
                <div className="mt-1 text-[11px] font-bold text-amber-300 animate-pulse">{speedStatus.label}</div>
              ) : (
                <div className="mt-1 text-[10px] opacity-60">Không giới hạn (bình thường ~0.25 m/s)</div>
              )}
              {speedStatus.warning && (
                <div className="mt-1 max-w-[260px] text-[10px] leading-snug text-left text-rose-300">{speedStatus.warning}</div>
              )}
            </div>
          )}

          {driveBlock && (
            <div
              role="alert"
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-2xl px-3 py-2 rounded-lg bg-red-950/95 border border-red-700 text-[11px] text-red-100 shadow-xl flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <div className="font-bold text-red-200">
                  Xe kẹt {driveBlock.stuck_sec}s: {driveBlock.message}
                </div>
                <div className="text-red-100/90">{driveBlock.hint}</div>
                {driveBlock.detail && (
                  <div className="text-[10px] text-red-300/70 font-mono mt-0.5">Pi: {driveBlock.detail}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDriveBlock(null)}
                className="text-red-300 hover:text-white font-bold text-xs cursor-pointer"
                title="Ẩn"
              >
                ✕
              </button>
            </div>
          )}

          {zoneDrawType && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 px-3 py-2 rounded-lg bg-amber-950/95 border border-amber-700 text-[11px] font-semibold text-amber-200 shadow-xl max-w-[90%]">
              {zoneDrawShape === 'polygon' ? (
                <>
                  <p>Vẽ {ZONE_TEMPLATES.find((t) => t.type === zoneDrawType)?.badge}: chấm từng đỉnh theo thứ tự quanh vùng. Bấm đỉnh đầu hoặc Hoàn tất để đóng hình.</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span>{zoneDraft?.vertices?.length || 0}/64 đỉnh</span>
                    <button type="button" disabled={(zoneDraft?.vertices?.length || 0) < 3} onClick={finishPolygon} className="rounded bg-emerald-700 px-2 py-1 text-white disabled:opacity-40 cursor-pointer">Hoàn tất</button>
                    <button type="button" disabled={!zoneDraft?.vertices?.length} onClick={() => setZoneDraft((draft) => draft && { ...draft, vertices: draft.vertices.slice(0, -1) })} className="rounded bg-slate-700 px-2 py-1 text-white disabled:opacity-40 cursor-pointer">Bỏ đỉnh cuối</button>
                    <button type="button" onClick={() => { setZoneDraft(null); setZoneDrawType(null); }} className="rounded border border-amber-700 px-2 py-1 cursor-pointer">Hủy (Esc)</button>
                  </div>
                </>
              ) : <>Vẽ vùng {ZONE_TEMPLATES.find((t) => t.type === zoneDrawType)?.badge}: nhấn giữ chuột ở 1 góc → kéo tới góc đối diện → thả chuột (Esc để hủy)</>}
            </div>
          )}

          {isPoseSetMode && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-700 text-[11px] font-semibold text-emerald-300 shadow-xl">
              Đặt vị trí ban đầu: click chỗ robot đứng → kéo theo hướng mũi xe → thả chuột
            </div>
          )}

          {isAddEndpointMode && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 px-3.5 py-1.5 rounded-lg bg-blue-950/95 border border-blue-500 text-xs font-semibold text-blue-200 shadow-2xl flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-blue-400 animate-bounce" />
              <span>Chế độ ghim Endpoint: Click vị trí bất kỳ trên bản đồ để thêm {addEndpointType === 'CHARGER' ? 'Trạm Sạc' : addEndpointType === 'PARK' ? 'Điểm Đỗ' : 'Waypoint'}</span>
              <button
                type="button"
                onClick={() => setIsAddEndpointMode(false)}
                className="ml-2 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold cursor-pointer transition-colors"
              >
                Xong
              </button>
            </div>
          )}


          {children}
        </div>
  );
}
