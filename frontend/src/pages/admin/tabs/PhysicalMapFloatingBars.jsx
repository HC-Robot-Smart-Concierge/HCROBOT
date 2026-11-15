import React from 'react';
import { Navigation, Save, Trash2, Check, X, Square } from 'lucide-react';
import { normalizeZoneYaw, isPolygonZone } from './physicalMapZones';
import { OTTO_ENDPOINT_TEMPLATES, getEndpointTemplateInfo } from './studio/studioConstants';

export function PhysicalMapFloatingBars({
  dragState, handleDeleteEndpoint, handleDeleteSelectedVertex, handleDeleteZone, handleNavigateToEndpoint, handleSaveEndpoints, handleSaveZones, handleStop, handleUpdateSelectedEndpoint, handleUpdateSelectedZone, hasUnsavedEndpoints, hasUnsavedZones, isNavigating, isSavingEndpoints, isSavingZones, navStatus, navigatingEndpointId, selectedEndpoint, selectedZone, selectedZoneVertex, setSelectedEndpoint, setSelectedZone,
}) {
  return (
    <>
          {/* FLOATING ACTION BAR O DAY CANAS: CHINH SUA ZONE HOAC ENDPOINT Y CHANG GIA LAP */}
          {selectedZone && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center flex-nowrap whitespace-nowrap gap-2 px-3.5 py-2 rounded-xl border shadow-2xl backdrop-blur-md bg-slate-900/95 border-slate-700 text-xs text-slate-100 max-w-[95%] overflow-x-auto">
              {/* Loai Vung Dropdown */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      selectedZone.type === 'KEEP_OUT'
                        ? '#EF4444'
                        : selectedZone.type === 'SPEED_ZONE'
                        ? '#F59E0B'
                        : '#FB7185',
                  }}
                />
                <select
                  value={selectedZone.type || 'KEEP_OUT'}
                  onChange={(e) => handleUpdateSelectedZone('type', e.target.value)}
                  className="px-2 py-1 rounded bg-slate-800 border border-slate-700 font-bold text-[11px] text-white focus:outline-none cursor-pointer"
                >
                  <option value="KEEP_OUT">Cấm Vào (KEEP OUT)</option>
                  <option value="SPEED_ZONE">Giới Hạn Tốc Độ</option>
                  <option value="NO_STOP">Cấm Dừng (NO STOP)</option>
                </select>
              </div>

              {/* Input Ten Vung */}
              <input
                type="text"
                value={selectedZone.name || ''}
                onChange={(e) => handleUpdateSelectedZone('name', e.target.value)}
                placeholder="Đặt tên vùng..."
                className="w-40 sm:w-48 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-semibold text-white focus:outline-none"
              />

              {/* Neu la SPEED_ZONE: input toc do */}
              {selectedZone.type === 'SPEED_ZONE' && (
                <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded bg-slate-800 border border-slate-700">
                  <span className="text-[10px] text-amber-400 font-semibold">Tối đa:</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.12"
                    max="0.25"
                    title="Tốc độ tối đa trong vùng (Nav2 Speed Filter). Xe thật: bình thường ~0.25 m/s, chậm nhất ~0.12 m/s (thấp hơn motor không lăn). Đặt 0.12 để demo thấy rõ nhất (còn một nửa tốc độ); đặt thấp hơn thì xe vẫn chạy ~0.12 m/s, từ 0.25 trở lên thì không thấy chậm lại."
                    value={selectedZone.speed_limit || 0.12}
                    onChange={(e) => handleUpdateSelectedZone('speed_limit', parseFloat(e.target.value) || 0.12)}
                    className="w-12 px-1 py-0.5 rounded text-center font-bold bg-slate-900 border border-slate-700 text-amber-400 text-xs focus:outline-none"
                  />
                  <span className="text-slate-400 text-[10px]">m/s</span>
                </div>
              )}

              {/* Tam & Kich thuoc */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] shrink-0 text-slate-300">
                <span className="text-slate-400">Tâm:</span>
                <span className="font-bold text-cyan-400">
                  ({Number(selectedZone.x).toFixed(2)}, {Number(selectedZone.y).toFixed(2)})
                </span>
                {isPolygonZone(selectedZone) ? (
                  <>
                    <span className="ml-2 text-cyan-300">Đa giác · {selectedZone.vertices.length} đỉnh</span>
                    <span className={selectedZoneVertex === null ? 'text-slate-400' : 'text-amber-300'}>
                      {selectedZoneVertex === null ? 'Chọn đỉnh để kéo hoặc xóa' : `Đã chọn đỉnh ${selectedZoneVertex + 1}`}
                    </span>
                    <span className="text-slate-400">· Bấm cạnh để thêm đỉnh</span>
                    <button type="button" onClick={handleDeleteSelectedVertex}
                      disabled={selectedZoneVertex === null || selectedZone.vertices.length <= 3 || !!dragState}
                      title={selectedZone.vertices.length <= 3 ? 'Đa giác phải giữ ít nhất 3 đỉnh' : 'Xóa đỉnh đang chọn và nối hai đỉnh liền kề (Delete)'}
                      className="ml-1 flex items-center gap-1 rounded border border-rose-800 bg-rose-950/60 px-2 py-1 text-rose-300 hover:bg-rose-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                      <Trash2 className="h-3 w-3" /> Xóa đỉnh (Delete)
                    </button>
                  </>
                ) : <>
                <span className="text-slate-400 ml-1">KT:</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.3"
                  max="5.0"
                  value={selectedZone.width || 1.0}
                  onChange={(e) => handleUpdateSelectedZone('width', Math.max(0.2, parseFloat(e.target.value) || 0.3))}
                  className="w-11 px-1 py-0.5 rounded text-center font-bold bg-slate-900 border border-slate-700 text-white focus:outline-none"
                  title="Chiều rộng (m)"
                />
                <span>×</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.3"
                  max="5.0"
                  value={selectedZone.height || 1.0}
                  onChange={(e) => handleUpdateSelectedZone('height', Math.max(0.2, parseFloat(e.target.value) || 0.3))}
                  className="w-11 px-1 py-0.5 rounded text-center font-bold bg-slate-900 border border-slate-700 text-white focus:outline-none"
                  title="Chiều dài (m)"
                />
                <span>m</span>
                <input
                  type="number"
                  step="15"
                  value={normalizeZoneYaw(selectedZone.yaw)}
                  onChange={(e) => handleUpdateSelectedZone('yaw', normalizeZoneYaw(e.target.value))}
                  className="w-12 px-1 py-0.5 rounded text-center font-bold bg-slate-900 border border-slate-700 text-white focus:outline-none"
                  aria-label="Góc xoay vùng (độ)"
                  title="Góc xoay vùng (độ)"
                />
                <span>°</span>
                </>}
              </div>

              {/* Nut Luu Vung */}
              <button
                type="button"
                onClick={handleSaveZones}
                disabled={isSavingZones || !hasUnsavedZones}
                className={`p-1.5 rounded-lg border cursor-pointer transition-colors shrink-0 flex items-center justify-center ${
                  hasUnsavedZones
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 animate-pulse'
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                }`}
                title={isSavingZones ? 'Đang lưu...' : 'Lưu vùng vào CSDL'}
              >
                <Save className={`w-3.5 h-3.5 ${isSavingZones ? 'animate-spin' : ''}`} />
              </button>

              {/* Nut Xoa Vung */}
              <button
                type="button"
                onClick={() => handleDeleteZone(selectedZone.id)}
                className="p-1.5 rounded-lg border text-rose-400 hover:text-white bg-rose-950/60 hover:bg-rose-900 border-rose-800 cursor-pointer transition-colors shrink-0"
                title="Xóa vùng này"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Nut Hoan Tat */}
              <button
                type="button"
                onClick={() => setSelectedZone(null)}
                className="p-1.5 rounded-lg border text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border-slate-700 cursor-pointer transition-colors shrink-0"
                title="Đóng thanh chỉnh sửa"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            </div>
          )}

          {/* NUT DUNG NOI: luon hien khi robot dang tu hanh toi dich */}
          {isNavigating && (
            <button
              type="button"
              onClick={handleStop}
              className="absolute top-5 right-5 z-30 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm flex items-center gap-2 shadow-2xl border border-rose-400 cursor-pointer"
              title="Dừng robot ngay (Space)"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>DỪNG</span>
            </button>
          )}

          {/* FLOATING ACTION BAR: CHINH SUA ENDPOINT */}
          {selectedEndpoint && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center flex-nowrap whitespace-nowrap gap-2 px-3.5 py-2 rounded-xl border shadow-2xl backdrop-blur-md bg-slate-900/95 border-slate-700 text-xs text-slate-100 max-w-[95%] overflow-x-auto">
              {/* Dropdown Loai Endpoint */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: getEndpointTemplateInfo(selectedEndpoint.type).color }}
                />
                <select
                  value={selectedEndpoint.type || 'WAYPOINT'}
                  onChange={(e) => handleUpdateSelectedEndpoint('type', e.target.value)}
                  className="px-2 py-1 rounded bg-slate-800 border border-slate-700 font-bold text-[11px] text-white focus:outline-none cursor-pointer"
                >
                  {OTTO_ENDPOINT_TEMPLATES.map((tmpl) => (
                    <option key={tmpl.type} value={tmpl.type}>
                      {tmpl.type === 'WAYPOINT' ? 'Waypoint' : tmpl.type === 'CHARGER' ? 'Trạm Sạc' : 'Điểm Đỗ'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Input Ten Endpoint */}
              <input
                type="text"
                value={selectedEndpoint.name || ''}
                onChange={(e) => handleUpdateSelectedEndpoint('name', e.target.value)}
                placeholder="Đặt tên điểm mốc..."
                className="w-40 sm:w-48 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-semibold text-white focus:outline-none"
              />

              {/* Toa do X, Y */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-[10px] shrink-0 text-slate-300">
                <span className="text-slate-400">X:</span>
                <input
                  type="number"
                  step="0.05"
                  value={selectedEndpoint.x}
                  onChange={(e) => handleUpdateSelectedEndpoint('x', parseFloat(e.target.value) || 0.0)}
                  className="w-12 px-1 py-0.5 rounded text-center font-bold bg-slate-900 border border-slate-700 text-cyan-400 focus:outline-none"
                />
                <span className="text-slate-400">Y:</span>
                <input
                  type="number"
                  step="0.05"
                  value={selectedEndpoint.y}
                  onChange={(e) => handleUpdateSelectedEndpoint('y', parseFloat(e.target.value) || 0.0)}
                  className="w-12 px-1 py-0.5 rounded text-center font-bold bg-slate-900 border border-slate-700 text-cyan-400 focus:outline-none"
                />
                <span>m</span>
              </div>

              {/* Nut Dieu Huong Toi Day / Dung khi dang chay */}
              {isNavigating && navigatingEndpointId === selectedEndpoint.id ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                  title="Dừng robot ngay (Space)"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Dừng</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleNavigateToEndpoint(selectedEndpoint)}
                  className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                  title="Điều hướng robot chạy tới điểm này"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Tới Đích</span>
                </button>
              )}

              {/* Nut Luu Endpoint */}
              <button
                type="button"
                onClick={handleSaveEndpoints}
                disabled={isSavingEndpoints || !hasUnsavedEndpoints}
                className={`p-1.5 rounded-lg border cursor-pointer transition-colors shrink-0 flex items-center justify-center ${
                  hasUnsavedEndpoints
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 animate-pulse'
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                }`}
                title={isSavingEndpoints ? 'Đang lưu...' : 'Lưu điểm mốc vào CSDL'}
              >
                <Save className={`w-3.5 h-3.5 ${isSavingEndpoints ? 'animate-spin' : ''}`} />
              </button>

              {/* Nut Xoa Endpoint */}
              <button
                type="button"
                onClick={() => handleDeleteEndpoint(selectedEndpoint.id)}
                className="p-1.5 rounded-lg border text-rose-400 hover:text-white bg-rose-950/60 hover:bg-rose-900 border-rose-800 cursor-pointer transition-colors shrink-0"
                title="Xóa điểm mốc này"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Nut Hoan Tat */}
              <button
                type="button"
                onClick={() => setSelectedEndpoint(null)}
                className="p-1.5 rounded-lg border text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border-slate-700 cursor-pointer transition-colors shrink-0"
                title="Đóng thanh chỉnh sửa"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            </div>
          )}

          <div className="mt-2 flex w-full items-center gap-2">
            <p role="status" aria-live="polite" className="min-w-0 flex-1 truncate text-[11px] text-cyan-300" title={navStatus}>
              {navStatus}
            </p>
            {isNavigating && (
              <button
                type="button"
                onClick={handleStop}
                className="shrink-0 px-2 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 font-bold cursor-pointer text-[10px] flex items-center gap-1 transition-colors"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Dừng xe</span>
              </button>
            )}
          </div>
    </>
  );
}
