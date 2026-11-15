import React from 'react';
import {
  getZoneTemplateInfo,
  OTTO_ENDPOINT_TEMPLATES,
  getEndpointTemplateInfo,
} from './unifiedStudioTemplates';

export const AdminUnifiedStudioWaypointsZonesTabs = ({
  sideTab,
  waypoints,
  keepOutZones,
  templateFilter,
  setTemplateFilter,
  selectedWaypoint,
  highlightedWpId,
  selectedZone,
  handleOpenAddEndpointModal,
  handleSelectWaypointFromMap,
  handleCanvasClickGoal,
  handleAddWaypointToWorkflow,
  handleOpenEditEndpointModal,
  handleOpenDeleteConfirm,
  handleOpenAddZoneModal,
  handleSelectZoneFromMap,
  handleOpenEditZoneModal,
  handleDeleteZone,
}) => (
  <>
          {/* TAB 2: ENDPOINTS & WAYPOINTS LIST (OTTO CONCEPT) */}
          {sideTab === 'waypoints' && (
            <div className="flex-1 min-h-0 p-3 overflow-y-auto space-y-2.5 flex flex-col">
              {/* Header & Add Button */}
              <div className="flex items-center justify-between shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#8C8C8C' }}>
                  ENDPOINTS TRÊN BẢN ĐỒ ({waypoints.length})
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenAddEndpointModal()}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors shadow-sm"
                  style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                >
                  + Thêm Endpoint
                </button>
              </div>

              {/* Template Filter Pills */}
              <div className="flex flex-wrap gap-1 shrink-0 pb-1 border-b" style={{ borderColor: '#E9E5DC' }}>
                <button
                  type="button"
                  onClick={() => setTemplateFilter('ALL')}
                  className="px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer"
                  style={{
                    backgroundColor: templateFilter === 'ALL' ? '#262626' : '#FFFFFF',
                    color: templateFilter === 'ALL' ? '#FFFFFF' : '#8C8C8C',
                    borderColor: '#CBD5E1',
                  }}
                >
                  Tất cả ({waypoints.length})
                </button>
                {OTTO_ENDPOINT_TEMPLATES.map((tmpl) => {
                  const count = waypoints.filter((w) => (w.type || 'WAYPOINT') === tmpl.type).length;
                  if (count === 0 && templateFilter !== tmpl.type) return null;
                  const isActive = templateFilter === tmpl.type;
                  return (
                    <button
                      key={tmpl.type}
                      type="button"
                      onClick={() => setTemplateFilter(tmpl.type)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer"
                      style={{
                        backgroundColor: isActive ? tmpl.color : '#FFFFFF',
                        color: isActive ? '#FFFFFF' : tmpl.color,
                        borderColor: tmpl.borderColor,
                      }}
                    >
                      {tmpl.badge} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Endpoints List */}
              <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                {waypoints
                  .filter((wp) => templateFilter === 'ALL' || (wp.type || 'WAYPOINT') === templateFilter)
                  .map((wp) => {
                    const tmpl = getEndpointTemplateInfo(wp.type);
                    const isSelected = selectedWaypoint?.id === wp.id;
                    return (
                      <div
                        key={wp.id}
                        className="p-2.5 rounded-xl border text-xs space-y-1.5 transition-colors cursor-pointer hover:bg-stone-50"
                        style={{
                          backgroundColor: isSelected || highlightedWpId === wp.id ? '#F5F3FF' : '#FFFFFF',
                          borderColor: isSelected || highlightedWpId === wp.id ? tmpl.color : '#BFBFBD',
                        }}
                        onClick={() => handleSelectWaypointFromMap(wp)}
                        onMouseEnter={() => setHighlightedWpId(wp.id)}
                        onMouseLeave={() => setHighlightedWpId(null)}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border uppercase shrink-0"
                              style={{
                                backgroundColor: tmpl.bgColor,
                                color: tmpl.color,
                                borderColor: tmpl.borderColor,
                              }}
                            >
                              {tmpl.badge}
                            </span>
                            <span className="font-bold text-xs truncate" style={{ color: '#94A3B8' }}>
                              {wp.name}
                            </span>
                          </div>

                          {/* Quick Action Buttons */}
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditEndpointModal(wp)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer hover:bg-stone-100"
                              style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                              title="Chỉnh sửa Endpoint"
                            >
                              ✎ Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddWaypointToWorkflow(wp)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                              style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                              title="Nối điểm này vào Workflow"
                            >
                              + Nối
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCanvasClickGoal(wp.x, wp.y)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer hover:bg-stone-100"
                              style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                              title="Điều khiển robot đến điểm này"
                            >
                              Đến
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteConfirm(wp)}
                              className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer hover:text-red-700 hover:bg-red-50"
                              style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#8C8C8C' }}
                              title="Xóa Endpoint khỏi CSDL"
                            >
                              ✕
                            </button>

                          </div>
                        </div>

                        {/* Coordinates & Tasks */}
                        <div className="text-[10px] font-mono flex items-center justify-between" style={{ color: '#8C8C8C' }}>
                          <span>X: {Number(wp.x).toFixed(2)}m, Y: {Number(wp.y).toFixed(2)}m</span>
                          <span>Yaw: {Number(wp.yaw || 0).toFixed(0)}°</span>
                        </div>

                        {wp.description && (
                          <div className="text-[10px] text-stone-500 italic truncate">
                            {wp.description}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 3: FUNCTIONAL ZONES LIST */}
          {sideTab === 'zones' && (
            <div className="flex-1 min-h-0 p-3 overflow-y-auto space-y-2.5 flex flex-col">
              <div className="flex items-center justify-between shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#8C8C8C' }}>
                  VÙNG CHỨC NĂNG SẢNH ({keepOutZones.length})
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenAddZoneModal()}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors shadow-sm"
                  style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                >
                  + Thêm Vùng
                </button>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                {keepOutZones.length === 0 ? (
                  <div className="text-center py-6 text-xs text-stone-500 italic">
                    Chưa có Vùng Chức Năng nào. Nhấn "+ Thêm Vùng" để tạo mới.
                  </div>
                ) : (
                  keepOutZones.map((z) => {
                    const tmpl = getZoneTemplateInfo(z.type);
                    const isSelected = selectedZone?.id === z.id;
                    return (
                      <div
                        key={z.id}
                        onClick={() => handleSelectZoneFromMap(z)}
                        className="p-2.5 rounded-xl border text-xs space-y-1.5 transition-colors cursor-pointer hover:bg-stone-50"
                        style={{
                          backgroundColor: isSelected ? tmpl.bgColor : '#FFFFFF',
                          borderColor: isSelected ? tmpl.color : '#BFBFBD',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border uppercase shrink-0"
                              style={{
                                backgroundColor: tmpl.bgColor,
                                color: tmpl.color,
                                borderColor: tmpl.borderColor,
                              }}
                            >
                              {tmpl.badge}
                            </span>
                            <span className="font-bold text-xs truncate" style={{ color: '#94A3B8' }}>
                              {z.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditZoneModal(z)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer hover:bg-stone-100"
                              style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#94A3B8' }}
                              title="Chỉnh sửa Vùng"
                            >
                              ✎ Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteZone(z.id, z.name)}
                              className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer hover:text-red-700 hover:bg-red-50"
                              style={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#8C8C8C' }}
                              title="Xóa Vùng"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        <div className="text-[10px] font-mono flex items-center justify-between" style={{ color: '#8C8C8C' }}>
                          <span>Tâm X: {Number(z.x).toFixed(2)}m, Y: {Number(z.y).toFixed(2)}m</span>
                          <span>Size: {Number(z.width).toFixed(1)}m × {Number(z.height).toFixed(1)}m</span>
                        </div>

                        {z.description && (
                          <div className="text-[10px] text-stone-500 italic truncate">
                            {z.description}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
  </>
);
