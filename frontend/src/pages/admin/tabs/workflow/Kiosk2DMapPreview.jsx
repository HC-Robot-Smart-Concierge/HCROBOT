import React from 'react';
import { Compass, Navigation, MapPin, Gauge, ShieldCheck, Footprints } from 'lucide-react';

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

  // Start coordinate (starts near dock if going somewhere, or near restaurant if returning)
  const startCoord = lowerName.includes('dock') || lowerName.includes('lễ tân')
    ? WAYPOINT_POSITIONS.RESTAURANT_GATE
    : WAYPOINT_POSITIONS.DOCK_01;

  return (
    <div className="space-y-2.5 animate-in fade-in duration-300">
      {/* Header HUD */}
      <div className="flex items-center justify-between pb-1 border-b border-stone-800">
        <h4 className="text-xs font-black text-cyan-300 flex items-center gap-1.5 uppercase tracking-wide">
          <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
          {isMove ? 'Bản Đồ 2D Điều Hướng Tự Hành (SLAM + LiDAR)' : 'Sơ Đồ Bản Đồ Sảnh Tầng 1 (Floor Map)'}
        </h4>
        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
          TẦNG 1 • LOBBY
        </span>
      </div>

      {/* Interactive 2D Floor Plan SVG */}
      <div className="relative rounded-2xl bg-[#0b0f19] border border-cyan-500/30 p-2 overflow-hidden shadow-2xl">
        <svg
          viewBox="0 0 380 220"
          className="w-full h-auto select-none"
          style={{ filter: 'drop-shadow(0 0 12px rgba(6,182,212,0.15))' }}
        >
          {/* Subtle Grid Lines */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="0.5" />
            </pattern>
            <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="1" />
            </linearGradient>
          </defs>
          <rect width="380" height="220" fill="url(#grid)" />

          {/* Lobby Wall Boundaries */}
          <rect x="20" y="20" width="340" height="180" rx="16" fill="none" stroke="#1e293b" strokeWidth="2" />
          <rect x="30" y="30" width="130" height="80" rx="10" fill="rgba(15, 23, 42, 0.6)" stroke="#334155" strokeWidth="1" />
          <text x="95" y="75" fill="#64748b" fontSize="8" fontWeight="bold" textAnchor="middle">SẢNH LOUNGE & CAFE</text>

          <rect x="240" y="30" width="110" height="60" rx="10" fill="rgba(15, 23, 42, 0.6)" stroke="#334155" strokeWidth="1" />
          <text x="295" y="65" fill="#64748b" fontSize="8" fontWeight="bold" textAnchor="middle">THANG MÁY A</text>

          <rect x="230" y="115" width="120" height="75" rx="10" fill="rgba(6, 182, 212, 0.08)" stroke="#0e7490" strokeWidth="1" strokeDasharray="3,3" />
          <text x="290" y="155" fill="#22d3ee" fontSize="9" fontWeight="bold" textAnchor="middle">🍽️ NHÀ HÀNG TẦNG 1</text>

          {/* All Waypoint Dots */}
          {Object.entries(WAYPOINT_POSITIONS).map(([key, wp]) => {
            const isTarget = wp.label === targetCoord.label;
            return (
              <g key={key}>
                <circle
                  cx={wp.x}
                  cy={wp.y}
                  r={isTarget ? 5 : 3}
                  fill={isTarget ? '#f59e0b' : '#475569'}
                  stroke={isTarget ? '#fef3c7' : '#1e293b'}
                  strokeWidth="1.5"
                />
                <text
                  x={wp.x}
                  y={wp.y - 7}
                  fill={isTarget ? '#fbbf24' : '#94a3b8'}
                  fontSize="7"
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
              {/* Waypoint Destination Pulse */}
              <circle cx={targetCoord.x} cy={targetCoord.y} r="10" fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.6">
                <animate attributeName="r" values="6;14;6" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2s" repeatCount="indefinite" />
              </circle>
            </>
          )}

          {/* Active Robot Marker (Animates towards target) */}
          <g transform={`translate(${isMove ? (startCoord.x + targetCoord.x) / 2 : targetCoord.x}, ${isMove ? (startCoord.y + targetCoord.y) / 2 : targetCoord.y})`}>
            {/* Robot Beacon Rings */}
            <circle cx="0" cy="0" r="9" fill="rgba(6, 182, 212, 0.3)" />
            <circle cx="0" cy="0" r="5" fill="#06b6d4" stroke="#ffffff" strokeWidth="1.5" />
            <text x="0" y="16" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">
              🤖 RC-001
            </text>
          </g>
        </svg>
      </div>

      {/* Telemetry Footer */}
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div className="p-2 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <div className="truncate">
            <span className="text-[9px] text-stone-500 block">Đích đến:</span>
            <span className="font-bold text-stone-200 truncate block">{targetCoord.label}</span>
          </div>
        </div>

        <div className="p-2 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <div>
            <span className="text-[9px] text-stone-500 block">Vận tốc Nav2:</span>
            <span className="font-mono font-bold text-cyan-300">{speed} m/s</span>
          </div>
        </div>

        <div className="p-2 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div>
            <span className="text-[9px] text-stone-500 block">Trạng thái:</span>
            <span className="font-bold text-emerald-300">{isMove ? 'Đang dẫn đường' : 'Đã định vị'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
