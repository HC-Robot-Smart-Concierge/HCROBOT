import React from 'react';
import { LobbyFloorPlan } from './LobbyFloorPlan';
import { meterToSvg } from './workflowSimulatorUtils';
import { WorkflowSvgZonesAndEndpoints } from './WorkflowSvgZonesAndEndpoints';

/**
 * Interactive 2D hotel lobby SVG map rendering zones, endpoints,
 * obstacle-avoidance trajectory, and the live animated robot marker.
 */
export const WorkflowFloorPlanSvg = ({
  svgRef,
  dynamicViewBox,
  handleMapClick,
  handleWheelZoom,
  handleSvgPointerDown,
  handleSvgPointerMove,
  handleSvgPointerUp,
  isPanning,
  dragState,
  isZoneEditMode,
  setIsZoneEditMode,
  selectedZone,
  setSelectedZone,
  currentPath,
  zones,
  showZones,
  endpoints,
  selectedEndpoint,
  setSelectedEndpoint,
  hoveredEndpointId,
  setHoveredEndpointId,
  setIsEndpointEditMode,
  dragEndpointState,
  handleEndpointPointerDown,
  handleZonePointerDown,
  handleZoneClick,
  handleNavigateToGoal,
  robotPose,
  isMoving,
  robotStatus,
  onNotify,
}) => {
  return (
    <svg
      ref={svgRef}
      viewBox={dynamicViewBox}
      onClick={handleMapClick}
      onWheel={handleWheelZoom}
      onPointerDown={handleSvgPointerDown}
      onPointerMove={handleSvgPointerMove}
      onPointerUp={handleSvgPointerUp}
      className={`w-full h-full object-contain select-none ${
        isPanning
          ? 'cursor-grabbing'
          : dragState
          ? 'cursor-grabbing'
          : isZoneEditMode || selectedZone
          ? 'cursor-default'
          : 'cursor-crosshair'
      }`}
    >
      <rect x="0" y="0" width="560" height="385" fill="#F4F2ED" />

      <text x="35" y="24" className="text-xs font-mono font-bold tracking-wider" fill="#1c1917" fontFamily="sans-serif">
        Ground
      </text>
      <text x="95" y="24" className="text-[10px] font-mono" fill="#8C8C8C" fontFamily="sans-serif">
        Sảnh Khách Sạn • 19.60m x 12.60m (490x315 • Gazebo 1:1)
      </text>

      <LobbyFloorPlan />

      <WorkflowSvgZonesAndEndpoints
        currentPath={currentPath}
        zones={zones}
        showZones={showZones}
        selectedZone={selectedZone}
        setSelectedZone={setSelectedZone}
        isZoneEditMode={isZoneEditMode}
        setIsZoneEditMode={setIsZoneEditMode}
        dragState={dragState}
        endpoints={endpoints}
        selectedEndpoint={selectedEndpoint}
        setSelectedEndpoint={setSelectedEndpoint}
        hoveredEndpointId={hoveredEndpointId}
        setHoveredEndpointId={setHoveredEndpointId}
        setIsEndpointEditMode={setIsEndpointEditMode}
        dragEndpointState={dragEndpointState}
        handleEndpointPointerDown={handleEndpointPointerDown}
        handleZonePointerDown={handleZonePointerDown}
        handleSvgPointerUp={handleSvgPointerUp}
        handleZoneClick={handleZoneClick}
        handleNavigateToGoal={handleNavigateToGoal}
        onNotify={onNotify}
      />

      {currentPath?.waypoints?.length > 1 && (() => {
        const pathData = currentPath.waypoints
          .map((pt, idx) => {
            const s = meterToSvg(pt.x, pt.y);
            return `${idx === 0 ? 'M' : 'L'} ${s.x} ${s.y}`;
          })
          .join(' ');

        const curSvg = meterToSvg(robotPose.x, robotPose.y);
        const targetSvg = meterToSvg(
          currentPath.targetPoint.x,
          currentPath.targetPoint.y
        );
        const targetLabel = currentPath.label || 'Đích Đến';
        const labelWidth = Math.max(42, targetLabel.length * 3.8 + 10);

        // Tinh toan vet duong da lan banh qua (bam theo cac waypoints da di qua, tuyet doi khong ve duong thang cat xuyen tuong)
        const traveledPathData = (() => {
          const pts = currentPath.waypoints;
          const traveledPts = [pts[0]];
          let foundCurrentSeg = false;

          for (let i = 0; i < pts.length - 1; i++) {
            const pA = pts[i];
            const pB = pts[i + 1];
            const segLen = Math.hypot(pB.x - pA.x, pB.y - pA.y);
            if (segLen < 0.001) continue;

            const vAx = robotPose.x - pA.x;
            const vAy = robotPose.y - pA.y;
            const vABx = pB.x - pA.x;
            const vABy = pB.y - pA.y;
            const proj = (vAx * vABx + vAy * vABy) / (segLen * segLen);

            const clampedProj = Math.max(0, Math.min(1, proj));
            const closestX = pA.x + clampedProj * vABx;
            const closestY = pA.y + clampedProj * vABy;
            const distToSeg = Math.hypot(robotPose.x - closestX, robotPose.y - closestY);

            if (distToSeg < 0.6 && proj >= -0.15 && proj <= 1.05) {
              traveledPts.push({ x: robotPose.x, y: robotPose.y });
              foundCurrentSeg = true;
              break;
            } else {
              traveledPts.push(pB);
            }
          }

          if (!foundCurrentSeg && traveledPts.length > 0) {
            traveledPts.push({ x: robotPose.x, y: robotPose.y });
          }

          return traveledPts
            .map((pt, idx) => {
              const s = meterToSvg(pt.x, pt.y);
              return `${idx === 0 ? 'M' : 'L'} ${s.x} ${s.y}`;
            })
            .join(' ');
        })();

        return (
          <g>
            {/* 1. Duong dan huong ne tuong (Polyline uon quanh qua cua mo - Mau nhat thanh lich) */}
            <path
              d={pathData}
              fill="none"
              stroke="#94A3B8"
              strokeWidth="1.6"
              strokeDasharray="4 3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.55"
            />

            {/* 2. Vet duong robot da lan banh qua toi vi tri hien tai (Mau Slate nhat diu mat, khong bi dam den) */}
            <path
              d={traveledPathData}
              fill="none"
              stroke="#475569"
              strokeWidth="2.0"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.65"
            />

            {/* 3. Vong tron dich den tinh gon gang */}
            <g>
              <circle
                cx={targetSvg.x}
                cy={targetSvg.y}
                r="10"
                fill="rgba(71, 85, 105, 0.04)"
                stroke="#64748B"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                strokeOpacity="0.55"
              />
              <g transform={`translate(${targetSvg.x}, ${targetSvg.y - 9.5})`}>
                <rect
                  x={-labelWidth / 2}
                  y="-5"
                  width={labelWidth}
                  height="10"
                  rx="2"
                  fill="#334155"
                  fillOpacity="0.92"
                  stroke="#475569"
                  strokeWidth="0.8"
                  filter="drop-shadow(0 1px 2px rgba(0,0,0,0.10))"
                />
                <text
                  x="0"
                  y="1.8"
                  textAnchor="middle"
                  className="text-[5.2px] font-bold fill-white tracking-wide"
                  fontFamily="sans-serif"
                >
                  {targetLabel}
                </text>
              </g>
            </g>
          </g>
        );
      })()}

      {/* ROBOT MARKER KEM BONG BONG ACTION HUD THONG MINH TREN DAU ROBOT */}
      {(() => {
        const robotSvg = meterToSvg(robotPose.x, robotPose.y);
        const svgAngle = -(robotPose.yaw * 180) / Math.PI;

        return (
          <g transform={`translate(${robotSvg.x}, ${robotSvg.y})`}>
            {/* BONG BONG TRANG THAI TINH GON TREN DAU ROBOT (Ty le nho gon, tinh te) */}
            {(() => {
              const statusText = robotStatus.label;
              const pillWidth = Math.max(46, statusText.length * 4.2 + 14);
              return (
                <g transform="translate(0, -12)" className="pointer-events-none select-none">
                  {/* Card nen trang tinh te */}
                  <rect
                    x={-pillWidth / 2}
                    y="-5.5"
                    width={pillWidth}
                    height="11"
                    rx="2.5"
                    fill="#FFFFFF"
                    stroke="#BFBFBD"
                    strokeWidth="0.8"
                    filter="drop-shadow(0 1px 3px rgba(0,0,0,0.12))"
                  />
                  {/* Mui ten tro xuong robot */}
                  <polygon points="-2,5.5 2,5.5 0,8.5" fill="#FFFFFF" stroke="#BFBFBD" strokeWidth="0.8" />
                  <line x1="-1.8" y1="5.5" x2="1.8" y2="5.5" stroke="#FFFFFF" strokeWidth="1.2" />

                  {/* Dot trang thai nho */}
                  <circle
                    cx={-pillWidth / 2 + 5.5}
                    cy="0"
                    r="1.6"
                    fill={robotStatus.dotColor}
                    className={robotStatus.isMoving ? 'animate-pulse' : ''}
                  />

                  {/* Chu trang thai cua robot */}
                  <text
                    x="2"
                    y="1.8"
                    textAnchor="middle"
                    className="text-[5.5px] font-bold tracking-wider uppercase"
                    fill="#262626"
                    fontFamily="sans-serif"
                  >
                    {statusText}
                  </text>
                </g>
              );
            })()}

            {/* Robot hinh chu nhat mau xam don gian, toi gian ky thuat (Kich thuoc nho gon hon) */}
            <g transform={`rotate(${svgAngle})`}>
              {/* 2 Banh xe mau xam den o 2 ben hong xe */}
              <rect x="-5" y="-8.5" width="10" height="2.2" rx="0.5" fill="#18181b" />
              <rect x="-5" y="6.3" width="10" height="2.2" rx="0.5" fill="#18181b" />

              {/* Than xe hinh chu nhat mau xam toi gian */}
              <rect
                x="-8"
                y="-6"
                width="16"
                height="12"
                rx="2"
                fill="#64748b"
                stroke="#334155"
                strokeWidth="1.2"
                filter="drop-shadow(0 1px 3px rgba(0,0,0,0.15))"
              />

              {/* Tam LiDAR nho mau xam dam */}
              <circle cx="-2" cy="0" r="2.2" fill="#334155" stroke="#94a3b8" strokeWidth="0.6" />
              <circle cx="-2" cy="0" r="0.8" fill="#cbd5e1" />

              {/* Mui ten chi huong dau xe (+X) mau trang tinh gon */}
              <polygon points="6,0 3,-2.2 3,2.2" fill="#ffffff" />
            </g>
          </g>
        );
      })()}
      </svg>
  );
};
