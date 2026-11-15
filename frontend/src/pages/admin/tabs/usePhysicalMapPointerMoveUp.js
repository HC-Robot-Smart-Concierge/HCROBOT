import {
  endpointPlacementViolation,
  isPointInZone,
  normalizeZoneYaw,
  rotateZoneFromPointer,
  zoneRotationHandle,
  resizeZoneFromCorner,
  zoneEndpointConflict,
  zoneCorners,
  zoneFromCorners,
  isPolygonZone,
  MAX_ZONE_VERTICES,
  polygonValidationError,
  zoneFromVertices,
  translateZone,
  polygonEdgeAtPoint,
} from './physicalMapZones';
import { panView } from './physicalMapView';
import { transformWorldToCanvas } from './physicalMapConstants';

export function usePhysicalMapPointerMoveUp({
  canvasRef, canvasToWorld, clickStartRef, dragState, endpoints, handleAddZone, handleApplyInitialPose, handleNavigateToEndpoint, isDraggingRef, mapConfig, panLastRef, persistZone, poseDraft, rejectZoneRule, selectedZone, setDragState, setEndpoints, setHasUnsavedEndpoints, setHoveredEndpointId, setMapView, setNavStatus, setPoseDraft, setSelectedEndpoint, setSelectedZone, setSelectedZoneVertex, setZoneCursor, setZoneDraft, setZoneDrawType, setZoneEdgeHover, setZones, showEndpoints, showZones, viewConfig, worldToCanvas, zoneDraft, zoneDrawShape, zoneDrawType, zoneEditRef, zones,
}) {
  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (zoneDrawType && zoneDrawShape === 'polygon' && zoneDraft?.vertices && !dragState) {
      const { worldX, worldY } = canvasToWorld(canvasX, canvasY, canvas.width, canvas.height);
      setZoneDraft((draft) => draft && { ...draft, cursor: { x: worldX, y: worldY } });
    }
    if (!dragState && showZones && isPolygonZone(selectedZone)) {
      const vertex = selectedZone.vertices.some((p) => {
        const c = worldToCanvas(p.x, p.y, canvas.width, canvas.height);
        return Math.hypot(canvasX - c.x, canvasY - c.y) <= 12;
      });
      const { worldX, worldY } = canvasToWorld(canvasX, canvasY, canvas.width, canvas.height);
      const edge = !vertex && polygonEdgeAtPoint(
        selectedZone.vertices.map((p) => worldToCanvas(p.x, p.y, canvas.width, canvas.height)),
        { x: canvasX, y: canvasY }
      );
      const canInsert = selectedZone.vertices.length < MAX_ZONE_VERTICES;
      if (edge && canInsert) {
        const p = canvasToWorld(edge.point.x, edge.point.y, canvas.width, canvas.height);
        setZoneEdgeHover({ zoneId: selectedZone.id, edgeIndex: edge.edgeIndex, point: { x: p.worldX, y: p.worldY } });
      } else setZoneEdgeHover(null);
      setZoneCursor(vertex ? 'crosshair' : edge ? (canInsert ? 'copy' : 'not-allowed')
        : isPointInZone(worldX, worldY, selectedZone) ? 'move' : null);
    } else if (!dragState && showZones && selectedZone) {
      const { scale } = transformWorldToCanvas(0, 0, canvas.width, canvas.height, viewConfig);
      const rotation = zoneRotationHandle(selectedZone, 28 / scale);
      const rh = worldToCanvas(rotation.x, rotation.y, canvas.width, canvas.height);
      const corner = Object.values(zoneCorners(selectedZone)).some((p) => {
        const c = worldToCanvas(p.x, p.y, canvas.width, canvas.height);
        return Math.hypot(canvasX - c.x, canvasY - c.y) <= 12;
      });
      const { worldX, worldY } = canvasToWorld(canvasX, canvasY, canvas.width, canvas.height);
      setZoneCursor(Math.hypot(canvasX - rh.x, canvasY - rh.y) <= 12 ? 'grab'
        : corner ? 'crosshair' : isPointInZone(worldX, worldY, selectedZone) ? 'move' : null);
    } else if (!dragState) setZoneCursor(null);

    // Kiem tra hover len Endpoint khi khong keo tha de tao con tro chuot pointer
    if (!dragState && showEndpoints) {
      let hovered = null;
      for (const ep of endpoints) {
        const { x: epx, y: epy } = worldToCanvas(ep.x, ep.y, canvas.width, canvas.height);
        if (Math.hypot(canvasX - epx, canvasY - epy) <= 18) {
          hovered = ep.id;
          break;
        }
      }
      setHoveredEndpointId(hovered);
    }

    if (!dragState) return;

    if (clickStartRef.current) {
      const moved = Math.hypot(canvasX - clickStartRef.current.startX, canvasY - clickStartRef.current.startY);
      if (moved > 6) {
        clickStartRef.current.hasMoved = true;
      }
    }

    if (dragState.type === 'PAN') {
      const last = panLastRef.current;
      panLastRef.current = { x: canvasX, y: canvasY };
      if (last) {
        const dx = canvasX - last.x;
        const dy = canvasY - last.y;
        setMapView((v) => panView(v, dx, dy, canvas.width, canvas.height, mapConfig));
      }
      return;
    }

    if (clickStartRef.current) {
      const moved = Math.hypot(canvasX - clickStartRef.current.startX, canvasY - clickStartRef.current.startY);
      if (moved > 6) {
        clickStartRef.current.hasMoved = true;
      }
    }

    if (dragState.type === 'POSE') {
      const dx = canvasX - dragState.mouseStartX;
      const dy = canvasY - dragState.mouseStartY;
      // Truc Y canvas huong xuong, truc Y the gioi huong len => dao dau dy
      if (Math.hypot(dx, dy) > 8) {
        setPoseDraft((prev) => (prev ? { ...prev, yaw: Math.atan2(-dy, dx) } : prev));
      }
      return;
    }

    if (['ZONE', 'ZONE_RESIZE', 'ZONE_ROTATE', 'ZONE_VERTEX'].includes(dragState.type) && !clickStartRef.current?.hasMoved) return;

    if (dragState.type === 'ZONE_VERTEX') {
      const { worldX, worldY } = canvasToWorld(canvasX, canvasY, canvas.width, canvas.height);
      const base = dragState.editBase || dragState.orig;
      const vertices = base.vertices.map((p, i) => i === dragState.vertex
        ? { x: Number(worldX.toFixed(3)), y: Number(worldY.toFixed(3)) } : p);
      const updated = { ...base, ...zoneFromVertices(vertices) };
      zoneEditRef.current = updated;
      setSelectedZone(updated);
      setZones((prev) => prev.map((z) => z.id === updated.id ? updated : z));
      return;
    }

    if (['ZONE_DRAW', 'ZONE_RESIZE', 'ZONE_ROTATE'].includes(dragState.type)) {
      const { worldX, worldY } = canvasToWorld(canvasX, canvasY, canvas.width, canvas.height);
      if (dragState.type === 'ZONE_DRAW') {
        setZoneDraft((prev) => (prev ? { ...prev, b: { x: worldX, y: worldY } } : prev));
      } else {
        const updated = {
          ...dragState.orig,
          ...(dragState.type === 'ZONE_ROTATE'
            ? rotateZoneFromPointer(dragState.orig, dragState.startPoint, { x: worldX, y: worldY }, e.shiftKey)
            : resizeZoneFromCorner(dragState.orig, dragState.corner, { x: worldX, y: worldY })),
        };
        zoneEditRef.current = updated;
        setSelectedZone(updated);
        setZones((prev) => prev.map((z) => (z.id === dragState.id ? updated : z)));
      }
      return;
    }

    const { scale } = transformWorldToCanvas(0, 0, canvas.width, canvas.height, viewConfig);
    const dxMeters = (canvasX - dragState.mouseStartX) / scale;
    const dyMeters = -(canvasY - dragState.mouseStartY) / scale;

    if (dragState.type === 'ENDPOINT') {
      const newX = Number((dragState.initX + dxMeters).toFixed(2));
      const newY = Number((dragState.initY + dyMeters).toFixed(2));
      const updated = { ...selectedEndpoint, x: newX, y: newY };
      setSelectedEndpoint(updated);
      setEndpoints((prev) => prev.map((ep) => (ep.id === dragState.id ? updated : ep)));
      setHasUnsavedEndpoints(true);
    } else if (dragState.type === 'ZONE') {
      const newX = Number((dragState.initX + dxMeters).toFixed(2));
      const newY = Number((dragState.initY + dyMeters).toFixed(2));
      const updated = translateZone(dragState.orig, newX - dragState.initX, newY - dragState.initY);
      zoneEditRef.current = updated;
      setSelectedZone(updated);
      setZones((prev) => prev.map((z) => (z.id === dragState.id ? updated : z)));
    }
  };

  const handleCanvasMouseUp = () => {
    const finishedDrag = dragState;
    const wasPoseDrag = finishedDrag?.type === 'POSE';
    const clickCandidate = clickStartRef.current;

    setDragState(null);
    isDraggingRef.current = false;
    clickStartRef.current = null;

    panLastRef.current = null;
    if (finishedDrag?.type === 'PAN') return;

    // Tha chuot sau khi ve: tao vung (qua nho = bam nham, bo qua) va thoat che do ve
    if (finishedDrag?.type === 'ZONE_DRAW') {
      const draft = zoneDraft;
      setZoneDraft(null);
      setZoneDrawType(null);
      const rect = draft && zoneFromCorners(draft.a, draft.b);
      if (rect) {
        handleAddZone(draft.type, rect);
      } else {
        setNavStatus('Vùng quá nhỏ: nhấn giữ chuột rồi kéo thành hình chữ nhật trên bản đồ (mỗi cạnh tối thiểu 20 cm).');
      }
      return;
    }

    // Keo/doi kich thuoc vung xong: de len endpoint => tra ve cho cu + bao; khong thi luu + cap nhat Nav2
    if (['ZONE', 'ZONE_RESIZE', 'ZONE_ROTATE', 'ZONE_VERTEX'].includes(finishedDrag?.type) && (clickCandidate?.hasMoved || finishedDrag.inserted)) {
      const zone = zoneEditRef.current || zones.find((z) => z.id === finishedDrag.id);
      const conflict = zone && zoneEndpointConflict(zone, endpoints);
      const geometryError = isPolygonZone(zone) && polygonValidationError(zone.vertices);
      if (conflict || geometryError) {
        const orig = finishedDrag.orig;
        const reverted = { ...zone, ...orig };
        setZones((prev) => prev.map((z) => (z.id === zone.id ? reverted : z)));
        setSelectedZone(reverted);
        if (finishedDrag.inserted) setSelectedZoneVertex(null);
        rejectZoneRule(geometryError || conflict.message);
      } else if (zone) {
        const nextList = zones.map((z) => z.id === zone.id ? zone : z);
        setZones(nextList);
        persistZone(zone, nextList, finishedDrag.inserted
          ? `Đã thêm đỉnh ${finishedDrag.vertex + 1} vào vùng "${zone.name}" • ${zone.vertices.length} đỉnh`
          : `Đã cập nhật vùng "${zone.name}" (${Number(zone.width).toFixed(2)} × ${Number(zone.height).toFixed(2)} m • ${normalizeZoneYaw(zone.yaw)}°)`);
      }
      zoneEditRef.current = null;
    }

    // Keo endpoint vao vung cam dung/cam vao => tra ve cho cu + bao
    if (finishedDrag?.type === 'ENDPOINT' && clickCandidate?.hasMoved) {
      const ep = endpoints.find((e) => e.id === finishedDrag.id);
      const placement = ep && endpointPlacementViolation({ x: Number(ep.x), y: Number(ep.y) }, zones);
      if (placement) {
        const reverted = { ...ep, x: finishedDrag.initX, y: finishedDrag.initY };
        setEndpoints((prev) => prev.map((e) => (e.id === ep.id ? reverted : e)));
        setSelectedEndpoint(reverted);
        rejectZoneRule(placement);
        return;
      }
    }

    if (wasPoseDrag && poseDraft) {
      handleApplyInitialPose(poseDraft.x, poseDraft.y, poseDraft.yaw);
      return;
    }

    // Neu nguoi dung click vao Endpoint (khong phai keo di xa > 6px) -> Robot di chuyen toi endpoint do!
    if (clickCandidate?.type === 'ENDPOINT' && !clickCandidate.hasMoved) {
      handleNavigateToEndpoint(clickCandidate.ep);
    }
  };

  const handleCanvasPointerCancel = () => {
    panLastRef.current = null;
    if (dragState?.orig && dragState.type.startsWith('ZONE')) {
      setZones((prev) => prev.map((z) => z.id === dragState.id ? dragState.orig : z));
      setSelectedZone(dragState.orig);
      if (dragState.inserted) setSelectedZoneVertex(null);
    }
    zoneEditRef.current = null;
    clickStartRef.current = null;
    isDraggingRef.current = false;
    setDragState(null);
    setZoneDraft(null);
    setPoseDraft(null);
  };


  return {
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleCanvasPointerCancel,
  };
}
