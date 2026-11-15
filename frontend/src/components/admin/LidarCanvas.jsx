import React, { useRef, useEffect, useState, useCallback } from 'react';
import { isPointInZone } from '../../pages/admin/tabs/physicalMapZones';
import { drawLidarScene } from './lidarCanvasRenderer';
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
  onResetMap,
  onScan360,
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
        if (isPointInZone(goalPos.x, goalPos.y, zone)) {
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
      drawLidarScene({
        canvas: canvasRef.current,
        scanPoints,
        gridData,
        gridMetadata,
        robotPose,
        waypoints,
        workflowSteps,
        highlightedWaypointId,
        keepOutZones,
        selectedZoneId,
        selectedGoal,
        scale,
        showGridMap,
        showGridLines,
        showScanRays,
        showWaypoints,
        worldToCanvas,
      });
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    scanPoints,
    gridData,
    gridMetadata,
    robotPose,
    waypoints,
    workflowSteps,
    highlightedWaypointId,
    keepOutZones,
    selectedZoneId,
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

        {/* Dynamic Physical Scale Ruler (1 Meter) */}
        <div className="flex items-center gap-1.5 pl-1 font-mono text-[11px] text-stone-700 select-none" title="Thước đo tỉ lệ thực tế 1 mét">
          <div className="h-1.5 border-b border-l border-r border-stone-800" style={{ width: `${Math.max(15, Math.round(scale))}px` }} />
          <span>1m</span>
        </div>
      </div>

      {/* Selected Target HUD or Pin Mode HUD */}
      {isPinMode ? (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-[#262626] text-[#F2EFE9] border border-[#262626] px-3.5 py-2 rounded-xl text-xs font-bold shadow-md">
          <Crosshair className="w-4 h-4 text-[#F2EFE9]" />
          <span>CHẾ ĐỘ GHIM WAYPOINT: Click trên bản đồ để chọn tọa độ</span>
        </div>
      ) : selectedGoal && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white/95 border border-[#BFBFBD] backdrop-blur-md px-3.5 py-2 rounded-xl text-[#262626] text-xs shadow-md animate-fadeIn">
          <Crosshair className="w-4 h-4 text-[#262626] animate-spin" />
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
      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-4 bg-white/95 backdrop-blur-md px-4 py-1.5 rounded-lg border border-[#BFBFBD] text-[11px] text-[#262626] shadow-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#262626]" />
          <span>Laser Point Cloud</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-[#E9E5DC] border border-[#BFBFBD]" />
          <span>Bản Đồ SLAM</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 border border-[#8C8C8C] bg-[#F2EFE9]" />
          <span>Lưới Ô Vuông (1m Grid)</span>
        </div>
      </div>
    </div>
  );
};
