import { isPolygonZone } from '../../pages/admin/tabs/physicalMapZones';
import { drawPolygonZone } from '../../pages/admin/tabs/physicalMapZoneDrawing';

const getZoneStyle = (type) => {
  switch (type) {
    case 'SPEED_ZONE':
    case 'SLOW_SPEED':
      return { fill: 'rgba(217, 119, 6, 0.16)', stroke: '#D97706', text: '#92400E', tag: '[GIỚI HẠN TỐC ĐỘ]' };
    case 'NO_STOP':
      return { fill: 'rgba(225, 29, 72, 0.16)', stroke: '#E11D48', text: '#9F1239', tag: '[CẤM DỪNG / NO-STOP]' };
    case 'SILENT_ZONE':
      return { fill: 'rgba(99, 102, 241, 0.15)', stroke: '#6366F1', text: '#3730A3', tag: '[YÊN LẶNG]' };
    case 'GREETING_ZONE':
      return { fill: 'rgba(5, 150, 105, 0.15)', stroke: '#059669', text: '#065F46', tag: '[ĐÓN KHÁCH]' };
    case 'SERVICE_PRIORITY':
      return { fill: 'rgba(2, 132, 199, 0.15)', stroke: '#0284C7', text: '#075985', tag: '[DỊCH VỤ]' };
    case 'KEEP_OUT':
    default:
      return { fill: 'rgba(220, 38, 38, 0.16)', stroke: '#DC2626', text: '#991B1B', tag: '[CẤM VÀO / KEEP-OUT]' };
  }
};

const getEndpointColor = (type) => {
  const norm = (type || 'WAYPOINT').toUpperCase();
  switch (norm) {
    case 'CHARGER':
    case 'DOCKING_TARGET':
      return '#34D399';
    case 'PARK':
    case 'PARKING_SPOT':
      return '#60A5FA';
    case 'WAYPOINT':
    default:
      return '#94A3B8';
  }
};

