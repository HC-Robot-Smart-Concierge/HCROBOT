import { useEffect } from 'react';
import { isPolygonZone, translateZone } from '../physicalMapZones';
import { createZoneSyncMsg, createWaypointSyncMsg } from '../../../../services/rosbridgeService';
import { saveZone, saveWaypoint } from '../../../../services/workflowApi';
import { svgToMeter, isPointInSimulatorZone } from './workflowSimulatorUtils';

/**
 * Manages pointer interactions on the 2D workflow floorplan SVG:
 * panning, endpoint dragging, zone moving/resizing, and overlapping zone click cycling.
 */
export function useWorkflowCanvasPointer({
  baseWidth,
  baseHeight,
  svgRef,
  zoomScale,
  panOffset,
  setPanOffset,
  isPanning,
  setIsPanning,
  panStartRef,
  getSvgPointFromClient,
  zones,
  setZones,
  zonesRef,
  selectedZone,
  setSelectedZone,
  isZoneEditMode,
  dragState,
  setDragState,
  setHasUnsavedZones,
  endpointsRef,
  setEndpoints,
  setSelectedEndpoint,
  setIsEndpointEditMode,
  dragEndpointState,
  setDragEndpointState,
  setHasUnsavedEndpoints,
  wasDraggingRef,
  isRosEnabledRef,
  rosClientRef,
}) {
  // PointerDown de keo tha Endpoint tren SVG Map
  const handleEndpointPointerDown = (e, ep) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedEndpoint(ep);
    setSelectedZone(null);
    setIsEndpointEditMode(true);
    wasDraggingRef.current = false;
    setDragEndpointState({
      endpointId: ep.id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialEndpoint: { ...ep },
    });
  };

  // Bat dau keo tha di chuyen hoac co gian kich thuoc Vung
  const handleZonePointerDown = (e, zone, type = 'MOVE') => {
    if (!isZoneEditMode && selectedZone?.id !== zone.id) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedZone(zone);
    wasDraggingRef.current = false;
    setDragState({
      type,
      zoneId: zone.id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialZone: { ...zone },
    });
  };

  // Tinh toan toa do keo tha thoi gian thuc tren he toa do met ROS
  const handleSvgPointerMove = (e) => {
    // Xu ly Pan ban do khi dang giu chuot giua hoac giu phim Space
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      const svgRect = svgRef.current?.getBoundingClientRect();
      const scaleX = (baseWidth / zoomScale) / (svgRect?.width || 1);
      const scaleY = (baseHeight / zoomScale) / (svgRect?.height || 1);
      setPanOffset({
        x: panStartRef.current.initialPan.x + dx * scaleX,
        y: panStartRef.current.initialPan.y + dy * scaleY,
      });
      return;
    }

    if ((!dragState && !dragEndpointState) || !svgRef.current) return;

    // QUAN TRỌNG: Neu chuot KHONG con duoc de nhan (e.buttons === 0), lap tuc huy trang thai keo tha
    if (e.buttons !== undefined && (e.buttons & 1) === 0) {
      if (dragEndpointState) {
        setDragEndpointState(null);
      }
      if (dragState) {
        setDragState(null);
      }
      return;
    }

    const activeStartClientX = dragState ? dragState.startClientX : dragEndpointState.startClientX;
    const activeStartClientY = dragState ? dragState.startClientY : dragEndpointState.startClientY;

    const deltaClientX = e.clientX - activeStartClientX;
    const deltaClientY = e.clientY - activeStartClientY;
    const moveDist = Math.hypot(deltaClientX, deltaClientY);

    // Nguong phan biet click va drag (4px): Neu chi bam click ma khong re chuot thi khong bat drag
    if (moveDist < 4) return;
    if (!wasDraggingRef.current) {
      wasDraggingRef.current = true;
      try {
        const pId = dragState?.pointerId || dragEndpointState?.pointerId || e.pointerId;
        if (svgRef.current?.setPointerCapture && pId) {
          svgRef.current.setPointerCapture(pId);
        }
      } catch {
        // Ignore fallback
      }
    }

    const svgRect = svgRef.current.getBoundingClientRect();
    if (!svgRect.width || !svgRect.height) return;

    const scaleX = (baseWidth / zoomScale) / svgRect.width;
    const scaleY = (baseHeight / zoomScale) / svgRect.height;

    const deltaSvgX = deltaClientX * scaleX;
    const deltaSvgY = deltaClientY * scaleY;

    // Dong bo ti le 1:1 voi Gazebo: PPM = 90 px/m cho ca X va Y
    const deltaMeterX = deltaSvgX / 25.0;
    const deltaMeterY = -deltaSvgY / 25.0;

    // 1. KEO THA ENDPOINT
    if (dragEndpointState) {
      const initEp = dragEndpointState.initialEndpoint;
      const rawX = initEp.x + deltaMeterX;
      const rawY = initEp.y + deltaMeterY;
      const clampedX = Number(Math.max(0.5, Math.min(19.1, rawX)).toFixed(2));
      const clampedY = Number(Math.max(0.5, Math.min(12.1, rawY)).toFixed(2));

      const updatedEndpoints = endpointsRef.current.map((ep) =>
        ep.id === dragEndpointState.endpointId ? { ...ep, x: clampedX, y: clampedY } : ep
      );
      endpointsRef.current = updatedEndpoints;

      setEndpoints(updatedEndpoints);
      setSelectedEndpoint((prev) =>
        prev && prev.id === dragEndpointState.endpointId
          ? { ...prev, x: clampedX, y: clampedY }
          : prev
      );
      setHasUnsavedEndpoints(true);
      return;
    }

    const initZone = dragState.initialZone;
    if (isPolygonZone(initZone) && dragState.type !== 'MOVE') return;

    if (dragState.type === 'MOVE') {
      const halfW = (Number(initZone.width) || 2.0) / 2;
      const halfH = (Number(initZone.height) || 2.0) / 2;

      const rawX = initZone.x + deltaMeterX;
      const rawY = initZone.y + deltaMeterY;
      const clampedX = Number(Math.max(halfW, Math.min(19.60 - halfW, rawX)).toFixed(2));
      const clampedY = Number(Math.max(halfH, Math.min(12.60 - halfH, rawY)).toFixed(2));

      const updated = translateZone(initZone, clampedX - initZone.x, clampedY - initZone.y);
      const updatedZones = zonesRef.current.map((z) => (z.id === dragState.zoneId ? updated : z));
      zonesRef.current = updatedZones;
      setZones(updatedZones);
      setSelectedZone(updated);
      setHasUnsavedZones(true);
    } else {
      // RESIZE HANDLES (NW, NE, SW, SE)
      const zw = Number(initZone.width) || 2.0;
      const zh = Number(initZone.height) || 2.0;
      const left = initZone.x - zw / 2;
      const right = initZone.x + zw / 2;
      const bottom = initZone.y - zh / 2;
      const top = initZone.y + zh / 2;

      let newLeft = left;
      let newRight = right;
      let newBottom = bottom;
      let newTop = top;

      if (dragState.type === 'RESIZE_SE') {
        newRight = Math.max(left + 0.6, Math.min(19.60, right + deltaMeterX));
        newBottom = Math.min(top - 0.6, Math.max(0.0, bottom + deltaMeterY));
      } else if (dragState.type === 'RESIZE_SW') {
        newLeft = Math.min(right - 0.6, Math.max(0.0, left + deltaMeterX));
        newBottom = Math.min(top - 0.6, Math.max(0.0, bottom + deltaMeterY));
      } else if (dragState.type === 'RESIZE_NE') {
        newRight = Math.max(left + 0.6, Math.min(19.60, right + deltaMeterX));
        newTop = Math.max(bottom + 0.6, Math.min(12.60, top + deltaMeterY));
      } else if (dragState.type === 'RESIZE_NW') {
        newLeft = Math.min(right - 0.6, Math.max(0.0, left + deltaMeterX));
        newTop = Math.max(bottom + 0.6, Math.min(12.60, top + deltaMeterY));
      }

      const newWidth = Number((newRight - newLeft).toFixed(2));
      const newHeight = Number((newTop - newBottom).toFixed(2));
      const newCenterX = Number(((newLeft + newRight) / 2).toFixed(2));
      const newCenterY = Number(((newBottom + newTop) / 2).toFixed(2));

      const updated = {
        ...initZone,
        x: newCenterX,
        y: newCenterY,
        width: newWidth,
        height: newHeight,
      };

      const updatedZones = zonesRef.current.map((z) => (z.id === dragState.zoneId ? updated : z));
      zonesRef.current = updatedZones;

      setZones(updatedZones);
      setSelectedZone(updated);
      setHasUnsavedZones(true);
    }
  };

  // Ket thuc keo tha
  const handleSvgPointerUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (!dragState && !dragEndpointState) return;
    try {
      const pId = dragState?.pointerId || dragEndpointState?.pointerId || e.pointerId;
      if (svgRef.current?.releasePointerCapture && pId) {
        svgRef.current.releasePointerCapture(pId);
      }
      if (pId) {
        e.currentTarget?.releasePointerCapture?.(pId);
      }
    } catch {
      // Ignore
    }

    if (dragEndpointState) {
      const curEp = endpointsRef.current.find((ep) => ep.id === dragEndpointState.endpointId);
      if (curEp && wasDraggingRef.current) {
        saveWaypoint(curEp).catch(() => {});
        if (isRosEnabledRef.current && rosClientRef.current?.isConnected) {
          rosClientRef.current.publish(
            '/hotel_waypoints',
            'std_msgs/String',
            createWaypointSyncMsg(endpointsRef.current)
          );
        }
      }
      setDragEndpointState(null);
    }

    if (dragState) {
      const curZone = zonesRef.current.find((z) => z.id === dragState.zoneId);
      if (curZone && wasDraggingRef.current) {
        saveZone(curZone).catch(() => {});
      }
      if (isRosEnabledRef.current && rosClientRef.current?.isConnected && wasDraggingRef.current) {
        rosClientRef.current.publish(
          '/hotel_zones',
          'std_msgs/String',
          createZoneSyncMsg(zonesRef.current)
        );
      }
      setDragState(null);
    }

    setTimeout(() => {
      wasDraggingRef.current = false;
    }, 80);
  };

  // Bat dau Pan ban do
  const handleSvgPointerDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        initialPan: { ...panOffset },
      };
    }
  };

  // Xu ly click chon vung hoac chuyen doi luan phien khi cac vung chong len nhau
  const handleZoneClick = (e, clickedZone) => {
    if (!isZoneEditMode && !selectedZone) {
      return;
    }

    e.stopPropagation();
    if (wasDraggingRef.current) return;

    const pt = getSvgPointFromClient(e.clientX, e.clientY);
    const meter = svgToMeter(pt.x, pt.y);

    // Tim tat ca cac vung bao phu toa do click
    const overlapping = zones.filter((z) => isPointInSimulatorZone(meter.x, meter.y, z));
    if (overlapping.length > 1) {
      const currentIdx = overlapping.findIndex((z) => z.id === selectedZone?.id);
      const nextIdx = (currentIdx + 1) % overlapping.length;
      setSelectedZone(overlapping[nextIdx]);
      return;
    }

    setSelectedZone(selectedZone?.id === clickedZone.id ? null : clickedZone);
  };

  // Giai phong trang thai keo tha tren toan bo document / window khi nguoi dung tha chuot
  useEffect(() => {
    const handleGlobalPointerUp = (e) => {
      if (dragState || dragEndpointState) {
        handleSvgPointerUp(e);
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, [dragState, dragEndpointState]);

  return {
    handleEndpointPointerDown,
    handleZonePointerDown,
    handleSvgPointerMove,
    handleSvgPointerUp,
    handleSvgPointerDown,
    handleZoneClick,
  };
}
