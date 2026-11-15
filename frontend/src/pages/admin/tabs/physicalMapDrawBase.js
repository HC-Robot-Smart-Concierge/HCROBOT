import { drawPolygonZone } from './physicalMapZoneDrawing';
import { isPointInZone, normalizeZoneYaw, isPolygonZone } from './physicalMapZones';
import { ZONE_TEMPLATES } from './physicalMapConstants';
import { mapFrame } from './physicalMapView';

export function drawPhysicalMapBaseLayers({
  costmapRef, ctx, height, mapConfig, mapImage, robotPose, selectedZone, selectedZoneVertex, showCostmap, showZones, t, viewConfig, width, worldToCanvas, zoneDraft, zoneEdgeHover, zones,
}) {
    // Bat che do lam min do hoa Canvas
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Xoa canvas voi mau nen Slate hien dai
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // 2. Tinh toan padding va ti le thu phong
    // (cung cong thuc voi worldToCanvas, gom ca zoom/keo map)
    const { scale, offsetX, offsetY, roomW, roomH } = mapFrame(width, height, viewConfig);

    // Nen phong Lab
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(offsetX, offsetY, roomW, roomH);

    // 3. Render Ban do SLAM cua map dang chon
    if (mapImage) {
      ctx.save();
      ctx.globalAlpha = 0.95;
      // Phong to (moi o >= 3 px): ve o luoi sac net thay vi lam mo
      if (scale * (mapConfig.resolution || 0.05) >= 3) ctx.imageSmoothingEnabled = false;
      ctx.drawImage(mapImage, offsetX, offsetY, roomW, roomH);
      ctx.restore();
    }

    // 3b. Lop costmap Nav2 (che do ROS 2): do = vat can/vung cam, cam = vung noi an toan
    const costmap = costmapRef.current;
    if (showCostmap && costmap) {
      const tl = worldToCanvas(costmap.originX, costmap.originY + costmap.heightM, width, height);
      const br = worldToCanvas(costmap.originX + costmap.widthM, costmap.originY, width, height);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(costmap.canvas, tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.restore();
    }

    // Luoi toa do 0.5m
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= mapConfig.widthMeters; x += 0.5) {
      const px = offsetX + x * scale;
      ctx.beginPath();
      ctx.moveTo(px, offsetY);
      ctx.lineTo(px, offsetY + roomH);
      ctx.stroke();
    }
    for (let y = 0; y <= mapConfig.heightMeters; y += 0.5) {
      const py = offsetY + y * scale;
      ctx.beginPath();
      ctx.moveTo(offsetX, py);
      ctx.lineTo(offsetX + roomW, py);
      ctx.stroke();
    }

    // 4. VE CAC VUNG CHUC NANG (ZONES: KEEP-OUT, SPEED-ZONE, NO-STOP)
    if (showZones && zones.length > 0) {
      for (const zone of zones) {
        const isSelected = selectedZone?.id === zone.id;
        if (isPolygonZone(zone)) {
          drawPolygonZone(ctx, zone.vertices.map((p) => worldToCanvas(p.x, p.y, width, height)), {
            color: zone.type === 'KEEP_OUT' ? '#EF4444' : zone.type === 'SPEED_ZONE' ? '#F59E0B' : '#FB7185',
            label: zone.name, selected: isSelected,
            selectedVertex: isSelected ? selectedZoneVertex : null,
            edgeHover: isSelected && zoneEdgeHover?.zoneId === zone.id ? {
              edgeIndex: zoneEdgeHover.edgeIndex,
              point: worldToCanvas(zoneEdgeHover.point.x, zoneEdgeHover.point.y, width, height),
            } : null,
            active: zone.type === 'SPEED_ZONE' && isPointInZone(robotPose.x, robotPose.y, zone),
          });
          continue;
        }
        const halfW = (Number(zone.width) || 1.0) / 2;
        const halfH = (Number(zone.height) || 1.0) / 2;
        const zx = Number(zone.x) || 0;
        const zy = Number(zone.y) || 0;

        const center = worldToCanvas(zx, zy, width, height);
        const zw = 2 * halfW * scale;
        const zh = 2 * halfH * scale;
        const tl = { x: -zw / 2, y: -zh / 2 };
        const br = { x: zw / 2, y: zh / 2 };
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(-normalizeZoneYaw(zone.yaw) * Math.PI / 180);

        const isKeepOut = zone.type === 'KEEP_OUT';
        const isSpeed = zone.type === 'SPEED_ZONE';
        const color = isKeepOut ? '#EF4444' : isSpeed ? '#F59E0B' : '#FB7185';
        const fill = isKeepOut
          ? 'rgba(239, 68, 68, 0.16)'
          : isSpeed
          ? 'rgba(245, 158, 11, 0.16)'
          : 'rgba(244, 63, 94, 0.16)';

        // Nen vung. Xe dang trong vung giam toc => sang len + vien phat sang (de khan gia thay)
        const robotInsideSpeedZone = isSpeed && isPointInZone(robotPose.x, robotPose.y, zone);
        ctx.fillStyle = robotInsideSpeedZone ? 'rgba(245, 158, 11, 0.42)' : fill;
        ctx.fillRect(tl.x, tl.y, zw, zh);
        if (robotInsideSpeedZone) {
          ctx.save();
          ctx.shadowColor = '#F59E0B';
          ctx.shadowBlur = 18;
          ctx.strokeStyle = '#FBBF24';
          ctx.lineWidth = 3;
          ctx.strokeRect(tl.x, tl.y, zw, zh);
          ctx.restore();
        }

        // Pattern soc chéo
        ctx.save();
        ctx.beginPath();
        ctx.rect(tl.x, tl.y, zw, zh);
        ctx.clip();
        ctx.strokeStyle = isKeepOut
          ? 'rgba(239, 68, 68, 0.28)'
          : isSpeed
          ? 'rgba(245, 158, 11, 0.28)'
          : 'rgba(244, 63, 94, 0.28)';
        ctx.lineWidth = 1.2;
        for (let i = -zh; i <= zw; i += 12) {
          ctx.beginPath();
          ctx.moveTo(tl.x + i, tl.y);
          ctx.lineTo(tl.x + i + zh, tl.y + zh);
          ctx.stroke();
        }
        ctx.restore();

        // Vien bao net dut
        ctx.save();
        ctx.strokeStyle = isSelected ? '#FFFFFF' : color;
        ctx.lineWidth = isSelected ? 2.2 : 1.2;
        ctx.setLineDash(isKeepOut ? [6, 4] : isSpeed ? [5, 3] : [4, 3]);
        ctx.strokeRect(tl.x, tl.y, zw, zh);
        ctx.restore();

        // Neu duoc chon: Ve 4 goc handles
        if (isSelected) {
          ctx.fillStyle = '#FFFFFF';
          [tl.x, br.x].forEach((hx) => {
            [tl.y, br.y].forEach((hy) => {
              ctx.fillRect(hx - 5, hy - 5, 10, 10);
              ctx.strokeStyle = '#22D3EE';
              ctx.strokeRect(hx - 5, hy - 5, 10, 10);
            });
          });
          ctx.beginPath();
          ctx.moveTo(0, tl.y);
          ctx.lineTo(0, tl.y - 28);
          ctx.strokeStyle = '#22D3EE';
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, tl.y - 28, 9, 0, Math.PI * 2);
          ctx.fillStyle = '#0891B2';
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('↻', 0, tl.y - 23);
        }

        // Nhãn tên vùng nhỏ gọn tinh tế
        const labelText = zone.name || (isKeepOut ? 'CẤM VÀO' : isSpeed ? `${zone.speed_limit}m/s` : 'CẤM DỪNG');
        ctx.fillStyle = isSelected ? '#0F172A' : 'rgba(15, 23, 42, 0.85)';
        const textW = Math.max(28, labelText.length * 5.2 + 8);
        ctx.fillRect(tl.x + 3, tl.y + 3, textW, 14);
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(tl.x + 3, tl.y + 3, textW, 14);

        ctx.fillStyle = isSelected ? '#FFFFFF' : color;
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(labelText.length > 20 ? labelText.slice(0, 18) + '...' : labelText, tl.x + 3 + textW / 2, tl.y + 13);
        ctx.restore();
      }
    }

    // 4b. Vung dang ve bang chuot (chua tha): khung net dut + kich thuoc
    if (zoneDraft?.vertices) {
      drawPolygonZone(ctx, zoneDraft.vertices.map((p) => worldToCanvas(p.x, p.y, width, height)), {
        color: ZONE_TEMPLATES.find((t) => t.type === zoneDraft.type)?.color || '#22D3EE', draft: true,
        hover: zoneDraft.cursor && worldToCanvas(zoneDraft.cursor.x, zoneDraft.cursor.y, width, height),
      });
    } else if (zoneDraft) {
      const { a, b } = zoneDraft;
      const tl = worldToCanvas(Math.min(a.x, b.x), Math.max(a.y, b.y), width, height);
      const br = worldToCanvas(Math.max(a.x, b.x), Math.min(a.y, b.y), width, height);
      const tmpl = ZONE_TEMPLATES.find((t) => t.type === zoneDraft.type) || ZONE_TEMPLATES[0];
      ctx.save();
      ctx.fillStyle = tmpl.bgColor;
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.strokeStyle = tmpl.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.setLineDash([]);
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = tmpl.color;
      ctx.fillText(
        `${tmpl.badge} ${Math.abs(a.x - b.x).toFixed(2)} x ${Math.abs(a.y - b.y).toFixed(2)} m`,
        tl.x + 4,
        Math.max(12, tl.y - 5)
      );
      ctx.restore();
    }

}
