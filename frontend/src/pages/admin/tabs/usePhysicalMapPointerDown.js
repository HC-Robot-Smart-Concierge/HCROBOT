import {
  isPointInZone,
  zoneRotationHandle,
  zoneCorners,
  isPolygonZone,
  MAX_ZONE_VERTICES,
  insertZoneVertex,
  polygonEdgeAtPoint,
} from './physicalMapZones';
import { transformWorldToCanvas } from './physicalMapConstants';

export function usePhysicalMapPointerDown({
  addEndpointType, canvasRef, canvasToWorld, clickStartRef, endpoints, finishPolygon, handleAddEndpoint, isAddEndpointMode, isDraggingRef, isPoseSetMode, openPanelSection, panLastRef, rejectZoneRule, robotPose, selectedZone, setDragState, setPoseDraft, setSelectedEndpoint, setSelectedZone, setSelectedZoneVertex, setZoneDraft, setZoneEdgeHover, setZones, showEndpoints, showZones, viewConfig, worldToCanvas, zoneDraft, zoneDrawShape, zoneDrawType, zoneEditRef, zones,
}) {
  const handleCanvasMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    zoneEditRef.current = null;
    setZoneEdgeHover(null);
    const rect = canvas.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const { worldX, worldY } = canvasToWorld(canvasX, canvasY, canvas.width, canvas.height);

    // Chuot phai / chuot giua = keo map (dung duoc ca khi dang o che do ghim/ve vung/dat vi tri)
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      panLastRef.current = { x: canvasX, y: canvasY };
      setDragState({ type: 'PAN' });
      isDraggingRef.current = true;
      return;
    }

    // 0. Che do Dat vi tri ban dau: click = vi tri, keo = huong dau xe
    if (isPoseSetMode) {
      setPoseDraft({ x: worldX, y: worldY, yaw: robotPose.yaw });
      setDragState({ type: 'POSE', mouseStartX: canvasX, mouseStartY: canvasY });
      isDraggingRef.current = true;
      return;
    }

    // 0b. Che do Ghim Endpoint: Click de dat endpoint moi ngay tai vi tri click tren ban do
    if (isAddEndpointMode) {
      handleAddEndpoint(addEndpointType, { x: worldX, y: worldY });
      return;
    }

    // 0c. Che do Ve vung: nhan chuot = 1 goc, keo toi goc doi dien, tha chuot = tao vung
    if (zoneDrawType) {
      const p = { x: Number(worldX.toFixed(3)), y: Number(worldY.toFixed(3)) };
      if (zoneDrawShape === 'polygon') {
        const vertices = zoneDraft?.vertices || [];
        if (vertices.length >= 3) {
          const first = worldToCanvas(vertices[0].x, vertices[0].y, canvas.width, canvas.height);
          if (Math.hypot(canvasX - first.x, canvasY - first.y) <= 12) {
            finishPolygon();
            return;
          }
        }
        if (vertices.length >= MAX_ZONE_VERTICES) {
          rejectZoneRule('Đa giác tối đa 64 đỉnh. Bấm Hoàn tất hoặc Bỏ đỉnh cuối để chỉnh lại.');
          return;
        }
        if (vertices.some((v) => Math.hypot(v.x - p.x, v.y - p.y) < 0.005)) return;
        setZoneDraft({ type: zoneDrawType, vertices: [...vertices, p], cursor: p });
        return;
      }
      setZoneDraft({ type: zoneDrawType, a: p, b: p });
      setDragState({ type: 'ZONE_DRAW' });
      isDraggingRef.current = true;
      return;
    }

    // 0d. Vung dang chon: nhan trung o vuong o goc (<= 8px) => keo de doi kich thuoc
    if (showZones && isPolygonZone(selectedZone)) {
      const vertex = selectedZone.vertices.findIndex((p) => {
        const c = worldToCanvas(p.x, p.y, canvas.width, canvas.height);
        return Math.hypot(canvasX - c.x, canvasY - c.y) <= 12;
      });
      if (vertex >= 0) {
        setSelectedZoneVertex(vertex);
        clickStartRef.current = { type: 'ZONE', startX: canvasX, startY: canvasY, hasMoved: false };
        setDragState({ type: 'ZONE_VERTEX', id: selectedZone.id, vertex, orig: selectedZone });
        isDraggingRef.current = true;
        return;
      }
      const edge = polygonEdgeAtPoint(
        selectedZone.vertices.map((p) => worldToCanvas(p.x, p.y, canvas.width, canvas.height)),
        { x: canvasX, y: canvasY }
      );
      if (edge) {
        const result = insertZoneVertex(selectedZone, edge.edgeIndex, { x: worldX, y: worldY });
        if (result.error) { rejectZoneRule(result.error); return; }
        setSelectedZone(result.zone);
        setSelectedZoneVertex(result.vertexIndex);
        setZones((prev) => prev.map((z) => z.id === selectedZone.id ? result.zone : z));
        zoneEditRef.current = result.zone;
        clickStartRef.current = { type: 'ZONE', startX: canvasX, startY: canvasY, hasMoved: false };
        // Commit on release, so one press can insert and drag without saving an intermediate shape.
        setDragState({ type: 'ZONE_VERTEX', id: selectedZone.id, vertex: result.vertexIndex,
          orig: selectedZone, editBase: result.zone, inserted: true });
        isDraggingRef.current = true;
        return;
      }
    } else if (showZones && selectedZone) {
      const { scale } = transformWorldToCanvas(0, 0, canvas.width, canvas.height, viewConfig);
      const rotation = zoneRotationHandle(selectedZone, 28 / scale);
      const handle = worldToCanvas(rotation.x, rotation.y, canvas.width, canvas.height);
      if (Math.hypot(canvasX - handle.x, canvasY - handle.y) <= 12) {
        clickStartRef.current = { type: 'ZONE', startX: canvasX, startY: canvasY, hasMoved: false };
        setDragState({ type: 'ZONE_ROTATE', id: selectedZone.id, orig: { ...selectedZone },
          startPoint: { x: worldX, y: worldY } });
        isDraggingRef.current = true;
        return;
      }
      const corners = zoneCorners(selectedZone);
      const center = worldToCanvas(selectedZone.x, selectedZone.y, canvas.width, canvas.height);
      const hit = Math.hypot(canvasX - center.x, canvasY - center.y) > 4 && Object.keys(corners).map((key) => {
        const c = worldToCanvas(corners[key].x, corners[key].y, canvas.width, canvas.height);
        return { key, distance: Math.hypot(canvasX - c.x, canvasY - c.y) };
      }).sort((a, b) => a.distance - b.distance).find((c) => c.distance <= 12)?.key;
      if (hit) {
        clickStartRef.current = { type: 'ZONE', startX: canvasX, startY: canvasY, hasMoved: false };
        setDragState({
          type: 'ZONE_RESIZE', id: selectedZone.id, corner: hit,
          orig: { ...selectedZone },
        });
        isDraggingRef.current = true;
        return;
      }
    }

    setSelectedZoneVertex(null);

    // 1. Kiem tra click trúng Endpoint (r <= 18px)
    if (showEndpoints) {
      for (const ep of endpoints) {
        const { x: epx, y: epy } = worldToCanvas(ep.x, ep.y, canvas.width, canvas.height);
        const dist = Math.hypot(canvasX - epx, canvasY - epy);
        if (dist <= 18) {
          setSelectedEndpoint(ep);
          setSelectedZone(null);
          openPanelSection('WAYPOINTS');
          clickStartRef.current = {
            type: 'ENDPOINT',
            ep,
            startX: canvasX,
            startY: canvasY,
            hasMoved: false,
          };
          setDragState({
            type: 'ENDPOINT',
            id: ep.id,
            mouseStartX: canvasX,
            mouseStartY: canvasY,
            initX: ep.x,
            initY: ep.y,
          });
          isDraggingRef.current = true;
          return;
        }
      }
    }

    // 2. Kiem tra click trúng Zone
    if (showZones) {
      for (let i = zones.length - 1; i >= 0; i--) {
        const zone = zones[i];
        if (isPointInZone(worldX, worldY, zone)) {
          setSelectedZone(zone);
          setSelectedEndpoint(null);
          openPanelSection('ZONES');
          clickStartRef.current = {
            type: 'ZONE',
            zone,
            startX: canvasX,
            startY: canvasY,
            hasMoved: false,
          };
          setDragState({
            type: 'ZONE',
            id: zone.id,
            mouseStartX: canvasX,
            mouseStartY: canvasY,
            initX: zone.x,
            initY: zone.y,
            orig: { ...zone },
          });
          isDraggingRef.current = true;
          return;
        }
      }
    }

    // 3. Neu khong trung: Bo chon (Khong tu dong chay robot khi click vung trong); giu chuot keo = keo map
    setSelectedEndpoint(null);
    setSelectedZone(null);
    clickStartRef.current = null;
    panLastRef.current = { x: canvasX, y: canvasY };
    setDragState({ type: 'PAN' });
    isDraggingRef.current = true;
  };

  return { handleCanvasMouseDown };
}
