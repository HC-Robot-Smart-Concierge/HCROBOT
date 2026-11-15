import React from 'react';
import {
  Sliders,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Navigation,
  Plus,
  Save,
  Trash2,
  Edit2,
  Crosshair,
} from 'lucide-react';
import { isPolygonZone } from './physicalMapZones';
import { getEndpointTemplateInfo } from './studio/studioConstants';

export function PhysicalMapPopupTabsSections({
  addEndpointType, endpoints, handleAddEndpoint, handleDeleteEndpoint, handleDeleteZone, handleNavigateToEndpoint, handleSaveEndpoints, handleSaveZones, handleStop, hardwareInfo, hasUnsavedEndpoints, hasUnsavedZones, isAddEndpointMode, isNavigating, isSavingEndpoints, isSavingZones, maxLinearSpeed, navigatingEndpointId, panel, pi5Ip, scanPoints, selectedEndpoint, selectedZone, sendTeleopCommand, setAddEndpointType, setMaxLinearSpeed, setSelectedEndpoint, setSelectedZone, setSpeedPercent, setZoneDraft, setZoneDrawShape, setZoneDrawType, speedPercent, toggleZoneDraw, zoneDrawShape, zoneDrawType, zones,
}) {
  return (
    <>
          {/* NOI DUNG TAB 1: DANH SACH DIEM MOC (WAYPOINTS) */}
          {panel.section === 'WAYPOINTS' && (
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2.5">
              {/* Toolbar them & luu endpoint */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleAddEndpoint('CHARGER')}
                    className="px-2 py-1 rounded bg-emerald-600/80 hover:bg-emerald-600 text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                    title="Thêm trạm sạc pin"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Trạm Sạc</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddEndpoint('PARK')}
                    className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                    title="Thêm điểm đỗ chờ"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Điểm Đỗ</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveEndpoints}
                  disabled={isSavingEndpoints || !hasUnsavedEndpoints}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                    hasUnsavedEndpoints
                      ? 'bg-emerald-600 text-white shadow-sm animate-pulse'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                  title="Lưu tất cả điểm mốc vào CSDL"
                >
                  <Save className="w-3 h-3" />
                  <span>{isSavingEndpoints ? 'Lưu...' : 'Lưu'}</span>
                </button>
              </div>

              {isAddEndpointMode && (
                <label className="flex items-center gap-2 rounded-lg border border-blue-500/50 bg-blue-950/40 p-2 text-[11px] text-blue-200">
                  <Crosshair className="w-3.5 h-3.5 shrink-0" />
                  <span>Ghim trên map:</span>
                  <select
                    aria-label="Loại điểm mốc cần ghim"
                    value={addEndpointType}
                    onChange={(e) => setAddEndpointType(e.target.value)}
                    className="min-w-0 flex-1 rounded bg-slate-900 p-1 text-slate-100 outline-none"
                  >
                    <option value="CHARGER">Trạm Sạc</option>
                    <option value="PARK">Điểm Đỗ</option>
                  </select>
                </label>
              )}

              {/* Danh sach Waypoints */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {endpoints.map((ep) => {
                  const tmpl = getEndpointTemplateInfo(ep.type);
                  const isSelected = selectedEndpoint?.id === ep.id;
                  const isNavTarget = isNavigating && navigatingEndpointId === ep.id;
                  return (
                    <div
                      key={ep.id}
                      onClick={() => handleNavigateToEndpoint(ep)}
                      className={`p-2 rounded-lg border flex items-center justify-between transition-colors cursor-pointer ${
                        isNavTarget
                          ? 'bg-cyan-950/80 border-cyan-500 shadow-md ring-1 ring-cyan-400'
                          : isSelected
                          ? 'bg-blue-950/60 border-blue-500 shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-850 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tmpl.color || ep.color }}
                        />
                        <div className="truncate">
                          <span className="text-xs font-semibold text-slate-200 block truncate flex items-center gap-1.5">
                            <span>{ep.name}</span>
                            {isNavTarget && (
                              <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold border border-cyan-500/40">
                                Đang tới...
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            ({Number(ep.x).toFixed(2)}m, {Number(ep.y).toFixed(2)}m) • {tmpl.type}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigateToEndpoint(ep);
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                            isNavTarget
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white'
                          }`}
                          title="Bấm để robot di chuyển tới điểm này"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Tới</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEndpoint(ep.id);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer transition-colors"
                          title="Xóa điểm"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NOI DUNG TAB 2: DANH SACH VUNG CHUC NANG (ZONES) */}
          {panel.section === 'ZONES' && (
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2.5">
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <span>Hình vẽ:</span>
                {[['rectangle', 'Chữ nhật'], ['polygon', 'Đa giác (Polygon)']].map(([shape, label]) => (
                  <button key={shape} type="button" aria-pressed={zoneDrawShape === shape}
                    onClick={() => { setZoneDrawShape(shape); setZoneDraft(null); setZoneDrawType(null); }}
                    className={`rounded border px-2 py-1 cursor-pointer ${zoneDrawShape === shape ? 'border-cyan-500 bg-cyan-950 text-cyan-200' : 'border-slate-700 bg-slate-800'}`}>
                    {label}
                  </button>
                ))}
              </div>
              {/* Toolbar them & luu zone */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleZoneDraw('KEEP_OUT')}
                    className={`px-2 py-1 rounded text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                      zoneDrawType === 'KEEP_OUT' ? 'bg-rose-600 ring-2 ring-white/70' : 'bg-rose-600/80 hover:bg-rose-600'
                    }`}
                    title="Vẽ khu vực cấm vào theo hình đã chọn. Nav2 sẽ đi đường vòng, không nhận endpoint bên trong."
                  >
                    <Plus className="w-3 h-3" />
                    <span>{zoneDrawType === 'KEEP_OUT' ? 'Đang Vẽ...' : 'Cấm Vào'}</span>
                  </button>
                  <button
                    onClick={() => toggleZoneDraw('SPEED_ZONE')}
                    className={`px-2 py-1 rounded text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                      zoneDrawType === 'SPEED_ZONE' ? 'bg-amber-600 ring-2 ring-white/70' : 'bg-amber-600/80 hover:bg-amber-600'
                    }`}
                    title="Vẽ vùng giới hạn tốc độ theo hình đã chọn. Robot tự chạy chậm lại khi vào vùng."
                  >
                    <Plus className="w-3 h-3" />
                    <span>{zoneDrawType === 'SPEED_ZONE' ? 'Đang Vẽ...' : 'Tốc Độ'}</span>
                  </button>
                  <button
                    onClick={() => toggleZoneDraw('NO_STOP')}
                    className={`px-2 py-1 rounded text-white text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                      zoneDrawType === 'NO_STOP' ? 'bg-pink-600 ring-2 ring-white/70' : 'bg-pink-600/80 hover:bg-pink-600'
                    }`}
                    title="Vẽ vùng cấm dừng theo hình đã chọn. Robot được đi ngang qua nhưng không nhận endpoint bên trong."
                  >
                    <Plus className="w-3 h-3" />
                    <span>{zoneDrawType === 'NO_STOP' ? 'Đang Vẽ...' : 'Cấm Dừng'}</span>
                  </button>
                </div>

                <button
                  onClick={handleSaveZones}
                  disabled={isSavingZones || !hasUnsavedZones}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                    hasUnsavedZones
                      ? 'bg-emerald-600 text-white shadow-sm animate-pulse'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                  title="Lưu tất cả vùng vào CSDL"
                >
                  <Save className="w-3 h-3" />
                  <span>{isSavingZones ? 'Lưu...' : 'Lưu'}</span>
                </button>
              </div>

              {/* Danh sach Zones */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {zones.map((zone) => {
                  const isSelected = selectedZone?.id === zone.id;
                  const isKeepOut = zone.type === 'KEEP_OUT';
                  const isSpeed = zone.type === 'SPEED_ZONE';
                  const color = isKeepOut ? '#EF4444' : isSpeed ? '#F59E0B' : '#FB7185';
                  return (
                    <div
                      key={zone.id}
                      onClick={() => {
                        setSelectedZone(zone);
                        setSelectedEndpoint(null);
                        setZoneDrawType(null);
                        setZoneDraft(null);
                      }}
                      className={`p-2 rounded-lg border flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-950/60 border-indigo-500 shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-850 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <div className="truncate">
                          <span className="text-xs font-semibold text-slate-200 block truncate">{zone.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {isPolygonZone(zone) ? `Đa giác · ${zone.vertices.length} đỉnh` : `${Number(zone.width).toFixed(1)}m×${Number(zone.height).toFixed(1)}m`}
                            {' • '}Tâm ({Number(zone.x).toFixed(2)}, {Number(zone.y).toFixed(2)})
                            {isSpeed && ` • ${zone.speed_limit}m/s`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedZone(zone);
                            setSelectedEndpoint(null);
                            setZoneDrawType(null);
                            setZoneDraft(null);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-slate-800 cursor-pointer transition-colors"
                          title="Sửa vùng"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteZone(zone.id);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer transition-colors"
                          title="Xóa vùng"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NOI DUNG TAB 3: TELEOP DIEU KHIEN THU CONG */}
          {panel.section === 'TELEOP' && (
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  Điều Khiển Thủ Công (D-Pad & Phím WASD)
                </span>
                <span className="text-[10px] text-amber-400 font-mono">
                  {speedPercent}% ({maxLinearSpeed.toFixed(2)}m/s)
                </span>
              </div>

              {/* D-Pad Buttons */}
              <div className="flex flex-col items-center justify-center gap-2 my-2">
                <button
                  onMouseDown={() => sendTeleopCommand('forward', maxLinearSpeed, 0.0)}
                  onMouseUp={() => sendTeleopCommand('stop', 0.0, 0.0)}
                  onTouchStart={() => sendTeleopCommand('forward', maxLinearSpeed, 0.0)}
                  onTouchEnd={() => sendTeleopCommand('stop', 0.0, 0.0)}
                  className="w-12 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center text-white active:bg-amber-600 cursor-pointer transition-colors"
                  title="Tiến lên (W / Up)"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onMouseDown={() => sendTeleopCommand('left', 0.0, 0.5)}
                    onMouseUp={() => sendTeleopCommand('stop', 0.0, 0.0)}
                    onTouchStart={() => sendTeleopCommand('left', 0.0, 0.5)}
                    onTouchEnd={() => sendTeleopCommand('stop', 0.0, 0.0)}
                    className="w-12 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center text-white active:bg-amber-600 cursor-pointer transition-colors"
                    title="Quay trái (A / Left)"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <button
                    onClick={handleStop}
                    className="w-12 h-10 rounded-lg bg-rose-700 hover:bg-rose-600 border border-rose-500 flex items-center justify-center text-white font-bold text-xs cursor-pointer active:scale-95 transition-all shadow-md"
                    title="Dừng khẩn cấp (Space)"
                  >
                    STOP
                  </button>

                  <button
                    onMouseDown={() => sendTeleopCommand('right', 0.0, -0.5)}
                    onMouseUp={() => sendTeleopCommand('stop', 0.0, 0.0)}
                    onTouchStart={() => sendTeleopCommand('right', 0.0, -0.5)}
                    onTouchEnd={() => sendTeleopCommand('stop', 0.0, 0.0)}
                    className="w-12 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center text-white active:bg-amber-600 cursor-pointer transition-colors"
                    title="Quay phải (D / Right)"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <button
                  onMouseDown={() => sendTeleopCommand('backward', -maxLinearSpeed, 0.0)}
                  onMouseUp={() => sendTeleopCommand('stop', 0.0, 0.0)}
                  onTouchStart={() => sendTeleopCommand('backward', -maxLinearSpeed, 0.0)}
                  onTouchEnd={() => sendTeleopCommand('stop', 0.0, 0.0)}
                  className="w-12 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center text-white active:bg-amber-600 cursor-pointer transition-colors"
                  title="Lùi lại (S / Down)"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>

              {/* Speed slider toi uu cho LiDAR A1M8 quet tron ven */}
              <div className="mt-2 text-xs">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span className="font-semibold text-amber-400">
                    Tốc độ quét an toàn: {speedPercent}% ({maxLinearSpeed.toFixed(2)} m/s)
                  </span>
                  <span>Max an toàn: 50%</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="50"
                  step="5"
                  value={speedPercent}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setSpeedPercent(val);
                    setMaxLinearSpeed(Number((val * 0.0048).toFixed(2)));
                  }}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <p className="mt-1 text-[9px] text-slate-400 italic">
                  * Giảm tốc độ giúp RPLiDAR A1M8 (5.5Hz) quét đủ mật độ điểm, chống trượt bánh và chống méo bản đồ.
                </p>
              </div>            </div>
          )}

          {/* Hardware connection info */}
          {panel.section === 'telemetry' && (
          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <span className="font-bold text-slate-300 block">Thông Tin Kết Nối Thực Tế:</span>
            <div className="flex justify-between text-[10px]">
              <span>Cổng Serial RPLiDAR:</span>
              <span className="text-cyan-400 font-mono">{hardwareInfo.port}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>Địa chỉ IP Pi 5:</span>
              <span className="text-emerald-400 font-mono">{pi5Ip}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>Tia quét nhận diện:</span>
              <span className="text-amber-400 font-mono">{scanPoints.length} điểm</span>
            </div>
          </div>
          )}
    </>
  );
}
