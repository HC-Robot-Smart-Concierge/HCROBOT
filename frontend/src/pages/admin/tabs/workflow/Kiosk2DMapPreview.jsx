import React from 'react';
import { Compass, MapPin, Gauge, ShieldCheck } from 'lucide-react';

import { LobbyFloorPlan } from './LobbyFloorPlan';
import {
  calculateSafeWaypoints, GAZEBO_LOBBY_WAYPOINTS, meterToSvg, resolveMoveTarget, ROBOT_INITIAL_POSE,
} from './workflowSimulatorUtils';

export const Kiosk2DMapPreview = ({ activeStep }) => {
  const params = activeStep?.params || {};
  const isMove = activeStep?.type === 'MOVE';
  const waypointName = params.waypoint_name || params.target_value || 'Quầy Lễ Tân';
  const speed = params.speed || 0.4;

  const target = resolveMoveTarget(activeStep);
  const start = GAZEBO_LOBBY_WAYPOINTS[params.from_waypoint] || ROBOT_INITIAL_POSE;
  const startPixel = meterToSvg(start.x, start.y);
  const targetPixel = meterToSvg(target.x, target.y);
  const route = isMove
    ? calculateSafeWaypoints(start, target).map(point => {
        const { x, y } = meterToSvg(point.x, point.y);
        return `${x},${y}`;
      }).join(' ')
    : '';

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      {/* Header HUD */}
      <div className="flex items-center justify-between pb-1 border-b border-stone-200">
        <h4 className="text-xs font-black text-cyan-800 flex items-center gap-1.5 uppercase tracking-wide">
          <Compass className="w-4 h-4 text-cyan-600 animate-spin" />
          {isMove ? 'Bản Đồ 2D Điều Hướng Tự Hành (SLAM + LiDAR)' : 'Sơ Đồ Bản Đồ Sảnh Tầng 1 (Floor Map)'}
        </h4>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-100 text-cyan-900 border border-cyan-300">
          TẦNG 1 • LOBBY
        </span>
      </div>

      {/* Interactive 2D Floor Plan Blueprint */}
      <div className="relative rounded-2xl bg-[#09101d] border-2 border-cyan-400/40 p-2 overflow-hidden shadow-xl">
        <svg viewBox="35 35 490 315" className="w-full h-auto select-none" aria-label="Bản đồ sảnh tầng trệt">
          <LobbyFloorPlan />
          {route && <polyline points={route} fill="none" stroke="#0891b2" strokeWidth="2.5" strokeDasharray="4 4" />}
          <circle cx={startPixel.x} cy={startPixel.y} r="5" fill="#0891b2" stroke="white" strokeWidth="2">
            <title>RC-001</title>
          </circle>
          <circle cx={targetPixel.x} cy={targetPixel.y} r="5" fill="#f59e0b" stroke="white" strokeWidth="2">
            <title>{waypointName}</title>
          </circle>
        </svg>
      </div>

      {/* Luminous Telemetry Footer Cards */}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div className="p-2.5 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div className="truncate">
            <span className="text-[9px] text-stone-400 block uppercase font-bold">Đích đến:</span>
            <span className="font-extrabold text-stone-900 truncate block">{waypointName}</span>
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
            <Gauge className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[9px] text-stone-400 block uppercase font-bold">Vận tốc Nav2:</span>
            <span className="font-mono font-black text-cyan-800">{speed} m/s</span>
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[9px] text-stone-400 block uppercase font-bold">Trạng thái:</span>
            <span className="font-bold text-emerald-700">{isMove ? 'Đang dẫn đường' : 'Đã định vị'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
