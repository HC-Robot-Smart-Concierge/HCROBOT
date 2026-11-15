import {
  createWaypointSyncMsg,
  createZoneSyncMsg,
} from '../../../services/rosbridgeService';
import {
  saveWaypoint,
  deleteWaypoint,
  saveZone,
  deleteZone,
  updateRos2KeepoutMask,
} from '../../../services/workflowApi';
import {
  endpointPlacementViolation,
  zoneEndpointConflict,
  isPolygonZone,
  polygonValidationError,
  zoneFromVertices,
  removeZoneVertex,
} from './physicalMapZones';
import { getEndpointTemplateInfo } from './studio/studioConstants';
import { ZONE_TEMPLATES } from './physicalMapConstants';

export function usePhysicalMapEntities({
  closePopup, deleteZoneVertexRef, dragState, endpoints, handleSendGoalRef, isAddEndpointMode, isDraggingRef, isPoseSetMode, mapConfig, navigatingEndpointId, openPanelSection, pi5WsRef, rosClientRef, selectedEndpoint, selectedZone, selectedZoneVertex, setAddEndpointType, setEndpoints, setHasUnsavedEndpoints, setHasUnsavedZones, setIsAddEndpointMode, setIsNavigating, setIsPoseSetMode, setIsSavingEndpoints, setIsSavingZones, setNavStatus, setNavigatingEndpointId, setPoseDraft, setSelectedEndpoint, setSelectedGoal, setSelectedZone, setSelectedZoneVertex, setShowEndpoints, setShowZones, setZoneDraft, setZoneDrawType, setZones, showZones, t, zoneDraft, zoneDrawType, zones,
}) {
  const handleSendGoal = (...args) => handleSendGoalRef.current?.(...args);

  // ==========================================
  // Vi pham luat vung cam dung/cam vao <-> endpoint: hop thoai (de admin khong bo lo) + dong trang thai
  const rejectZoneRule = (message) => {
    setNavStatus(`⛔ ${message}`);
    window.alert(message);
  };

  const handleAddEndpoint = (type = 'PARK', customCoords = null) => {
    const tmpl = getEndpointTemplateInfo(type);
    const count = endpoints.length + 1;
    const typeLabel = type === 'CHARGER' ? 'Trạm Sạc' : type === 'PARK' ? 'Điểm Đỗ' : 'Điểm Mốc';
    const placement = endpointPlacementViolation(customCoords || { x: 1.5, y: 0.0 }, zones);
    if (placement) {
      rejectZoneRule(placement);
      return;
    }
    const newEp = {
      id: `wp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${typeLabel} #${count}`,
      type,
      x: customCoords ? Number(customCoords.x.toFixed(2)) : 1.50,
      y: customCoords ? Number(customCoords.y.toFixed(2)) : 0.00,
      yaw: 0.0,
      color: tmpl.color || '#3B82F6',
      map_id: mapConfig.mapId,
    };
    const nextList = [...endpoints, newEp];
    setEndpoints(nextList);
    setSelectedEndpoint(newEp);
    setSelectedZone(null);
    setHasUnsavedEndpoints(true);
    openPanelSection('WAYPOINTS');
    setNavStatus(`Đã tạo ${newEp.name} tại (${newEp.x}m, ${newEp.y}m)`);

    saveWaypoint(newEp).catch((err) => {
      console.warn('Lỗi lưu endpoint vào backend:', err.message);
    });

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/hotel_waypoints', 'std_msgs/String', createWaypointSyncMsg(nextList));
    }
  };

  const handleNavigateToEndpoint = (ep) => {
    if (!ep) return;
    setSelectedEndpoint(ep);
    setSelectedZone(null);
    setNavigatingEndpointId(ep.id);
    // Bi tu choi (vung cam, chua dinh vi...) thi giu nguyen thong bao loi cua handleSendGoal.
    if (!handleSendGoal(Number(ep.x) || 0.0, Number(ep.y) || 0.0, Number(ep.yaw) || 0.0)) return;
    setNavStatus(`Bấm chọn '${ep.name}' → Đang điều hướng robot tới (${Number(ep.x).toFixed(2)}, ${Number(ep.y).toFixed(2)})...`);
  };

  const handleUpdateSelectedEndpoint = (field, value) => {
    if (!selectedEndpoint) return;
    const updated = { ...selectedEndpoint, [field]: value };
    if (field === 'x' || field === 'y') {
      const placement = endpointPlacementViolation({ x: Number(updated.x), y: Number(updated.y) }, zones);
      if (placement) {
        rejectZoneRule(placement);
        return;
      }
    }
    if (field === 'type') {
      const tmpl = getEndpointTemplateInfo(value);
      updated.color = tmpl.color || updated.color;
    }
    setSelectedEndpoint(updated);
    const nextList = endpoints.map((ep) => (ep.id === updated.id ? updated : ep));
    setEndpoints(nextList);
    setHasUnsavedEndpoints(true);

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/hotel_waypoints', 'std_msgs/String', createWaypointSyncMsg(nextList));
    }
  };

  const handleSaveEndpoints = async () => {
    setIsSavingEndpoints(true);
    try {
      for (const ep of endpoints) {
        await saveWaypoint({ ...ep, map_id: mapConfig.mapId });
      }
      setHasUnsavedEndpoints(false);
      setNavStatus('Đã lưu toàn bộ điểm mốc vào CSDL');

      if (rosClientRef.current?.isConnected) {
        rosClientRef.current.publish('/hotel_waypoints', 'std_msgs/String', createWaypointSyncMsg(endpoints));
      }
      if (pi5WsRef.current && pi5WsRef.current.readyState === WebSocket.OPEN) {
        pi5WsRef.current.send(JSON.stringify({ type: 'SYNC_WAYPOINTS', waypoints: endpoints }));
      }
    } catch (err) {
      console.warn('[AdminPhysicalMapTab] Failed to save endpoints:', err);
      setNavStatus('Lỗi khi lưu điểm mốc vào CSDL');
    } finally {
      setIsSavingEndpoints(false);
    }
  };

  const handleDeleteEndpoint = (id) => {
    const target = endpoints.find((ep) => ep.id === id);
    const nextList = endpoints.filter((ep) => ep.id !== id);
    setEndpoints(nextList);
    if (selectedEndpoint?.id === id) {
      setSelectedEndpoint(null);
    }
    if (navigatingEndpointId === id) {
      setNavigatingEndpointId(null);
      setIsNavigating(false);
      setSelectedGoal(null);
    }
    setHasUnsavedEndpoints(true);

    deleteWaypoint(id).catch((err) => {
      console.warn('Lỗi khi xóa endpoint ở backend:', err.message);
    });

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/hotel_waypoints', 'std_msgs/String', createWaypointSyncMsg(nextList));
    }
    setNavStatus(`Đã xóa điểm mốc "${target?.name || id}"`);
  };

  // ==========================================
  // QUAN LY ZONES (VUNG CHUC NANG)
  // ==========================================
  // Luu 1 vung vao CSDL roi tao lai mask Nav2 (vung cam + gioi han toc do): Nav2 dang chay
  // thi ap dung ngay, khong can bam "Lưu".
  const persistZone = (zone, nextList, prefix) => {
    saveZone({ ...zone, map_id: mapConfig.mapId })
      .then(() => refreshNav2Keepout(prefix))
      .catch((err) => {
        console.warn('Lỗi lưu zone vào backend:', err.message);
        setHasUnsavedZones(true);
        setNavStatus(`Chưa lưu được vùng "${zone.name}" vào CSDL: ${err.message}`);
      });
    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/hotel_zones', 'std_msgs/String', createZoneSyncMsg(nextList));
    }
  };

  // rect = { x, y, width, height } (vung ve bang chuot); khong co thi dat 1x1 m giua map.
  const handleAddZone = (type = 'KEEP_OUT', rect = null) => {
    const tmpl = ZONE_TEMPLATES.find((t) => t.type === type) || ZONE_TEMPLATES[0];
    const count = zones.length + 1;
    const prefix = type === 'KEEP_OUT' ? 'Cấm Vào' : type === 'SPEED_ZONE' ? 'Giới Hạn Tốc Độ' : 'Cấm Dừng';
    const geometry = rect || {
      x: Number((mapConfig.originX + mapConfig.widthMeters / 2).toFixed(2)),
      y: Number((mapConfig.originY + mapConfig.heightMeters / 2).toFixed(2)),
      width: 1.0,
      height: 1.0,
    };
    const newZone = {
      id: `zone-${Date.now().toString(36)}`,
      name: `${prefix} #${count}`,
      type,
      ...geometry,
      speed_limit: tmpl.defaultSpeed,
      description: tmpl.description,
      map_id: mapConfig.mapId,
    };
    const conflict = zoneEndpointConflict(newZone, endpoints);
    if (conflict) {
      rejectZoneRule(conflict.message);
      return false;
    }
    const nextList = [...zones, newZone];
    setZones(nextList);
    setSelectedZone(newZone);
    setSelectedEndpoint(null);
    openPanelSection('ZONES');
    persistZone(newZone, nextList, `Đã tạo vùng "${newZone.name}" (${newZone.width} x ${newZone.height} m)`);
    return true;
  };

  const finishPolygon = () => {
    const vertices = zoneDraft?.vertices || [];
    const error = polygonValidationError(vertices);
    if (error) {
      rejectZoneRule(error);
      return;
    }
    if (handleAddZone(zoneDrawType, zoneFromVertices(vertices))) {
      setZoneDraft(null);
      setZoneDrawType(null);
    }
  };

  const handleDeleteSelectedVertex = () => {
    if (!isPolygonZone(selectedZone) || selectedZoneVertex === null || !showZones
      || zoneDrawType || isPoseSetMode || isAddEndpointMode || dragState || isDraggingRef.current) return false;
    const result = removeZoneVertex(selectedZone, selectedZoneVertex);
    const conflict = result.zone && zoneEndpointConflict(result.zone, endpoints);
    if (result.error || conflict) {
      rejectZoneRule(result.error || conflict.message);
      return true;
    }
    const updated = result.zone;
    const nextList = zones.map((z) => z.id === updated.id ? updated : z);
    setZones(nextList);
    setSelectedZone(updated);
    setSelectedZoneVertex(null);
    persistZone(updated, nextList, `Đã xóa đỉnh ${selectedZoneVertex + 1} của vùng "${updated.name}" • Còn ${updated.vertices.length} đỉnh`);
    return true;
  };
  // The keyboard listener is stable; keep its vertex action on the current selection.
  deleteZoneVertexRef.current = handleDeleteSelectedVertex;

  const toggleZoneDraw = (type) => {
    setZoneDraft(null);
    setZoneDrawType((cur) => (cur === type ? null : type));
    setShowZones(true);
    setIsAddEndpointMode(false);
    setIsPoseSetMode(false);
    setPoseDraft(null);
    setSelectedEndpoint(null);
    setSelectedZone(null);
    closePopup();
  };

  const startPointPlacement = (type) => {
    setAddEndpointType(type);
    setIsAddEndpointMode(true);
    setShowEndpoints(true);
    setIsPoseSetMode(false);
    setPoseDraft(null);
    setZoneDrawType(null);
    setZoneDraft(null);
    setSelectedEndpoint(null);
    setSelectedZone(null);
    closePopup();
    setNavStatus('Click trên bản đồ để đặt điểm mốc. Nhấn Esc để hủy.');
  };

  const handleUpdateSelectedZone = (field, value) => {
    if (!selectedZone) return false;
    const updated = { ...selectedZone, [field]: value };
    // Doi loai sang cam dung/cam vao, hoac doi tam/kich thuoc bang o nhap => de len endpoint?
    // (Doi ten/mo ta thi khong xet, de vung cu lo de endpoint van sua ten duoc.)
    const geometryChange = ['type', 'x', 'y', 'width', 'height', 'yaw'].includes(field);
    const conflict = geometryChange && zoneEndpointConflict(updated, endpoints);
    if (conflict) {
      rejectZoneRule(conflict.message);
      return false;
    }
    setSelectedZone(updated);
    const nextList = zones.map((z) => (z.id === updated.id ? updated : z));
    setZones(nextList);
    setHasUnsavedZones(true);

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/hotel_zones', 'std_msgs/String', createZoneSyncMsg(nextList));
    }
    return true;
  };

  // KEEP_OUT -> mask Keepout Filter, SPEED_ZONE -> mask Speed Filter cua Nav2
  // (robot/maps/keepout|speed/<map>.pgm); Nav2 dang chay thi nap lai ngay, khong thi dung khi
  // bat Navigation lan sau. NO_STOP khong co mask: chan endpoint ngay tren Web (handleSendGoal).
  const refreshNav2Keepout = (prefix) => {
    updateRos2KeepoutMask(mapConfig.mapId)
      .then((res) =>
        setNavStatus(
          `${prefix} • Nav2: ${res?.keepout_zones ?? 0} vùng cấm, ${res?.speed_zones ?? 0} vùng giới hạn tốc độ ${
            res?.reloaded ? 'đã nạp lại ngay' : 'sẽ áp dụng khi bật Navigation'
          }`
        )
      )
      .catch((err) => {
        console.warn('[AdminPhysicalMapTab] Cập nhật mask vùng lỗi:', err.message);
        setNavStatus(`${prefix} • Chưa cập nhật được vùng cho Nav2: ${err.message}`);
      });
  };

  const handleSaveZones = async () => {
    setIsSavingZones(true);
    try {
      for (const z of zones) {
        await saveZone({ ...z, map_id: mapConfig.mapId });
      }
      setHasUnsavedZones(false);
      setNavStatus('Đã lưu toàn bộ vùng chức năng vào CSDL');
      refreshNav2Keepout('Đã lưu vùng chức năng');

      if (rosClientRef.current?.isConnected) {
        rosClientRef.current.publish('/hotel_zones', 'std_msgs/String', createZoneSyncMsg(zones));
      }
      if (pi5WsRef.current && pi5WsRef.current.readyState === WebSocket.OPEN) {
        pi5WsRef.current.send(JSON.stringify({ type: 'SYNC_ZONES', zones }));
      }
    } catch (err) {
      console.warn('[AdminPhysicalMapTab] Failed to save zones:', err);
      setNavStatus('Lỗi khi lưu vùng chức năng vào CSDL');
    } finally {
      setIsSavingZones(false);
    }
  };

  const handleDeleteZone = (id) => {
    const target = zones.find((z) => z.id === id);
    const nextList = zones.filter((z) => z.id !== id);
    setZones(nextList);
    if (selectedZone?.id === id) {
      setSelectedZone(null);
    }
    setHasUnsavedZones(true);

    deleteZone(id)
      .then(() => refreshNav2Keepout(`Đã xóa vùng "${target?.name || id}"`))
      .catch((err) => {
        console.warn('Lỗi xóa zone ở backend:', err.message);
      });

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/hotel_zones', 'std_msgs/String', createZoneSyncMsg(nextList));
    }
    setNavStatus(`Đã xóa vùng "${target?.name || id}"`);
  };

  return {
    rejectZoneRule,
    handleAddEndpoint,
    handleNavigateToEndpoint,
    handleUpdateSelectedEndpoint,
    handleSaveEndpoints,
    handleDeleteEndpoint,
    persistZone,
    handleAddZone,
    finishPolygon,
    handleDeleteSelectedVertex,
    toggleZoneDraw,
    startPointPlacement,
    handleUpdateSelectedZone,
    handleSaveZones,
    handleDeleteZone,
  };
}
