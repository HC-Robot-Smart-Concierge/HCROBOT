import { useEffect } from 'react';
import { createWaypointSyncMsg } from '../../../../services/rosbridgeService';
import { fetchWaypoints, saveWaypoint, deleteWaypoint } from '../../../../services/workflowApi';
import { getEndpointTemplateInfo } from '../studio/studioConstants';
import { STANDARD_LOBBY_WAYPOINTS } from './workflowSimulatorUtils';

/**
 * Loads map endpoints (WAYPOINT, CHARGER, PARK) and manages CRUD + ROS 2 sync.
 */
export function useWorkflowEndpointActions({
  endpoints,
  setEndpoints,
  endpointsRef,
  selectedEndpoint,
  setSelectedEndpoint,
  setSelectedZone,
  setIsEndpointEditMode,
  setIsEndpointMenuOpen,
  setIsMapMenuOpen,
  setHasUnsavedEndpoints,
  setIsSavingEndpoints,
  robotPose,
  isRosEnabledRef,
  rosClientRef,
  onNotify,
}) {
  // Tai danh sach Endpoints tu backend CSDL
  useEffect(() => {
    let isMounted = true;
    fetchWaypoints()
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setEndpoints(data);
        }
      })
      .catch(() => {
        // Fallback giu nguyen STANDARD_LOBBY_WAYPOINTS
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const syncEndpointsToRos = (nextEndpoints) => {
    if (isRosEnabledRef.current && rosClientRef.current?.isConnected) {
      rosClientRef.current.publish(
        '/hotel_waypoints',
        'std_msgs/String',
        createWaypointSyncMsg(nextEndpoints)
      );
    }
  };

  // Them Endpoint moi (Add Endpoint)
  const handleAddEndpoint = (type = 'WAYPOINT', customCoords = null) => {
    setIsEndpointMenuOpen(false);
    setIsMapMenuOpen(false);
    const count = endpoints.filter((e) => (e.type || 'WAYPOINT') === type).length + 1;
    const typeInfo = getEndpointTemplateInfo(type);
    const defaultName =
      type === 'CHARGER'
        ? `Trạm Sạc #${count}`
        : type === 'PARK'
        ? `Điểm Chờ #${count}`
        : `Điểm Mốc #${count}`;

    const x = customCoords
      ? Number(customCoords.x.toFixed(2))
      : Number(Math.min(18.5, Math.max(1.0, robotPose.x + 0.8)).toFixed(2));
    const y = customCoords
      ? Number(customCoords.y.toFixed(2))
      : Number(Math.min(11.5, Math.max(1.0, robotPose.y + 0.5)).toFixed(2));

    const newEndpoint = {
      id: `wp-${Date.now().toString(36)}`,
      name: defaultName,
      type,
      x,
      y,
      yaw: 0,
      floor: 'Sảnh Tầng 1',
      description: typeInfo.description,
    };

    setEndpoints((prev) => [...prev, newEndpoint]);
    setSelectedEndpoint(newEndpoint);
    setSelectedZone(null);
    setIsEndpointEditMode(true);
    setHasUnsavedEndpoints(true);
    onNotify(`Đã thêm mới ${typeInfo.label.split('(')[0].trim()}: "${newEndpoint.name}"`, 'success');

    saveWaypoint(newEndpoint).catch((err) => {
      console.warn('Lỗi lưu endpoint vào backend:', err.message);
    });

    syncEndpointsToRos([...endpoints, newEndpoint]);
  };

  // Cap nhat thong tin Endpoint (ten, loai)
  const handleUpdateSelectedEndpoint = (field, value) => {
    if (!selectedEndpoint) return;
    const updated = { ...selectedEndpoint, [field]: value };
    setSelectedEndpoint(updated);
    const nextEndpoints = endpoints.map((e) => (e.id === updated.id ? updated : e));
    setEndpoints(nextEndpoints);
    setHasUnsavedEndpoints(true);
    syncEndpointsToRos(nextEndpoints);
  };

  // Luu endpoint vao CSDL
  const handleSaveEndpointToDb = async (endpoint) => {
    if (!endpoint || !endpoint.name?.trim()) return;
    try {
      setIsSavingEndpoints(true);
      await saveWaypoint({
        ...endpoint,
        name: endpoint.name.trim(),
        x: Number(endpoint.x),
        y: Number(endpoint.y),
        type: endpoint.type || 'WAYPOINT',
        floor: endpoint.floor || 'Sảnh Tầng 1',
      });
      setHasUnsavedEndpoints(false);
      syncEndpointsToRos(endpointsRef.current);
      onNotify(`Đã lưu Endpoint "${endpoint.name}" vào CSDL.`, 'success');
    } catch (err) {
      onNotify('Lỗi khi lưu Endpoint: ' + err.message, 'warning');
    } finally {
      setIsSavingEndpoints(false);
    }
  };

  // Xoa Endpoint
  const handleDeleteEndpoint = async (endpointId) => {
    const target = endpoints.find((e) => e.id === endpointId);
    const name = target?.name || 'Endpoint';
    setEndpoints((prev) => prev.filter((e) => e.id !== endpointId));
    if (selectedEndpoint?.id === endpointId) {
      setSelectedEndpoint(null);
      setIsEndpointEditMode(false);
    }
    onNotify(`Đã xóa "${name}" khỏi bản đồ.`, 'info');
    const remaining = endpoints.filter((e) => e.id !== endpointId);
    syncEndpointsToRos(remaining);
    try {
      await deleteWaypoint(endpointId);
    } catch {
      // local state already updated
    }
  };

  // Dat lai danh sach Endpoints chuan ban dau
  const handleResetDefaultEndpoints = () => {
    setEndpoints(STANDARD_LOBBY_WAYPOINTS);
    setSelectedEndpoint(null);
    setHasUnsavedEndpoints(true);
    syncEndpointsToRos(STANDARD_LOBBY_WAYPOINTS);
    onNotify('Đã khôi phục danh sách Điểm Đích về thông số chuẩn sảnh 10m x 6m.', 'info');
  };

  return {
    handleAddEndpoint,
    handleUpdateSelectedEndpoint,
    handleSaveEndpointToDb,
    handleDeleteEndpoint,
    handleResetDefaultEndpoints,
  };
}