export function drawLidarScene({
  canvas,
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
}) {
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

  // 2. Render Real 2D SLAM Occupancy Grid Map
  if (showGridMap && gridData && gridData.length > 0) {
    const gWidth = gridMetadata.width || 200;
    const gHeight = gridMetadata.height || 200;
    const gRes = gridMetadata.resolution || 0.05;
    const ox = gridMetadata.origin_x || -5.0;
    const oy = gridMetadata.origin_y || -5.0;
    const cellPx = Math.max(gRes * scale, 1.5);
    const cellCount = Math.min(gridData.length, gWidth * gHeight);

    for (let idx = 0; idx < cellCount; idx++) {
      const cell = gridData[idx];
      if (cell !== 0 && cell !== 100) continue;
      const gx = idx % gWidth;
      const gy = (idx - gx) / gWidth;
      const worldX = ox + gx * gRes;
      const worldY = oy + gy * gRes;
      const cellCanvas = worldToCanvas(worldX, worldY, width, height);
      if (cell === 0) {
        ctx.fillStyle = 'rgba(238, 235, 225, 0.45)';
        ctx.fillRect(cellCanvas.px, cellCanvas.py - cellPx, cellPx + 0.6, cellPx + 0.6);
      } else {
        ctx.fillStyle = '#18181B';
        ctx.fillRect(cellCanvas.px, cellCanvas.py - cellPx, cellPx + 0.8, cellPx + 0.8);
      }
    }
  }

  // 3. Cartesian Coordinate Grid Mesh (1m x 1m)
  if (showGridLines) {
    const xMin = Math.floor((0 - origin.px) / scale) - 1;
    const xMax = Math.ceil((width - origin.px) / scale) + 1;
    const yMin = Math.floor((origin.py - height) / scale) - 1;
    const yMax = Math.ceil((origin.py - 0) / scale) + 1;

    ctx.strokeStyle = 'rgba(140, 133, 123, 0.15)';
    ctx.lineWidth = 1;

    for (let x = xMin; x <= xMax; x++) {
      if (x === 0) continue;
      const p = worldToCanvas(x, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(p.px, 0);
      ctx.lineTo(p.px, height);
      ctx.stroke();
    }

    for (let y = yMin; y <= yMax; y++) {
      if (y === 0) continue;
      const p = worldToCanvas(0, y, width, height);
      ctx.beginPath();
      ctx.moveTo(0, p.py);
      ctx.lineTo(width, p.py);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(38, 38, 38, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(origin.px, 0);
    ctx.lineTo(origin.px, height);
    ctx.moveTo(0, origin.py);
    ctx.lineTo(width, origin.py);
    ctx.stroke();

    ctx.fillStyle = '#8C8C8C';
    ctx.font = '10px Inter, monospace';
    for (let x = xMin; x <= xMax; x++) {
      if (x !== 0 && x % 2 === 0) {
        const p = worldToCanvas(x, 0, width, height);
        ctx.fillText(`${x > 0 ? '+' : ''}${x}m`, p.px + 2, origin.py + 12);
      }
    }
    for (let y = yMin; y <= yMax; y++) {
      if (y !== 0 && y % 2 === 0) {
        const p = worldToCanvas(0, y, width, height);
        ctx.fillText(`${y > 0 ? '+' : ''}${y}m`, origin.px + 4, p.py - 2);
      }
    }

    const axisLen = Math.max(scale * 0.6, 24);
    ctx.strokeStyle = '#262626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(origin.px, origin.py);
    ctx.lineTo(origin.px + axisLen, origin.py);
    ctx.stroke();
    ctx.fillStyle = '#262626';
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.fillText('+X', origin.px + axisLen + 3, origin.py + 3);

    ctx.strokeStyle = '#8C8C8C';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(origin.px, origin.py);
    ctx.lineTo(origin.px, origin.py - axisLen);
    ctx.stroke();
    ctx.fillStyle = '#8C8C8C';
    ctx.fillText('+Y', origin.px - 6, origin.py - axisLen - 4);
  }

  // 4. Real LiDAR Scan Points & Laser Rays
  const currentPose = robotPose || { x: 0, y: 0, yaw: 0 };
  const robotCanvasPos = worldToCanvas(currentPose.x, currentPose.y, width, height);

  if (scanPoints && scanPoints.length > 0) {
    if (showScanRays) {
      ctx.strokeStyle = 'rgba(38, 38, 38, 0.12)';
      ctx.lineWidth = 1;
      scanPoints.forEach((pt) => {
        const ptCanvas = worldToCanvas(pt.x, pt.y, width, height);
        ctx.beginPath();
        ctx.moveTo(robotCanvasPos.px, robotCanvasPos.py);
        ctx.lineTo(ptCanvas.px, ptCanvas.py);
        ctx.stroke();
      });
    }

    scanPoints.forEach((pt) => {
      const ptCanvas = worldToCanvas(pt.x, pt.y, width, height);
      ctx.fillStyle = '#262626';
      ctx.beginPath();
      ctx.arc(ptCanvas.px, ptCanvas.py, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(38, 38, 38, 0.18)';
      ctx.beginPath();
      ctx.arc(ptCanvas.px, ptCanvas.py, 4.0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 5. Functional Zones & Virtual Walls
  if (keepOutZones && keepOutZones.length > 0) {
    keepOutZones.forEach((zone) => {
      const topLeft = worldToCanvas(zone.x - zone.width / 2, zone.y + zone.height / 2, width, height);
      const wPx = zone.width * scale;
      const hPx = zone.height * scale;
      const style = getZoneStyle(zone.type);
      const isSelected = zone.id === selectedZoneId;

      if (isPolygonZone(zone)) {
        drawPolygonZone(
          ctx,
          zone.vertices.map((p) => {
            const c = worldToCanvas(p.x, p.y, width, height);
            return { x: c.px, y: c.py };
          }),
          { color: style.stroke, label: zone.name, selected: isSelected }
        );
        return;
      }

      ctx.fillStyle = style.fill;
      ctx.fillRect(topLeft.px, topLeft.py, wPx, hPx);

      ctx.strokeStyle = isSelected ? '#262626' : style.stroke;
      ctx.lineWidth = isSelected ? 2 : 1.2;
      ctx.setLineDash(isSelected ? [] : [5, 4]);
      ctx.strokeRect(topLeft.px, topLeft.py, wPx, hPx);
      ctx.setLineDash([]);

      if (isSelected) {
        ctx.strokeStyle = '#262626';
        ctx.lineWidth = 1;
        ctx.strokeRect(topLeft.px - 3, topLeft.py - 3, wPx + 6, hPx + 6);
      }

      ctx.fillStyle = style.text;
      ctx.font = 'bold 9px Inter, sans-serif';
      const label = `${zone.name || 'VÙNG CHỨC NĂNG'} ${style.tag}`;
      ctx.fillText(label, topLeft.px + 4, topLeft.py + 12);

      if ((zone.type === 'SLOW_SPEED' || zone.type === 'SPEED_ZONE') && zone.speed_limit) {
        ctx.font = '8px monospace';
        ctx.fillText(`MAX: ${zone.speed_limit}m/s`, topLeft.px + 4, topLeft.py + 24);
      }
    });
  }

  // 6. Workflow Trajectory Polyline
  if (workflowSteps && workflowSteps.length > 0 && waypoints.length > 0) {
    const moveSteps = workflowSteps.filter((s) => s.type === 'MOVE');
    if (moveSteps.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#8C8C8C';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
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

  // 7. Waypoints / Endpoints Overlay
  if (showWaypoints && waypoints.length > 0) {
    waypoints.forEach((wp) => {
      const wpPos = worldToCanvas(wp.x, wp.y, width, height);
      const isHighlighted = wp.id === highlightedWaypointId;
      const nodeColor = getEndpointColor(wp.type);

      if (isHighlighted) {
        ctx.strokeStyle = '#262626';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wpPos.px, wpPos.py, 14, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(38, 38, 38, 0.12)';
        ctx.beginPath();
        ctx.arc(wpPos.px, wpPos.py, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = nodeColor;
      ctx.beginPath();
      ctx.arc(wpPos.px, wpPos.py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

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

  // 9. Robot Position Marker
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
}
