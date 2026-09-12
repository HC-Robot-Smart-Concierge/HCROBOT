import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Crosshair } from 'lucide-react';

export const LidarCanvas = ({
  scanPoints = [],
  gridData = [],
  gridMetadata = { width: 200, height: 200, resolution: 0.05, origin_x: -5.0, origin_y: -5.0 },
  robotPose = { x: 0, y: 0, yaw: 0 },
  waypoints = [],
  workflowSteps = [],
  highlightedWaypointId = null,
  keepOutZones = [],
  selectedZoneId = null,
  onCanvasClickGoal,
  onCanvasClickWaypointPin,
  onSelectWaypoint,
  onSelectZone,
  isPinMode = false,
  showGridMap = true,
  showGridLines = true,
  showScanRays = true,
  showWaypoints = true,
}) => {
  const canvasRef = useRef(null);

  // Scale (pixels per meter) & Pan offset
  const [scale, setScale] = useState(45.0); // 45px = 1m
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedGoal, setSelectedGoal] = useState(null);

  // Helper đổi tọa độ mét (thế giới) -> pixel Canvas
  const worldToCanvas = useCallback(
    (worldX, worldY, canvasWidth, canvasHeight) => {
      const centerX = canvasWidth / 2 + panOffset.x;
      const centerY = canvasHeight / 2 + panOffset.y;

      const px = centerX + worldX * scale;
      const py = centerY - worldY * scale; // Trục Y ngược chiều

      return { px, py };
    },
    [scale, panOffset]
  );

  // Helper đổi pixel Canvas -> tọa độ mét (thế giới)
  const canvasToWorld = useCallback(
    (px, py, canvasWidth, canvasHeight) => {
      const centerX = canvasWidth / 2 + panOffset.x;
      const centerY = canvasHeight / 2 + panOffset.y;

      const worldX = (px - centerX) / scale;
      const worldY = (centerY - py) / scale;

      return { worldX, worldY };
    },
    [scale, panOffset]
  );

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasClick = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const { worldX, worldY } = canvasToWorld(
      px,
      py,
      canvasRef.current.width,
      canvasRef.current.height
    );

    const goalPos = { x: Number(worldX.toFixed(2)), y: Number(worldY.toFixed(2)) };

    // 1. Check if clicking on an existing waypoint
    if (!isPinMode && waypoints && waypoints.length > 0 && onSelectWaypoint) {
      for (const wp of waypoints) {
        const wpCanvas = worldToCanvas(wp.x, wp.y, canvasRef.current.width, canvasRef.current.height);
        const dist = Math.hypot(px - wpCanvas.px, py - wpCanvas.py);
        if (dist <= 18) {
          onSelectWaypoint(wp);
          return;
        }
      }
    }

    // 2. Check if clicking inside a Zone bounding box
    if (!isPinMode && keepOutZones && keepOutZones.length > 0 && onSelectZone) {
      for (const zone of keepOutZones) {
        const topLeft = worldToCanvas(zone.x - zone.width / 2, zone.y + zone.height / 2, canvasRef.current.width, canvasRef.current.height);
        const wPx = zone.width * scale;
        const hPx = zone.height * scale;
        if (px >= topLeft.px && px <= topLeft.px + wPx && py >= topLeft.py && py <= topLeft.py + hPx) {
          onSelectZone(zone);
          return;
        }
      }
    }

    if (isPinMode) {
      if (onCanvasClickWaypointPin) {
        onCanvasClickWaypointPin(goalPos.x, goalPos.y);
      }
    } else {
      setSelectedGoal(goalPos);
      if (onCanvasClickGoal) {
        onCanvasClickGoal(goalPos.x, goalPos.y);
      }
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setScale((prev) => Math.min(Math.max(prev * zoomFactor, 15.0), 200.0));
  };

  // Canvas Render Loop (Light Monochrome Theme)
  useEffect(() => {
    let animId;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.parentElement.clientWidth || 800;
      const height = canvas.parentElement.clientHeight || 600;
      canvas.width = width;
      canvas.height = height;

      // 1. Light Gray Canvas Background
      ctx.fillStyle = '#FCFAF7';
      ctx.fillRect(0, 0, width, height);

      const origin = worldToCanvas(0, 0, width, height);

      // 2. Render Real 2D SLAM Occupancy Grid Map (White & Dark Gray)
      if (showGridMap && gridData && gridData.length > 0) {
        const gWidth = gridMetadata.width || 200;
        const gHeight = gridMetadata.height || 200;
        const gRes = gridMetadata.resolution || 0.05;
        const ox = gridMetadata.origin_x || -5.0;
        const oy = gridMetadata.origin_y || -5.0;

        const cellPx = gRes * scale;

        for (let gy = 0; gy < gHeight; gy++) {
          for (let gx = 0; gx < gWidth; gx++) {
            const idx = gy * gWidth + gx;
            const val = gridData[idx];

            if (val === -1) continue; // Unexplored

            let fillColor = 'rgba(232, 229, 216, 0.4)'; // Free space (0): Soft warm gray
            if (val === 100) fillColor = '#18181B';       // Obstacle/Wall (100): Dark charcoal

            const worldX = ox + gx * gRes;
            const worldY = oy + gy * gRes;
            const cellCanvas = worldToCanvas(worldX, worldY, width, height);

            ctx.fillStyle = fillColor;
            ctx.fillRect(cellCanvas.px, cellCanvas.py - cellPx, cellPx + 0.5, cellPx + 0.5);
          }
        }
      }

      // 3. Polar Radar Circles
      if (showGridLines) {
        ctx.strokeStyle = 'rgba(120, 113, 108, 0.15)';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#78716C';
        ctx.font = '10px Inter, sans-serif';

        for (let r = 1; r <= 8; r++) {
          const radiusPx = r * scale;
          ctx.beginPath();
          ctx.arc(origin.px, origin.py, radiusPx, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillText(`${r}.0m`, origin.px + 6, origin.py - radiusPx + 12);
        }

        // Axes N-S-E-W
        ctx.strokeStyle = 'rgba(120, 113, 108, 0.25)';
        ctx.beginPath();
        ctx.moveTo(origin.px, 0);
        ctx.lineTo(origin.px, height);
        ctx.moveTo(0, origin.py);
        ctx.lineTo(width, origin.py);
        ctx.stroke();

        ctx.fillStyle = '#1A1917';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText('N', origin.px - 4, 18);
        ctx.fillText('S', origin.px - 4, height - 10);
        ctx.fillText('E', width - 18, origin.py + 4);
        ctx.fillText('W', 10, origin.py + 4);
      }

      // 4. Render Real LiDAR Scan Points & Laser Rays (Dark points)
      const currentPose = robotPose || { x: 0, y: 0, yaw: 0 };
      const robotCanvasPos = worldToCanvas(currentPose.x, currentPose.y, width, height);

      if (scanPoints && scanPoints.length > 0) {
        // Laser Rays
        if (showScanRays) {
          ctx.strokeStyle = 'rgba(24, 24, 27, 0.15)';
          ctx.lineWidth = 1;
          scanPoints.forEach((pt) => {
            const ptCanvas = worldToCanvas(pt.x, pt.y, width, height);
            ctx.beginPath();
            ctx.moveTo(robotCanvasPos.px, robotCanvasPos.py);
            ctx.lineTo(ptCanvas.px, ptCanvas.py);
            ctx.stroke();
          });
        }

        // Laser Scan Point Cloud
        scanPoints.forEach((pt) => {
          const ptCanvas = worldToCanvas(pt.x, pt.y, width, height);
          ctx.fillStyle = '#18181B';
          ctx.beginPath();
          ctx.arc(ptCanvas.px, ptCanvas.py, 2.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(24, 24, 27, 0.2)';
          ctx.beginPath();
          ctx.arc(ptCanvas.px, ptCanvas.py, 4.0, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // 5. Render Functional Zones & Virtual Walls (Hotel Concierge Standard)
      if (keepOutZones && keepOutZones.length > 0) {
        const getZoneStyle = (type) => {
          switch (type) {
            case 'SLOW_SPEED':
              return { fill: 'rgba(245, 158, 11, 0.14)', stroke: '#D97706', text: '#B45309', icon: '⚠️' };
            case 'SILENT_ZONE':
              return { fill: 'rgba(99, 102, 241, 0.14)', stroke: '#6366F1', text: '#4338CA', icon: '🔇' };
            case 'GREETING_ZONE':
              return { fill: 'rgba(16, 185, 129, 0.14)', stroke: '#10B981', text: '#047857', icon: '👋' };
            case 'SERVICE_PRIORITY':
              return { fill: 'rgba(2, 132, 199, 0.14)', stroke: '#0284C7', text: '#0369A1', icon: '🛎️' };
            case 'KEEP_OUT':
            default:
              return { fill: 'rgba(239, 68, 68, 0.14)', stroke: '#DC2626', text: '#B91C1C', icon: '🚫' };
          }
        };

        keepOutZones.forEach((zone) => {
          const topLeft = worldToCanvas(zone.x - zone.width / 2, zone.y + zone.height / 2, width, height);
          const wPx = zone.width * scale;
          const hPx = zone.height * scale;
          const style = getZoneStyle(zone.type);
          const isSelected = zone.id === selectedZoneId;

          // Background Fill
          ctx.fillStyle = style.fill;
          ctx.fillRect(topLeft.px, topLeft.py, wPx, hPx);

          // Border Dash & Stroke
          ctx.strokeStyle = isSelected ? '#18181B' : style.stroke;
          ctx.lineWidth = isSelected ? 2.5 : 1.5;
          ctx.setLineDash(isSelected ? [] : [5, 4]);
          ctx.strokeRect(topLeft.px, topLeft.py, wPx, hPx);
          ctx.setLineDash([]);

          // Selection Outline Overlay
          if (isSelected) {
            ctx.strokeStyle = style.stroke;
            ctx.lineWidth = 1;
            ctx.strokeRect(topLeft.px - 3, topLeft.py - 3, wPx + 6, hPx + 6);
          }

          // Label Text & Icon
          ctx.fillStyle = style.text;
          ctx.font = 'bold 9px Inter, sans-serif';
          const label = `${style.icon} ${zone.name || 'VÙNG CHỨC NĂNG'}`;
          ctx.fillText(label, topLeft.px + 4, topLeft.py + 12);

          if (zone.type === 'SLOW_SPEED' && zone.speed_limit) {
            ctx.font = '8px monospace';
            ctx.fillText(`MAX: ${zone.speed_limit}m/s`, topLeft.px + 4, topLeft.py + 24);
          }
        });
      }

      // 6. Render Workflow Trajectory Polyline (Otto style path connecting steps)
      if (workflowSteps && workflowSteps.length > 0 && waypoints.length > 0) {
        const moveSteps = workflowSteps.filter((s) => s.type === 'MOVE');
        if (moveSteps.length > 0) {
          ctx.save();
          ctx.strokeStyle = '#8B5CF6'; // Otto purple trajectory
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);

          ctx.beginPath();
          ctx.moveTo(robotCanvasPos.px, robotCanvasPos.py);

          moveSteps.forEach((st) => {
            const targetWp = waypoints.find(
              (w) =>
                w.id === st.params?.target_waypoint_id ||
                (w.x === st.params?.target_x && w.y === st.params?.target_y)
            );
            if (targetWp) {
              const p = worldToCanvas(targetWp.x, targetWp.y, width, height);
              ctx.lineTo(p.px, p.py);
            }
          });

          ctx.stroke();
          ctx.restore();
        }
      }

      // 7. Render Waypoints / Endpoints Overlay (Otto Motors Style)
      if (showWaypoints && waypoints.length > 0) {
        const getEndpointColor = (type) => {
          switch (type) {
            case 'DOCKING_TARGET':
              return '#0284C7'; // Sky / Quầy neo tiếp khách
            case 'PICKUP_DROPOFF':
              return '#059669'; // Emerald / Giao nhận đồ
            case 'SERVICE_STATION':
              return '#6366F1'; // Indigo / Trạm dịch vụ
            case 'PARKING_SPOT':
              return '#64748B'; // Slate / Bãi đỗ
            default:
              return '#8B5CF6'; // Violet / Waypoint
          }
        };

        waypoints.forEach((wp) => {
          const wpPos = worldToCanvas(wp.x, wp.y, width, height);
          const isHighlighted = wp.id === highlightedWaypointId;
          const nodeColor = getEndpointColor(wp.type);

          // Otto Motors halo ring for active/selected waypoint
          if (isHighlighted) {
            ctx.strokeStyle = nodeColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(wpPos.px, wpPos.py, 15, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = `${nodeColor}33`; // 20% opacity
            ctx.beginPath();
            ctx.arc(wpPos.px, wpPos.py, 15, 0, Math.PI * 2);
            ctx.fill();
          }

          // Main node circle with template color
          ctx.fillStyle = nodeColor;
          ctx.beginPath();
          ctx.arc(wpPos.px, wpPos.py, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Orientation Heading indicator (if yaw is defined)
          if (wp.yaw !== undefined && wp.yaw !== null) {
            const rad = (wp.yaw * Math.PI) / 180;
            const arrowLen = 14;
            const arrowX = wpPos.px + arrowLen * Math.cos(rad);
            const arrowY = wpPos.py - arrowLen * Math.sin(rad);

            ctx.strokeStyle = nodeColor;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(wpPos.px, wpPos.py);
            ctx.lineTo(arrowX, arrowY);
            ctx.stroke();
          }

          // Label badge with Name
          ctx.fillStyle = isHighlighted ? '#18181B' : '#262626';
          ctx.font = isHighlighted ? 'bold 12px Inter, sans-serif' : 'bold 11px Inter, sans-serif';
          ctx.fillText(wp.name, wpPos.px + 10, wpPos.py + 4);
        });
      }

      // 8. Selected Goal Crosshair Ring
      if (selectedGoal) {
        const goalCanvas = worldToCanvas(selectedGoal.x, selectedGoal.y, width, height);
        ctx.strokeStyle = '#18181B';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(goalCanvas.px, goalCanvas.py, 10, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(goalCanvas.px - 6, goalCanvas.py);
        ctx.lineTo(goalCanvas.px + 6, goalCanvas.py);
        ctx.moveTo(goalCanvas.px, goalCanvas.py - 6);
        ctx.lineTo(goalCanvas.px, goalCanvas.py + 6);
        ctx.stroke();
      }

      // 7. Robot Position Marker
      const radYaw = (currentPose.yaw * Math.PI) / 180;

      ctx.strokeStyle = 'rgba(24, 24, 27, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(robotCanvasPos.px, robotCanvasPos.py, 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.arc(robotCanvasPos.px, robotCanvasPos.py, 6, 0, Math.PI * 2);
      ctx.fill();

      const headLen = 20;
      const headX = robotCanvasPos.px + headLen * Math.cos(radYaw);
      const headY = robotCanvasPos.py - headLen * Math.sin(radYaw);

      ctx.strokeStyle = '#18181B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(robotCanvasPos.px, robotCanvasPos.py);
      ctx.lineTo(headX, headY);
      ctx.stroke();
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    scanPoints,
    gridData,
    gridMetadata,
    robotPose,
    waypoints,
    scale,
    panOffset,
    showGridMap,
    showGridLines,
    showScanRays,
    showWaypoints,
    selectedGoal,
    worldToCanvas,
  ]);

  const resetView = () => {
    setScale(45.0);
    setPanOffset({ x: 0, y: 0 });
    setSelectedGoal(null);
  };

  return (
    <div className="relative w-full h-full bg-[#FAF8F5] rounded-2xl overflow-hidden border border-[#E5E1D8] shadow-sm flex flex-col">
      {/* Top Toolbar Controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-[#E5E1D8] text-stone-900 text-xs shadow-md">
        <button
          onClick={() => setScale((prev) => Math.min(prev * 1.2, 200.0))}
          className="p-1.5 hover:bg-[#EFECE6] rounded-lg transition-colors cursor-pointer text-stone-800"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setScale((prev) => Math.max(prev * 0.8, 15.0))}
          className="p-1.5 hover:bg-[#EFECE6] rounded-lg transition-colors cursor-pointer text-stone-800"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 hover:bg-[#EFECE6] rounded-lg transition-colors cursor-pointer text-stone-800"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-[#DDD8CE] my-auto mx-1" />

        <span className="text-[11px] font-mono text-stone-700 font-bold">
          SCALE: {scale.toFixed(0)} px/m
        </span>
      </div>

      {/* Selected Target HUD or Pin Mode HUD */}
      {isPinMode ? (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-[#262626] text-[#F2EFE9] border border-[#262626] px-3.5 py-2 rounded-xl text-xs font-bold shadow-md animate-pulse">
          <Crosshair className="w-4 h-4 text-emerald-400" />
          <span>CHẾ ĐỘ GHIM WAYPOINT: Click trên bản đồ để chọn tọa độ</span>
        </div>
      ) : selectedGoal && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white/95 border border-[#E5E1D8] backdrop-blur-md px-3.5 py-2 rounded-xl text-stone-900 text-xs shadow-md animate-fadeIn">
          <Crosshair className="w-4 h-4 text-stone-900 animate-spin" />
          <span>
            MỤC TIÊU: <strong>X={selectedGoal.x}m</strong>, <strong>Y={selectedGoal.y}m</strong>
          </span>
        </div>
      )}

      {/* Canvas Viewport */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleCanvasClick}
        onWheel={handleWheel}
        className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
      />

      {/* Bottom Minimal Legend */}
      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-4 bg-white/95 backdrop-blur-md px-4 py-1.5 rounded-lg border border-[#E5E1D8] text-[11px] text-stone-700 shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#18181B]" />
          <span>Point Cloud</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-[#E5E1D8]" />
          <span>SLAM 2D Floor Map</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-stone-400" />
          <span>Radar Rings</span>
        </div>
      </div>
    </div>
  );
};
