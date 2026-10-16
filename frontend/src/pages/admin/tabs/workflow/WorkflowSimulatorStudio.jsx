import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
  Send,
  Eye,
  Mic,
  MessageSquare,
  ClipboardList,
  Star,
  Navigation,
  Edit3,
  Check,
  Shield,
  ShieldAlert,
  Layers,
  Gauge,
  Ban,
  AlertTriangle,
  X,
  Info,
  Move,
  Save,
  Plus,
  Trash2,
  ChevronDown,
  EyeOff,
  MapPin,
} from 'lucide-react';
import { useSpeechSynthesis } from '../../../../hooks/useSpeechSynthesis';
import {
  RosbridgeClient,
  ROS_TOPICS,
  ROS_MSG_TYPES,
  quaternionToYaw,
  createZoneSyncMsg,
} from '../../../../services/rosbridgeService';
import {
  fetchWorkflows,
  executeWorkflow,
  fetchZones,
  saveZone,
  updateZone,
  deleteZone,
  fetchWaypoints,
  saveWaypoint,
  updateWaypoint,
  deleteWaypoint,
} from '../../../../services/workflowApi';
import {
  OTTO_ENDPOINT_TEMPLATES,
  getEndpointTemplateInfo,
} from '../studio/studioConstants';
import {
  ROBOT_INITIAL_POSE,
  GAZEBO_LOBBY_WAYPOINTS,
  STANDARD_LOBBY_WAYPOINTS,
  meterToSvg,
  svgToMeter,
  calculateSafeWaypoints,
  getStepActionDetail,
  SIMULATOR_HOTEL_ZONES,
  isPointInSimulatorZone,
  getActiveSimulatorZone,
  zoneToSvgRect,
  validateWorkflowStepZone,
  resolveNoStopPassthrough,
} from './workflowSimulatorUtils';

