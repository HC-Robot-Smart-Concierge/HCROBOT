import { laserPointToMap, obstacleClearanceAt, TURN_CLEARANCE_M } from './physicalMapNavigation';
import { getEndpointTemplateInfo } from './studio/studioConstants';

export function drawPhysicalMapEntities({
  ctx, endpoints, height, hoveredEndpointId, invertHeading, isNavigating, navPath, navigatingEndpointId, navigationRef, poseDraft, robotPose, scale, scanPoints, selectedEndpoint, selectedGoal, showEndpoints, showLaserRays, showLaserScan, trail, width, worldToCanvas,
}) {
    // 5. Ve tia Laser RPLiDAR thoi gian thuc
    const { x: rpx, y: rpy } = worldToCanvas(robotPose.x, robotPose.y, width, height);
    const effectiveYaw = robotPose.yaw + (invertHeading ? Math.PI : 0);

    if (showLaserScan && navigationRef.current.poseAt && scanPoints.length > 0) {
      for (const pt of scanPoints) {
        const hit = laserPointToMap(pt, { ...robotPose, yaw: effectiveYaw });
        if (!hit) continue;
        const { x: wx, y: wy } = hit;

        const { x: lpx, y: lpy } = worldToCanvas(wx, wy, width, height);

        if (showLaserRays) {
          ctx.beginPath();
          ctx.moveTo(rpx, rpy);
          ctx.lineTo(lpx, lpy);
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(lpx, lpy, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#06B6D4';
        ctx.shadowColor = '#06B6D4';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // 6. Ve Vet Di Chuyen (Trail)
    if (trail.length > 1) {
      ctx.beginPath();
      const first = worldToCanvas(trail[0].x, trail[0].y, width, height);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < trail.length; i++) {
        const pt = worldToCanvas(trail[i].x, trail[i].y, width, height);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 7. Ve cac Diem Moc Endpoints (Waypoints tu layout2.json)
    if (showEndpoints && endpoints.length > 0) {
      for (const ep of endpoints) {
        const { x: wpx, y: wpy } = worldToCanvas(ep.x, ep.y, width, height);
        const isSelected = selectedEndpoint?.id === ep.id;
        const isHovered = hoveredEndpointId === ep.id;
        const isNavTarget =
          isNavigating &&
          (navigatingEndpointId === ep.id ||
            (selectedGoal && Math.hypot(ep.x - selectedGoal.x, ep.y - selectedGoal.y) < 0.15));
        const tmpl = getEndpointTemplateInfo(ep.type);
        const epColor = tmpl.color || ep.color || '#3B82F6';

        // Endpoint sat vat can (< 25 cm): ve vong quay dau mau vang => xe toi do khong xoay duoc
        const epClearance = obstacleClearanceAt(navigationRef.current.costmap, ep.x, ep.y, TURN_CLEARANCE_M);
        if (epClearance < TURN_CLEARANCE_M) {
          const edge = worldToCanvas(ep.x + TURN_CLEARANCE_M, ep.y, width, height);
          ctx.save();
          ctx.beginPath();
          ctx.arc(wpx, wpy, Math.max(10, Math.abs(edge.x - wpx)), 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(245, 158, 11, 0.10)';
          ctx.fill();
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#FBBF24';
          ctx.fillText(`⚠ sát vật ${Math.round(epClearance * 100)}cm`, wpx, wpy + 26);
          ctx.restore();
        }

        // Halo khi dang di toi, hover hoac duoc chon
        if (isNavTarget) {
          ctx.beginPath();
          ctx.arc(wpx, wpy, 16, 0, Math.PI * 2);
          ctx.strokeStyle = '#22D3EE';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (isHovered) {
          ctx.beginPath();
          ctx.arc(wpx, wpy, 14, 0, Math.PI * 2);
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        } else if (isSelected) {
          ctx.beginPath();
          ctx.arc(wpx, wpy, 13, 0, Math.PI * 2);
          ctx.strokeStyle = epColor;
          ctx.lineWidth = 1.4;
          ctx.setLineDash([3, 2]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Diem tron filled
        ctx.beginPath();
        ctx.arc(wpx, wpy, isNavTarget ? 8.0 : isHovered ? 6.5 : isSelected ? 6.5 : 5.0, 0, Math.PI * 2);
        ctx.fillStyle = isNavTarget ? '#22D3EE' : epColor;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = isNavTarget ? 2.0 : 1.5;
        ctx.stroke();

        // Nhãn tên điểm mốc nhỏ gọn, tinh tế
        const nameText = isNavTarget ? `🎯 ${ep.name}` : ep.name || 'Điểm mốc';
        const badgeW = Math.max(22, nameText.length * 5.2 + 12);
        const badgeH = 14;
        const bx = wpx - badgeW / 2;
        const by = wpy - 20;

        ctx.fillStyle = isNavTarget ? '#083344' : isSelected ? '#18181B' : isHovered ? '#1E293B' : '#0F172A';
        ctx.fillRect(bx, by, badgeW, badgeH);
        ctx.strokeStyle = isNavTarget ? '#22D3EE' : isSelected ? epColor : isHovered ? '#38BDF8' : '#475569';
        ctx.lineWidth = isNavTarget ? 1.5 : 0.8;
        ctx.strokeRect(bx, by, badgeW, badgeH);

        // Dot mau loai
        ctx.beginPath();
        ctx.arc(bx + 4.5, by + badgeH / 2, 2.0, 0, Math.PI * 2);
        ctx.fillStyle = isNavTarget ? '#22D3EE' : epColor;
        ctx.fill();

        ctx.fillStyle = isNavTarget ? '#67E8F9' : isSelected || isHovered ? '#FFFFFF' : '#CBD5E1';
        ctx.font = 'bold 8.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(nameText.length > 22 ? nameText.slice(0, 20) + '...' : nameText, bx + badgeW / 2 + 2, by + 10);
      }
    }

    // 7b. Ve duong di A* Pi dang bam theo (tu robot qua cac chang con lai)
    if (navPath.length > 0) {
      const startPt = worldToCanvas(robotPose.x, robotPose.y, width, height);
      ctx.save();
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(startPt.x, startPt.y);
      for (const [px, py] of navPath) {
        const p = worldToCanvas(px, py, width, height);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#22D3EE';
      for (const [px, py] of navPath.slice(0, -1)) {
        const p = worldToCanvas(px, py, width, height);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 8. Ve Diem Dich Den (Selected Goal)
    if (selectedGoal) {
      const { x: gpx, y: gpy } = worldToCanvas(selectedGoal.x, selectedGoal.y, width, height);

      ctx.beginPath();
      ctx.arc(gpx, gpy, 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(gpx, gpy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#EF4444';
      ctx.fill();

      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Mục tiêu (${selectedGoal.x.toFixed(2)}, ${selectedGoal.y.toFixed(2)})`, gpx, gpy - 16);
    }

    // 9. Ve Robot HC-Robot
    ctx.save();
    ctx.translate(rpx, rpy);
    ctx.rotate(-effectiveYaw);

    const robW = 0.33 * scale;
    const robH = 0.17 * scale;

    ctx.fillStyle = navigationRef.current.poseAt ? '#F59E0B' : '#64748B';
    ctx.fillRect(-robW / 2, -robH / 2, robW, robH);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(-robW / 2, -robH / 2, robW, robH);

    // Mui xe phia truoc (Heading indicator)
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.moveTo(robW / 2, 0);
    ctx.lineTo(robW / 2 - 8, -5);
    ctx.lineTo(robW / 2 - 8, 5);
    ctx.closePath();
    ctx.fill();

    // Tam RPLiDAR
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#06B6D4';
    ctx.fill();

    ctx.restore();

    // 9b. Vi tri ban dau dang chon (2D Pose Estimate): vong tron + mui ten huong dau xe
    if (poseDraft) {
      const { x: dpx, y: dpy } = worldToCanvas(poseDraft.x, poseDraft.y, width, height);
      const arrowLen = 0.45 * scale;
      const ax = dpx + arrowLen * Math.cos(poseDraft.yaw);
      const ay = dpy - arrowLen * Math.sin(poseDraft.yaw);

      ctx.beginPath();
      ctx.arc(dpx, dpy, 0.22 * scale, 0, Math.PI * 2);
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(dpx, dpy);
      ctx.lineTo(ax, ay);
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 3;
      ctx.stroke();

      const head = 9;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - head * Math.cos(poseDraft.yaw - 0.45), ay + head * Math.sin(poseDraft.yaw - 0.45));
      ctx.lineTo(ax - head * Math.cos(poseDraft.yaw + 0.45), ay + head * Math.sin(poseDraft.yaw + 0.45));
      ctx.closePath();
      ctx.fillStyle = '#22C55E';
      ctx.fill();

      ctx.fillStyle = '#22C55E';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `Start (${poseDraft.x.toFixed(2)}, ${poseDraft.y.toFixed(2)}, ${((poseDraft.yaw * 180) / Math.PI).toFixed(0)}°)`,
        dpx,
        dpy + 0.22 * scale + 14
      );
    }

    // 10. Toa do truc goc Oxy (0, 0)
    const { x: opx, y: opy } = worldToCanvas(0.0, 0.0, width, height);
    ctx.beginPath();
    ctx.arc(opx, opy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#10B981';
    ctx.fill();
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('Gốc map (0,0)', opx + 6, opy + 12);
}
