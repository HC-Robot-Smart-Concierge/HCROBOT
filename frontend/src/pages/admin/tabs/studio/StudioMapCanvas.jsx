import React from 'react';
import { LidarCanvas } from '../../../../components/admin/LidarCanvas';
import { getEndpointTemplateInfo } from './studioConstants';

export const StudioMapCanvas = ({
  scanPoints,
  gridData,
  gridMetadata,
  robotPose,
  waypoints,
  activeWf,
  highlightedWpId,
  keepOutZones,
  isPinMode,
  selectedWaypoint,
  onCanvasClickGoal,
  onCanvasClickPin,
  onSelectWaypointFromMap,
  onAddWaypointToWorkflow,
  onOpenEditEndpointModal,
  onOpenDeleteConfirm,
}) => {
  return (
    <div
      className="col-span-8 lg:col-span-9 h-full relative overflow-hidden flex flex-col border-r"
      style={{ borderColor: '#BFBFBD' }}
    >
      <div className="w-full flex-1 relative overflow-hidden">
        <LidarCanvas
          scanPoints={scanPoints}
          gridData={gridData}
          gridMetadata={gridMetadata}
          robotPose={{ x: robotPose.x, y: robotPose.y, yaw: robotPose.yaw }}
          waypoints={waypoints}
          workflowSteps={activeWf?.steps || []}
          highlightedWaypointId={highlightedWpId}
          keepOutZones={keepOutZones}
          onCanvasClickGoal={onCanvasClickGoal}
          onCanvasClickWaypointPin={onCanvasClickPin}
          onSelectWaypoint={onSelectWaypointFromMap}
          isPinMode={isPinMode}
          showGridMap={true}
          showGridLines={true}
          showScanRays={true}
          showWaypoints={true}
        />

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
                  <span className="text-xs font-bold" style={{ color: '#262626' }}>
                    {selectedWaypoint.name}
                  </span>
                </div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: '#8C8C8C' }}>
                  {selectedWaypoint.floor} • X: {Number(selectedWaypoint.x).toFixed(2)}m, Y:{' '}
                  {Number(selectedWaypoint.y).toFixed(2)}m • Yaw:{' '}
                  {Number(selectedWaypoint.yaw || 0).toFixed(0)}°
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
                  onClick={() => onAddWaypointToWorkflow(selectedWaypoint)}
                  className="px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors"
                  style={{ backgroundColor: '#8B5CF6', color: '#FFFFFF' }}
                  title="Nối điểm này vào Workflow"
                >
                  + Nối vào Workflow
                </button>
                <button
                  type="button"
                  onClick={() => onOpenEditEndpointModal(selectedWaypoint)}
                  className="px-2 py-1 rounded text-xs font-bold border cursor-pointer hover:bg-stone-100"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                  title="Chỉnh sửa thông số Endpoint"
                >
                  ✎ Sửa
                </button>
                <button
                  type="button"
                  onClick={() => onCanvasClickGoal(selectedWaypoint.x, selectedWaypoint.y)}
                  className="px-2 py-1 rounded text-xs font-bold border cursor-pointer hover:bg-stone-100"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                  title="Điều khiển robot đến điểm này"
                >
                  Đến đây
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDeleteConfirm(selectedWaypoint)}
                  className="px-2 py-1 rounded text-xs border cursor-pointer hover:text-red-700"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#8C8C8C' }}
                  title="Xóa Endpoint khỏi CSDL"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Bottom Telemetry Mini Bar */}
      <div
        className="h-8 border-t px-4 shrink-0 flex items-center justify-between text-[11px] font-mono"
        style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#8C8C8C' }}
      >
        <div className="flex items-center gap-4">
          <span>
            X: <strong style={{ color: '#262626' }}>{Number(robotPose.x).toFixed(2)}m</strong>
          </span>
          <span>
            Y: <strong style={{ color: '#262626' }}>{Number(robotPose.y).toFixed(2)}m</strong>
          </span>
          <span>
            YAW: <strong style={{ color: '#262626' }}>{Number(robotPose.yaw).toFixed(0)}°</strong>
          </span>
          <span>
            PIN: <strong style={{ color: '#262626' }}>{robotPose.battery}%</strong>
          </span>
        </div>
        <span>CHẾ ĐỘ TÍCH HỢP BẢN ĐỒ &amp; WORKFLOWS</span>
      </div>
    </div>
  );
};
