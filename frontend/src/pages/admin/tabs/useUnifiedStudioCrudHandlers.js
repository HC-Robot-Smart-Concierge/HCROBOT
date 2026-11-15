import { useEffect } from 'react';
import {
  saveWaypoint,
  updateWaypoint,
  deleteWaypoint,
  fetchWorkflows,
  fetchWaypoints,
  saveWorkflow,
  fetchZones,
  saveZone,
  updateZone,
  deleteZone,
} from '../../../services/workflowApi';
import { OTTO_STEP_TYPES } from './AdminWorkflowTab';

/** Manages endpoint, zone, and workflow CRUD handlers for AdminUnifiedStudioTab. */
export const useUnifiedStudioCrudHandlers = ({
  workflows,
  setWorkflows,
  activeWf,
  setActiveWf,
  setWaypoints,
  setKeepOutZones,
  selectedZone,
  setSelectedZone,
  selectedWaypoint,
  setSelectedWaypoint,
  highlightedWpId,
  setHighlightedWpId,
  robotPose,
  setIsPinMode,
  isEndpointModalOpen,
  setIsEndpointModalOpen,
  endpointModalMode,
  setEndpointModalMode,
  endpointFormData,
  setEndpointFormData,
  setIsZoneModalOpen,
  zoneModalMode,
  setZoneModalMode,
  zoneFormData,
  setZoneFormData,
  deleteConfirmTarget,
  setDeleteConfirmTarget,
  setIsRenameWfModalOpen,
  newWfName,
  setNewWfName,
  syncZonesToRos,
  showNotification,
}) => {
  const loadAll = async () => {
    try {
      const [wfs, wps, zs] = await Promise.all([fetchWorkflows(), fetchWaypoints(), fetchZones()]);
      setWorkflows(wfs || []);
      setWaypoints(wps || []);
      setKeepOutZones(zs || []);
      syncZonesToRos(zs || []);
      if (wfs && wfs.length > 0 && !activeWf) {
        setActiveWf(wfs[0]);
      }
    } catch {
      showNotification('Không thể tải danh sách Workflows, Waypoints hoặc Vùng Chức Năng');
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Open Add Endpoint Modal (from map pin or manual button)
  const handleOpenAddEndpointModal = (coords = null) => {
    const x = coords ? coords.x : Number(robotPose.x || 0);
    const y = coords ? coords.y : Number(robotPose.y || 0);
    const yaw = coords ? 0 : Number(robotPose.yaw || 0);
    setEndpointFormData({
      id: `wp-${Date.now().toString(36)}`,
      name: '',
      floor: 'Tầng 1',
      x: Number(Number(x).toFixed(2)),
      y: Number(Number(y).toFixed(2)),
      yaw: Number(Number(yaw).toFixed(0)),
      type: 'WAYPOINT',
      description: '',
    });
    setEndpointModalMode('CREATE');
    setIsPinMode(false);
    setIsEndpointModalOpen(true);
  };

  // Open Edit Endpoint Modal
  const handleOpenEditEndpointModal = (wp) => {
    setEndpointFormData({
      id: wp.id,
      name: wp.name || '',
      floor: wp.floor || 'Tầng 1',
      x: wp.x ?? 0,
      y: wp.y ?? 0,
      yaw: wp.yaw ?? 0,
      type: wp.type || 'WAYPOINT',
      description: wp.description || '',
    });
    setEndpointModalMode('EDIT');
    setIsEndpointModalOpen(true);
  };

  const handleCanvasClickPin = (x, y) => {
    handleOpenAddEndpointModal({ x, y });
  };

  const handleSelectWaypointFromMap = (wp) => {
    setSelectedWaypoint(wp);
    setHighlightedWpId(wp.id);
  };

  // Save or Update Endpoint to Database
  const handleSaveEndpoint = async (e) => {
    e.preventDefault();
    if (!endpointFormData.name.trim()) {
      showNotification('Vui lòng nhập tên Endpoint');
      return;
    }

    try {
      const payload = {
        id: endpointFormData.id,
        name: endpointFormData.name.trim(),
        floor: endpointFormData.floor,
        x: Number(endpointFormData.x),
        y: Number(endpointFormData.y),
        yaw: Number(endpointFormData.yaw || 0),
        type: endpointFormData.type || 'WAYPOINT',
        description: endpointFormData.description ? endpointFormData.description.trim() : null,
      };

      if (endpointModalMode === 'EDIT') {
        await updateWaypoint(payload.id, payload);
        showNotification(`Đã cập nhật Endpoint "${payload.name}" vào CSDL!`);
      } else {
        await saveWaypoint(payload);
        showNotification(`Đã tạo mới Endpoint "${payload.name}" trong CSDL!`);
      }

      setIsEndpointModalOpen(false);
      await loadAll();
      if (selectedWaypoint?.id === payload.id) {
        setSelectedWaypoint(payload);
      }
    } catch (err) {
      showNotification('Lỗi khi lưu Endpoint: ' + err.message);
    }
  };

  const handleOpenDeleteConfirm = (target) => {
    if (!target) return;
    setDeleteConfirmTarget({ id: target.id, name: target.name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    const { id, name } = deleteConfirmTarget;
    try {
      await deleteWaypoint(id);
      setWaypoints((prev) => prev.filter((w) => w.id !== id));
      if (selectedWaypoint?.id === id) setSelectedWaypoint(null);
      if (highlightedWpId === id) setHighlightedWpId(null);
      if (isEndpointModalOpen && endpointFormData.id === id) {
        setIsEndpointModalOpen(false);
      }
      setDeleteConfirmTarget(null);
      showNotification(`Đã xóa Endpoint "${name}" khỏi CSDL`);
    } catch (err) {
      showNotification('Lỗi khi xóa Endpoint: ' + err.message);
    }
  };

  // Open Add Zone Modal
  const handleOpenAddZoneModal = (coords = null) => {
    const x = coords ? coords.x : Number(robotPose.x || 0) + 1.5;
    const y = coords ? coords.y : Number(robotPose.y || 0) + 1.5;
    setZoneFormData({
      id: `zone-${Date.now().toString(36)}`,
      name: '',
      type: 'KEEP_OUT',
      x: Number(Number(x).toFixed(2)),
      y: Number(Number(y).toFixed(2)),
      width: 2.0,
      height: 2.0,
      speed_limit: 0.3,
      floor: 'Sảnh Tầng 1',
      description: '',
    });
    setZoneModalMode('CREATE');
    setIsZoneModalOpen(true);
  };

  // Open Edit Zone Modal
  const handleOpenEditZoneModal = (zone) => {
    setZoneFormData({
      id: zone.id,
      name: zone.name || '',
      type: zone.type || 'KEEP_OUT',
      x: zone.x ?? 0,
      y: zone.y ?? 0,
      width: zone.width ?? 2.0,
      height: zone.height ?? 2.0,
      vertices: zone.vertices ?? null,
      yaw: zone.yaw ?? 0,
      map_id: zone.map_id,
      speed_limit: zone.speed_limit ?? 0.3,
      floor: zone.floor || 'Sảnh Tầng 1',
      description: zone.description || '',
    });
    setZoneModalMode('EDIT');
    setIsZoneModalOpen(true);
  };

  // Select Zone from Map Click
  const handleSelectZoneFromMap = (zone) => {
    setSelectedZone(zone);
    setSelectedWaypoint(null);
  };

  // Save Zone to Database
  const handleSaveZone = async (e) => {
    e.preventDefault();
    if (!zoneFormData.name.trim()) {
      showNotification('Vui lòng nhập tên Vùng Chức Năng');
      return;
    }

    try {
      const payload = {
        id: zoneFormData.id,
        name: zoneFormData.name.trim(),
        type: zoneFormData.type || 'KEEP_OUT',
        vertices: zoneFormData.vertices ?? null,
        yaw: zoneFormData.yaw ?? 0,
        map_id: zoneFormData.map_id,
        x: Number(zoneFormData.x),
        y: Number(zoneFormData.y),
        width: Number(zoneFormData.width || 2.0),
        height: Number(zoneFormData.height || 2.0),
        speed_limit: zoneFormData.type === 'SLOW_SPEED' ? Number(zoneFormData.speed_limit || 0.3) : null,
        floor: zoneFormData.floor || 'Sảnh Tầng 1',
        description: zoneFormData.description ? zoneFormData.description.trim() : null,
      };

      if (zoneModalMode === 'EDIT') {
        await updateZone(payload.id, payload);
        showNotification(`Đã cập nhật Vùng Chức Năng "${payload.name}"!`);
      } else {
        await saveZone(payload);
        showNotification(`Đã lưu Vùng Chức Năng mới "${payload.name}"!`);
      }

      setIsZoneModalOpen(false);
      await loadAll();
      if (selectedZone?.id === payload.id) {
        setSelectedZone(payload);
      }
    } catch (err) {
      showNotification('Lỗi khi lưu Vùng Chức Năng: ' + err.message);
    }
  };

  // Delete Zone
  const handleDeleteZone = async (zoneId, zoneName) => {
    if (!window.confirm(`Xác nhận xóa Vùng Chức Năng "${zoneName}"?`)) return;
    try {
      await deleteZone(zoneId);
      setKeepOutZones((prev) => prev.filter((z) => z.id !== zoneId));
      if (selectedZone?.id === zoneId) setSelectedZone(null);
      showNotification(`Đã xóa Vùng Chức Năng "${zoneName}"`);
    } catch (err) {
      showNotification('Lỗi khi xóa Vùng: ' + err.message);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmTarget(null);
  };

  // Add Selected Waypoint directly to Active Workflow as a MOVE step
  const handleAddWaypointToWorkflow = (wp) => {
    if (!activeWf) return;
    const newStep = {
      step_id: `step-${Date.now()}`,
      type: 'MOVE',
      title: `Di chuyển tới ${wp.name}`,
      params: {
        target_waypoint_id: wp.id,
        waypoint_name: wp.name,
        target_x: wp.x,
        target_y: wp.y,
        speed: 0.5,
        timeout_sec: 30,
      },
    };

    setActiveWf({
      ...activeWf,
      steps: [...(activeWf.steps || []), newStep],
    });
    showNotification(`Đã thêm bước MOVE tới "${wp.name}" vào kịch bản!`);
  };

  // Step Workflow editing
  const handleAddStep = (stepType) => {
    if (!activeWf) return;
    const stepDef = OTTO_STEP_TYPES.find((s) => s.type === stepType);
    if (!stepDef) return;

    const newStep = {
      step_id: `step-${Date.now()}`,
      type: stepDef.type,
      title: stepDef.label,
      params: { ...stepDef.defaultParams },
    };

    setActiveWf({
      ...activeWf,
      steps: [...(activeWf.steps || []), newStep],
    });
  };

  const handleRemoveStep = (idx) => {
    if (!activeWf) return;
    const steps = [...activeWf.steps];
    steps.splice(idx, 1);
    setActiveWf({ ...activeWf, steps });
  };

  const handleMoveStep = (idx, dir) => {
    if (!activeWf) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= activeWf.steps.length) return;
    const steps = [...activeWf.steps];
    const temp = steps[idx];
    steps[idx] = steps[targetIdx];
    steps[targetIdx] = temp;
    setActiveWf({ ...activeWf, steps });
  };

  const handleSaveCurrentWorkflow = async () => {
    if (!activeWf) return;
    try {
      await saveWorkflow(activeWf);
      showNotification(`Đã lưu kịch bản "${activeWf.name}" thành công!`);
      await loadAll();
    } catch (err) {
      showNotification('Lỗi khi lưu kịch bản: ' + err.message);
    }
  };

  const handleOpenRenameModal = () => {
    if (!activeWf) return;
    setNewWfName(activeWf.name || '');
    setIsRenameWfModalOpen(true);
  };

  const handleSaveRenameWorkflow = async (e) => {
    e.preventDefault();
    if (!newWfName.trim()) {
      showNotification('Vui lòng nhập tên kịch bản mới');
      return;
    }
    const updatedWf = { ...activeWf, name: newWfName.trim() };
    try {
      await saveWorkflow(updatedWf);
      setActiveWf(updatedWf);
      setWorkflows((prev) => prev.map((w) => (w.id === updatedWf.id ? updatedWf : w)));
      setIsRenameWfModalOpen(false);
      showNotification(`Đã đổi tên kịch bản thành "${updatedWf.name}"!`);
    } catch (err) {
      showNotification('Lỗi khi đổi tên kịch bản: ' + err.message);
    }
  };

  const handleCreateNewWorkflow = async () => {
    const newWf = {
      id: `wf-${Date.now().toString(36)}`,
      name: `Kịch bản mới ${workflows.length + 1}`,
      description: 'Mô tả chu trình hoạt động của robot...',
      trigger_type: 'AUTO_DETECT',
      is_active: true,
      steps: [],
    };
    try {
      await saveWorkflow(newWf);
      setWorkflows((prev) => [...prev, newWf]);
      setActiveWf(newWf);
      showNotification(`Đã tạo kịch bản mới "${newWf.name}"!`);
    } catch (err) {
      showNotification('Lỗi khi tạo kịch bản mới: ' + err.message);
    }
  };

  return {
    loadAll,
    handleOpenAddEndpointModal,
    handleOpenEditEndpointModal,
    handleCanvasClickPin,
    handleSelectWaypointFromMap,
    handleSaveEndpoint,
    handleOpenDeleteConfirm,
    handleConfirmDelete,
    handleOpenAddZoneModal,
    handleOpenEditZoneModal,
    handleSelectZoneFromMap,
    handleSaveZone,
    handleDeleteZone,
    handleCancelDelete,
    handleAddWaypointToWorkflow,
    handleAddStep,
    handleRemoveStep,
    handleMoveStep,
    handleSaveCurrentWorkflow,
    handleOpenRenameModal,
    handleSaveRenameWorkflow,
    handleCreateNewWorkflow,
  };
};
