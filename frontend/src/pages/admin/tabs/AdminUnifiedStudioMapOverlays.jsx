import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { getEndpointTemplateInfo, getZoneTemplateInfo } from './unifiedStudioTemplates';

export const AdminUnifiedStudioMapOverlays = ({
  showTeleopPad,
  setShowTeleopPad,
  handleTeleop,
  selectedWaypoint,
  handleCanvasClickGoal,
  handleOpenEditEndpointModal,
  handleAddWaypointToWorkflow,
  handleOpenDeleteConfirm,
  selectedZone,
  handleOpenEditZoneModal,
  handleDeleteZone,
}) => (
  <>
            {/* Floating Manual WASD Teleop D-Pad */}
            {showTeleopPad && (
              <div className="absolute bottom-4 right-4 z-30 p-3 rounded-2xl border bg-white/95 backdrop-blur-md shadow-2xl flex flex-col items-center gap-2" style={{ borderColor: '#CBD5E1' }}>
                <div className="flex items-center justify-between w-full border-b pb-1">
                  <span className="text-[10px] font-bold text-stone-700 uppercase tracking-wider">Lái Quét Phòng (WASD)</span>
                  <button onClick={() => setShowTeleopPad(false)} className="text-stone-400 hover:text-stone-800 text-xs font-bold cursor-pointer">✕</button>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <button
                    onMouseDown={() => handleTeleop('forward')}
                    onMouseUp={() => handleTeleop('stop')}
                    className="p-2 rounded-lg border bg-stone-50 hover:bg-stone-200 active:scale-95 cursor-pointer text-stone-800"
                    title="Tiến (W)"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onMouseDown={() => handleTeleop('left')}
                      onMouseUp={() => handleTeleop('stop')}
                      className="p-2 rounded-lg border bg-stone-50 hover:bg-stone-200 active:scale-95 cursor-pointer text-stone-800"
                      title="Rẽ Trái (A)"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleTeleop('stop')}
                      className="px-2.5 py-1.5 rounded-lg border bg-stone-200 hover:bg-stone-300 text-[10px] font-black active:scale-95 cursor-pointer text-stone-800"
                      title="Dừng (Space/X)"
                    >
                      STOP
                    </button>
                    <button
                      onMouseDown={() => handleTeleop('right')}
                      onMouseUp={() => handleTeleop('stop')}
                      className="p-2 rounded-lg border bg-stone-50 hover:bg-stone-200 active:scale-95 cursor-pointer text-stone-800"
                      title="Rẽ Phải (D)"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onMouseDown={() => handleTeleop('backward')}
                    onMouseUp={() => handleTeleop('stop')}
                    className="p-2 rounded-lg border bg-stone-50 hover:bg-stone-200 active:scale-95 cursor-pointer text-stone-800"
                    title="Lùi (S)"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-[9px] font-mono text-stone-600">Bấm phím W-A-S-D hoặc bấm nút</span>
              </div>
            )}

            {/* Selected Waypoint Floating Action Pill */}
            {selectedWaypoint && (() => {
              const tmpl = getEndpointTemplateInfo(selectedWaypoint.type);
              return (
                <div
                  className="absolute bottom-4 left-4 z-20 p-3 rounded-xl border shadow-xl flex items-center gap-3 animate-fadeIn"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#262626' }}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-1.5 py-0.2 text-[9px] font-mono font-bold rounded border uppercase"
                        style={{
                          backgroundColor: tmpl.bgColor,
                          color: tmpl.color,
                          borderColor: tmpl.borderColor,
                        }}
                      >
                        {tmpl.badge}
                      </span>
                      <span className="text-xs font-bold" style={{ color: '#94A3B8' }}>
                        {selectedWaypoint.name}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono mt-0.5" style={{ color: '#8C8C8C' }}>
                      X: {Number(selectedWaypoint.x).toFixed(2)}m, Y: {Number(selectedWaypoint.y).toFixed(2)}m • Yaw: {Number(selectedWaypoint.yaw || 0).toFixed(0)}°
                    </div>
                    {selectedWaypoint.description && (
                      <div className="text-[10px] text-stone-500 truncate max-w-xs mt-0.5">
                        {selectedWaypoint.description}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddWaypointToWorkflow(selectedWaypoint)}
                      className="px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors"
                      style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                      title="Nối điểm này vào Workflow"
                    >
                      + Nối vào Workflow
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditEndpointModal(selectedWaypoint)}
                      className="px-2 py-1 rounded text-xs font-bold border cursor-pointer hover:bg-stone-100"
                      style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                      title="Chỉnh sửa thông số Endpoint"
                    >
                      ✎ Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCanvasClickGoal(selectedWaypoint.x, selectedWaypoint.y)}
                      className="px-2 py-1 rounded text-xs font-bold border cursor-pointer hover:bg-stone-100"
                      style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                      title="Điều khiển robot đến điểm này"
                    >
                      Đến đây
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteConfirm(selectedWaypoint)}
                      className="px-2 py-1 rounded text-xs border cursor-pointer hover:text-red-700"
                      style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#8C8C8C' }}
                      title="Xóa Endpoint khỏi CSDL"
                    >
                      ✕
                    </button>

                  </div>
                </div>
              );
            })()}

            {/* Selected Zone Floating Action Pill */}
            {selectedZone && (() => {
              const tmpl = getZoneTemplateInfo(selectedZone.type);
              return (
                <div
                  className="absolute bottom-4 left-4 z-20 p-3 rounded-xl border shadow-xl flex items-center gap-3 animate-fadeIn"
                  style={{ backgroundColor: '#FFFFFF', borderColor: tmpl.color }}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-1.5 py-0.2 text-[9px] font-mono font-bold rounded border uppercase"
                        style={{
                          backgroundColor: tmpl.bgColor,
                          color: tmpl.color,
                          borderColor: tmpl.borderColor,
                        }}
                      >
                        {tmpl.badge}
                      </span>
                      <span className="text-xs font-bold" style={{ color: '#94A3B8' }}>
                        {selectedZone.name}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono mt-0.5" style={{ color: '#8C8C8C' }}>
                      Tâm (X: {Number(selectedZone.x).toFixed(2)}m, Y: {Number(selectedZone.y).toFixed(2)}m) • Size ({Number(selectedZone.width).toFixed(1)}m × {Number(selectedZone.height).toFixed(1)}m)
                      {selectedZone.type === 'SLOW_SPEED' && selectedZone.speed_limit && ` • MAX: ${selectedZone.speed_limit}m/s`}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditZoneModal(selectedZone)}
                      className="px-2 py-1 rounded text-xs font-bold border cursor-pointer hover:bg-stone-100"
                      style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                      title="Chỉnh sửa Vùng Chức Năng"
                    >
                      ✎ Sửa Vùng
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteZone(selectedZone.id, selectedZone.name)}
                      className="px-2 py-1 rounded text-xs border cursor-pointer hover:text-red-700"
                      style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#8C8C8C' }}
                      title="Xóa Vùng Chức Năng"
                    >
                      ✕ Xóa Vùng
                    </button>
                  </div>
                </div>
              );
            })()}
  </>
);
