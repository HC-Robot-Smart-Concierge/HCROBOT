import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Crosshair } from 'lucide-react';

export const LidarCanvas = ({
  scanPoints = [],
  gridData = [],
  gridMetadata = { width: 200, height: 200, resolution: 0.05, origin_x: -5.0, origin_y: -5.0 },
  robotPose = { x: 0, y: 0, yaw: 0 },
  waypoints = [],
  onCanvasClickGoal,
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
    setSelectedGoal(goalPos);

    if (onCanvasClickGoal) {
      onCanvasClickGoal(goalPos.x, goalPos.y);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setScale((prev) => Math.min(Math.max(prev * zoomFactor, 15.0), 200.0));
  };

  // Canvas Render Loop (Real-time 60 FPS Canvas rendering)
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

      // 1. Pitch Black Background
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, width, height);

      const origin = worldToCanvas(0, 0, width, height);

      // 2. Render Real 2D SLAM Occupancy Grid Map (Trắng - Đen - Xám)
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

            if (val === -1) continue; // Unexplored -> Giữ màu nền đen

            let fillColor = 'rgba(255, 255, 255, 0.12)'; // Free space (0): Xám sáng mờ
            if (val === 100) fillColor = '#FFFFFF';      // Obstacle/Wall (100): Trắng sáng

            const worldX = ox + gx * gRes;
            const worldY = oy + gy * gRes;
            const cellCanvas = worldToCanvas(worldX, worldY, width, height);

            ctx.fillStyle = fillColor;
            ctx.fillRect(cellCanvas.px, cellCanvas.py - cellPx, cellPx + 0.5, cellPx + 0.5);
          }
        }
      }

      // 3. Polar Radar Circles (Vòng tròn bán kính 1m, 2m, 3m, 4m, 5m, 6m)
      if (showGridLines) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#737373';
        ctx.font = '10px Inter, sans-serif';

        for (let r = 1; r <= 8; r++) {
          const radiusPx = r * scale;
          ctx.beginPath();
          ctx.arc(origin.px, origin.py, radiusPx, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillText(`${r}.0m`, origin.px + 6, origin.py - radiusPx + 12);
        }

        // Trục N-S-E-W
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.moveTo(origin.px, 0);
        ctx.lineTo(origin.px, height);
        ctx.moveTo(0, origin.py);
        ctx.lineTo(width, origin.py);
        ctx.stroke();

        ctx.fillStyle = '#A3A3A3';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText('N', origin.px - 4, 18);
        ctx.fillText('S', origin.px - 4, height - 10);
        ctx.fillText('E', width - 18, origin.py + 4);
        ctx.fillText('W', 10, origin.py + 4);
      }

      // 4. Render Real LiDAR Scan Points & Laser Rays (Tia laser sáng trắng)
      const currentPose = robotPose || { x: 0, y: 0, yaw: 0 };
      const robotCanvasPos = worldToCanvas(currentPose.x, currentPose.y, width, height);

      if (scanPoints && scanPoints.length > 0) {
        // Laser Rays
        if (showScanRays) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
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
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(ptCanvas.px, ptCanvas.py, 2.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.beginPath();
          ctx.arc(ptCanvas.px, ptCanvas.py, 4.0, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // 5. Render Waypoints Overlay
      if (showWaypoints && waypoints.length > 0) {
        waypoints.forEach((wp) => {
          const wpPos = worldToCanvas(wp.x, wp.y, width, height);

          ctx.fillStyle = '#E5E5E5';
          ctx.beginPath();
          ctx.arc(wpPos.px, wpPos.py, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#262626';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#D4D4D4';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(wp.name, wpPos.px + 8, wpPos.py + 4);
        });
      }

      // 6. Selected Goal Crosshair Ring
      if (selectedGoal) {
        const goalCanvas = worldToCanvas(selectedGoal.x, selectedGoal.y, width, height);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
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

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(robotCanvasPos.px, robotCanvasPos.py, 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(robotCanvasPos.px, robotCanvasPos.py, 6, 0, Math.PI * 2);
      ctx.fill();

      const headLen = 20;
      const headX = robotCanvasPos.px + headLen * Math.cos(radYaw);
      const headY = robotCanvasPos.py - headLen * Math.sin(radYaw);

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
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
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl flex flex-col">
      {/* Top Toolbar Controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-neutral-700/60 text-white text-xs shadow-xl">
        <button
          onClick={() => setScale((prev) => Math.min(prev * 1.2, 200.0))}
          className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4 text-neutral-200" />
        </button>
        <button
          onClick={() => setScale((prev) => Math.max(prev * 0.8, 15.0))}
          className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4 text-neutral-200" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4 text-neutral-200" />
        </button>

        <div className="h-4 w-px bg-neutral-700 my-auto mx-1" />

        <span className="text-[11px] font-mono text-neutral-300 font-semibold">
          SCALE: {scale.toFixed(0)} px/m
        </span>
      </div>

      {/* Selected Target HUD */}
      {selectedGoal && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-neutral-900/90 border border-neutral-600 backdrop-blur-md px-3.5 py-2 rounded-xl text-neutral-100 text-xs shadow-xl animate-fadeIn">
          <Crosshair className="w-4 h-4 text-white animate-spin" />
          <span>
            TARGET: <strong>X={selectedGoal.x}m</strong>, <strong>Y={selectedGoal.y}m</strong>
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
      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-4 bg-neutral-900/90 backdrop-blur-md px-4 py-1.5 rounded-lg border border-neutral-800 text-[11px] text-neutral-300">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
          <span>Point Cloud</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-neutral-200" />
          <span>SLAM 2D Floor Map</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-400" />
          <span>Radar Rings</span>
        </div>
      </div>
    </div>
  );
};