export const WorkflowSimulatorStudio = ({
  workflows = [],
  initialWorkflowId = null,
  onClose = null,
  onNotify = () => {},
}) => {
  // Khoi tao danh sach workflow thuc te tu props (Khong dung fallback seed gia lap)
  const [localWorkflows, setLocalWorkflows] = useState(() =>
    Array.isArray(workflows) && workflows.length > 0 ? workflows : []
  );

  // Chon workflow dang duoc mo phong
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(() => {
    if (initialWorkflowId) return initialWorkflowId;
    return (Array.isArray(workflows) && workflows[0]?.id) || null;
  });

  // Dong bo workflows thuc te tu props hoac tu dong goi API neu chua co du lieu
  useEffect(() => {
    if (Array.isArray(workflows) && workflows.length > 0) {
      setLocalWorkflows(workflows);
    } else {
      fetchWorkflows()
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setLocalWorkflows(data);
          }
        })
        .catch(() => {});
    }
  }, [workflows]);

  // Cap nhat selectedWorkflowId ngay lap tuc khi initialWorkflowId hoac localWorkflows thay doi
  useEffect(() => {
    if (initialWorkflowId && localWorkflows.some((w) => w.id === initialWorkflowId)) {
      setSelectedWorkflowId(initialWorkflowId);
    } else if (
      localWorkflows.length > 0 &&
      (!selectedWorkflowId || !localWorkflows.some((w) => w.id === selectedWorkflowId))
    ) {
      setSelectedWorkflowId(localWorkflows[0].id);
    }
  }, [initialWorkflowId, localWorkflows]);

  const activeWorkflow =
    localWorkflows.find((w) => w.id === selectedWorkflowId) ||
    localWorkflows[0] ||
    null;
  const steps = activeWorkflow?.steps || [];

  // Che do chinh sua nhanh diem moc cua buoc MOVE ngay tai sa ban
  const [editingStepIdx, setEditingStepIdx] = useState(null);

  const handleUpdateMoveStepWaypoints = (stepIdx, fromKey, toKey) => {
    const targetWp =
      endpointsRef.current.find((e) => e.id === toKey || e.key === toKey) ||
      GAZEBO_LOBBY_WAYPOINTS[toKey] ||
      GAZEBO_LOBBY_WAYPOINTS.FRONT_DESK;
    const fromWp =
      fromKey === 'CURRENT'
        ? null
        : endpointsRef.current.find((e) => e.id === fromKey || e.key === fromKey) ||
          GAZEBO_LOBBY_WAYPOINTS[fromKey];

    setLocalWorkflows((prevList) => {
      return prevList.map((wf) => {
        if (wf.id !== selectedWorkflowId) return wf;
        const updatedSteps = (wf.steps || []).map((st, i) => {
          if (i !== stepIdx) return st;
          return {
            ...st,
            params: {
              ...(st.params || {}),
              from_waypoint: fromKey,
              from_waypoint_name: fromWp ? fromWp.name : 'Vị trí hiện tại của Robot',
              target_value: toKey,
              target_waypoint_id: toKey,
              waypoint_name: targetWp.name,
              target_x: targetWp.x,
              target_y: targetWp.y,
            },
          };
        });
        return { ...wf, steps: updatedSteps };
      });
    });

    // Ve ngay duong di preview tu diem A den B tren sa ban
    const startPt =
      fromKey === 'CURRENT'
        ? { x: robotPoseRef.current.x, y: robotPoseRef.current.y }
        : { x: fromWp?.x ?? 3.7, y: fromWp?.y ?? 5.0 };
    const goalPt = { x: targetWp.x, y: targetWp.y };
    const pts = calculateSafeWaypoints(startPt, goalPt);
    let totalDist = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      totalDist += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    }
    setCurrentPath({
      waypoints: pts,
      label: targetWp.name,
      targetPoint: goalPt,
      totalDistance: totalDist,
    });
    setManualNavLabel(`Lộ trình: ${fromKey === 'CURRENT' ? 'Hiện tại' : (fromWp?.name?.split('(')[0]?.trim() || fromKey)} ➔ ${targetWp.name?.split('(')[0]?.trim()}`);
  };

  // Trang thai thuc thi
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [stepProgress, setStepProgress] = useState(0);

  // Duong di hien tai cua robot: { waypoints: [{x, y}], label: string }
  const [currentPath, setCurrentPath] = useState(null);

  // Vi tri robot (Mac dinh o Goc Tren Ben Phai sanh: x: 3.7, y: 5.0, yaw: -Math.PI / 2)
  const [robotPose, setRobotPose] = useState(ROBOT_INITIAL_POSE);
  const [manualNavLabel, setManualNavLabel] = useState(null);
  const [isRosEnabled, setIsRosEnabled] = useState(true);
  const [isRosConnected, setIsRosConnected] = useState(false);

  // Quan ly 3 Vung Chuc Nang: Keep-Out, Speed Zone, No-Stop
  const [zones, setZones] = useState(SIMULATOR_HOTEL_ZONES);
  const [showZones, setShowZones] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);
  const [zoneAlert, setZoneAlert] = useState(null);

  // Che do keo tha va thay doi kich thuoc Vung tren sa ban map
  const [isZoneEditMode, setIsZoneEditMode] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [hasUnsavedZones, setHasUnsavedZones] = useState(false);
  const [isSavingZones, setIsSavingZones] = useState(false);
  const [isZoneMenuOpen, setIsZoneMenuOpen] = useState(false);
  const wasDraggingRef = useRef(false);

  // Tai danh sach Vung tu backend CSDL neu co, fallback la 3 vung mac dinh
  useEffect(() => {
    let isMounted = true;
    fetchZones()
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setZones(data);
        }
      })
      .catch(() => {
        // Fallback giu nguyen SIMULATOR_HOTEL_ZONES
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Them Vung moi tren sa ban (Add Zone)
  const handleAddZone = (type) => {
    setIsZoneMenuOpen(false);
    const count = zones.filter((z) => z.type === type).length + 1;
    let name = '';
    let speedLimit = null;
    let width = 2.0;
    let height = 2.0;

    const slot = zones.length % 4;
    const initialX = Number((3.5 + slot * 0.8).toFixed(2));
    const initialY = Number((3.0 + (slot % 2 === 0 ? 0.4 : -0.4)).toFixed(2));

    if (type === 'KEEP_OUT') {
      name = `Khu Vực Cấm Vào #${count}`;
    } else if (type === 'SPEED_ZONE' || type === 'SLOW_SPEED') {
      name = `Vùng Giới Hạn Tốc Độ #${count}`;
      speedLimit = 0.20;
      width = 2.4;
      height = 2.0;
    } else {
      name = `Khu Vực Cấm Dừng #${count}`;
      width = 1.8;
      height = 1.6;
    }

    const newZone = {
      id: `zone_${Date.now()}`,
      name,
      type,
      x: initialX,
      y: initialY,
      width,
      height,
      speed_limit: speedLimit,
      description: 'Vùng được tạo mới bởi quản trị viên.',
    };

    const updatedZones = [...zones, newZone];
    setZones(updatedZones);
    setSelectedZone(newZone);
    setIsZoneEditMode(true);
    setShowZones(true);
    setHasUnsavedZones(true);

    if (isRosEnabledRef.current && rosClientRef.current?.isConnected) {
      rosClientRef.current.publish(
        '/hotel_zones',
        'std_msgs/String',
        createZoneSyncMsg(updatedZones)
      );
    }

    onNotify(`Đã thêm ${name}. Hãy kéo thân để di chuyển hoặc kéo 4 góc để co giãn.`, 'success');
  };

  // Xoa Vung duoc chon (Delete Zone)
  const handleDeleteZone = async (zoneId) => {
    if (!zoneId) return;
    const target = zones.find((z) => z.id === zoneId);
    const updatedZones = zones.filter((z) => z.id !== zoneId);
    setZones(updatedZones);
    setSelectedZone(null);
    setHasUnsavedZones(true);

    try {
      await deleteZone(zoneId);
    } catch {
      // Bỏ qua lỗi nếu zone chỉ tồn tại client-side
    }

    if (isRosEnabledRef.current && rosClientRef.current?.isConnected) {
      rosClientRef.current.publish(
        '/hotel_zones',
        'std_msgs/String',
        createZoneSyncMsg(updatedZones)
      );
    }

    onNotify(`Đã xóa vùng "${target?.name || zoneId}" khỏi bản đồ.`, 'info');
  };

  // Cap nhat thuoc tinh cua Vung dang chon (Edit Zone attributes)
  const handleUpdateSelectedZone = (field, value) => {
    if (!selectedZone) return;
    const updated = { ...selectedZone, [field]: value };
    setSelectedZone(updated);
    setZones((prev) => prev.map((z) => (z.id === selectedZone.id ? updated : z)));
    setHasUnsavedZones(true);
  };

  // Luu cau hinh 3 Vung Chuc Nang vao CSDL va phat len topic ROS 2
  const handleSaveZones = async () => {
    setIsSavingZones(true);
    try {
      for (const z of zones) {
        await saveZone(z);
      }
      if (isRosEnabledRef.current && rosClientRef.current?.isConnected) {
        rosClientRef.current.publish(
          '/hotel_zones',
          'std_msgs/String',
          createZoneSyncMsg(zones)
        );
      }
      setHasUnsavedZones(false);
      onNotify('Đã lưu cấu hình vị trí & kích thước Vùng thành công.', 'success');
    } catch {
      if (isRosEnabledRef.current && rosClientRef.current?.isConnected) {
        rosClientRef.current.publish(
          '/hotel_zones',
          'std_msgs/String',
          createZoneSyncMsg(zones)
        );
      }
      setHasUnsavedZones(false);
      onNotify('Đã áp dụng vị trí Vùng cho phiên làm việc hiện tại.', 'info');
    } finally {
      setIsSavingZones(false);
    }
  };

  // Khoi phuc vi tri 3 Vung Chuc Nang ve mac dinh
  const handleResetDefaultZones = () => {
    setZones(SIMULATOR_HOTEL_ZONES);
    setSelectedZone(null);
    setHasUnsavedZones(true);
    if (isRosEnabledRef.current && rosClientRef.current?.isConnected) {
      rosClientRef.current.publish(
        '/hotel_zones',
        'std_msgs/String',
        createZoneSyncMsg(SIMULATOR_HOTEL_ZONES)
      );
    }
    onNotify('Đã khôi phục 3 Vùng Chức Năng về thông số chuẩn sảnh 10m x 6m.', 'info');
  };

  // ========================================================
  // QUAN LY ENDPOINTS (3 LOAI CHUAN: WAYPOINT, CHARGER, PARK)
  // ========================================================
  const [endpoints, setEndpoints] = useState(STANDARD_LOBBY_WAYPOINTS);
  const endpointsRef = useRef(endpoints);
  endpointsRef.current = endpoints;

  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [hoveredEndpointId, setHoveredEndpointId] = useState(null);
  const [isEndpointEditMode, setIsEndpointEditMode] = useState(false);
  const [dragEndpointState, setDragEndpointState] = useState(null);
  const [isEndpointMenuOpen, setIsEndpointMenuOpen] = useState(false);
  const [hasUnsavedEndpoints, setHasUnsavedEndpoints] = useState(false);
  const [isSavingEndpoints, setIsSavingEndpoints] = useState(false);

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

  // Them Endpoint moi (Add Endpoint)
  const handleAddEndpoint = (type = 'WAYPOINT', customCoords = null) => {
    setIsEndpointMenuOpen(false);
    const count = endpoints.filter((e) => (e.type || 'WAYPOINT') === type).length + 1;
    const typeInfo = getEndpointTemplateInfo(type);
    const defaultName =
      type === 'CHARGER'
        ? `Trạm Sạc #${count}`
        : type === 'PARK'
        ? `Điểm Chờ #${count}`
        : `Điểm Mốc #${count}`;

    const x = customCoords ? Number(customCoords.x.toFixed(2)) : Number(Math.min(9.0, Math.max(1.0, robotPose.x + 0.8)).toFixed(2));
    const y = customCoords ? Number(customCoords.y.toFixed(2)) : Number(Math.min(5.0, Math.max(1.0, robotPose.y + 0.5)).toFixed(2));

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
  };

  // Cap nhat thong tin Endpoint (ten, loai)
  const handleUpdateSelectedEndpoint = (field, value) => {
    if (!selectedEndpoint) return;
    const updated = { ...selectedEndpoint, [field]: value };
    setSelectedEndpoint(updated);
    setEndpoints((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setHasUnsavedEndpoints(true);
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
    onNotify('Đã khôi phục danh sách Điểm Đích về thông số chuẩn sảnh 10m x 6m.', 'info');
  };

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

    const scaleX = 1000 / svgRect.width;
    const scaleY = 620 / svgRect.height;

    const deltaSvgX = deltaClientX * scaleX;
    const deltaSvgY = deltaClientY * scaleY;

    // Chuyen delta sang met: 900 SVG px = 10m X, 500 SVG px = 6m Y (truc Y nguoc chieu)
    const deltaMeterX = (deltaSvgX / 900) * 10.0;
    const deltaMeterY = -(deltaSvgY / 500) * 6.0;

    // 1. KEO THA ENDPOINT
    if (dragEndpointState) {
      const initEp = dragEndpointState.initialEndpoint;
      const rawX = initEp.x + deltaMeterX;
      const rawY = initEp.y + deltaMeterY;
      const clampedX = Number(Math.max(0.3, Math.min(9.7, rawX)).toFixed(2));
      const clampedY = Number(Math.max(0.3, Math.min(5.7, rawY)).toFixed(2));

      setEndpoints((prev) =>
        prev.map((ep) =>
          ep.id === dragEndpointState.endpointId ? { ...ep, x: clampedX, y: clampedY } : ep
        )
      );
      setSelectedEndpoint((prev) =>
        prev && prev.id === dragEndpointState.endpointId
          ? { ...prev, x: clampedX, y: clampedY }
          : prev
      );
      setHasUnsavedEndpoints(true);
      return;
    }

    const initZone = dragState.initialZone;

    if (dragState.type === 'MOVE') {
      const halfW = (Number(initZone.width) || 2.0) / 2;
      const halfH = (Number(initZone.height) || 2.0) / 2;

      const rawX = initZone.x + deltaMeterX;
      const rawY = initZone.y + deltaMeterY;
      const clampedX = Number(Math.max(halfW, Math.min(10.0 - halfW, rawX)).toFixed(2));
      const clampedY = Number(Math.max(halfH, Math.min(6.0 - halfH, rawY)).toFixed(2));

      setZones((prev) =>
        prev.map((z) => (z.id === dragState.zoneId ? { ...z, x: clampedX, y: clampedY } : z))
      );
      setSelectedZone((prev) =>
        prev && prev.id === dragState.zoneId ? { ...prev, x: clampedX, y: clampedY } : prev
      );
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
        newRight = Math.max(left + 0.6, Math.min(10.0, right + deltaMeterX));
        newBottom = Math.min(top - 0.6, Math.max(0.0, bottom + deltaMeterY));
      } else if (dragState.type === 'RESIZE_SW') {
        newLeft = Math.min(right - 0.6, Math.max(0.0, left + deltaMeterX));
        newBottom = Math.min(top - 0.6, Math.max(0.0, bottom + deltaMeterY));
      } else if (dragState.type === 'RESIZE_NE') {
        newRight = Math.max(left + 0.6, Math.min(10.0, right + deltaMeterX));
        newTop = Math.max(bottom + 0.6, Math.min(6.0, top + deltaMeterY));
      } else if (dragState.type === 'RESIZE_NW') {
        newLeft = Math.min(right - 0.6, Math.max(0.0, left + deltaMeterX));
        newTop = Math.max(bottom + 0.6, Math.min(6.0, top + deltaMeterY));
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

      setZones((prev) => prev.map((z) => (z.id === dragState.zoneId ? updated : z)));
      setSelectedZone(updated);
      setHasUnsavedZones(true);
    }
  };

  // Ket thuc keo tha
  const handleSvgPointerUp = (e) => {
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
      }
      setDragEndpointState(null);
    }

    if (dragState) {
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

  // Xu ly click chon vung hoac chuyen doi luan phien khi cac vung chong len nhau
  const handleZoneClick = (e, clickedZone) => {
    if (!isZoneEditMode && !selectedZone) {
      return;
    }

    e.stopPropagation();
    if (wasDraggingRef.current) return;

    const svg = svgRef.current;
    if (svg) {
      const bRect = svg.getBoundingClientRect();
      const svgX = ((e.clientX - bRect.left) / bRect.width) * 1000;
      const svgY = ((e.clientY - bRect.top) / bRect.height) * 620;
      const meter = svgToMeter(svgX, svgY);

      // Tim tat ca cac vung bao phu toa do click
      const overlapping = zones.filter((z) => isPointInSimulatorZone(meter.x, meter.y, z));
      if (overlapping.length > 1) {
        const currentIdx = overlapping.findIndex((z) => z.id === selectedZone?.id);
        const nextIdx = (currentIdx + 1) % overlapping.length;
        setSelectedZone(overlapping[nextIdx]);
        return;
      }
    }

    setSelectedZone(selectedZone?.id === clickedZone.id ? null : clickedZone);
  };

  // TTS Voice Hook
  const { speak, cancel: stopSpeaking } = useSpeechSynthesis();

  // Refs de tranh re-render loop va dong bo trang thai thoi gian thuc
  const svgRef = useRef(null);
  const timerRef = useRef(null);
  const animFrameRef = useRef(null);
  const rosClientRef = useRef(null);
  const speakRef = useRef(speak);
  const stopSpeakingRef = useRef(stopSpeaking);
  const isMutedRef = useRef(isMuted);
  const simSpeedRef = useRef(simSpeed);
  const stepsRef = useRef(steps);
  const isPlayingRef = useRef(isPlaying);
  const currentStepIndexRef = useRef(currentStepIndex);
  const robotPoseRef = useRef(robotPose);
  const isRosEnabledRef = useRef(isRosEnabled);
  const isRosConnectedRef = useRef(isRosConnected);
  const currentPathRef = useRef(currentPath);
  const targetTelemetryPoseRef = useRef(null);
  const zonesRef = useRef(zones);

  useEffect(() => {
    speakRef.current = speak;
    stopSpeakingRef.current = stopSpeaking;
    isMutedRef.current = isMuted;
    simSpeedRef.current = simSpeed;
    stepsRef.current = steps;
    isPlayingRef.current = isPlaying;
    currentStepIndexRef.current = currentStepIndex;
    robotPoseRef.current = robotPose;
    isRosEnabledRef.current = isRosEnabled;
    isRosConnectedRef.current = isRosConnected;
    currentPathRef.current = currentPath;
    zonesRef.current = zones;
  });

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

  // Vung chuc nang ma robot dang dung hien tai
  const activeRobotZone = getActiveSimulatorZone(robotPose.x, robotPose.y, zones);

  // VONG LAP LERP NOI SUY MUOT 60FPS: Dong bo ti le 1:1 theo Gazebo, khong bi giat lag
  useEffect(() => {
    let animId;
    const smoothUpdate = () => {
      if (isRosEnabledRef.current && isRosConnectedRef.current && targetTelemetryPoseRef.current) {
        const cur = robotPoseRef.current;
        const target = targetTelemetryPoseRef.current;
        const lerpFactor = 0.28;

        const dx = target.x - cur.x;
        const dy = target.y - cur.y;
        let dyaw = target.yaw - cur.yaw;
        dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));

        if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001 || Math.abs(dyaw) > 0.005) {
          const nextPose = {
            x: Number((cur.x + dx * lerpFactor).toFixed(3)),
            y: Number((cur.y + dy * lerpFactor).toFixed(3)),
            yaw: Number((cur.yaw + dyaw * lerpFactor).toFixed(3)),
          };
          robotPoseRef.current = nextPose;
          setRobotPose(nextPose);
        }
      }
      animId = requestAnimationFrame(smoothUpdate);
    };

    animId = requestAnimationFrame(smoothUpdate);
    return () => cancelAnimationFrame(animId);
  }, []);

  const activeStep = isPlaying && currentStepIndex < steps.length ? steps[currentStepIndex] : null;
  const isMoving = Boolean(currentPath && currentPath.waypoints && currentPath.waypoints.length > 0);

  // Xac dinh trang thai gon gang cua robot (Chi the hien trang thai, khong ghi chi tiet toa do/dieu huong toi dau)
  const robotStatus = (() => {
    if (isMoving || (manualNavLabel && manualNavLabel.startsWith('Toi:'))) {
      return {
        code: 'NAV',
        label: 'ĐIỀU HƯỚNG',
        dotColor: '#262626',
        isMoving: true,
      };
    }
    if (activeStep) {
      switch (activeStep.type) {
        case 'MOVE':
          return { code: 'NAV', label: 'ĐIỀU HƯỚNG', dotColor: '#262626', isMoving: true };
        case 'GREET':
          return { code: 'GREET', label: 'CHÀO KHÁCH', dotColor: '#059669', isMoving: false };
        case 'SPEAK':
          return { code: 'SPEAK', label: 'PHÁT GIỌNG NÓI', dotColor: '#059669', isMoving: false };
        case 'SHOW':
          return { code: 'SHOW', label: 'MÀN HÌNH', dotColor: '#262626', isMoving: false };
        case 'LISTEN':
          return { code: 'LISTEN', label: 'LẮNG NGHE', dotColor: '#D97706', isMoving: false };
        case 'RECOMMEND':
          return { code: 'REC', label: 'GỢI Ý', dotColor: '#D97706', isMoving: false };
        case 'FEEDBACK':
          return { code: 'RATE', label: 'ĐÁNH GIÁ', dotColor: '#059669', isMoving: false };
        default:
          return { code: activeStep.type, label: activeStep.type, dotColor: '#262626', isMoving: false };
      }
    }
    if (manualNavLabel && manualNavLabel.startsWith('Da den')) {
      return {
        code: 'ARRIVED',
        label: 'ĐÃ ĐẾN NƠI',
        dotColor: '#059669',
        isMoving: false,
      };
    }
    return {
      code: 'READY',
      label: 'SẴN SÀNG',
      dotColor: '#059669',
      isMoving: false,
    };
  })();

  const activeDetail = activeStep
    ? getStepActionDetail(activeStep)
    : manualNavLabel
    ? {
        label: 'NAV',
        bubbleTitle: 'DIEU HUONG',
        bubbleBody: manualNavLabel,
      }
    : getStepActionDetail(null);

  // Chuyen buoc ke tiep
  const handleStepFinish = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (stopSpeakingRef.current) stopSpeakingRef.current();

    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publishCmdVel(0.0, 0.0);
    }

    setStepProgress(100);

    // Luon reset currentPath ngay lap tuc de khong trigger lap lai o buoc sau
    setCurrentPath(null);
    currentPathRef.current = null;

    setCurrentStepIndex((prev) => {
      const nextIdx = prev + 1;
      const totalSteps = stepsRef.current?.length || 0;
      if (nextIdx < totalSteps) {
        return nextIdx;
      } else {
        setIsPlaying(false);
        setIsPaused(false);
        return 0;
      }
    });
  }, []);

  // Ket noi ROS 2 Bridge ngam (Co autoReconnect de luon dong bo voi Gazebo)
  useEffect(() => {
    if (!isRosEnabled) {
      setIsRosConnected(false);
      targetTelemetryPoseRef.current = null;
      if (rosClientRef.current) {
        rosClientRef.current.disconnect();
      }
      return;
    }

    const rosUrl = import.meta.env.VITE_ROSBRIDGE_URL || 'ws://127.0.0.1:9090';
    const client = new RosbridgeClient(rosUrl, {
      autoReconnect: true,
      onOpen: () => setIsRosConnected(true),
      onClose: () => setIsRosConnected(false),
      onError: () => setIsRosConnected(false),
    });
    rosClientRef.current = client;
    client.connect();

    // 1. Subscribe /robot_pose (Toa do the gioi tieu chuan thuc te tu Gazebo)
    const unbindRobotPose = client.subscribe(
      '/robot_pose',
      'geometry_msgs/msg/PoseStamped',
      (msg) => {
        const pos = msg?.pose?.position;
        const orient = msg?.pose?.orientation;
        if (pos) {
          const yaw = orient ? quaternionToYaw(orient.z, orient.w) : 0.0;
          targetTelemetryPoseRef.current = {
            x: Number(pos.x.toFixed(3)),
            y: Number(pos.y.toFixed(3)),
            yaw: Number(yaw.toFixed(3)),
          };

          // Dong bo tien do quang duong thuc te tu Gazebo (Chi ap dung khi dang o buoc MOVE)
          const curPath = currentPathRef.current;
          const curStep = stepsRef.current?.[currentStepIndexRef.current];
          const isMoveStep = isPlayingRef.current ? curStep?.type === 'MOVE' : Boolean(curPath);

          if (curPath?.targetPoint && isMoveStep) {
            const distRemaining = Math.hypot(pos.x - curPath.targetPoint.x, pos.y - curPath.targetPoint.y);
            const totalDist = curPath.totalDistance || 1.0;
            const progress = Math.max(0, Math.min(99, Math.round(((totalDist - distRemaining) / totalDist) * 100)));
            setStepProgress(progress);

            // Nguong den noi theo tieu chuan vi tri thuc cua Gazebo (0.35m)
            if (distRemaining < 0.35) {
              setStepProgress(100);
              setCurrentPath(null);
              currentPathRef.current = null;
              if (isPlayingRef.current) {
                handleStepFinish();
              } else {
                setManualNavLabel(`Da den: ${curPath.label}`);
              }
            }
          }
        }
      }
    );

    // 2. Fallback subscribe /odom truc tiep tu Gazebo DiffDrive
    const unbindOdom = client.subscribe(ROS_TOPICS.ODOM, ROS_MSG_TYPES.ODOMETRY, (msg) => {
      const pos = msg?.pose?.pose?.position;
      const orient = msg?.pose?.pose?.orientation;
      if (pos && !targetTelemetryPoseRef.current) {
        const rawOdomYaw = orient ? quaternionToYaw(orient.z, orient.w) : 0.0;
        const isRelative = Math.abs(pos.x) < 2.5 && Math.abs(pos.y) < 2.5;
        // Chuyen doi tu Odom frame (spawn yaw: -PI/2) sang World frame
        const worldX = isRelative ? 3.7 + pos.y : pos.x;
        const worldY = isRelative ? 5.0 - pos.x : pos.y;
        let worldYaw = isRelative ? -Math.PI / 2 + rawOdomYaw : rawOdomYaw;
        worldYaw = Math.atan2(Math.sin(worldYaw), Math.cos(worldYaw));

        targetTelemetryPoseRef.current = {
          x: Number(worldX.toFixed(3)),
          y: Number(worldY.toFixed(3)),
          yaw: Number(worldYaw.toFixed(3)),
        };
      }
    });

    // 3. Subscribe trang thai /goal_reached tu Autonomous Navigator
    const unbindGoalReached = client.subscribe(
      '/goal_reached',
      'std_msgs/String',
      (msg) => {
        if (msg?.data?.startsWith('REACHED')) {
          const curPath = currentPathRef.current;
          const curStep = stepsRef.current?.[currentStepIndexRef.current];
          const isMoveStep = isPlayingRef.current ? curStep?.type === 'MOVE' : Boolean(curPath);

          if (isMoveStep && curPath) {
            setStepProgress(100);
            setCurrentPath(null);
            currentPathRef.current = null;
            if (isPlayingRef.current) {
              handleStepFinish();
            } else {
              setManualNavLabel(`Da den: ${curPath.label}`);
            }
          }
        }
      }
    );

    return () => {
      if (unbindRobotPose) unbindRobotPose();
      if (unbindOdom) unbindOdom();
      if (unbindGoalReached) unbindGoalReached();
      client.disconnect();
    };
  }, [isRosEnabled, handleStepFinish]);

  // Dieu huong robot toi bat ky diem nao (Click waypoint hoac click sanh map hoac buoc MOVE)
  const handleNavigateToGoal = useCallback(
    (targetX, targetY, targetName = 'Điểm đã chọn', fromWorkflow = false, startPoseOverride = null) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (stopSpeakingRef.current) stopSpeakingRef.current();

      const startPoint = startPoseOverride
        ? { x: Number(startPoseOverride.x.toFixed(2)), y: Number(startPoseOverride.y.toFixed(2)) }
        : { x: robotPoseRef.current.x, y: robotPoseRef.current.y };
      const goalPoint = { x: Number(targetX.toFixed(2)), y: Number(targetY.toFixed(2)) };

      // Kiem tra an toan Vung chuc nang: Chặn tuyet doi neu dich den la KEEP_OUT
      const targetZone = getActiveSimulatorZone(goalPoint.x, goalPoint.y, zonesRef.current);
      if (targetZone && targetZone.type === 'KEEP_OUT') {
        const errMessage = `Vị trí (${goalPoint.x}m, ${goalPoint.y}m) thuộc "${targetZone.name}" (Vùng cấm vào - KEEP_OUT). Lệnh điều hướng đã bị chặn!`;
        setZoneAlert({
          type: 'error',
          message: errMessage,
        });
        onNotify(errMessage, 'warning');
        return;
      }

      // Xu ly tu dong di xuyen qua neu dich den nam trong NO_STOP (tuyet doi khong dung lai giua vung cam dung)
      const passthrough = resolveNoStopPassthrough(startPoint, goalPoint, zonesRef.current);
      if (passthrough.isNoStop) {
        goalPoint.x = passthrough.safePoint.x;
        goalPoint.y = passthrough.safePoint.y;
        onNotify(
          `Điểm đến nằm trong Vùng cấm dừng "${passthrough.zone.name}". Robot tự động đi xuyên qua vùng cấm đến vị trí an toàn (${goalPoint.x}m, ${goalPoint.y}m).`,
          'info'
        );
      }

      if (startPoseOverride) {
        const resetPose = {
          x: startPoint.x,
          y: startPoint.y,
          yaw: startPoseOverride.yaw ?? robotPoseRef.current.yaw,
        };
        robotPoseRef.current = resetPose;
        setRobotPose(resetPose);
      }

      // Tinh toan lo trinh da diem ne tuong va vach ngan
      const waypoints = calculateSafeWaypoints(startPoint, goalPoint);

      // Kiem tra neu lo trinh bat buoc phai di qua vung KEEP_OUT (vi du cua thong sanh bi chan boi KEEP_OUT)
      const blockedMidpoint = waypoints.slice(1, -1).find((pt) => {
        const z = getActiveSimulatorZone(pt.x, pt.y, zonesRef.current);
        return z && z.type === 'KEEP_OUT';
      });

      if (blockedMidpoint) {
        const blockingZone = getActiveSimulatorZone(blockedMidpoint.x, blockedMidpoint.y, zonesRef.current);
        const warnMsg = `Lộ trình di chuyển bị chặn bởi Vùng cấm vào "${blockingZone?.name || 'KEEP_OUT'}" ngay tại lối đi. Nếu đây là lối đi cần cấm dừng/đậu, vui lòng chuyển loại vùng sang "Cấm dừng (NO_STOP)".`;
        setZoneAlert({
          type: 'error',
          message: warnMsg,
        });
        onNotify(warnMsg, 'warning');
        return;
      }

      const segments = [];
      let totalDistance = 0;
      for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = waypoints[i];
        const p2 = waypoints[i + 1];
        const segDx = p2.x - p1.x;
        const segDy = p2.y - p1.y;
        const segDist = Math.hypot(segDx, segDy);
        const segYaw = Math.atan2(segDy, segDx);

        segments.push({
          p1,
          p2,
          segDx,
          segDy,
          segDist,
          segYaw,
          startDist: totalDistance,
          endDist: totalDistance + segDist,
        });
        totalDistance += segDist;
      }

      setCurrentPath({
        waypoints,
        label: targetName,
        targetPoint: goalPoint,
        totalDistance,
      });

      if (!fromWorkflow) {
        setManualNavLabel(`Toi: ${targetName}`);
      }

      // Phat tin hieu goal toi ROS 2 Gazebo (Chi khi dang bat ket noi ROS 2)
      if (isRosEnabledRef.current && rosClientRef.current?.isConnected) {
        rosClientRef.current.publishGoal(goalPoint.x, goalPoint.y, 0.0);
        // KHI DA KET NOI VOI GAZEBO:
        // Vi tri va goc quay hoan toan do Telemetry thuc cua Gazebo dieu khien qua LERP 60fps
        // Khong chay animation gia lap noi bo de dong bo ti le 100% va khong bi giat rung
        return;
      }

      // CHE DO GIA LAP THUAN WEB (Internal Animation):
      // Chay animation noi bo voi ti le van toc thuc 0.35m/s (Dong nhat ti le voi Gazebo)
      const currentSpeed = simSpeedRef.current || 1.0;
      const baseDurationSec = Math.max(2.5, Math.min(12.0, totalDistance / 0.35));
      const durationMs = (baseDurationSec * 1000) / currentSpeed;
      const startTime = performance.now();

      const animateMove = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / durationMs);
        const ease = progress * progress * (3 - 2 * progress);
        const curTraveledDist = ease * totalDistance;

        let activeSeg =
          segments.find((s) => curTraveledDist >= s.startDist && curTraveledDist <= s.endDist) ||
          segments[segments.length - 1];

        let curX = goalPoint.x;
        let curY = goalPoint.y;
        let curYaw = robotPoseRef.current.yaw;

        if (activeSeg) {
          const segRatio =
            activeSeg.segDist > 0.001
              ? (curTraveledDist - activeSeg.startDist) / activeSeg.segDist
              : 1.0;
          curX = Number((activeSeg.p1.x + activeSeg.segDx * segRatio).toFixed(2));
          curY = Number((activeSeg.p1.y + activeSeg.segDy * segRatio).toFixed(2));
          curYaw = Number(activeSeg.segYaw.toFixed(2));
        }

        const newPose = { x: curX, y: curY, yaw: curYaw };
        robotPoseRef.current = newPose;
        setRobotPose(newPose);
        setStepProgress(Math.round(progress * 100));

        if (progress < 1.0) {
          animFrameRef.current = requestAnimationFrame(animateMove);
        } else {
          const lastYaw = segments.length > 0 ? segments[segments.length - 1].segYaw : robotPoseRef.current.yaw;
          const finalPose = { x: goalPoint.x, y: goalPoint.y, yaw: Number(lastYaw.toFixed(2)) };
          robotPoseRef.current = finalPose;
          setRobotPose(finalPose);
          setStepProgress(100);

          if (fromWorkflow) {
            handleStepFinish();
          } else {
            setManualNavLabel(`Da den: ${targetName}`);
          }
        }
      };

      animFrameRef.current = requestAnimationFrame(animateMove);
    },
    [handleStepFinish]
  );

  // Thuc thi buoc hien tai (Chi trigger khi chuyen buoc hoac bam Play/Pause)
  useEffect(() => {
    if (!isPlaying || isPaused || !activeStep) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    // Kiem tra an toan Vung chuc nang truoc khi thuc thi buoc
    const stepValidation = validateWorkflowStepZone(activeStep, zonesRef.current);
    if (!stepValidation.valid) {
      setIsPlaying(false);
      setIsPaused(false);
      setZoneAlert({ type: 'error', message: stepValidation.error });
      onNotify(stepValidation.error, 'error');
      return;
    }
    if (stepValidation.warning) {
      onNotify(stepValidation.warning, 'info');
    }

    setStepProgress(0);
    const stepType = activeStep.type;
    const params = activeStep.params || {};

    // Phat giong noi TTS neu buoc co loi thoai
    if (!isMutedRef.current && (stepType === 'GREET' || stepType === 'SPEAK')) {
      const voiceText =
        stepType === 'GREET'
          ? params.greeting_text || params.text || 'Xin chao quy khach'
          : params.text || params.speech_text || '';
      const voiceSpeed = parseFloat(params.speed || params.voice_speed) || 1.0;
      const lang = params.language || 'vi-VN';

      if (voiceText.trim() && speakRef.current) {
        speakRef.current(voiceText, lang, null, null, null, voiceSpeed);
      }
    }

    // XU LY DI CHUYEN NE TUONG (MOVE)
    if (stepType === 'MOVE') {
      let targetX = parseFloat(params.target_x);
      let targetY = parseFloat(params.target_y);
      const wpName = params.waypoint_name || params.target_value || 'Điểm đến';

      if (isNaN(targetX) || isNaN(targetY)) {
        const wp = GAZEBO_LOBBY_WAYPOINTS[params.target_value] || GAZEBO_LOBBY_WAYPOINTS.FRONT_DESK;
        targetX = wp?.x ?? 5.2;
        targetY = wp?.y ?? 2.0;
      }

      let startOverride = null;
      if (params.from_waypoint && params.from_waypoint !== 'CURRENT') {
        const fromWp = GAZEBO_LOBBY_WAYPOINTS[params.from_waypoint];
        if (fromWp) {
          startOverride = { x: fromWp.x, y: fromWp.y, yaw: robotPoseRef.current.yaw };
        }
      }

      handleNavigateToGoal(targetX, targetY, wpName, true, startOverride);
    } else {
      // CAC BUOC TUONG TAC (GREET, SPEAK, SHOW, LISTEN, RECOMMEND, CREATE_REQUEST, FEEDBACK)
      let waitDurationSec = 3.5;
      if (stepType === 'GREET' || stepType === 'SPEAK') {
        const textContent =
          stepType === 'GREET'
            ? params.greeting_text || params.text || 'Xin chào quý khách'
            : params.text || params.speech_text || '';
        const len = textContent.trim().length;
        waitDurationSec = Math.max(3.5, Math.min(10.0, Math.ceil(len * 0.085)));
      } else if (stepType === 'SHOW') {
        waitDurationSec = parseInt(params.timeout || params.slide_duration_sec) || 4;
      } else if (stepType === 'LISTEN') {
        waitDurationSec = parseInt(params.timeout || params.timeout_sec) || 4;
      } else if (stepType === 'RECOMMEND') {
        waitDurationSec = 3.5;
      } else if (stepType === 'CREATE_REQUEST') {
        waitDurationSec = 3;
      } else if (stepType === 'FEEDBACK') {
        waitDurationSec = 3.5;
      }

      const currentSpeed = simSpeedRef.current || 1.0;
      const totalMs = (waitDurationSec * 1000) / currentSpeed;
      const startTime = performance.now();

      const animateProgress = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / totalMs);
        setStepProgress(Math.round(progress * 100));

        if (progress < 1.0) {
          animFrameRef.current = requestAnimationFrame(animateProgress);
        }
      };

      animFrameRef.current = requestAnimationFrame(animateProgress);
      timerRef.current = setTimeout(handleStepFinish, totalMs);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, isPaused, currentStepIndex, selectedWorkflowId, handleStepFinish, handleNavigateToGoal]);

  // Bo dieu khien
  const handleStartSim = () => {
    if (!steps || steps.length === 0) {
      onNotify('Kịch bản hiện tại chưa có bước thực thi nào', 'warning');
      return;
    }
    setIsPlaying(true);
    setIsPaused(false);
    setCurrentStepIndex(0);
    setStepProgress(0);
    setManualNavLabel(null);
    robotPoseRef.current = ROBOT_INITIAL_POSE;
    setRobotPose(ROBOT_INITIAL_POSE);
  };

  const handlePauseSim = () => {
    setIsPaused((prev) => !prev);
    if (!isPaused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (stopSpeakingRef.current) stopSpeakingRef.current();
    }
  };

  const handleStopSim = () => {
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentStepIndex(0);
    setStepProgress(0);
    setCurrentPath(null);
    setManualNavLabel(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (stopSpeakingRef.current) stopSpeakingRef.current();
    robotPoseRef.current = ROBOT_INITIAL_POSE;
    setRobotPose(ROBOT_INITIAL_POSE);
  };

  const handleNextStep = () => {
    handleStepFinish();
  };

  const handleReset = () => {
    handleStopSim();
  };

  // Nguoi dung click vao mat san de chon diem den truc tiep tren ban do
  const handleMapClick = (e) => {
    // Neu vua keo tha Vung hoac Endpoint xong thi khong kich hoat dieu huong robot
    if (wasDraggingRef.current || dragState || dragEndpointState) return;

    // Neu click trung endpoint hoac phan tu con cua endpoint thi khong bo chon va khong dieu huong
    if (e.target?.closest?.('[data-endpoint]')) return;

    // Neu click trung vung (zone) hoac tay nam co gian thi khong bo chon va khong dieu huong
    if (e.target?.closest?.('[data-zone]') || e.target?.closest?.('.zone-resize-handles')) return;

    // KHI DANG CHINH SUA HOAC THEM VUNG / ENDPOINT: BO CHON VA KHONG LAI ROBOT
    if (isZoneEditMode || selectedZone || isEndpointEditMode || selectedEndpoint) {
      if (selectedZone) {
        setSelectedZone(null);
      }
      if (selectedEndpoint) {
        setSelectedEndpoint(null);
      }
      setIsZoneEditMode(false);
      setIsEndpointEditMode(false);
      return;
    }

    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const svgX = (clientX / rect.width) * 1000;
    const svgY = (clientY / rect.height) * 620;

    // Chi tiep nhan click trong pham vi sanh (X 50..950, Y 50..550)
    if (svgX < 50 || svgX > 950 || svgY < 50 || svgY > 550) return;

    const meter = svgToMeter(svgX, svgY);

    // Kiem tra an toan Zone tai toa do nguoi dung click
    const clickedZone = getActiveSimulatorZone(meter.x, meter.y, zonesRef.current);
    if (clickedZone && clickedZone.type === 'KEEP_OUT') {
      const msg = `Vị trí (${meter.x.toFixed(1)}m, ${meter.y.toFixed(1)}m) thuộc Vùng cấm vào "${clickedZone.name}". Robot không được phép di chuyển vào đây!`;
      setZoneAlert({ type: 'error', message: msg });
      onNotify(msg, 'warning');
      return;
    }

    const currentRobotPt = { x: robotPoseRef.current.x, y: robotPoseRef.current.y };
    const passthrough = resolveNoStopPassthrough(currentRobotPt, meter, zonesRef.current);
    if (passthrough.isNoStop) {
      const safePt = passthrough.safePoint;
      onNotify(
        `Điểm chọn (${meter.x}m, ${meter.y}m) nằm trong Vùng cấm dừng "${passthrough.zone.name}". Robot tự động đi xuyên qua vùng cấm đến vị trí an toàn (${safePt.x}m, ${safePt.y}m).`,
        'info'
      );
      handleNavigateToGoal(safePt.x, safePt.y, `Thoát vùng cấm dừng (${safePt.x}m, ${safePt.y}m)`);
      return;
    }

    handleNavigateToGoal(meter.x, meter.y, `${meter.x}m, ${meter.y}m`);
  };

  const handleDispatchToRobot = async () => {
    try {
      await executeWorkflow(selectedWorkflowId);
      onNotify('Đã phát lệnh kích hoạt kịch bản tới Robot thành công.', 'success');
    } catch {
      onNotify('Kích hoạt kịch bản tới Robot (Chế độ mô phỏng nội bộ).', 'info');
    } finally {
      if (onClose) {
        onClose();
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden select-none" style={{ backgroundColor: '#F2EFE9' }}>
      {/* THANH DIEU KHIEN CHINH - Đồng bộ màu xám #E9E5DC của Sidebar trái */}
      <div
        className="h-14 px-4 border-b flex items-center justify-between gap-4 shrink-0"
        style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
      >
        <div className="flex items-center gap-3">
          {/* NUT TRANG THAI ROS 2: ONLINE / OFFLINE */}
          <button
            type="button"
            onClick={() => {
              const nextState = !isRosEnabled;
              setIsRosEnabled(nextState);
              if (nextState) {
                onNotify('Đang kích hoạt kết nối ROS 2 (port 9090)...', 'info');
              } else {
                onNotify('Đã ngắt kết nối ROS 2.', 'info');
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border transition-all cursor-pointer shadow-xs ${
              isRosEnabled && isRosConnected
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'text-[#262626] hover:bg-[#BFBFBD]'
            }`}
            style={!(isRosEnabled && isRosConnected) ? { backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' } : {}}
            title={
              isRosEnabled && isRosConnected
                ? 'ROS 2: ONLINE (Click để ngắt kết nối)'
                : 'ROS 2: OFFLINE (Click để kết nối lại port 9090)'
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isRosEnabled && isRosConnected ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
              }`}
            />
            <span>{isRosEnabled && isRosConnected ? 'ROS 2: ONLINE' : 'ROS 2: OFFLINE'}</span>
          </button>

          <select
            value={selectedWorkflowId || ''}
            onChange={(e) => {
              handleStopSim();
              setSelectedWorkflowId(e.target.value);
            }}
            className="h-8 px-2.5 rounded-lg border text-xs font-bold shadow-xs focus:outline-none max-w-[280px] sm:max-w-[340px] truncate cursor-pointer"
            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
          >
            {localWorkflows.map((wf) => (
              <option key={wf.id} value={wf.id}>
                {wf.name} ({wf.steps?.length || 0} bước)
              </option>
            ))}
          </select>

          {/* NUT VUNG TONG HOP (DROP BOX TOAN BO CHUC NANG KEO THA, THEM, LUU, DAT LAI) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsZoneMenuOpen((prev) => !prev)}
              className={`h-8 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${
                showZones
                  ? 'bg-[#262626] text-white border-[#262626]'
                  : 'hover:bg-[#FAF8F5] text-[#262626]'
              }`}
              style={!showZones ? { backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' } : {}}
              title="Mở menu quản lý các Vùng Quy Định (Hiển thị, Kéo thả, Thêm, Lưu, Đặt lại)"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Vùng</span>
              <span
                className={`text-[9.5px] px-1 py-0.2 rounded font-mono ${
                  showZones ? 'bg-white/20 text-white' : 'bg-[#E9E5DC] text-[#262626]'
                }`}
              >
                {zones.length}
              </span>
              {hasUnsavedZones && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
              <ChevronDown className={`w-3 h-3 transition-transform ${isZoneMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* DROP BOX MENU QUAN LY VUNG */}
            {isZoneMenuOpen && (
              <div
                className="absolute top-9 left-0 z-30 w-72 p-2.5 rounded-xl border shadow-2xl backdrop-blur-md animate-fadeIn text-xs space-y-2 select-none"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              >
                {/* Header Drop Box */}
                <div className="flex items-center justify-between pb-1.5 border-b" style={{ borderColor: '#E9E5DC' }}>
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10.5px]">
                    <Layers className="w-3.5 h-3.5 text-[#262626]" />
                    <span>Quản lý Vùng ({zones.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsZoneMenuOpen(false)}
                    className="p-1 rounded hover:bg-[#F2EFE9] text-[#8C8C8C] hover:text-[#262626] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 1. Switch Hien Thi & Switch Keo Tha */}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setShowZones((prev) => !prev)}
                    className="w-full px-2 py-1.5 rounded-lg border flex items-center justify-between font-semibold hover:bg-[#F2EFE9] cursor-pointer transition-colors text-left"
                    style={{ borderColor: '#E9E5DC' }}
                  >
                    <span className="flex items-center gap-2">
                      {showZones ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-[#8C8C8C]" />}
                      <span>Hiển thị lớp Vùng</span>
                    </span>
                    <span
                      className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        showZones ? 'bg-emerald-100 text-emerald-800' : 'bg-[#E9E5DC] text-[#8C8C8C]'
                      }`}
                    >
                      {showZones ? 'BẬT' : 'TẮT'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsZoneEditMode((prev) => !prev)}
                    className={`w-full px-2 py-1.5 rounded-lg border flex items-center justify-between font-semibold cursor-pointer transition-colors text-left ${
                      isZoneEditMode
                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : 'hover:bg-[#F2EFE9] text-[#8C8C8C] border-[#E9E5DC]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Move className="w-3.5 h-3.5 text-amber-700" />
                      <span>Kéo thả & Co giãn Vùng</span>
                    </span>
                    <span
                      className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        isZoneEditMode ? 'bg-amber-200 text-amber-900' : 'bg-[#E9E5DC] text-[#8C8C8C]'
                      }`}
                    >
                      {isZoneEditMode ? 'BẬT' : 'TẮT'}
                    </span>
                  </button>
                </div>

                {/* 2. Them Vung Moi */}
                <div className="pt-1.5 border-t space-y-1" style={{ borderColor: '#E9E5DC' }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">
                    + Thêm vùng mới:
                  </div>
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => handleAddZone('KEEP_OUT')}
                      className="w-full text-left px-2 py-1.2 rounded-lg flex items-center gap-2 hover:bg-red-50 text-red-700 font-semibold cursor-pointer transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />
                      <span>Cấm vào (Keep-Out Zone)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddZone('SPEED_ZONE')}
                      className="w-full text-left px-2 py-1.2 rounded-lg flex items-center gap-2 hover:bg-amber-50 text-amber-800 font-semibold cursor-pointer transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      <span>Giới hạn tốc độ (Speed Zone)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddZone('NO_STOP')}
                      className="w-full text-left px-2 py-1.2 rounded-lg flex items-center gap-2 hover:bg-rose-50 text-rose-700 font-semibold cursor-pointer transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                      <span>Cấm dừng (No-Stop Zone)</span>
                    </button>
                  </div>
                </div>

                {/* 3. Luu Vung & Dat Lai */}
                <div className="pt-2 border-t flex items-center gap-2" style={{ borderColor: '#E9E5DC' }}>
                  <button
                    type="button"
                    onClick={() => {
                      handleSaveZones();
                      setIsZoneMenuOpen(false);
                    }}
                    disabled={isSavingZones || !hasUnsavedZones}
                    className={`flex-1 h-7.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all ${
                      hasUnsavedZones
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer animate-pulse'
                        : 'bg-[#F2EFE9] text-[#8C8C8C] cursor-not-allowed border border-[#E9E5DC]'
                    }`}
                  >
                    <Save className="w-3 h-3" />
                    <span>{isSavingZones ? 'Đang lưu...' : 'Lưu Vùng'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleResetDefaultZones();
                      setIsZoneMenuOpen(false);
                    }}
                    className="h-7.5 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1 text-[#8C8C8C] hover:text-[#262626] hover:bg-[#F2EFE9] cursor-pointer"
                    style={{ borderColor: '#BFBFBD' }}
                    title="Khôi phục lại 3 Vùng Chức Năng về chuẩn ban đầu"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Đặt lại</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* MENU QUAN LY ENDPOINTS (3 LOAI CHUAN: WAYPOINT, CHARGER, PARK) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsEndpointMenuOpen((prev) => !prev);
                setIsZoneMenuOpen(false);
              }}
              className={`h-8 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${
                isEndpointMenuOpen || selectedEndpoint
                  ? 'bg-[#262626] text-white border-[#262626]'
                  : 'text-[#262626] hover:bg-[#FAF8F5]'
              }`}
              style={!(isEndpointMenuOpen || selectedEndpoint) ? { backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' } : {}}
              title="Thêm và chỉnh sửa các loại Endpoint sảnh"
            >
              <MapPin className="w-3.5 h-3.5 text-[#262626]" />
              <span>Điểm đích ({endpoints.length})</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>

            {isEndpointMenuOpen && (
              <div
                className="absolute top-full left-0 mt-1.5 w-68 rounded-xl border shadow-xl p-3 z-50 text-xs space-y-2.5 animate-fadeIn"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: '#E9E5DC' }}>
                  <div className="flex items-center gap-1.5 font-bold">
                    <MapPin className="w-4 h-4 text-[#262626]" />
                    <span>Quản lý Endpoint ({endpoints.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEndpointMenuOpen(false)}
                    className="p-1 rounded hover:bg-[#F2EFE9] text-[#8C8C8C] hover:text-[#262626] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* + Them Endpoint Moi (3 Loai Chuan) */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">
                    + Thêm Endpoint mới:
                  </div>
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => handleAddEndpoint('WAYPOINT')}
                      className="w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-[#F2EFE9] text-[#262626] font-semibold cursor-pointer transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-[#262626] shrink-0" />
                      <span>Waypoint (Điểm đường / Điểm trung gian)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddEndpoint('CHARGER')}
                      className="w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-emerald-50 text-emerald-800 font-semibold cursor-pointer transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-[#059669] shrink-0" />
                      <span>Charger (Điểm sạc pin)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddEndpoint('PARK')}
                      className="w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-[#E9E5DC] text-stone-800 font-semibold cursor-pointer transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-[#71717A] shrink-0" />
                      <span>Park (Điểm đỗ / chờ)</span>
                    </button>
                  </div>
                </div>

                {/* Luu & Dat lai */}
                <div className="pt-2 border-t flex items-center gap-2" style={{ borderColor: '#E9E5DC' }}>
                  <button
                    type="button"
                    onClick={() => {
                      endpoints.forEach((ep) => handleSaveEndpointToDb(ep));
                      setIsEndpointMenuOpen(false);
                    }}
                    disabled={isSavingEndpoints || !hasUnsavedEndpoints}
                    className={`flex-1 h-7.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all ${
                      hasUnsavedEndpoints
                        ? 'bg-[#262626] hover:bg-[#383838] text-[#F2EFE9] cursor-pointer'
                        : 'bg-[#F2EFE9] text-[#8C8C8C] cursor-not-allowed border border-[#E9E5DC]'
                    }`}
                  >
                    <Save className="w-3 h-3" />
                    <span>{isSavingEndpoints ? 'Đang lưu...' : 'Lưu Điểm'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleResetDefaultEndpoints();
                      setIsEndpointMenuOpen(false);
                    }}
                    className="h-7.5 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1 text-[#8C8C8C] hover:text-[#262626] hover:bg-[#F2EFE9] cursor-pointer"
                    style={{ borderColor: '#BFBFBD' }}
                    title="Khôi phục lại danh sách Điểm Mốc về chuẩn ban đầu"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Đặt lại</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nhom nut dieu khien Play / Pause / Next / Reset / Speed */}
        <div className="flex items-center gap-2">
          {!isPlaying ? (
            <button
              type="button"
              onClick={handleStartSim}
              className="h-8 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Chay</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handlePauseSim}
                className="h-8 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
              >
                {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{isPaused ? 'Tiep' : 'Dung'}</span>
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="h-8 px-2.5 rounded-lg text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer hover:bg-[#363636]"
                style={{ backgroundColor: '#262626' }}
                title="Chuyen buoc tiep theo"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleStopSim}
                className="h-8 px-2.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                title="Huy kich ban"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="h-8 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer hover:bg-[#FAF8F5]"
            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
            title="Ve vi tri tram cho sảnh"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Toc do mo phong */}
          <div
            className="hidden lg:flex items-center border rounded-lg p-0.5 shadow-xs"
            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' }}
          >
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSimSpeed(spd)}
                className={`px-2 py-0.5 text-[11px] font-bold rounded cursor-pointer ${
                  simSpeed === spd ? 'bg-[#262626] text-white' : 'text-[#262626] hover:bg-[#E9E5DC]'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Mute Voice */}
          <button
            type="button"
            onClick={() => setIsMuted((prev) => !prev)}
            className={`h-8 w-8 rounded-lg border flex items-center justify-center cursor-pointer transition-all ${
              isMuted
                ? 'bg-amber-100 border-amber-300 text-amber-800'
                : 'hover:bg-[#FAF8F5]'
            }`}
            style={!isMuted ? { backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' } : {}}
            title={isMuted ? 'Bat tieng noi' : 'Tat tieng noi'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleDispatchToRobot}
            className="h-8 px-3 rounded-lg text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer shrink-0 hover:bg-[#363636]"
            style={{ backgroundColor: '#262626' }}
            title="Phát kịch bản tới Robot"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Phát</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded-lg border text-xs font-bold cursor-pointer shadow-xs hover:bg-[#FAF8F5]"
              style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
              title="Đóng giả lập"
            >
              Đóng
            </button>
          )}
        </div>
      </div>

      {/* KHONG GIAN CHINH CHIA 2 COT: SIDEBAR STEPS BEN TRAI VA SA BAN BEN PHAI */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* COT TRAI: DANH SACH CAC BUOC WORKFLOW XEP DOC (Màu xám #E9E5DC đồng bộ với Tab bên trái) */}
        <aside
          className="w-72 sm:w-80 border-r flex flex-col shrink-0 overflow-hidden"
          style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
        >
          {/* Header Sidebar: Trang thai buoc hien tai & Tien do */}
          <div
            className="p-3 border-b shrink-0"
            style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#262626' }}>
                <ClipboardList className="w-3.5 h-3.5 text-[#262626]" />
                <span>Tiến trình kịch bản</span>
              </span>
              <span
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border"
                style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
              >
                {steps.length} bước
              </span>
            </div>

            {/* Card trang thai buoc dang thuc thi */}
            <div
              className="p-2.5 rounded-xl border shadow-xs"
              style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase" style={{ color: '#8C8C8C' }}>
                    {isPlaying ? `Bước ${currentStepIndex + 1}/${steps.length}` : 'Trạng thái'}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold font-mono shadow-xs tracking-wider"
                    style={{ backgroundColor: '#262626', color: '#FFFFFF' }}
                  >
                    {activeDetail.label}
                  </span>
                </div>
                {isPlaying && (
                  <span className="text-xs font-mono font-bold" style={{ color: '#262626' }}>
                    {stepProgress}%
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {isPlaying && (
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden mb-1.5 border"
                  style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
                >
                  <div
                    className="h-full transition-all duration-150 rounded-full"
                    style={{ width: `${stepProgress}%`, backgroundColor: '#262626' }}
                  />
                </div>
              )}

              <div
                className="text-[11px] font-bold truncate"
                style={{ color: '#262626' }}
                title={activeStep ? (activeStep.title || activeDetail.shortChip) : 'Robot ở trạng thái chờ lệnh'}
              >
                {activeStep ? (activeStep.title || activeDetail.shortChip) : 'Robot ở trạng thái chờ lệnh'}
              </div>
            </div>
          </div>

          {/* Danh sach cac buoc xep doc (Vertical Timeline) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
            {steps.length === 0 ? (
              <div
                className="p-4 text-center rounded-xl border text-xs leading-relaxed"
                style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#8C8C8C' }}
              >
                {activeWorkflow
                  ? `Kịch bản "${activeWorkflow.name}" chưa có bước thực thi nào trong CSDL.`
                  : 'Chưa có kịch bản nào được chọn.'}
              </div>
            ) : (
              steps.map((step, idx) => {
                const isActive = isPlaying && currentStepIndex === idx;
                const isPast = isPlaying && currentStepIndex > idx;
                const stepDetail = getStepActionDetail(step);

              return (
                <div
                  key={step.step_id || idx}
                  className="p-2.5 rounded-xl border transition-all flex items-start gap-2.5 select-none"
                  style={{
                    backgroundColor: isActive ? '#FFFFFF' : isPast ? '#E9E5DC' : '#F2EFE9',
                    borderColor: isActive ? '#262626' : '#BFBFBD',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  {/* Badge so thu tu tron */}
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shrink-0 mt-0.5 ${
                      isActive
                        ? 'bg-[#262626] text-white'
                        : isPast
                        ? 'bg-[#BFBFBD] text-[#262626]'
                        : 'border'
                    }`}
                    style={!isActive && !isPast ? { backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' } : {}}
                  >
                    {idx + 1}
                  </div>

                  {/* Noi dung buoc */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold tracking-wider border shrink-0"
                        style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                      >
                        {stepDetail.label}
                      </span>
                      <span
                        className="text-[11px] font-bold truncate flex-1"
                        style={{ color: '#262626' }}
                        title={step.title || stepDetail.shortChip}
                      >
                        {step.title || stepDetail.shortChip}
                      </span>

                      {step.type === 'MOVE' && !isPlaying && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingStepIdx(editingStepIdx === idx ? null : idx);
                          }}
                          className="text-[9.5px] font-bold flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors cursor-pointer shrink-0 hover:bg-[#FAF8F5]"
                          style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                          title="Thay đổi điểm mốc xuất phát và đích đến của bước này"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>{editingStepIdx === idx ? 'Đóng' : 'Đổi điểm'}</span>
                        </button>
                      )}
                    </div>

                    {/* Panel chinh sua nhanh diem moc ngay tai Sa ban Studio */}
                    {editingStepIdx === idx && step.type === 'MOVE' && (
                      <div
                        className="mt-2 pt-2 border-t space-y-2 p-2 rounded-lg animate-fadeIn"
                        style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold mb-0.5" style={{ color: '#262626' }}>
                          <span>Đổi Điểm Mốc (A ➔ B)</span>
                          <button
                            type="button"
                            onClick={() => setEditingStepIdx(null)}
                            className="font-bold flex items-center gap-0.5 cursor-pointer text-[9.5px] hover:text-black"
                            style={{ color: '#262626' }}
                          >
                            <Check className="w-3 h-3 text-[#262626]" />
                            <span>Xong</span>
                          </button>
                        </div>

                        <div className="space-y-0.5">
                          <label className="block text-[9px] font-bold uppercase" style={{ color: '#8C8C8C' }}>
                            Từ Điểm Mốc (Start):
                          </label>
                          <select
                            value={step.params?.from_waypoint || 'CURRENT'}
                            onChange={(e) =>
                              handleUpdateMoveStepWaypoints(
                                idx,
                                e.target.value,
                                step.params?.target_value || step.params?.target_waypoint_id || 'FRONT_DESK'
                              )
                            }
                            className="w-full px-2 py-1 rounded text-[10px] font-semibold border focus:outline-none cursor-pointer"
                            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
                          >
                            <option value="CURRENT">Vị trí hiện tại của Robot</option>
                            {endpoints.map((wp) => (
                              <option key={wp.id} value={wp.id}>
                                {wp.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-0.5">
                          <label className="block text-[9px] font-bold uppercase" style={{ color: '#8C8C8C' }}>
                            Đến Điểm Mốc (Goal):
                          </label>
                          <select
                            value={step.params?.target_value || step.params?.target_waypoint_id || 'FRONT_DESK'}
                            onChange={(e) =>
                              handleUpdateMoveStepWaypoints(
                                idx,
                                step.params?.from_waypoint || 'CURRENT',
                                e.target.value
                              )
                            }
                            className="w-full px-2 py-1 rounded text-[10px] font-semibold border focus:outline-none cursor-pointer"
                            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
                          >
                            {endpoints.map((wp) => (
                              <option key={wp.id} value={wp.id}>
                                {wp.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

        {/* COT PHAI: TOAN BO KHONG GIAN SA BAN 2D SANH GROUND FLOOR */}
        <main
          className="flex-1 min-w-0 h-full relative p-2 flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: '#F2EFE9' }}
        >
        {/* Thanh huong dan dieu huong truc quan & HUD Trang thai Vung cua Robot */}
        <div className="absolute top-3 right-4 z-10 flex flex-col items-end gap-1.5 select-none pointer-events-none">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-xs text-xs font-medium backdrop-blur-xs"
            style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
          >
            {isZoneEditMode || selectedZone ? (
              <>
                <Move className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline font-bold text-amber-900">Chế độ sửa Vùng (Kéo thả định vị)</span>
              </>
            ) : (
              <>
                <Navigation className="w-3.5 h-3.5 text-[#8C8C8C]" />
                <span className="hidden sm:inline">Click sàn để di chuyển</span>
              </>
            )}
            <span
              className="font-mono font-bold px-1.5 py-0.5 rounded border ml-1"
              style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
            >
              ({robotPose.x}m, {robotPose.y}m)
            </span>

            {/* Chip HUD Trang thai Vung hien tai cua Robot */}
            {activeRobotZone ? (
              <span
                className={`flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[10px] border shadow-2xs ${
                  activeRobotZone.type === 'KEEP_OUT'
                    ? 'bg-red-100 text-red-800 border-red-300 animate-pulse'
                    : activeRobotZone.type === 'SPEED_ZONE' || activeRobotZone.type === 'SLOW_SPEED'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}
              >
                {activeRobotZone.type === 'KEEP_OUT' && <Ban className="w-3 h-3 text-red-600" />}
                {(activeRobotZone.type === 'SPEED_ZONE' || activeRobotZone.type === 'SLOW_SPEED') && (
                  <Gauge className="w-3 h-3 text-amber-600" />
                )}
                {activeRobotZone.type === 'NO_STOP' && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                <span>
                  {activeRobotZone.type === 'KEEP_OUT'
                    ? 'VÙNG CẤM'
                    : activeRobotZone.type === 'SPEED_ZONE' || activeRobotZone.type === 'SLOW_SPEED'
                    ? `TỐC ĐỘ: ${activeRobotZone.speed_limit || 0.20}m/s`
                    : 'CẤM DỪNG'}
                </span>
              </span>
            ) : (
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[9.5px] border"
                style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#8C8C8C' }}
              >
                <Shield className="w-2.5 h-2.5" />
                <span>Sảnh Tự Do</span>
              </span>
            )}
          </div>


          {/* Toast Cảnh Báo An Toàn Vùng (Nổi khi vi phạm hoặc click vùng cấm) */}
          {zoneAlert && (
            <div
              className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-md text-xs font-semibold animate-fadeIn max-w-md"
              style={{
                backgroundColor: zoneAlert.type === 'error' ? '#FEF2F2' : '#FFFBEB',
                borderColor: zoneAlert.type === 'error' ? '#FCA5A5' : '#FCD34D',
                color: zoneAlert.type === 'error' ? '#991B1B' : '#92400E',
              }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="text-[11px] leading-tight flex-1">{zoneAlert.message}</span>
              <button
                type="button"
                onClick={() => setZoneAlert(null)}
                className="p-1 rounded hover:bg-black/5 cursor-pointer shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <svg
          ref={svgRef}
          viewBox="0 0 1000 620"
          onClick={handleMapClick}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          className={`w-full h-full object-contain select-none ${
            dragState
              ? 'cursor-grabbing'
              : isZoneEditMode || selectedZone
              ? 'cursor-default'
              : 'cursor-crosshair'
          }`}
        >
          <defs>
            <pattern id="blueprintDots" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="#BFBFBD" />
            </pattern>
            {/* Pattern soc cheo do cho KEEP_OUT */}
            <pattern id="keepoutStripes" width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="16" stroke="#DC2626" strokeWidth="4" opacity="0.30" />
            </pattern>
            {/* Pattern cham ho phach cho SPEED_ZONE */}
            <pattern id="speedZonePattern" width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="3" r="2" fill="#D97706" opacity="0.35" />
            </pattern>
            {/* Pattern soc cheo do hong cho NO_STOP */}
            <pattern id="nostopStripes" width="14" height="14" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="14" stroke="#E11D48" strokeWidth="3" opacity="0.30" />
            </pattern>
          </defs>

          {/* Nen san co luoi cham */}
          <rect x="0" y="0" width="1000" height="620" fill="#F2EFE9" />
          <rect x="50" y="50" width="900" height="500" fill="url(#blueprintDots)" />

          <text x="50" y="36" className="text-xs font-mono font-bold tracking-widest uppercase" fill="#8C8C8C" fontFamily="sans-serif">
            Mặt bằng sảnh khách sạn • 10m x 6m
          </text>

          {/* MAT BANG KIEN TRUC SANH TANG TRET - DONG BO CHINH XAC 100% VOI GAZEBO hotel_room.world */}
          {/* 1. KHUNG TUONG BAO NGOAI (OUTER WALLS: X 50..950, Y 50..550 tuong ung 10m x 6m) */}
          <rect
            x="50"
            y="50"
            width="900"
            height="500"
            fill="#FFFFFF"
            stroke="#262626"
            strokeWidth="3.5"
          />

          {/* 2. VACH NGAN CHIA SANH (Gazebo: X = 4.4m -> svgX = 446) */}
          {/* Vach Bac (Gazebo: Y = 3.3m den 6.0m -> svgY = 275 den 50) */}
          <line x1="446" y1="50" x2="446" y2="275" stroke="#1c1917" strokeWidth="3.5" />
          {/* Vach Nam (Gazebo: Y = 0.0m den 2.4m -> svgY = 550 den 350) */}
          <line x1="446" y1="350" x2="446" y2="550" stroke="#1c1917" strokeWidth="3.5" />
          {/* Lối Cửa Thông Sảnh (Doorway: Gazebo Y = 2.4m den 3.3m rong 0.9m -> svgY = 275 den 350) */}
          <line x1="446" y1="275" x2="446" y2="350" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />

          {/* 3. GIAN TRAI: 3 BO SOFA VA BAN TRA TRON (LOBBY LOUNGE - Chuan Gazebo) */}
          {/* Bo Sofa 1 (Bac: pose x=0.55, y=5.0; ban tra x=1.3, y=5.0) */}
          <g>
            <rect x="73" y="75" width="54" height="116" rx="4" fill="#ffffff" stroke="#1c1917" strokeWidth="2" />
            <line x1="73" y1="104" x2="127" y2="104" stroke="#64748b" strokeWidth="1" />
            <line x1="73" y1="162" x2="127" y2="162" stroke="#64748b" strokeWidth="1" />
            <circle cx="167" cy="133" r="23" fill="#ffffff" stroke="#1c1917" strokeWidth="2" />
          </g>

          {/* Bo Sofa 2 (Giua: pose x=0.55, y=3.0; ban tra x=1.3, y=3.0) */}
          <g>
            <rect x="73" y="242" width="54" height="116" rx="4" fill="#ffffff" stroke="#1c1917" strokeWidth="2" />
            <line x1="73" y1="271" x2="127" y2="271" stroke="#64748b" strokeWidth="1" />
            <line x1="73" y1="329" x2="127" y2="329" stroke="#64748b" strokeWidth="1" />
            <circle cx="167" cy="300" r="23" fill="#ffffff" stroke="#1c1917" strokeWidth="2" />
          </g>

          {/* Chu Lobby o giua Gian Trai */}
          <text
            x="240"
            y="305"
            textAnchor="middle"
            className="text-base font-bold fill-stone-900"
            fontFamily="sans-serif"
          >
            Lobby
          </text>

          {/* Bo Sofa 3 (Nam: pose x=0.55, y=1.0; ban tra x=1.3, y=1.0) */}
          <g>
            <rect x="73" y="408" width="54" height="116" rx="4" fill="#ffffff" stroke="#1c1917" strokeWidth="2" />
            <line x1="73" y1="437" x2="127" y2="437" stroke="#64748b" strokeWidth="1" />
            <line x1="73" y1="495" x2="127" y2="495" stroke="#64748b" strokeWidth="1" />
            <circle cx="167" cy="467" r="23" fill="#ffffff" stroke="#1c1917" strokeWidth="2" />
          </g>

          {/* 4. GIAN PHAI - PHIA NAM: CUA CHINH, FRONT DESK, STAFF ONLY */}
          {/* Cua Chinh (Gazebo: x = 4.8m den 5.8m -> svgX = 482 den 572, tam x = 527) */}
          <g>
            <rect x="482" y="546" width="90" height="8" fill="#ffffff" />
            {/* Canh cua mo xoay vao trong */}
            <line x1="482" y1="550" x2="527" y2="520" stroke="#1c1917" strokeWidth="2" />
            <path d="M 527 520 A 45 45 0 0 1 527 550" fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="2 2" />
            <line x1="572" y1="550" x2="527" y2="520" stroke="#1c1917" strokeWidth="2" />
            <path d="M 527 520 A 45 45 0 0 0 527 550" fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="2 2" />
          </g>

          {/* Quay Tiep Tan (Gazebo Front Desk: goc L tai x=5.8m, y=2.5m -> svgX=572, svgY=342) */}
          <g>
            {/* Mat truoc quay ngang: x = 5.8m -> 6.8m (svgX 572 -> 662), y = 2.5m (svgY 342) */}
            <rect x="572" y="327" width="90" height="30" fill="#ffffff" stroke="#1c1917" strokeWidth="3" />
            {/* Vach doc ben hong: x = 5.8m (svgX 572), y = 0.3m -> 2.5m (svgY 342 -> 525) */}
            <rect x="572" y="357" width="23" height="168" fill="#ffffff" stroke="#1c1917" strokeWidth="3" />
            <text x="635" y="420" textAnchor="middle" className="text-sm font-bold fill-stone-900" fontFamily="sans-serif">
              Front
            </text>
            <text x="635" y="442" textAnchor="middle" className="text-sm font-bold fill-stone-900" fontFamily="sans-serif">
              Desk
            </text>
          </g>

          {/* Phong Staff Only (Gazebo: x = 8.35m den 10.0m, y = 0.0m den 3.06m -> svgX = 802 den 950, svgY = 295 den 550) */}
          <g>
            {/* Vach ngang phia Bac (Gazebo: y = 3.06m -> svgY = 295) */}
            <line x1="802" y1="295" x2="950" y2="295" stroke="#1c1917" strokeWidth="3" />
            {/* Vach dung phia Tay (Gazebo: x = 8.35m, y = 0.0m den 2.25m -> svgY 550 den 363) */}
            <line x1="802" y1="363" x2="802" y2="550" stroke="#1c1917" strokeWidth="3" />
            {/* Cua mo vao phong Staff Only (Gazebo: y = 2.25m den 3.06m -> svgY 295 den 363) */}
            <line x1="802" y1="295" x2="802" y2="363" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 3" />
            <text x="876" y="445" textAnchor="middle" className="text-sm font-bold fill-stone-900" fontFamily="sans-serif">
              Staff Only
            </text>
          </g>

          {/* 5. GIAN PHAI - PHIA BAC: DAY 3 PHONG (WC, THANG MAY, CAU THANG - Chuan Gazebo) */}
          {/* Mat truoc: Gazebo y = 4.7m den 6.0m -> svgY = 50 den 158; x = 5.8m den 10.0m -> svgX = 572 den 950 */}
          <rect x="572" y="50" width="378" height="108" fill="#ffffff" stroke="#1c1917" strokeWidth="3" />
          {/* Vach ngan giua WC va Thang May (Gazebo: x = 7.2m -> svgX = 698) */}
          <line x1="698" y1="50" x2="698" y2="158" stroke="#1c1917" strokeWidth="2.5" />
          {/* Vach ngan giua Thang May va Cau Thang (Gazebo: x = 8.65m -> svgX = 828) */}
          <line x1="828" y1="50" x2="828" y2="158" stroke="#1c1917" strokeWidth="2.5" />

          {/* (1) Nha Ve Sinh (Restrooms: Gazebo x = 5.8m den 7.2m -> svgX = 572 den 698) */}
          <g>
            {/* Nam */}
            <circle cx="620" cy="80" r="7" fill="#1c1917" />
            <path d="M 611 91 L 629 91 L 629 120 L 624 120 L 624 145 L 616 145 L 616 120 L 611 120 Z" fill="#1c1917" />
            {/* Nu */}
            <circle cx="660" cy="80" r="7" fill="#1c1917" />
            <path d="M 651 91 L 669 91 L 676 120 L 666 120 L 666 145 L 661 145 L 661 120 L 657 120 L 657 145 L 652 145 L 652 120 L 644 120 Z" fill="#1c1917" />
          </g>

          {/* (2) Cum Thang May (Elevator: Gazebo x = 7.2m den 8.65m -> svgX = 698 den 828) */}
          <g>
            <rect x="736" y="68" width="54" height="74" fill="none" stroke="#1c1917" strokeWidth="2.2" />
            <line x1="763" y1="68" x2="763" y2="142" stroke="#1c1917" strokeWidth="1.8" />
            <line x1="758" y1="100" x2="758" y2="110" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />
            <line x1="768" y1="100" x2="768" y2="110" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />
            {/* Mui ten len / xuong */}
            <path d="M 752 90 L 752 78 M 748 82 L 752 78 L 756 82" stroke="#1c1917" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 774 78 L 774 90 M 770 86 L 774 90 L 778 86" stroke="#1c1917" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          {/* (3) Cau Thang Bo (Stairs: Gazebo x = 8.65m den 10.0m -> svgX = 828 den 950) */}
          <g>
            <line x1="889" y1="50" x2="889" y2="158" stroke="#1c1917" strokeWidth="2" />
            {[62, 76, 90, 104, 118, 132, 146].map((sy) => (
              <g key={sy}>
                <line x1="835" y1={sy} x2="883" y2={sy} stroke="#64748b" strokeWidth="1.5" />
                <line x1="895" y1={sy} x2="943" y2={sy} stroke="#64748b" strokeWidth="1.5" />
              </g>
            ))}
          </g>

          {/* LOP 3 VUNG CHUC NANG (KEEP-OUT, SPEED ZONE, NO-STOP) TRUOC MAT BANG SAU TUONG SAN */}
          {showZones &&
            zones.map((zone) => {
              const rect = zoneToSvgRect(zone);
              const isKeepOut = zone.type === 'KEEP_OUT';
              const isSpeed = zone.type === 'SPEED_ZONE' || zone.type === 'SLOW_SPEED';
              const isSelected = selectedZone?.id === zone.id;
              const isDraggingThis = dragState?.zoneId === zone.id;

              const fillPattern = isKeepOut
                ? 'url(#keepoutStripes)'
                : isSpeed
                ? 'url(#speedZonePattern)'
                : 'url(#nostopStripes)';

              const strokeColor = isKeepOut ? '#DC2626' : isSpeed ? '#D97706' : '#E11D48';
              const bgTint = isKeepOut
                ? 'rgba(220, 38, 38, 0.12)'
                : isSpeed
                ? 'rgba(217, 119, 6, 0.12)'
                : 'rgba(225, 29, 72, 0.12)';


              const isZoneInteractable = isZoneEditMode || isSelected;

              return (
                <g
                  key={zone.id}
                  data-zone="true"
                  data-zone-id={zone.id}
                  onPointerDown={(e) => {
                    if (isZoneInteractable) {
                      handleZonePointerDown(e, zone, 'MOVE');
                    }
                  }}
                  onPointerUp={(e) => {
                    handleSvgPointerUp(e);
                  }}
                  onClick={(e) => handleZoneClick(e, zone)}
                  className={`select-none transition-opacity ${
                    isZoneInteractable
                      ? isDraggingThis
                        ? 'cursor-grabbing opacity-90 pointer-events-auto'
                        : 'cursor-grab hover:opacity-95 pointer-events-auto'
                      : 'pointer-events-none'
                  }`}
                >
                  {/* Nen mau tint nhe */}
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    fill={bgTint}
                  />
                  {/* Lop hoa van pattern */}
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    fill={fillPattern}
                  />
                  {/* Vien bao net dut ky thuat */}
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isSelected ? '2.5' : '1.8'}
                    strokeDasharray={isKeepOut ? '6 4' : isSpeed ? '5 3' : '4 3'}
                  />

                  {/* Chú thích vùng bằng ICON và MÀU RIÊNG ở góc trên bên phải của vùng (Click vao Icon de chon va sua Vung) */}
                  <g
                    transform={`translate(${rect.x + rect.width - (isSpeed ? 44 : 26)}, ${rect.y + 7})`}
                    className="pointer-events-auto select-none cursor-pointer group"
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextSelected = isSelected ? null : zone;
                      setSelectedZone(nextSelected);
                      setIsZoneEditMode(Boolean(nextSelected));
                      if (nextSelected) {
                        onNotify(`Chế độ sửa vùng: Đã chọn "${zone.name}".`, 'info');
                      }
                    }}
                    title={`Click vào Icon để chọn và chỉnh sửa Vùng: ${zone.name}`}
                  >
                    {isKeepOut && (
                      <g filter="drop-shadow(0 1px 2px rgba(0,0,0,0.25))">
                        {/* Vòng nền đỏ riêng biệt */}
                        <circle cx="10" cy="10" r="9.5" fill="#DC2626" />
                        {/* Icon Cấm Vào (Ban / Circle Slash) */}
                        <circle cx="10" cy="10" r="6" fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
                        <line x1="5.8" y1="5.8" x2="14.2" y2="14.2" stroke="#FFFFFF" strokeWidth="1.6" />
                      </g>
                    )}
                    {!isKeepOut && !isSpeed && (
                      <g filter="drop-shadow(0 1px 2px rgba(0,0,0,0.25))">
                        {/* Vòng nền hồng đỏ riêng biệt */}
                        <circle cx="10" cy="10" r="9.5" fill="#E11D48" />
                        {/* Icon Cấm Dừng (Stop / Octagon Hand) */}
                        <polygon points="7,4 13,4 16,7 16,13 13,16 7,16 4,13 4,7" fill="#FFFFFF" />
                        <rect x="7" y="9.2" width="6" height="1.6" rx="0.4" fill="#E11D48" />
                      </g>
                    )}
                    {isSpeed && (
                      <g filter="drop-shadow(0 1px 2px rgba(0,0,0,0.25))">
                        {/* Pill badge nền cam hổ phách */}
                        <rect x="0" y="0" width="38" height="18" rx="9" fill="#D97706" />
                        {/* Gauge arc & needle */}
                        <path d="M 6 12.5 A 4.5 4.5 0 1 1 14 12.5" fill="none" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" />
                        <line x1="10" y1="9.5" x2="12.5" y2="7" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" />
                        <text
                          x="25"
                          y="12.5"
                          textAnchor="middle"
                          fill="#FFFFFF"
                          className="text-[8.5px] font-mono font-bold"
                          fontFamily="sans-serif"
                        >
                          {zone.speed_limit || 0.2}
                        </text>
                      </g>
                    )}
                  </g>


                  {/* 4 NUT TAY NAM CO GIAN KICH THUOC (RESIZE HANDLES) SIÊU NHẠY VÀ DỄ KÉO THẢ */}
                  {isSelected && (
                    <g className="zone-resize-handles">
                      {[
                        { cx: rect.x, cy: rect.y, type: 'RESIZE_NW', cursor: 'cursor-nwse-resize' },
                        { cx: rect.x + rect.width, cy: rect.y, type: 'RESIZE_NE', cursor: 'cursor-nesw-resize' },
                        { cx: rect.x, cy: rect.y + rect.height, type: 'RESIZE_SW', cursor: 'cursor-nesw-resize' },
                        { cx: rect.x + rect.width, cy: rect.y + rect.height, type: 'RESIZE_SE', cursor: 'cursor-nwse-resize' },
                      ].map((handle) => (
                        <g key={handle.type} className="group">
                          {/* 1. Vùng nhận diện click/drag tàng hình rộng r=16 (đường kính 32px), siêu dễ trỏ trúng */}
                          <circle
                            cx={handle.cx}
                            cy={handle.cy}
                            r="16"
                            fill="transparent"
                            stroke="transparent"
                            className={`${handle.cursor} select-none`}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              handleZonePointerDown(e, zone, handle.type);
                            }}
                          />
                          {/* 2. Vòng hào quang tương tác hỗ trợ định vị góc khi rê chuột */}
                          <circle
                            cx={handle.cx}
                            cy={handle.cy}
                            r="11"
                            fill={strokeColor}
                            fillOpacity="0.25"
                            className="pointer-events-none transition-transform"
                          />
                          {/* 3. Vòng tròn hiển thị chính (bán kính 7.5px, viền dày 3px màu vùng, nền trắng tương phản) */}
                          <circle
                            cx={handle.cx}
                            cy={handle.cy}
                            r="7.5"
                            fill="#FFFFFF"
                            stroke={strokeColor}
                            strokeWidth="3"
                            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.30))"
                            className={`pointer-events-none ${handle.cursor} transition-transform`}
                          />
                          {/* 4. Tâm tròn định vị đồng màu viền vùng */}
                          <circle
                            cx={handle.cx}
                            cy={handle.cy}
                            r="2.5"
                            fill={strokeColor}
                            className="pointer-events-none"
                          />
                        </g>
                      ))}
                    </g>
                  )}
                </g>
              );
            })}

          {/* CAC DIEM MOC ENDPOINTS TREN SA BAN - 3 LOAI CHUAN (WAYPOINT, CHARGER, PARK), HO TRO KEO THA & SUA TEN */}
          {endpoints.map((ep) => {
            const wpSvg = meterToSvg(ep.x, ep.y);
            const isTarget =
              currentPath?.targetPoint &&
              Math.abs(currentPath.targetPoint.x - ep.x) < 0.25 &&
              Math.abs(currentPath.targetPoint.y - ep.y) < 0.25;
            const isSelected = selectedEndpoint?.id === ep.id;
            const isDraggingThis = dragEndpointState?.endpointId === ep.id;
            const isHovered = hoveredEndpointId === ep.id;
            const showLabel = isSelected || isDraggingThis || isHovered;

            const tmpl = getEndpointTemplateInfo(ep.type);
            const epColor = tmpl.color || '#262626';

            // Ten diem moc do nguoi dung dat
            const nameText = ep.name || 'Điểm mốc';
            const badgeWidth = Math.max(70, nameText.length * 7.2 + 20);
            const isTopHalf = ep.y > 3.0;
            const badgeOffsetY = isTopHalf ? 18 : -18;

            return (
              <g
                key={ep.id}
                data-endpoint="true"
                data-endpoint-id={ep.id}
                onMouseEnter={() => setHoveredEndpointId(ep.id)}
                onMouseLeave={() => setHoveredEndpointId((prev) => (prev === ep.id ? null : prev))}
                onPointerDown={(e) => handleEndpointPointerDown(e, ep)}
                onPointerUp={(e) => {
                  if (!wasDraggingRef.current) {
                    setSelectedEndpoint(ep);
                    setSelectedZone(null);
                    setIsEndpointEditMode(true);
                  }
                  handleSvgPointerUp(e);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (wasDraggingRef.current) return;
                  setSelectedEndpoint(ep);
                  setSelectedZone(null);
                  setIsEndpointEditMode(true);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleNavigateToGoal(ep.x, ep.y, ep.name);
                }}
                className={`select-none ${isDraggingThis ? 'cursor-grabbing' : 'cursor-pointer'} group`}
              >
                {/* 1. Vung nhan dien Pointer va Halo khi duoc chon */}
                {isSelected && (
                  <circle
                    cx={wpSvg.x}
                    cy={wpSvg.y}
                    r="15"
                    fill={epColor}
                    fillOpacity="0.22"
                    stroke={epColor}
                    strokeWidth="1.8"
                    strokeDasharray="4 2"
                    className="animate-pulse pointer-events-none"
                  />
                )}

                {/* Vung nhan dien tuong tac rong r=16 de de tro chuot / keo tha */}
                <circle
                  cx={wpSvg.x}
                  cy={wpSvg.y}
                  r="16"
                  fill="transparent"
                  stroke="transparent"
                  className={isDraggingThis ? 'cursor-grabbing' : 'cursor-grab'}
                />

                {/* 2. Vong tron ngoai: Mau theo loai Endpoint (Waypoint: Carbon, Charger: Emerald, Park: Slate) */}
                <circle
                  cx={wpSvg.x}
                  cy={wpSvg.y}
                  r={isSelected ? 8.5 : isHovered ? 7.5 : 5.5}
                  fill="#ffffff"
                  stroke={epColor}
                  strokeWidth={isSelected ? '2.8' : isHovered ? '2.2' : '1.8'}
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.18))"
                  className="transition-all duration-150"
                />

                {/* 3. Tam tron dinh vi dong mau loai */}
                <circle
                  cx={wpSvg.x}
                  cy={wpSvg.y}
                  r={isSelected ? 3.5 : isHovered ? 3.0 : 2.2}
                  fill={epColor}
                  className="pointer-events-none transition-all duration-150"
                />

                {/* 4. The Nhan ten Endpoint - Hien khi hover hoac khi duoc chon, click vao cung chon duoc endpoint */}
                {showLabel && (
                  <g
                    transform={`translate(${wpSvg.x}, ${wpSvg.y + badgeOffsetY})`}
                    className="cursor-pointer transition-all duration-150"
                  >
                    {/* Card nen trang / xam tinh gon */}
                    <rect
                      x={-badgeWidth / 2}
                      y="-10"
                      width={badgeWidth}
                      height="20"
                      rx="4"
                      fill={isSelected ? '#18181B' : '#FFFFFF'}
                      stroke={isSelected ? epColor : '#BFBFBD'}
                      strokeWidth={isSelected ? '1.8' : '1'}
                      filter="drop-shadow(0 2px 6px rgba(0,0,0,0.22))"
                    />

                    {/* Dot mau phan biet loai Endpoint */}
                    <circle
                      cx={-badgeWidth / 2 + 8}
                      cy="0"
                      r="2.5"
                      fill={epColor}
                      className="pointer-events-none"
                    />

                    {/* Chu ten do nguoi dung dat */}
                    <text
                      x="4"
                      y="3.5"
                      textAnchor="middle"
                      fill={isSelected ? '#FFFFFF' : '#18181B'}
                      className="text-[9.5px] font-bold tracking-tight truncate pointer-events-none"
                      fontFamily="sans-serif"
                    >
                      {nameText.length > 24 ? nameText.slice(0, 22) + '...' : nameText}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* THE HIEN DUONG DI NE TUONG VA VAT CAN (OBSTACLE-AVOIDANCE TRAJECTORY) */}
          {currentPath?.waypoints?.length > 1 && (() => {
            const pathData = currentPath.waypoints
              .map((pt, idx) => {
                const s = meterToSvg(pt.x, pt.y);
                return `${idx === 0 ? 'M' : 'L'} ${s.x} ${s.y}`;
              })
              .join(' ');

            const curSvg = meterToSvg(robotPose.x, robotPose.y);
            const targetSvg = meterToSvg(
              currentPath.targetPoint.x,
              currentPath.targetPoint.y
            );
            const targetLabel = currentPath.label || 'Đích Đến';
            const labelWidth = Math.max(84, targetLabel.length * 7.5 + 16);

            // Tinh toan vet duong da lan banh qua (bam theo cac waypoints da di qua, tuyet doi khong ve duong thang cat xuyen tuong)
            const traveledPathData = (() => {
              const pts = currentPath.waypoints;
              const traveledPts = [pts[0]];
              let foundCurrentSeg = false;

              for (let i = 0; i < pts.length - 1; i++) {
                const pA = pts[i];
                const pB = pts[i + 1];
                const segLen = Math.hypot(pB.x - pA.x, pB.y - pA.y);
                if (segLen < 0.001) continue;

                const vAx = robotPose.x - pA.x;
                const vAy = robotPose.y - pA.y;
                const vABx = pB.x - pA.x;
                const vABy = pB.y - pA.y;
                const proj = (vAx * vABx + vAy * vABy) / (segLen * segLen);

                const clampedProj = Math.max(0, Math.min(1, proj));
                const closestX = pA.x + clampedProj * vABx;
                const closestY = pA.y + clampedProj * vABy;
                const distToSeg = Math.hypot(robotPose.x - closestX, robotPose.y - closestY);

                if (distToSeg < 0.6 && proj >= -0.15 && proj <= 1.05) {
                  traveledPts.push({ x: robotPose.x, y: robotPose.y });
                  foundCurrentSeg = true;
                  break;
                } else {
                  traveledPts.push(pB);
                }
              }

              if (!foundCurrentSeg && traveledPts.length > 0) {
                traveledPts.push({ x: robotPose.x, y: robotPose.y });
              }

              return traveledPts
                .map((pt, idx) => {
                  const s = meterToSvg(pt.x, pt.y);
                  return `${idx === 0 ? 'M' : 'L'} ${s.x} ${s.y}`;
                })
                .join(' ');
            })();

            return (
              <g>
                {/* 1. Duong dan huong ne tuong (Polyline uon quanh qua cua mo) */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="#71717a"
                  strokeWidth="2.5"
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.75"
                />

                {/* 2. Vet duong robot da lan banh qua toi vi tri hien tai (Bam sat polyline ne tuong, khong cat xuyen tuong) */}
                <path
                  d={traveledPathData}
                  fill="none"
                  stroke="#18181b"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* 3. Vong tron dich den tinh gon gang */}
                <g>
                  <circle
                    cx={targetSvg.x}
                    cy={targetSvg.y}
                    r="12"
                    fill="rgba(24, 24, 27, 0.05)"
                    stroke="#18181b"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  <g transform={`translate(${targetSvg.x}, ${targetSvg.y - 18})`}>
                    <rect
                      x={-labelWidth / 2}
                      y="-8.5"
                      width={labelWidth}
                      height="17"
                      rx="3"
                      fill="#18181b"
                      stroke="#27272a"
                      strokeWidth="1"
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.12))"
                    />
                    <text
                      x="0"
                      y="3.2"
                      textAnchor="middle"
                      className="text-[9px] font-bold fill-white tracking-wide"
                      fontFamily="sans-serif"
                    >
                      {targetLabel}
                    </text>
                  </g>
                </g>
              </g>
            );
          })()}

          {/* ROBOT MARKER KEM BONG BONG ACTION HUD THONG MINH TREN DAU ROBOT */}
          {(() => {
            const robotSvg = meterToSvg(robotPose.x, robotPose.y);
            const svgAngle = -(robotPose.yaw * 180) / Math.PI;

            return (
              <g transform={`translate(${robotSvg.x}, ${robotSvg.y})`}>
                {/* BONG BONG TRANG THAI TINH GON TREN DAU ROBOT (CHI HIEN THI TRANG THAI, KHONG HIEN CHI TIET DIEN DEN) */}
                {(() => {
                  const statusText = robotStatus.label;
                  const pillWidth = Math.max(86, statusText.length * 8.0 + 26);
                  return (
                    <g transform="translate(0, -32)" className="pointer-events-none select-none">
                      {/* Card nen trang tinh te */}
                      <rect
                        x={-pillWidth / 2}
                        y="-11"
                        width={pillWidth}
                        height="22"
                        rx="5"
                        fill="#FFFFFF"
                        stroke="#BFBFBD"
                        strokeWidth="1.2"
                        filter="drop-shadow(0 2px 5px rgba(0,0,0,0.12))"
                      />
                      {/* Mui ten tro xuong robot */}
                      <polygon points="-4,11 4,11 0,16" fill="#FFFFFF" stroke="#BFBFBD" strokeWidth="1.2" />
                      <line x1="-3.5" y1="11" x2="3.5" y2="11" stroke="#FFFFFF" strokeWidth="2" />

                      {/* Dot trang thai nho */}
                      <circle
                        cx={-pillWidth / 2 + 10}
                        cy="0"
                        r="3"
                        fill={robotStatus.dotColor}
                        className={robotStatus.isMoving ? 'animate-pulse' : ''}
                      />

                      {/* Chu trang thai cua robot */}
                      <text
                        x="4"
                        y="3.5"
                        textAnchor="middle"
                        className="text-[9.5px] font-bold tracking-wider uppercase"
                        fill="#262626"
                        fontFamily="sans-serif"
                      >
                        {statusText}
                      </text>
                    </g>
                  );
                })()}

                {/* Robot hinh chu nhat mau xam don gian, toi gian ky thuat */}
                <g transform={`rotate(${svgAngle})`}>
                  {/* 2 Banh xe mau xam den o 2 ben hong xe */}
                  <rect x="-8" y="-14" width="16" height="3.5" rx="1" fill="#18181b" />
                  <rect x="-8" y="10.5" width="16" height="3.5" rx="1" fill="#18181b" />

                  {/* Than xe hinh chu nhat mau xam toi gian */}
                  <rect
                    x="-14"
                    y="-11"
                    width="28"
                    height="22"
                    rx="3"
                    fill="#64748b"
                    stroke="#334155"
                    strokeWidth="1.5"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"
                  />

                  {/* Tam LiDAR nho mau xam dam */}
                  <circle cx="-3" cy="0" r="3.5" fill="#334155" stroke="#94a3b8" strokeWidth="0.8" />
                  <circle cx="-3" cy="0" r="1.2" fill="#cbd5e1" />

                  {/* Mui ten chi huong dau xe (+X) mau trang tinh gon */}
                  <polygon points="11,0 6,-3.5 6,3.5" fill="#ffffff" />
                </g>
              </g>
            );
          })()}
        </svg>

        {/* FLOATING ACTION BAR TINH GON O DUOI DAY SA BAN (EDIT ZONE & DRAG/RESIZE) */}
        {selectedZone && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center flex-nowrap whitespace-nowrap gap-2 px-3.5 py-1.5 rounded-xl border shadow-2xl backdrop-blur-md animate-fadeIn text-xs max-w-[95%] overflow-x-auto select-none"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
          >
            {/* 1. Loai Vung Dropdown */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    selectedZone.type === 'KEEP_OUT'
                      ? '#DC2626'
                      : selectedZone.type === 'SPEED_ZONE' || selectedZone.type === 'SLOW_SPEED'
                      ? '#D97706'
                      : '#E11D48',
                }}
              />
              <select
                value={
                  selectedZone.type === 'SLOW_SPEED' ? 'SPEED_ZONE' : selectedZone.type || 'KEEP_OUT'
                }
                onChange={(e) => handleUpdateSelectedZone('type', e.target.value)}
                className="px-2 py-1 rounded-lg font-bold text-[11px] border focus:outline-none cursor-pointer"
                style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
              >
                <option value="KEEP_OUT">Cấm vào (Keep-Out)</option>
                <option value="SPEED_ZONE">Giới hạn tốc độ (Speed Zone)</option>
                <option value="NO_STOP">Cấm dừng (No-Stop)</option>
              </select>
            </div>

            {/* 2. Sua Ten Vung Inline */}
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="text"
                value={selectedZone.name || ''}
                onChange={(e) => handleUpdateSelectedZone('name', e.target.value)}
                placeholder="Tên vùng..."
                className="w-36 sm:w-44 px-2 py-1 rounded-lg text-xs font-semibold border focus:outline-none"
                style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
              />
            </div>

            {/* 3. Neu la Speed Zone: Cho sua van toc toi da */}
            {(selectedZone.type === 'SPEED_ZONE' || selectedZone.type === 'SLOW_SPEED') && (
              <div className="flex items-center gap-1 text-[11px] font-mono shrink-0">
                <span className="text-[#8C8C8C]">Tối đa:</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="1.0"
                  value={selectedZone.speed_limit || 0.2}
                  onChange={(e) => handleUpdateSelectedZone('speed_limit', parseFloat(e.target.value) || 0.2)}
                  className="w-14 px-1.5 py-1 rounded-lg text-xs font-bold text-center border focus:outline-none"
                  style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#D97706' }}
                />
                <span className="text-[#8C8C8C]">m/s</span>
              </div>
            )}

            {/* 4. Thong so toa do realtime */}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[10.5px] border shrink-0"
              style={{ backgroundColor: '#F2EFE9', borderColor: '#E9E5DC', color: '#262626' }}
            >
              <span className="text-[#8C8C8C]">Tâm:</span>
              <span className="font-bold">({selectedZone.x}m, {selectedZone.y}m)</span>
              <span className="text-[#8C8C8C] ml-1">KT:</span>
              <span className="font-bold">{selectedZone.width}m × {selectedZone.height}m</span>
            </div>

            {/* 5. Nut Xoa Vung (Delete Zone) */}
            <button
              type="button"
              onClick={() => handleDeleteZone(selectedZone.id)}
              className="p-1.5 rounded-lg border text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border-red-200 cursor-pointer transition-colors shrink-0"
              title="Xóa vùng này khỏi bản đồ"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* 6. Nut Hoan tat / Dong che do sua */}
            <button
              type="button"
              onClick={() => {
                setSelectedZone(null);
                setIsZoneEditMode(false);
              }}
              className="p-1.5 rounded-lg border text-[#8C8C8C] hover:text-[#262626] hover:bg-[#F2EFE9] border-transparent hover:border-[#BFBFBD] cursor-pointer transition-colors shrink-0"
              title="Hoàn tất và trở về chế độ điều hướng"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            </button>
          </div>
        )}

        {/* FLOATING ACTION BAR TINH GON O DUOI DAY SA BAN (EDIT ENDPOINT: DAT TEN, LOAI, TOA DO, DIEN DEN, XOA) */}
        {selectedEndpoint && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center flex-nowrap whitespace-nowrap gap-2 px-3.5 py-1.5 rounded-xl border shadow-2xl backdrop-blur-md animate-fadeIn text-xs max-w-[95%] overflow-x-auto select-none"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
          >
            {/* 1. Loai Endpoint Dropdown (3 Loai Chuan: WAYPOINT, CHARGER, PARK) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: getEndpointTemplateInfo(selectedEndpoint.type).color }}
              />
              <select
                value={selectedEndpoint.type || 'WAYPOINT'}
                onChange={(e) => handleUpdateSelectedEndpoint('type', e.target.value)}
                className="px-2 py-1 rounded-lg font-bold text-[11px] border focus:outline-none cursor-pointer"
                style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
              >
                {OTTO_ENDPOINT_TEMPLATES.map((tmpl) => (
                  <option key={tmpl.type} value={tmpl.type}>
                    {tmpl.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Dat ten cho cho do Inline */}
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="text"
                value={selectedEndpoint.name || ''}
                onChange={(e) => handleUpdateSelectedEndpoint('name', e.target.value)}
                onBlur={() => handleSaveEndpointToDb(selectedEndpoint)}
                placeholder="Đặt tên cho chỗ này..."
                className="w-40 sm:w-56 px-2 py-1 rounded-lg text-xs font-semibold border focus:outline-none"
                style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
              />
            </div>

            {/* 3. Thong so toa do realtime */}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-[10.5px] border shrink-0"
              style={{ backgroundColor: '#F2EFE9', borderColor: '#E9E5DC', color: '#262626' }}
            >
              <span className="text-[#8C8C8C]">Tọa độ:</span>
              <span className="font-bold">
                ({Number(selectedEndpoint.x).toFixed(2)}m, {Number(selectedEndpoint.y).toFixed(2)}m)
              </span>
            </div>

            {/* 4. Nut Dieu huong toi day (Navigate robot) */}
            <button
              type="button"
              onClick={() => handleNavigateToGoal(selectedEndpoint.x, selectedEndpoint.y, selectedEndpoint.name)}
              className="px-2.5 py-1 rounded-lg border font-bold text-[11px] text-[#262626] bg-[#F2EFE9] hover:bg-stone-200 border-[#BFBFBD] cursor-pointer transition-colors shrink-0 flex items-center gap-1"
              title="Điều hướng Robot chạy tới điểm này"
            >
              <Navigation className="w-3 h-3 text-[#262626]" />
              <span>Tới đây</span>
            </button>

            {/* 5. Nut Xoa Endpoint */}
            <button
              type="button"
              onClick={() => handleDeleteEndpoint(selectedEndpoint.id)}
              className="p-1.5 rounded-lg border text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border-red-200 cursor-pointer transition-colors shrink-0"
              title="Xóa Endpoint này khỏi bản đồ"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* 6. Nut Hoan tat / Dong che do sua */}
            <button
              type="button"
              onClick={() => {
                handleSaveEndpointToDb(selectedEndpoint);
                setSelectedEndpoint(null);
                setIsEndpointEditMode(false);
              }}
              className="p-1.5 rounded-lg border text-[#8C8C8C] hover:text-[#262626] hover:bg-[#F2EFE9] border-transparent hover:border-[#BFBFBD] cursor-pointer transition-colors shrink-0"
              title="Hoàn tất và đóng thanh chỉnh sửa"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            </button>
          </div>
        )}
      </main>
    </div>
  </div>
);
};

export default WorkflowSimulatorStudio;
