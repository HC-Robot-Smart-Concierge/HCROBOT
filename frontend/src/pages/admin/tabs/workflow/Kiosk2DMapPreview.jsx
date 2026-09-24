import React from 'react';
import { Compass, MapPin, Gauge, ShieldCheck } from 'lucide-react';

export const Kiosk2DMapPreview = ({ activeStep }) => {
  const params = activeStep?.params || {};
  const isMove = activeStep?.type === 'MOVE';
  const waypointName = params.waypoint_name || params.target_value || 'Quầy Lễ Tân';
  const speed = params.speed || 0.4;

  // Waypoint coordinate map for 2D SVG
  const WAYPOINT_POSITIONS = {
    DOCK_01: { x: 60, y: 170, label: 'Trạm Sạc (Dock)' },
    'wp-reception': { x: 60, y: 170, label: 'Quầy Lễ Tân' },
    ZONE_LOBBY: { x: 130, y: 150, label: 'Sảnh Đón Khách' },
    HOTSPOT_LOBBY: { x: 200, y: 160, label: 'Điểm Đông Người' },
    'wp-lounge': { x: 100, y: 70, label: 'Sảnh Lounge' },
    'wp-vip-table': { x: 180, y: 75, label: 'Bàn VIP 01' },
    'wp-elevator': { x: 290, y: 65, label: 'Cụm Thang Máy A' },
    RESTAURANT_GATE: { x: 310, y: 160, label: 'Cửa Nhà Hàng Tầng 1' },
  };

  // Determine target coordinates
  let targetCoord = { x: 200, y: 120, label: waypointName };
  const lowerName = waypointName.toLowerCase();
  if (lowerName.includes('nhà hàng') || lowerName.includes('restaurant')) {
    targetCoord = WAYPOINT_POSITIONS.RESTAURANT_GATE;
  } else if (lowerName.includes('lễ tân') || lowerName.includes('dock') || lowerName.includes('trạm')) {
    targetCoord = WAYPOINT_POSITIONS.DOCK_01;
  } else if (lowerName.includes('đông người') || lowerName.includes('hotspot')) {
    targetCoord = WAYPOINT_POSITIONS.HOTSPOT_LOBBY;
  } else if (lowerName.includes('sảnh') || lowerName.includes('đón')) {
    targetCoord = WAYPOINT_POSITIONS.ZONE_LOBBY;
  } else if (lowerName.includes('vip')) {
    targetCoord = WAYPOINT_POSITIONS['wp-vip-table'];
  } else if (lowerName.includes('thang máy')) {
    targetCoord = WAYPOINT_POSITIONS['wp-elevator'];
  } else if (lowerName.includes('lounge')) {
    targetCoord = WAYPOINT_POSITIONS['wp-lounge'];
  }

  // Start coordinate
  const startCoord = lowerName.includes('dock') || lowerName.includes('lễ tân')
    ? WAYPOINT_POSITIONS.RESTAURANT_GATE
    : WAYPOINT_POSITIONS.DOCK_01;

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
        <svg
          viewBox="0 0 380 220"
          className="w-full h-auto select-none"
          style={{ filter: 'drop-shadow(0 0 12px rgba(6,182,212,0.25))' }}
        >
          {/* Grid pattern */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="0.5" />
            </pattern>
            <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="1" />
            </linearGradient>
          </defs>
          <rect width="380" height="220" fill="url(#grid)" />

          {/* Lobby Wall Boundaries */}
          <rect x="20" y="20" width="340" height="180" rx="16" fill="none" stroke="#334155" strokeWidth="2" />
          <rect x="30" y="30" width="130" height="80" rx="10" fill="rgba(30, 41, 59, 0.7)" stroke="#475569" strokeWidth="1" />
          <text x="95" y="75" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">SẢNH LOUNGE & CAFE</text>

          <rect x="240" y="30" width="110" height="60" rx="10" fill="rgba(30, 41, 59, 0.7)" stroke="#475569" strokeWidth="1" />
          <text x="295" y="65" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">THANG MÁY A</text>

          <rect x="230" y="115" width="120" height="75" rx="10" fill="rgba(6, 182, 212, 0.12)" stroke="#22d3ee" strokeWidth="1" strokeDasharray="3,3" />
          <text x="290" y="155" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle">🍽️ NHÀ HÀNG TẦNG 1</text>

          {/* All Waypoint Dots */}
          {Object.entries(WAYPOINT_POSITIONS).map(([key, wp]) => {
            const isTarget = wp.label === targetCoord.label;
            return (
              <g key={key}>
                <circle
                  cx={wp.x}
                  cy={wp.y}
                  r={isTarget ? 5.5 : 3.5}
                  fill={isTarget ? '#f59e0b' : '#64748b'}
                  stroke={isTarget ? '#ffffff' : '#1e293b'}
                  strokeWidth="1.5"
                />
                <text
                  x={wp.x}
                  y={wp.y - 7}
                  fill={isTarget ? '#fbbf24' : '#cbd5e1'}
                  fontSize="7.5"
                  fontWeight={isTarget ? 'bold' : 'normal'}
                  textAnchor="middle"
                >
                  {wp.label}
                </text>
              </g>
            );
          })}

          {/* Navigation Route Path */}
          {isMove && (
            <>
              <line
                x1={startCoord.x}
                y1={startCoord.y}
                x2={targetCoord.x}
                y2={targetCoord.y}
                stroke="url(#routeGrad)"
                strokeWidth="2.5"
                strokeDasharray="4,4"
                className="animate-pulse"
              />
              <circle cx={targetCoord.x} cy={targetCoord.y} r="10" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.8">
                <animate attributeName="r" values="6;15;6" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0.1;0.9" dur="2s" repeatCount="indefinite" />
              </circle>
            </>
          )}

          {/* Active Robot Marker */}
          <g transform={`translate(${isMove ? (startCoord.x + targetCoord.x) / 2 : targetCoord.x}, ${isMove ? (startCoord.y + targetCoord.y) / 2 : targetCoord.y})`}>
            <circle cx="0" cy="0" r="10" fill="rgba(6, 182, 212, 0.4)" />
            <circle cx="0" cy="0" r="5.5" fill="#06b6d4" stroke="#ffffff" strokeWidth="2" />
            <text x="0" y="17" fill="#7dd3fc" fontSize="8" fontWeight="bold" textAnchor="middle">
              🤖 RC-001
            </text>
          </g>
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
            <span className="font-extrabold text-stone-900 truncate block">{targetCoord.label}</span>
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
