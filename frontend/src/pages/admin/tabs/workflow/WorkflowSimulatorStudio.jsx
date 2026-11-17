import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  isPolygonZone,
  translateZone,
  zoneFromVertices,
  polygonValidationError,
  removeZoneVertex,
  insertZoneVertex,
  polygonEdgeAtPoint,
  MAX_ZONE_VERTICES,
  endpointZoneViolation,
  zoneEndpointConflict,
  zoneCorners,
  zoneBounds,
  resizeZoneFromCorner,
} from '../physicalMapZones';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Square,
  Send,
  Navigation,
  Edit3,
  Check,
  Layers,
  Gauge,
  Ban,
  AlertTriangle,
  X,
  Move,
  Save,
  Trash2,
  ChevronDown,
  SlidersHorizontal,
  ListOrdered,
  Megaphone,
  ZoomIn,
  ZoomOut,
  Maximize2,
  BatteryLow,
  MinusCircle,
  PlusCircle,
} from 'lucide-react';
import { useSpeechSynthesis } from '../../../../hooks/useSpeechSynthesis';
import { useRobotControlText } from '../../../../context/RobotControlLanguage';
import { LobbyFloorPlan } from './LobbyFloorPlan';
import {
  RosbridgeClient,
  ROS_TOPICS,
  ROS_MSG_TYPES,
  quaternionToYaw,
  createZoneSyncMsg,
  createWaypointSyncMsg,
} from '../../../../services/rosbridgeService';
import {
  fetchWorkflows,
  saveWorkflow,
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
  getStepActionDetail,
  SIMULATOR_HOTEL_ZONES,
  isPointInSimulatorZone,
  getActiveSimulatorZone,
  zoneToSvgRect,
  validateWorkflowStepZone,
  resolveMoveTarget,
} from './workflowSimulatorUtils';
import { guestRequestPhase } from '../../../../utils/workflowGuestRequest';
import { WorkflowGuestRequestPanel } from './WorkflowGuestRequestPanel';
import { useLanguage } from '../../../../context/LanguageContext';
import { KioskChoicePrompt } from './KioskChoicePrompt';
import { OUTCOME, findBrokenFlowLinks, getChoiceTimeoutSec, resolveNextStepIndex } from '../../../../utils/workflowFlow';
import {
  BATTERY_CRITICAL_PERCENT,
  BATTERY_LOW_PERCENT,
  BATTERY_MODE,
  BATTERY_RESUME_PERCENT,
  describeBatteryStatus,
  findChargeRoutine,
} from '../../../../utils/batteryPolicy';
import { useLowBatteryGuard } from '../../../../hooks/useLowBatteryGuard';
import { useWorkflowZoomPan } from './useWorkflowZoomPan';
import { useSimulatedGuest } from './useSimulatedGuest';
import { SimulatorGuestControls, SimulatorGuestMarker } from './SimulatorGuest';
import { simulatorRobotStatus } from './workflowSimulatorPresentation';
import { SimulatorMapMode } from './SimulatorMapMode';
import { simulatorGoalViolation, planSimulatorRoute, buildSimulatorMotion, sampleSimulatorMotion } from './simulatorNavigation';

// Kich thuoc ViewBox co so (om sat map 490x315 voi le 3px de anh map to toi da)
const BASE_VB_WIDTH = 496;
const BASE_VB_HEIGHT = 321;

export const WorkflowSimulatorStudio = ({
  workflows = [],
  initialWorkflowId = null,
  onClose = null,
  onNotify = () => { },
  onWorkflowUpdated = null,
}) => {
  const rc = useRobotControlText();
  const { language } = useLanguage();
  const [guestRequest, setGuestRequest] = useState({});
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
        .catch(() => { });
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

  // Tu dong bat che do Lap lai neu kich ban co kieu kich hoat la PATROL_LOOP
  useEffect(() => {
    if (activeWorkflow?.trigger_type === 'PATROL_LOOP') {
      setIsLoopMode(true);
      isLoopModeRef.current = true;
    }
  }, [selectedWorkflowId, activeWorkflow?.trigger_type]);

  // Che do chinh sua nhanh diem moc cua buoc MOVE ngay tai sa ban
  const [editingStepIdx, setEditingStepIdx] = useState(null);

  const handleUpdateMoveStepWaypoints = (stepIdx, fromKey, toKey) => {
    const targetWp =
      endpointsRef.current.find((e) => e.id === toKey || e.key === toKey || e.name === toKey) ||
      GAZEBO_LOBBY_WAYPOINTS[toKey] ||
      GAZEBO_LOBBY_WAYPOINTS.FRONT_DESK;
    const fromWp =
      fromKey === 'CURRENT'
        ? null
        : endpointsRef.current.find((e) => e.id === fromKey || e.key === fromKey || e.name === fromKey) ||
        GAZEBO_LOBBY_WAYPOINTS[fromKey];

    const toCleanName = targetWp?.name?.split('(')[0]?.trim() || toKey;
    const stepNumber = stepIdx + 1;
    const newTitle = `${stepNumber}. Di chuyển tới ${toCleanName}`;

    setLocalWorkflows((prevList) => {
      return prevList.map((wf) => {
        if (wf.id !== selectedWorkflowId) return wf;
        const updatedSteps = (wf.steps || []).map((st, i) => {
          if (i !== stepIdx) return st;
          return {
            ...st,
            title: newTitle,
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
    const pts = planSimulatorRoute(startPt, goalPt, zonesRef.current);
    if (!pts) {
      onNotify(language === 'VI' ? 'Không có lộ trình khả dụng giữa hai điểm.' : 'No clear route between these endpoints.', 'warning');
      setCurrentPath(null);
      return;
    }
    let totalDist = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      totalDist += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    }
    setCurrentPath({
      preview: true,
      waypoints: pts,
      label: targetWp.name,
      targetPoint: goalPt,
      totalDistance: totalDist,
    });
    setManualNavLabel(`Lộ trình: ${fromKey === 'CURRENT' ? 'Hiện tại' : (fromWp?.name?.split('(')[0]?.trim() || fromKey)} ➔ ${toCleanName}`);

    // Dong bo luu truc tiep vao Database & cap nhat len Tab Danh Sach
    const currentWf = localWorkflows.find((w) => w.id === selectedWorkflowId);
    if (currentWf) {
      const updatedSteps = (currentWf.steps || []).map((st, i) => {
        if (i !== stepIdx) return st;
        return {
          ...st,
          title: newTitle,
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
      const wfToSave = { ...currentWf, steps: updatedSteps };
      saveWorkflow(wfToSave)
        .then((savedWf) => {
          onWorkflowUpdated?.(savedWf || wfToSave);
          onNotify?.(`Đã đồng bộ điểm mốc Bước ${stepNumber} vào kịch bản`, 'success');
        })
        .catch((err) => {
          console.warn('Lỗi tự động lưu kịch bản vào Database:', err);
        });
    }
  };

  // Cap nhat loi quang ba/phat loa khi di chuyen cho buoc MOVE
  const handleUpdateMoveStepBroadcast = (stepIdx, speechText) => {
    setLocalWorkflows((prevList) => {
      return prevList.map((wf) => {
        if (wf.id !== selectedWorkflowId) return wf;
        const updatedSteps = (wf.steps || []).map((st, i) => {
          if (i !== stepIdx) return st;
          return {
            ...st,
            params: {
              ...(st.params || {}),
              broadcast_speech: speechText,
            },
          };
        });
        return { ...wf, steps: updatedSteps };
      });
    });

    const currentWf = localWorkflows.find((w) => w.id === selectedWorkflowId);
    if (currentWf) {
      const updatedSteps = (currentWf.steps || []).map((st, i) => {
        if (i !== stepIdx) return st;
        return {
          ...st,
          params: {
            ...(st.params || {}),
            broadcast_speech: speechText,
          },
        };
      });
      const wfToSave = { ...currentWf, steps: updatedSteps };
      saveWorkflow(wfToSave)
        .then((savedWf) => {
          onWorkflowUpdated?.(savedWf || wfToSave);
        })
        .catch((err) => {
          console.warn('Lỗi lưu lời phát loa vào Database:', err);
        });
    }
  };

  // Trang thai thuc thi
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoopMode, setIsLoopMode] = useState(false);
  const [stepProgress, setStepProgress] = useState(0);
  // Tang moi lan vao buoc de buoc nhay ve chinh no van chay lai; cac buoc da chay that su (co re nhanh)
  const [stepRun, setStepRun] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState(() => new Set());
  // Pin gia lap (Gazebo khong mo phong pin); cung quy tac pin yeu voi man hinh robot
  const [simBatteryPercent, setSimBatteryPercent] = useState(100);
  const [simGuestPresent, setSimGuestPresent] = useState(false);
  const [guestRunId, setGuestRunId] = useState(0);
  const promotionProgressRef = useRef({ key: null, percent: 0 });

  // Duong di hien tai cua robot: { waypoints: [{x, y}], label: string }
  const [currentPath, setCurrentPath] = useState(null);

  // Vi tri robot (Mac dinh o Goc Tren Ben Phai sanh: x: 3.7, y: 5.0, yaw: -Math.PI / 2)
  const [robotPose, setRobotPose] = useState(ROBOT_INITIAL_POSE);
  const [manualNavLabel, setManualNavLabel] = useState(null);
  const [isRosEnabled, setIsRosEnabled] = useState(true);
  const [isRosConnected, setIsRosConnected] = useState(false);
  const [interactionMode, setInteractionMode] = useState('CONTROL');
  const interactionModeRef = useRef(interactionMode);
  interactionModeRef.current = interactionMode;
  const isMapEditing = interactionMode === 'EDIT' && !isPlaying && (!currentPath || currentPath.preview);
  const [linearSpeed, setLinearSpeed] = useState(0);
  const navigationContextRef = useRef({ language });
  navigationContextRef.current = { language };

  // Quan ly 3 Vung Chuc Nang: Keep-Out, Speed Zone, No-Stop
  const [zones, setZones] = useState(SIMULATOR_HOTEL_ZONES);
  const [showZones, setShowZones] = useState(true);
  const [selectedZone, setSelectedZone] = useState(null);
  const [zoneAlert, setZoneAlert] = useState(null);

  // Zone feedback stays on the map instead of also opening the parent toast.
  useEffect(() => {
    if (!zoneAlert) return;
    const timeout = window.setTimeout(() => setZoneAlert(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [zoneAlert]);

  const svgRef = useRef(null);
  const {
    zoomScale,
    setZoomScale,
    panOffset,
    setPanOffset,
    isPanning,
    setIsPanning,
    panStartRef,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleWheelZoom,
    getSvgPointFromClient,
    currentVbWidth,
    currentVbHeight,
    currentVbX,
    currentVbY,
    viewBoxString: dynamicViewBox,
  } = useWorkflowZoomPan({
    baseWidth: BASE_VB_WIDTH,
    baseHeight: BASE_VB_HEIGHT,
    centerX: 280,
    centerY: 192.5,
    svgRef,
  });

  // Che do keo tha va thay doi kich thuoc Vung tren sa ban map
  const [isZoneEditMode, setIsZoneEditMode] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [hasUnsavedZones, setHasUnsavedZones] = useState(false);
  const [isSavingZones, setIsSavingZones] = useState(false);
  const [isZoneMenuOpen, setIsZoneMenuOpen] = useState(false);
  const wasDraggingRef = useRef(false);

  // Polygon draw mode (giong AdminPhysicalMapTab)
  const [zoneDrawType, setZoneDrawType] = useState(null); // null | 'KEEP_OUT' | 'SPEED_ZONE' | 'NO_STOP'
  const [zoneDrawShape, setZoneDrawShape] = useState('rectangle'); // 'rectangle' | 'polygon'
  const [zoneDraft, setZoneDraft] = useState(null); // { type, vertices: [{x,y}], cursor: {x,y} } hoac { type, a, b }
  const [selectedZoneVertex, setSelectedZoneVertex] = useState(null); // index dinh polygon dang chon
  const [zoneEdgeHover, setZoneEdgeHover] = useState(null); // { zoneId, edgeIndex, point: {x,y} }

  useEffect(() => {
    setSelectedZoneVertex(null);
    setZoneEdgeHover(null);
  }, [selectedZone?.id]);

  // Dropdown menu Workflow, Ban do, Tien trinh kịch bản & Menu Tuy chon mo phong
  const [isWorkflowMenuOpen, setIsWorkflowMenuOpen] = useState(false);
  const [isMapMenuOpen, setIsMapMenuOpen] = useState(false);
  const [mapMenuTab, setMapMenuTab] = useState('ZONES'); // 'ZONES' | 'ENDPOINTS'
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isStepsMenuOpen, setIsStepsMenuOpen] = useState(false);
  const workflowMenuRef = useRef(null);
  const mapMenuRef = useRef(null);
  const settingsMenuRef = useRef(null);
  const stepsMenuRef = useRef(null);

  // Tu dong dong Dropdown khi click ben ngoai
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (workflowMenuRef.current && !workflowMenuRef.current.contains(event.target)) {
        setIsWorkflowMenuOpen(false);
      }
      if (mapMenuRef.current && !mapMenuRef.current.contains(event.target)) {
        setIsMapMenuOpen(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
        setIsSettingsMenuOpen(false);
      }
      if (stepsMenuRef.current && !stepsMenuRef.current.contains(event.target)) {
        setIsStepsMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, []);

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
    if (!isMapEditing) return;
    setIsZoneMenuOpen(false);
    setIsMapMenuOpen(false);
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

    const conflict = zoneEndpointConflict(newZone, endpointsRef.current);
    if (conflict) { onNotify(conflict.message, 'warning'); return; }
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

  // Toggle polygon/rect draw mode (giong AdminPhysicalMapTab.toggleZoneDraw)
  const toggleZoneDraw = (type) => {
    if (!isMapEditing) return;
    setZoneDraft(null);
    setZoneDrawType((cur) => (cur === type ? null : type));
    setIsMapMenuOpen(false);
  };

  // Hoan thanh polygon zone (khi nguoi dung double-click hoac bam nut Xong)
  const finishPolygon = () => {
    if (!isMapEditing) return;
    const vertices = zoneDraft?.vertices || [];
    const error = polygonValidationError(vertices);
    if (error) { onNotify(error, 'warning'); return; }
    const count = zones.filter((z) => z.type === zoneDrawType).length + 1;
    const typeLabels = { KEEP_OUT: 'Cấm Vào', SPEED_ZONE: 'Giới Hạn Tốc Độ', NO_STOP: 'Cấm Dừng' };
    const newZone = {
      id: `zone_${Date.now()}`,
      name: `${typeLabels[zoneDrawType] || 'Vùng'} #${count}`,
      type: zoneDrawType,
      speed_limit: zoneDrawType === 'SPEED_ZONE' ? 0.20 : null,
      description: 'Vùng đa giác được vẽ trong Simulator.',
      ...zoneFromVertices(vertices),
      vertices,
    };
    const conflict = zoneEndpointConflict(newZone, endpointsRef.current);
    if (conflict) { onNotify(conflict.message, 'warning'); return; }
    const updatedZones = [...zones, newZone];
    setZones(updatedZones);
    setSelectedZone(newZone);
    setSelectedZoneVertex(null);
    setIsZoneEditMode(true);
    setShowZones(true);
    setHasUnsavedZones(true);
    setZoneDraft(null);
    setZoneDrawType(null);
    onNotify(`Đã tạo vùng đa giác "${newZone.name}".`, 'success');
  };

  // Xoa dinh dang chon cua polygon (Toi thieu 3 dinh)
  const handleDeleteSelectedVertex = () => {
    if (!isMapEditing) return false;
    if (!isPolygonZone(selectedZone) || selectedZoneVertex === null || !showZones || zoneDrawType) return false;
    const result = removeZoneVertex(selectedZone, selectedZoneVertex);
    if (result.error) {
      onNotify(result.error, 'warning');
      return false;
    }
    const updated = result.zone;
    const conflict = zoneEndpointConflict(updated, endpointsRef.current);
    if (conflict) { onNotify(conflict.message, 'warning'); return false; }
    const nextList = zones.map((z) => (z.id === updated.id ? updated : z));
    setZones(nextList);
    setSelectedZone(updated);
    setSelectedZoneVertex(null);
    setHasUnsavedZones(true);
    onNotify(`Đã xóa đỉnh ${selectedZoneVertex + 1}. Vùng "${updated.name}" còn ${updated.vertices.length} đỉnh.`, 'info');
    return true;
  };
  const deleteZoneVertexRef = useRef(handleDeleteSelectedVertex);
  deleteZoneVertexRef.current = handleDeleteSelectedVertex;

  // Keyboard listener: Esc de huy ve, Delete/Backspace de xoa dinh polygon dang chon
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'escape') {
        setSelectedZoneVertex(null);
        setZoneDrawType(null);
        setZoneDraft(null);
        return;
      }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
      if (key === 'delete' || key === 'backspace') {
        if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.isContentEditable) {
          if (deleteZoneVertexRef.current?.()) {
            e.preventDefault();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Xoa Vung duoc chon (Delete Zone)
  const handleDeleteZone = async (zoneId) => {
    if (!isMapEditing) return;
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
    if (!isMapEditing) return;
    if (!selectedZone) return;
    const updated = { ...selectedZone, [field]: value };
    if (field === 'type') {
      const conflict = zoneEndpointConflict(updated, endpointsRef.current);
      if (conflict) { onNotify(conflict.message, 'warning'); return; }
    }
    setSelectedZone(updated);
    setZones((prev) => prev.map((z) => (z.id === selectedZone.id ? updated : z)));
    setHasUnsavedZones(true);
  };

  // Luu cau hinh 3 Vung Chuc Nang vao CSDL va phat len topic ROS 2
  const handleSaveZones = async () => {
    if (!isMapEditing) return;
    for (const zone of zones) {
      const error = isPolygonZone(zone) ? polygonValidationError(zone.vertices) : null;
      if (error) { onNotify(error, 'warning'); return; }
    }
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
    } catch (error) {
      setHasUnsavedZones(true);
      onNotify(language === 'VI' ? `Chưa lưu được vùng: ${error.message}` : `Zones were not saved: ${error.message}`, 'warning');
    } finally {
      setIsSavingZones(false);
    }
  };

  // Khoi phuc vi tri 3 Vung Chuc Nang ve mac dinh
  const handleResetDefaultZones = () => {
    if (!isMapEditing) return;
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
    if (!isMapEditing) return;
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

    const x = customCoords ? Number(customCoords.x.toFixed(2)) : Number(Math.min(18.5, Math.max(1.0, robotPose.x + 0.8)).toFixed(2));
    const y = customCoords ? Number(customCoords.y.toFixed(2)) : Number(Math.min(11.5, Math.max(1.0, robotPose.y + 0.5)).toFixed(2));

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

    const placementError = endpointZoneViolation(newEndpoint, zones);
    if (placementError) { onNotify(placementError, 'warning'); return; }

    setEndpoints((prev) => [...prev, newEndpoint]);
    setSelectedEndpoint(newEndpoint);
    setSelectedZone(null);
    setIsEndpointEditMode(true);
    setHasUnsavedEndpoints(true);
    onNotify(`Đã thêm mới ${typeInfo.label.split('(')[0].trim()}: "${newEndpoint.name}"`, 'success');

    saveWaypoint(newEndpoint).catch((err) => {
      console.warn('Lỗi lưu endpoint vào backend:', err.message);
    });

    if (isRosEnabledRef.current && rosClientRef.current?.isConnected) {
      rosClientRef.current.publish(
        '/hotel_waypoints',
        'std_msgs/String',
        createWaypointSyncMsg([...endpoints, newEndpoint])
      );
    }
  };

  // Cap nhat thong tin Endpoint (ten, loai)
  const handleUpdateSelectedEndpoint = (field, value) => {
    if (!isMapEditing) return;
    if (!selectedEndpoint) return;
    const updated = { ...selectedEndpoint, [field]: value };
    setSelectedEndpoint(updated);
    const nextEndpoints = endpoints.map((e) => (e.id === updated.id ? updated : e));
    setEndpoints(nextEndpoints);
    setHasUnsavedEndpoints(true);
    if (isRosEnabledRef.current && rosClientRef.current?.isConnected) {
      rosClientRef.current.publish(
        '/hotel_waypoints',
        'std_msgs/String',
        createWaypointSyncMsg(nextEndpoints)
      );
    }
  };

  // Luu endpoint vao CSDL
  const handleSaveEndpointToDb = async (endpoint) => {
    if (!isMapEditing) return;
    if (!endpoint || !endpoint.name?.trim()) return;
    const placementError = endpointZoneViolation(endpoint, zonesRef.current);
    if (placementError) { onNotify(placementError, 'warning'); return; }
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
      if (isRosEnabledRef.current && rosClientRef.current?.isConnected) {
        rosClientRef.current.publish(
          '/hotel_waypoints',
          'std_msgs/String',
          createWaypointSyncMsg(endpointsRef.current)
        );
      }
      onNotify(`Đã lưu Endpoint "${endpoint.name}" vào CSDL.`, 'success');
    } catch (err) {
      onNotify('Lỗi khi lưu Endpoint: ' + err.message, 'warning');
    } finally {
      setIsSavingEndpoints(false);
    }
  };

  // Xoa Endpoint
  const handleDeleteEndpoint = async (endpointId) => {
    if (!isMapEditing) return;
    const target = endpoints.find((e) => e.id === endpointId);
    const name = target?.name || 'Endpoint';
    setEndpoints((prev) => prev.filter((e) => e.id !== endpointId));
    if (selectedEndpoint?.id === endpointId) {
      setSelectedEndpoint(null);
      setIsEndpointEditMode(false);
    }
    onNotify(`Đã xóa "${name}" khỏi bản đồ.`, 'info');
    const remaining = endpoints.filter((e) => e.id !== endpointId);
    if (isRosEnabledRef.current && rosClientRef.current?.isConnected) {
      rosClientRef.current.publish(
        '/hotel_waypoints',
        'std_msgs/String',
        createWaypointSyncMsg(remaining)
      );
    }
    try {
      await deleteWaypoint(endpointId);
    } catch {
      // local state already updated
    }
  };

  // Dat lai danh sach Endpoints chuan ban dau
  const handleResetDefaultEndpoints = () => {
    if (!isMapEditing) return;
    setEndpoints(STANDARD_LOBBY_WAYPOINTS);
    setSelectedEndpoint(null);
    setHasUnsavedEndpoints(true);
    if (isRosEnabledRef.current && rosClientRef.current?.isConnected) {
      rosClientRef.current.publish(
        '/hotel_waypoints',
        'std_msgs/String',
        createWaypointSyncMsg(STANDARD_LOBBY_WAYPOINTS)
      );
    }
    onNotify('Đã khôi phục danh sách Điểm Đích về thông số chuẩn sảnh 10m x 6m.', 'info');
  };

  // PointerDown de keo tha Endpoint tren SVG Map
  const handleEndpointPointerDown = (e, ep) => {
    if (!isMapEditing || zoneDrawType || e.shiftKey) return;
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
    if (!isMapEditing || e.shiftKey) return;
    if (e.button !== 0) return;
    if (zoneDrawType) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedZone(zone);
    setSelectedEndpoint(null);
    setIsZoneEditMode(true);
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
      const scaleX = (BASE_VB_WIDTH / zoomScale) / (svgRect?.width || 1);
      const scaleY = (BASE_VB_HEIGHT / zoomScale) / (svgRect?.height || 1);
      setPanOffset({
        x: panStartRef.current.initialPan.x + dx * scaleX,
        y: panStartRef.current.initialPan.y + dy * scaleY,
      });
      return;
    }

    // Cap nhat cursor cho polygon draw preview
    if (!isMapEditing) return;
    if (zoneDrawType && zoneDrawShape === 'polygon' && zoneDraft?.vertices) {
      const pt = getSvgPointFromClient(e.clientX, e.clientY);
      const p = svgToMeter(pt.x, pt.y);
      setZoneDraft((prev) => prev ? { ...prev, cursor: p } : prev);
      return;
    }

    // Kiem tra edge hover tren Polygon Zone dang chon (khi khong keo tha) de them dinh moi
    if (!dragState && !dragEndpointState && showZones && isPolygonZone(selectedZone) && !zoneDrawType) {
      const pt = getSvgPointFromClient(e.clientX, e.clientY);
      const points = selectedZone.vertices.map((p) => meterToSvg(p.x, p.y));
      const nearVertex = points.some((p) => Math.hypot(pt.x - p.x, pt.y - p.y) <= 10);
      if (!nearVertex && selectedZone.vertices.length < MAX_ZONE_VERTICES) {
        const edge = polygonEdgeAtPoint(points, pt, 8);
        if (edge) {
          const meterPoint = svgToMeter(edge.point.x, edge.point.y);
          setZoneEdgeHover({
            zoneId: selectedZone.id,
            edgeIndex: edge.edgeIndex,
            point: meterPoint,
            svgPoint: edge.point,
          });
        } else {
          setZoneEdgeHover(null);
        }
      } else {
        setZoneEdgeHover(null);
      }
    }

    if ((!dragState && !dragEndpointState) || !svgRef.current) return;

    // QUAN TRỌNG: Neu chuot KHONG con duoc de nhan (e.buttons === 0), lap tuc huy trang thai keo tha
    if (e.buttons !== undefined && (e.buttons & 1) === 0) {
      handleSvgPointerUp(e);
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

    const scaleX = (BASE_VB_WIDTH / zoomScale) / svgRect.width;
    const scaleY = (BASE_VB_HEIGHT / zoomScale) / svgRect.height;

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

    // 2. KEO THA DINH POLYGON (ZONE_VERTEX)
    if (dragState.type === 'ZONE_VERTEX') {
      const pt = getSvgPointFromClient(e.clientX, e.clientY);
      const meterPt = svgToMeter(pt.x, pt.y);
      const clampedX = Number(Math.max(0.2, Math.min(19.4, meterPt.x)).toFixed(2));
      const clampedY = Number(Math.max(0.2, Math.min(12.4, meterPt.y)).toFixed(2));
      const initZ = dragState.initialZone;
      const vertices = initZ.vertices.map((p, idx) =>
        idx === dragState.vertex ? { x: clampedX, y: clampedY } : p
      );
      const updated = { ...initZ, ...zoneFromVertices(vertices), vertices };
      zonesRef.current = zonesRef.current.map((z) => (z.id === dragState.zoneId ? updated : z));
      setZones(zonesRef.current);
      setSelectedZone(updated);
      setHasUnsavedZones(true);
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
      const updatedZones = zonesRef.current.map((z) => z.id === dragState.zoneId ? updated : z);
      zonesRef.current = updatedZones;
      setZones(updatedZones);
      setSelectedZone(updated);
      setHasUnsavedZones(true);
    } else {
      const pt = getSvgPointFromClient(e.clientX, e.clientY);
      const updated = { ...initZone, ...resizeZoneFromCorner(initZone,
        dragState.type.replace('RESIZE_', '').toLowerCase(), svgToMeter(pt.x, pt.y), 0.6) };
      const updatedZones = zonesRef.current.map((z) => z.id === dragState.zoneId ? updated : z);
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
      const placementError = curEp && endpointZoneViolation(curEp, zonesRef.current);
      if (placementError && wasDraggingRef.current) {
        const restored = endpointsRef.current.map((ep) => ep.id === curEp.id ? dragEndpointState.initialEndpoint : ep);
        endpointsRef.current = restored;
        setEndpoints(restored);
        setSelectedEndpoint(dragEndpointState.initialEndpoint);
        onNotify(placementError, 'warning');
      } else if (curEp && wasDraggingRef.current) {
        saveWaypoint(curEp).catch(() => { });
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
      const bounds = curZone && zoneBounds(curZone);
      const outsideMap = bounds && (bounds.minX < 0 || bounds.maxX > 19.6 || bounds.minY < 0 || bounds.maxY > 12.6);
      const zoneError = curZone && ((outsideMap && (language === 'VI' ? 'Vùng phải nằm trong sảnh.' : 'Keep the zone inside the lobby.'))
        || (isPolygonZone(curZone) && polygonValidationError(curZone.vertices))
        || zoneEndpointConflict(curZone, endpointsRef.current)?.message);
      if (zoneError && wasDraggingRef.current) {
        const restored = zonesRef.current.map((z) => z.id === curZone.id ? dragState.initialZone : z);
        zonesRef.current = restored;
        setZones(restored);
        setSelectedZone(dragState.initialZone);
        onNotify(zoneError, 'warning');
      } else if (curZone && wasDraggingRef.current) {
        saveZone(curZone).catch((error) => onNotify(error.message, 'warning'));
      }
      if (!zoneError && isRosEnabledRef.current && rosClientRef.current?.isConnected && wasDraggingRef.current) {
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
    if (!isMapEditing || e.shiftKey) return;
    if (zoneDrawType) return;
    e.stopPropagation();
    if (wasDraggingRef.current) return;

    setSelectedEndpoint(null);
    setIsZoneEditMode(true);

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

    setSelectedZone(clickedZone);
  };

  // TTS Voice Hook
  const { speak, cancel: stopSpeaking } = useSpeechSynthesis();

  // Refs de tranh re-render loop va dong bo trang thai thoi gian thuc
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
  const isLoopModeRef = useRef(isLoopMode);

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
    isLoopModeRef.current = isLoopMode;
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
  const showingIdlePromo = activeWorkflow?.id === 'wf-06-idle-promo' && activeStep?.type === 'SHOW';
  const promotionInterrupted = showingIdlePromo && simGuestPresent;
  const requestPhase = guestRequestPhase(activeWorkflow?.id, activeStep);
  const isMoving = Boolean(currentPath && !currentPath.preview && currentPath.waypoints && currentPath.waypoints.length > 0);

  const robotStatus = simulatorRobotStatus({
    step: activeStep, language, isMoving, manualNavLabel, isPaused, promotionInterrupted,
  });

  const activeDetail = activeStep
    ? getStepActionDetail(activeStep, language)
    : manualNavLabel
      ? { label: 'NAV', bubbleTitle: robotStatus.label, bubbleBody: manualNavLabel }
      : getStepActionDetail(null, language);

  // Chuyen buoc ke tiep
  // outcome: { type: 'CHOSEN' | 'TIMEOUT' | 'CANCEL', optionId } cho buoc CHOICE; bo trong = xong buoc
  const handleStepFinish = useCallback((outcome) => {
    setLinearSpeed(0);
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
      const totalSteps = stepsRef.current?.length || 0;
      const nextIdx = resolveNextStepIndex(stepsRef.current, prev, outcome);
      if (nextIdx >= 0) {
        return nextIdx;
      } else if (isLoopModeRef.current && totalSteps > 0) {
        onNotify?.('Đã hết chu trình, tự động lặp lại hành trình tuần tra', 'info');
        return 0;
      } else {
        setIsPlaying(false);
        setIsPaused(false);
        return 0;
      }
    });
    setStepRun((n) => n + 1);
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

          if (curPath?.targetPoint && !curPath.preview && isMoveStep) {
            const distRemaining = Math.hypot(pos.x - curPath.targetPoint.x, pos.y - curPath.targetPoint.y);
            const totalDist = curPath.totalDistance || 1.0;
            const progress = Math.max(0, Math.min(99, Math.round(((totalDist - distRemaining) / totalDist) * 100)));
            setStepProgress(progress);

            // Nguong den noi theo tieu chuan vi tri thuc cua Gazebo (0.35m)
            if (distRemaining < 0.35 && !simulatorGoalViolation({ x: pos.x, y: pos.y }, zonesRef.current)) {
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
      setLinearSpeed(Math.abs(Number(msg?.twist?.twist?.linear?.x) || 0));
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
        if (msg?.data?.startsWith('REJECTED') && currentPathRef.current && !currentPathRef.current.preview) {
          setZoneAlert({ type: 'error', message: msg.data });
          setCurrentPath(null);
          currentPathRef.current = null;
          setLinearSpeed(0);
          setIsPlaying(false);
          setIsPaused(false);
          return;
        }
        if (msg?.data?.startsWith('REACHED')) {
          const curPath = currentPathRef.current;
          const curStep = stepsRef.current?.[currentStepIndexRef.current];
          const isMoveStep = isPlayingRef.current ? curStep?.type === 'MOVE' : Boolean(curPath);

          if (isMoveStep && curPath && !curPath.preview) {
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

  // Both manual goals and workflow moves use the same zone rules.
  const handleNavigateToGoal = useCallback(
    (targetX, targetY, targetName = 'Destination', fromWorkflow = false, startPoseOverride = null) => {
      const { language } = navigationContextRef.current;
      if (!fromWorkflow && (interactionModeRef.current !== 'CONTROL' || isPlayingRef.current)) return;
      const startPoint = startPoseOverride
        ? { x: Number(startPoseOverride.x), y: Number(startPoseOverride.y) }
        : { x: robotPoseRef.current.x, y: robotPoseRef.current.y };
      const goalPoint = { x: Number(Number(targetX).toFixed(2)), y: Number(Number(targetY).toFixed(2)) };
      const violation = simulatorGoalViolation(goalPoint, zonesRef.current, language);
      const waypoints = violation ? null : planSimulatorRoute(startPoint, goalPoint, zonesRef.current);
      if (violation || !waypoints) {
        const message = violation || (language === 'VI'
          ? 'Không có lộ trình đủ khoảng cách an toàn tới điểm này. Kiểm tra vật cản, vùng cấm vào và vị trí xuất phát.'
          : 'No route with enough clearance to this destination. Check obstacles, keep-out zones and the starting position.');
        setZoneAlert({ type: 'error', message });
        if (fromWorkflow) { setIsPlaying(false); setIsPaused(false); setLinearSpeed(0); }
        return;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      stopSpeakingRef.current?.();
      setZoneAlert(null);
      if (startPoseOverride) {
        const pose = { ...startPoint, yaw: startPoseOverride.yaw ?? robotPoseRef.current.yaw };
        robotPoseRef.current = pose;
        setRobotPose(pose);
      }
      const cruiseSpeed = fromWorkflow ? Number(stepsRef.current?.[currentStepIndexRef.current]?.params?.speed) : 0.35;
      const motion = buildSimulatorMotion(waypoints, zonesRef.current, cruiseSpeed);
      const path = { waypoints, label: targetName, targetPoint: goalPoint, totalDistance: motion.totalDistance };
      currentPathRef.current = path;
      setCurrentPath(path);
      setStepProgress(0);
      if (!fromWorkflow) setManualNavLabel(`${language === 'VI' ? 'Tới' : 'To'}: ${targetName}`);

      // Gazebo owns its actual motion. Web-only simulation uses physical distance / speed.
      if (isRosEnabledRef.current && rosClientRef.current?.isConnected) {
        rosClientRef.current.publishGoal(goalPoint.x, goalPoint.y, 0.0);
        return;
      }
      let previousTime = performance.now(), seconds = 0;
      const animateMove = (now) => {
        seconds += Math.max(0, now - previousTime) / 1000 * (simSpeedRef.current || 1);
        previousTime = now;
        const sample = sampleSimulatorMotion(motion, seconds);
        const pose = { x: Number(sample.x.toFixed(3)), y: Number(sample.y.toFixed(3)), yaw: sample.yaw };
        robotPoseRef.current = pose;
        setRobotPose(pose);
        setLinearSpeed(sample.speed);
        setStepProgress(sample.progress);
        if (sample.progress < 100) {
          animFrameRef.current = requestAnimationFrame(animateMove);
        } else {
          currentPathRef.current = null;
          setCurrentPath(null);
          if (fromWorkflow) handleStepFinish();
          else setManualNavLabel(`${language === 'VI' ? 'Đã đến' : 'Arrived'}: ${targetName}`);
        }
      };
      animFrameRef.current = requestAnimationFrame(animateMove);
    },
    [handleStepFinish]
  );

  // Thuc thi buoc hien tai (Chi trigger khi chuyen buoc hoac bam Play/Pause)
  useEffect(() => {
    if (!isPlaying || isPaused || !activeStep || promotionInterrupted) {
      if (promotionInterrupted) stopSpeakingRef.current?.();
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    // Kiem tra an toan Vung chuc nang truoc khi thuc thi buoc
    const stepValidation = validateWorkflowStepZone(activeStep, zonesRef.current, endpointsRef.current, robotPoseRef.current);
    if (!stepValidation.valid) {
      setIsPlaying(false);
      setIsPaused(false);
      setZoneAlert({ type: 'error', message: stepValidation.error });
      return;
    }
    if (stepValidation.warning) {
      onNotify(stepValidation.warning, 'info');
    }

    const promotionKey = `${selectedWorkflowId}:${guestRunId}:${stepRun}:${currentStepIndex}`;
    if (promotionProgressRef.current.key !== promotionKey) {
      promotionProgressRef.current = { key: promotionKey, percent: 0 };
    }
    const resumedProgress = showingIdlePromo ? promotionProgressRef.current.percent : 0;
    setStepProgress(resumedProgress);
    setVisitedSteps((prev) => (prev.has(currentStepIndex) ? prev : new Set(prev).add(currentStepIndex)));
    if (requestPhase) return;
    const stepType = activeStep.type;
    const params = activeStep.params || {};



    // Phat giong noi TTS neu buoc co loi thoai hoac buoc SHOW co thuyet minh
    if (
      !isMutedRef.current &&
      (stepType === 'GREET' ||
        stepType === 'SPEAK' ||
        (stepType === 'CHOICE' && Boolean(params.prompt)) ||
        (stepType === 'SHOW' && Boolean(params.speech_text || params.text)))
    ) {
      const voiceText =
        stepType === 'GREET'
          ? params.greeting_text || params.text || 'Xin chao quy khach'
          : stepType === 'CHOICE'
            ? params.prompt
            : params.speech_text || params.text || '';
      const voiceSpeed = parseFloat(params.speed || params.voice_speed) || 1.0;
      const lang = params.language || 'vi-VN';

      if (voiceText.trim() && speakRef.current) {
        speakRef.current(voiceText, lang, null, null, null, voiceSpeed);
      }
    }

    // XU LY DI CHUYEN NE TUONG (MOVE)
    if (stepType === 'MOVE') {
      const { x: targetX, y: targetY } = resolveMoveTarget(activeStep, endpointsRef.current);
      const wpName = params.waypoint_name || params.target_value || 'Điểm đến';

      let startOverride = null;
      if (params.from_waypoint && params.from_waypoint !== 'CURRENT') {
        const fromWp =
          endpointsRef.current.find((e) => e.id === params.from_waypoint || e.key === params.from_waypoint || e.name === params.from_waypoint) ||
          GAZEBO_LOBBY_WAYPOINTS[params.from_waypoint];
        if (fromWp) {
          startOverride = { x: fromWp.x, y: fromWp.y, yaw: robotPoseRef.current.yaw };
        }
      }

      // THUC THI PHAT THANH / QUANG BA SONG SONG KHI DANG DI CHUYEN (Concurrent Broadcast)
      const broadcastText = (params.broadcast_speech || params.speech_text || '').trim();
      if (broadcastText && !isMutedRef.current && speakRef.current) {
        const lang = params.language || 'vi-VN';
        const voiceSpeed = parseFloat(params.speed || params.voice_speed) || 1.0;
        speakRef.current(broadcastText, lang, null, null, null, voiceSpeed);
      }

      handleNavigateToGoal(targetX, targetY, wpName, true, startOverride);
    } else {
      // CAC BUOC TUONG TAC (GREET, COMMUNICATE, SPEAK, SHOW, LISTEN, RECOMMEND, CREATE_REQUEST, FEEDBACK)
      let waitDurationSec = 3.5;
      if (stepType === 'WAIT') {
        waitDurationSec = Number(params.duration_sec) || 5;
      } else if (stepType === 'COMMUNICATE') {
        const textContent = params.initial_prompt || params.speech_text || params.text || '';
        const len = textContent.trim().length;
        const silenceSec = parseInt(params.silence_timeout_sec || params.timeout) || 30;
        waitDurationSec = Math.max(4.0, Math.min(silenceSec, Math.ceil(len * 0.085) + 3));
      } else if (stepType === 'GREET' || stepType === 'SPEAK') {
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
      } else if (stepType === 'CHOICE') {
        // Cho khach chon tren khung lua chon; het gio thi theo nhanh het gio
        waitDurationSec = getChoiceTimeoutSec(activeStep);
      }

      const currentSpeed = simSpeedRef.current || 1.0;
      const totalMs = (waitDurationSec * 1000) / currentSpeed;
      const startTime = performance.now();

      const animateProgress = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, resumedProgress / 100 + elapsed / totalMs);
        if (showingIdlePromo) promotionProgressRef.current.percent = progress * 100;
        setStepProgress(Math.round(progress * 100));

        if (progress < 1.0) {
          animFrameRef.current = requestAnimationFrame(animateProgress);
        }
      };

      animFrameRef.current = requestAnimationFrame(animateProgress);
      timerRef.current = setTimeout(
        () => handleStepFinish(stepType === 'CHOICE' ? { type: OUTCOME.TIMEOUT } : undefined),
        totalMs * (1 - resumedProgress / 100)
      );
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, isPaused, currentStepIndex, stepRun, selectedWorkflowId, handleStepFinish, handleNavigateToGoal, promotionInterrupted, showingIdlePromo, guestRunId]);

  // PIN YEU: tu chay kich ban ve tram sac theo utils/batteryPolicy (giong man hinh robot)
  const chargeRoutine = useMemo(() => findChargeRoutine(localWorkflows), [localWorkflows]);
  const isChargeRoutineRunning = isPlaying && activeWorkflow?.id === chargeRoutine.id;
  const isServingGuestInSim = isPlaying && !isChargeRoutineRunning && activeWorkflow?.id !== 'wf-06-idle-promo';
  const pendingAutoStartRef = useRef(null);

  // Dung kich ban dang chay ma khong dua robot ve vi tri xuat phat
  const haltSimulation = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (stopSpeakingRef.current) stopSpeakingRef.current();
    if (rosClientRef.current?.isConnected) rosClientRef.current.publishCmdVel(0.0, 0.0);
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentPath(null);
    currentPathRef.current = null;
  }, []);

  const startChargeRoutine = useCallback((routine) => {
    if (!routine) return;
    setLocalWorkflows((prev) => (prev.some((w) => w.id === routine.id) ? prev : [...prev, routine]));
    pendingAutoStartRef.current = routine.id;
    setSelectedWorkflowId(routine.id);
  }, []);

  const batteryGuard = useLowBatteryGuard({
    percent: simBatteryPercent,
    routine: chargeRoutine,
    isRoutineRunning: isChargeRoutineRunning,
    isServingGuest: isServingGuestInSim,
    startRoutine: startChargeRoutine,
    interruptGuest: () => {
      haltSimulation();
      onNotify(`Pin dưới ${BATTERY_CRITICAL_PERCENT}%: dừng kịch bản đang chạy để về trạm sạc.`, 'warning');
    },
    onChargeNeeded: () =>
      onNotify('Robot đã tới trạm sạc. Trên robot thật, màn hình robot gửi phiếu Maintenance để nhân viên tới cắm sạc.', 'info'),
  });
  const batteryStatusText = describeBatteryStatus({
    mode: batteryGuard.mode,
    percent: simBatteryPercent,
    isRoutineRunning: isChargeRoutineRunning,
    isWaitingForCharge: batteryGuard.isWaitingForCharge,
  });

  const simulatedGuest = useSimulatedGuest({
    workflow: activeWorkflow, step: activeStep, stepRun, runId: guestRunId,
    isPlaying, isPaused, isCharging: isChargeRoutineRunning, chargeRoutineId: chargeRoutine.id,
    robot: robotPose, endpoints, simSpeed, onPresenceChange: setSimGuestPresent,
  });

  // Bo dieu khien
  // options.keepPose: bat dau tu vi tri hien tai (kich ban ve tram sac tu chay)
  const handleStartSim = (options = {}) => {
    const keepPose = options?.keepPose === true;
    if (!steps || steps.length === 0) {
      onNotify('Kịch bản hiện tại chưa có bước thực thi nào', 'warning');
      return;
    }
    if (!batteryGuard.canStartGuestSession && activeWorkflow?.id !== chargeRoutine.id) {
      onNotify(
        `Pin giả lập còn ${simBatteryPercent}%. Robot không nhận kịch bản phục vụ mới cho tới khi pin đạt ${BATTERY_RESUME_PERCENT}%.`,
        'warning'
      );
      return;
    }
    handleInteractionModeChange('CONTROL');
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    currentPathRef.current = null;
    setCurrentPath(null);
    setLinearSpeed(0);
    setGuestRequest({});
    setGuestRunId((id) => id + 1);
    setSimGuestPresent(false);
    setIsPlaying(true);
    setIsPaused(false);
    setCurrentStepIndex(0);
    setStepProgress(0);
    setManualNavLabel(null);
    setVisitedSteps(new Set());
    const brokenLinks = findBrokenFlowLinks(steps);
    if (brokenLinks.length > 0) {
      onNotify(
        `Kịch bản có ${brokenLinks.length} liên kết rẽ nhánh trỏ tới bước không còn tồn tại. Robot sẽ kết thúc phiên khi đi vào các liên kết này.`,
        'warning'
      );
    }

    // Xac dinh vi tri xuat phat cua Robot cho buoc dau tien:
    // Neu buoc 1 co from_waypoint (A -> B), dat robot ngay tai vi tri A
    const firstStep = steps[0];
    let initialPose = ROBOT_INITIAL_POSE;
    if (firstStep?.type === 'MOVE' && firstStep?.params?.from_waypoint && firstStep.params.from_waypoint !== 'CURRENT') {
      const fromKey = firstStep.params.from_waypoint;
      const fromWp =
        endpointsRef.current.find((e) => e.id === fromKey || e.key === fromKey || e.name === fromKey) ||
        GAZEBO_LOBBY_WAYPOINTS[fromKey];
      if (fromWp && !isNaN(fromWp.x) && !isNaN(fromWp.y)) {
        initialPose = { x: fromWp.x, y: fromWp.y, yaw: -Math.PI / 2 };
      }
    }

    if (!keepPose) {
      robotPoseRef.current = initialPose;
      setRobotPose(initialPose);
    }
  };

  // Chay kich ban ve tram sac ngay khi no da duoc chon lam kich ban hien tai
  useEffect(() => {
    const pendingId = pendingAutoStartRef.current;
    if (!pendingId || isPlaying) return;
    if (selectedWorkflowId !== pendingId) {
      if (localWorkflows.some((w) => w.id === pendingId)) setSelectedWorkflowId(pendingId);
      return;
    }
    if (activeWorkflow?.id === pendingId) {
      pendingAutoStartRef.current = null;
      onNotify(`Pin giả lập còn ${simBatteryPercent}%: robot tự chạy kịch bản về trạm sạc.`, 'warning');
      handleStartSim({ keepPose: true });
    }
  });

  const handlePauseSim = () => {
    setIsPaused((prev) => !prev);
    if (!isPaused) {
      setLinearSpeed(0);
      if (rosClientRef.current?.isConnected) {
        rosClientRef.current.publish('/nav_mode', 'std_msgs/String', { data: 'STOP' });
        rosClientRef.current.publishCmdVel(0, 0);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (stopSpeakingRef.current) stopSpeakingRef.current();
    }
  };

  const handleStopSim = () => {
    setLinearSpeed(0);
    currentPathRef.current = null;
    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/nav_mode', 'std_msgs/String', { data: 'STOP' });
      rosClientRef.current.publishCmdVel(0, 0);
    }
    simulatedGuest.reset();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentStepIndex(0);
    setVisitedSteps(new Set());
    setStepProgress(0);
    setCurrentPath(null);
    setManualNavLabel(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (stopSpeakingRef.current) stopSpeakingRef.current();
    if (!rosClientRef.current?.isConnected) {
      robotPoseRef.current = ROBOT_INITIAL_POSE;
      setRobotPose(ROBOT_INITIAL_POSE);
    }
  };

  const handleNextStep = () => {
    handleStepFinish();
  };

  const handleReset = () => {
    handleStopSim();
  };

  const handleInteractionModeChange = (mode) => {
    if (mode === 'EDIT' && (isPlayingRef.current || (currentPathRef.current && !currentPathRef.current.preview))) return;
    if (dragState || dragEndpointState) return;
    // A draft is not a saved zone; changing mode must not leave invisible edit targets.
    setZoneDraft(null);
    setZoneDrawType(null);
    setSelectedZone(null);
    setSelectedZoneVertex(null);
    setZoneEdgeHover(null);
    setSelectedEndpoint(null);
    setIsZoneEditMode(false);
    setIsEndpointEditMode(false);
    setIsMapMenuOpen(false);
    if (currentPathRef.current?.preview) { currentPathRef.current = null; setCurrentPath(null); }
    interactionModeRef.current = mode;
    setInteractionMode(mode);
  };

  const handleMapClick = (e) => {
    if (e.shiftKey || e.target?.closest?.('[data-sim-guest]')) return;
    if (wasDraggingRef.current || dragState || dragEndpointState) return;
    if (e.target?.closest?.('[data-endpoint]') && !zoneDrawType) return;
    if (isMapEditing && !zoneDrawType && e.target?.closest?.('[data-zone]')) return;
    const { x: svgX, y: svgY } = getSvgPointFromClient(e.clientX, e.clientY);
    if (svgX < 35 || svgX > 525 || svgY < 35 || svgY > 350) return;
    const meter = svgToMeter(svgX, svgY);
    if (isMapEditing) {
      if (zoneDrawType && zoneDrawShape === 'polygon') {
        const vertices = zoneDraft?.vertices || [];
        if (vertices.length >= 3) {
          const first = meterToSvg(vertices[0].x, vertices[0].y);
          if (Math.hypot(svgX - first.x, svgY - first.y) < 6 || e.detail >= 2) {
            finishPolygon();
            return;
          }
        }
        if (vertices.length >= MAX_ZONE_VERTICES) return;
        setZoneDraft({ type: zoneDrawType, vertices: [...vertices, meter], cursor: meter });
      } else {
        setSelectedZone(null);
        setSelectedZoneVertex(null);
        setSelectedEndpoint(null);
      }
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
      {/* THANH DIEU KHIEN CHINH - Gọn gàng, phân nhóm trực quan chuẩn UX */}
      <div
        className="relative z-20 min-h-14 px-3 sm:px-5 py-2 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 select-none"
        style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
      >
        {/* NHOM 1: CHON KICH BAN VA QUAN LY LOP BAN DO */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Dropdown Kịch bản: BÊN NGOÀI CHỈ HIỆN WORKFLOW X + CHEVRON */}
          <div className="relative" ref={workflowMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsWorkflowMenuOpen((prev) => !prev);
                setIsMapMenuOpen(false);
                setIsSettingsMenuOpen(false);
              }}
              className={`h-8 px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${isWorkflowMenuOpen
                  ? 'bg-[#262626] text-white border-[#262626]'
                  : 'text-[#262626] hover:bg-[#FAF8F5]'
                }`}
              style={!isWorkflowMenuOpen ? { backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' } : {}}
              title={activeWorkflow?.name || rc('Select workflow')}
            >
              <span>
                Workflow {localWorkflows.findIndex((w) => w.id === selectedWorkflowId) >= 0 ? localWorkflows.findIndex((w) => w.id === selectedWorkflowId) + 1 : 1}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform opacity-70 ${isWorkflowMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* DANH SÁCH CHI TIẾT KHI MỞ RA */}
            {isWorkflowMenuOpen && (
              <div
                className="absolute top-full left-0 mt-1.5 w-80 sm:w-96 rounded-xl border shadow-2xl p-2.5 z-50 text-xs space-y-1.5 animate-fadeIn"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              >
                <div className="flex items-center justify-between pb-2 border-b px-1" style={{ borderColor: '#E9E5DC' }}>
                  <span className="font-bold text-xs uppercase tracking-wider text-[#8C8C8C]">
                    Danh sách kịch bản ({localWorkflows.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsWorkflowMenuOpen(false)}
                    className="p-1 rounded hover:bg-[#F2EFE9] text-[#8C8C8C] hover:text-[#262626] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                  {localWorkflows.map((wf, idx) => {
                    const isSelected = wf.id === selectedWorkflowId;
                    return (
                      <button
                        key={wf.id}
                        type="button"
                        onClick={() => {
                          handleStopSim();
                          setSelectedWorkflowId(wf.id);
                          setIsWorkflowMenuOpen(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg border flex items-center justify-between gap-2.5 transition-all cursor-pointer ${isSelected
                            ? 'bg-[#262626] text-white border-[#262626] shadow-xs'
                            : 'hover:bg-[#F2EFE9] border-transparent hover:border-[#E9E5DC] text-[#262626]'
                          }`}
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-0.5 ${isSelected ? 'bg-white/20 text-white' : 'bg-[#E9E5DC] text-[#262626]'
                              }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-xs truncate">
                              {wf.name}
                            </div>
                            <div
                              className={`text-[10px] mt-0.5 truncate ${isSelected ? 'text-white/70' : 'text-[#8C8C8C]'
                                }`}
                            >
                              {wf.description || `${wf.steps?.length || 0} bước thực thi`}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-[#E9E5DC] text-[#262626]'
                            }`}
                        >
                          {wf.steps?.length || 0} bước
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ICON BUTTON BẢN ĐỒ (CHỈ DÙNG ICON LAYERS + CHEVRON, TOOLTIP CHI TIẾT) */}
          <div className="relative" ref={mapMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsMapMenuOpen((prev) => !prev);
                setIsWorkflowMenuOpen(false);
                setIsSettingsMenuOpen(false);
              }}
              className={`h-8 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer ${isMapMenuOpen || selectedZone || selectedEndpoint
                  ? 'bg-[#262626] text-white border-[#262626]'
                  : 'text-[#262626] hover:bg-[#FAF8F5]'
                }`}
              style={!(isMapMenuOpen || selectedZone || selectedEndpoint) ? { backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' } : {}}
              title={`Lớp bản đồ: ${zones.length} Vùng · ${endpoints.length} Điểm`}
            >
              <Layers className="w-4 h-4" />
              {(hasUnsavedZones || hasUnsavedEndpoints) && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              )}
              <ChevronDown className={`w-3 h-3 transition-transform opacity-70 ${isMapMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* DROPDOWN POPOVER BẢN ĐỒ */}
            {isMapMenuOpen && (
              <div
                className="absolute top-full left-0 mt-1.5 w-80 rounded-xl border shadow-2xl p-3 z-50 text-xs space-y-3 animate-fadeIn"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#E9E5DC' }}>
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Layers className="w-4 h-4 text-[#262626]" />
                    <span>Cấu hình Lớp bản đồ</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMapMenuOpen(false)}
                    className="p-1 rounded hover:bg-[#F2EFE9] text-[#8C8C8C] hover:text-[#262626] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Tabs chuyển đổi giữa Vùng và Điểm đích (Text thuần túy) */}
                <div className="flex p-0.5 rounded-lg border bg-[#F2EFE9]" style={{ borderColor: '#E9E5DC' }}>
                  <button
                    type="button"
                    onClick={() => setMapMenuTab('ZONES')}
                    className={`flex-1 py-1 px-2 rounded-md font-bold text-[11px] transition-all flex items-center justify-center cursor-pointer ${mapMenuTab === 'ZONES' ? 'bg-[#262626] text-white shadow-xs' : 'text-[#8C8C8C] hover:text-[#262626]'
                      }`}
                  >
                    <span>Vùng ({zones.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapMenuTab('ENDPOINTS')}
                    className={`flex-1 py-1 px-2 rounded-md font-bold text-[11px] transition-all flex items-center justify-center cursor-pointer ${mapMenuTab === 'ENDPOINTS' ? 'bg-[#262626] text-white shadow-xs' : 'text-[#8C8C8C] hover:text-[#262626]'
                      }`}
                  >
                    <span>Điểm đích ({endpoints.length})</span>
                  </button>
                </div>

                {/* TAB 1: VÙNG QUY ĐỊNH */}
                {mapMenuTab === 'ZONES' && (
                  <fieldset disabled={!isMapEditing} className="space-y-2.5 disabled:opacity-45">
                    {/* Bật/Tắt hiển thị & Kéo thả (Gọn gàng không chèn icon) */}
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setShowZones((prev) => !prev)}
                        className="w-full px-2.5 py-1.5 rounded-lg border flex items-center justify-between font-semibold hover:bg-[#F2EFE9] cursor-pointer transition-colors text-left text-xs"
                        style={{ borderColor: '#E9E5DC' }}
                      >
                        <span className="text-[#262626]">Hiển thị Lớp Vùng</span>
                        <span
                          className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded ${showZones ? 'bg-emerald-100 text-emerald-800' : 'bg-[#E9E5DC] text-[#8C8C8C]'
                            }`}
                        >
                          {showZones ? 'BẬT' : 'TẮT'}
                        </span>
                      </button>


                    </div>

                    {/* Thêm Vùng mới */}
                    <div className="pt-1.5 border-t space-y-1" style={{ borderColor: '#E9E5DC' }}>
                      {/* Selector hình vẽ: Chữ nhật / Đa giác */}
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">
                        Hình vẽ:
                      </div>
                      <div className="flex gap-1 mb-1">
                        {[['rectangle', 'Chữ nhật'], ['polygon', 'Đa giác']].map(([shape, label]) => (
                          <button
                            key={shape}
                            type="button"
                            aria-pressed={zoneDrawShape === shape}
                            onClick={() => { setZoneDrawShape(shape); setZoneDraft(null); setZoneDrawType(null); }}
                            className={`flex-1 py-1 px-2 rounded border text-[10px] font-bold cursor-pointer transition-colors ${zoneDrawShape === shape
                                ? 'border-[#262626] bg-[#262626] text-white'
                                : 'border-[#BFBFBD] bg-[#F2EFE9] text-[#8C8C8C] hover:text-[#262626]'
                              }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">
                        + Thêm vùng chức năng:
                      </div>
                      <div className="space-y-0.5">
                        {/* Nếu đang ở polygon mode: hiện nút "Vẽ" thay cho "Thêm" */}
                        {zoneDrawShape === 'polygon' ? (
                          <>
                            {[
                              { type: 'KEEP_OUT', label: 'Vẽ Cấm vào (Polygon)', cls: 'hover:bg-red-50 text-red-700', dot: 'bg-red-600' },
                              { type: 'SPEED_ZONE', label: 'Vẽ Giảm tốc (Polygon)', cls: 'hover:bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
                              { type: 'NO_STOP', label: 'Vẽ Cấm dừng (Polygon)', cls: 'hover:bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
                            ].map(({ type, label, cls, dot }) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => toggleZoneDraw(type)}
                                className={`w-full text-left px-2 py-1.2 rounded-lg flex items-center gap-2 font-semibold cursor-pointer transition-colors ${zoneDrawType === type
                                    ? 'ring-2 ring-inset ring-current bg-opacity-10'
                                    : cls
                                  }`}
                              >
                                <span className={`w-2.5 h-2.5 rounded-full ${dot} shrink-0`} />
                                <span>{zoneDrawType === type ? '✏️ Đang vẽ... (click để thêm đỉnh, double-click để xong)' : label}</span>
                              </button>
                            ))}
                            {zoneDrawType && zoneDraft?.vertices?.length >= 3 && (
                              <button
                                type="button"
                                onClick={() => { finishPolygon(); setIsMapMenuOpen(false); }}
                                className="w-full mt-1 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold cursor-pointer hover:bg-emerald-800"
                              >
                                ✓ Xong — Tạo vùng đa giác ({zoneDraft.vertices.length} đỉnh)
                              </button>
                            )}
                            {zoneDrawType && (
                              <button
                                type="button"
                                onClick={() => { setZoneDrawType(null); setZoneDraft(null); }}
                                className="w-full py-1 rounded-lg border text-xs text-[#8C8C8C] hover:text-[#262626] hover:bg-[#F2EFE9] cursor-pointer"
                                style={{ borderColor: '#BFBFBD' }}
                              >
                                Hủy vẽ
                              </button>
                            )}
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>

                    {/* Lưu & Đặt lại Vùng (Pure Text CTA) */}
                    <div className="pt-2 border-t flex items-center gap-2" style={{ borderColor: '#E9E5DC' }}>
                      <button
                        type="button"
                        onClick={() => {
                          handleSaveZones();
                          setIsMapMenuOpen(false);
                        }}
                        disabled={isSavingZones || !hasUnsavedZones}
                        className={`flex-1 h-7.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center shadow-xs transition-all ${hasUnsavedZones
                            ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer animate-pulse'
                            : 'bg-[#F2EFE9] text-[#8C8C8C] cursor-not-allowed border border-[#E9E5DC]'
                          }`}
                      >
                        <span>{isSavingZones ? 'Đang lưu...' : 'Lưu Vùng'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleResetDefaultZones();
                          setIsMapMenuOpen(false);
                        }}
                        className="h-7.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center text-[#8C8C8C] hover:text-[#262626] hover:bg-[#F2EFE9] cursor-pointer"
                        style={{ borderColor: '#BFBFBD' }}
                        title="Khôi phục lại 3 Vùng Chức Năng về chuẩn ban đầu"
                      >
                        <span>Đặt lại</span>
                      </button>
                    </div>
                  </fieldset>
                )}

                {/* TAB 2: ĐIỂM ĐÍCH (ENDPOINTS) */}
                {mapMenuTab === 'ENDPOINTS' && (
                  <fieldset disabled={!isMapEditing} className="space-y-2.5 disabled:opacity-45">
                    {/* Thêm Endpoint Mới */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">
                        + Thêm điểm đích mới:
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
                          <span>Charger (Trạm sạc pin)</span>
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

                    {/* Lưu & Đặt lại Endpoints (Pure Text CTA) */}
                    <div className="pt-2 border-t flex items-center gap-2" style={{ borderColor: '#E9E5DC' }}>
                      <button
                        type="button"
                        onClick={() => {
                          endpoints.forEach((ep) => handleSaveEndpointToDb(ep));
                          setIsMapMenuOpen(false);
                        }}
                        disabled={isSavingEndpoints || !hasUnsavedEndpoints}
                        className={`flex-1 h-7.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center shadow-xs transition-all ${hasUnsavedEndpoints
                            ? 'bg-[#262626] hover:bg-[#383838] text-[#F2EFE9] cursor-pointer'
                            : 'bg-[#F2EFE9] text-[#8C8C8C] cursor-not-allowed border border-[#E9E5DC]'
                          }`}
                      >
                        <span>{isSavingEndpoints ? 'Đang lưu...' : 'Lưu Điểm'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleResetDefaultEndpoints();
                          setIsMapMenuOpen(false);
                        }}
                        className="h-7.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center text-[#8C8C8C] hover:text-[#262626] hover:bg-[#F2EFE9] cursor-pointer"
                        style={{ borderColor: '#BFBFBD' }}
                        title="Khôi phục lại danh sách Điểm Mốc về chuẩn ban đầu"
                      >
                        <span>Đặt lại</span>
                      </button>
                    </div>
                  </fieldset>
                )}
              </div>
            )}
          </div>
        </div>

        {/* NHOM 2: BỘ ĐIỀU KHIỂN CHẠY & TIẾN TRÌNH WORKFLOW HỢP NHẤT TRÊN THANH CÔNG CỤ */}
        <div className="order-last xl:order-none w-full xl:w-auto xl:flex-1 flex flex-wrap sm:flex-nowrap items-center justify-center gap-2 min-w-0">
          {/* Cụm Nút Playback Controls: ĐỒNG BỘ 4 NÚT CÙNG TỈ LỆ VÀ KÍCH THƯỚC (32x32px) */}
          <div className="flex items-center gap-1 bg-[#F2EFE9] p-1 rounded-xl border shrink-0" style={{ borderColor: '#BFBFBD' }}>
            {/* 1. Nút Chạy / Tạm dừng */}
            <button
              type="button"
              onClick={isPlaying ? handlePauseSim : handleStartSim}
              className={`h-8 w-8 rounded-lg text-white flex items-center justify-center shadow-xs transition-all cursor-pointer ${isPlaying && !isPaused
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              title={
                isPlaying && !isPaused
                  ? rc('Pause simulation')
                  : isPlaying && isPaused
                    ? rc('Resume simulation')
                    : rc('Run simulation')
              }
            >
              {isPlaying && !isPaused ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
            </button>

            {/* 2. Nút Bước tiếp theo */}
            <button
              type="button"
              onClick={isPlaying ? handleNextStep : handleStartSim}
              className="h-8 w-8 rounded-lg text-white flex items-center justify-center shadow-xs cursor-pointer hover:bg-[#363636] transition-colors"
              style={{ backgroundColor: '#262626' }}
              title={rc(isPlaying ? 'Next step' : 'Run simulation')}
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            {/* 3. Nút Dừng hẳn mô phỏng */}
            <button
              type="button"
              onClick={handleStopSim}
              className="h-8 w-8 rounded-lg bg-red-700 hover:bg-red-800 text-white flex items-center justify-center shadow-xs cursor-pointer transition-colors"
              title={rc('Stop simulation')}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>

            {/* 4. Nút Đặt Robot về vị trí chờ ban đầu */}
            <button
              type="button"
              onClick={handleReset}
              className="h-8 w-8 rounded-lg border bg-white hover:bg-[#FAF8F5] text-[#262626] shadow-xs flex items-center justify-center cursor-pointer transition-colors"
              style={{ borderColor: '#BFBFBD' }}
              title={rc('Reset robot position')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* DÃY TIẾN TRÌNH STEPPER VÀ TRẠNG THÁI REALTIME */}
          <div
            className="flex items-center gap-2 px-2.5 py-1 rounded-xl border bg-[#F2EFE9] shadow-xs min-w-0"
            style={{ borderColor: '#BFBFBD' }}
          >
            {/* Dãy Stepper các bước ngang (Horizontal Steps) */}
            <div className="flex items-center gap-1 min-w-0 overflow-x-auto py-0.5">
              {steps.map((st, idx) => {
                const isActive = isPlaying && currentStepIndex === idx;
                const isPast = isPlaying && !isActive && visitedSteps.has(idx);
                const stDetail = getStepActionDetail(st, language);

                return (
                  <button
                    key={st.step_id || idx}
                    type="button"
                    onClick={() => {
                      setIsStepsMenuOpen(true);
                      setEditingStepIdx(idx);
                      setIsWorkflowMenuOpen(false);
                      setIsMapMenuOpen(false);
                      setIsSettingsMenuOpen(false);
                    }}
                    className={`h-7 min-w-7 shrink-0 px-1.5 rounded-lg flex items-center justify-center text-[10.5px] font-mono font-bold transition-all cursor-pointer ${isActive
                        ? 'bg-[#262626] text-white shadow-xs ring-2 ring-emerald-500/60 animate-pulse'
                        : isPast
                          ? 'bg-[#BFBFBD] text-[#262626]'
                          : 'border hover:bg-[#E9E5DC] text-[#8C8C8C] hover:text-[#262626]'
                      }`}
                    style={!isActive && !isPast ? { backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' } : {}}
                    title={`Bước ${idx + 1}: ${stDetail.label} - ${st.title || stDetail.shortChip}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Vách ngăn mỏng */}
            <div className="w-px h-5 bg-[#BFBFBD] shrink-0" />

            {/* Chip Trạng thái & Tiến độ bước thời gian thực */}
            <div className="flex flex-col justify-center min-w-0 shrink-0 max-w-[35vw]">
              <div className="flex items-center gap-1.5 text-xs">
                <span
                  className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold tracking-wider shrink-0"
                  style={{
                    backgroundColor: isPlaying ? '#262626' : '#E9E5DC',
                    color: isPlaying ? '#FFFFFF' : '#262626',
                    border: '1px solid #BFBFBD',
                  }}
                >
                  {isPlaying ? `B${currentStepIndex + 1}/${steps.length} ${activeDetail.label}` : 'READY'}
                </span>
                <span
                  className="font-bold text-[11px] truncate max-w-[120px] sm:max-w-[200px]"
                  style={{ color: '#262626' }}
                  title={activeStep ? (activeStep.title || activeDetail.shortChip) : rc('Robot ready')}
                >
                  {activeStep ? (activeStep.title || activeDetail.shortChip) : rc('Robot ready')}
                </span>
                {isPlaying && (
                  <span className="font-mono font-bold text-[11px] text-[#262626] shrink-0">
                    {stepProgress}%
                  </span>
                )}
              </div>

              {/* Progress Bar mảnh chạy theo tiến độ */}
              {isPlaying && (
                <div className="w-full h-1 rounded-full bg-[#E9E5DC] overflow-hidden mt-0.5 border border-[#BFBFBD]/50">
                  <div
                    className="h-full bg-[#262626] transition-all duration-150 rounded-full"
                    style={{ width: `${stepProgress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Nút Popover mở Danh sách tất cả các bước chi tiết (ListOrdered) */}
            <div className="relative shrink-0" ref={stepsMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsStepsMenuOpen((prev) => !prev);
                  setIsWorkflowMenuOpen(false);
                  setIsMapMenuOpen(false);
                  setIsSettingsMenuOpen(false);
                }}
                className={`h-7 w-7 rounded-lg border flex items-center justify-center shadow-2xs transition-all cursor-pointer ${isStepsMenuOpen ? 'bg-[#262626] text-white border-[#262626]' : 'text-[#262626] hover:bg-[#FAF8F5]'
                  }`}
                style={!isStepsMenuOpen ? { backgroundColor: '#FFFFFF', borderColor: '#BFBFBD' } : {}}
                title={`Xem & chỉnh sửa chi tiết ${steps.length} bước kịch bản`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>

              {/* DROPDOWN POPOVER DANH SÁCH BƯỚC VÀ ĐỔI ĐIỂM MỐC */}
              {isStepsMenuOpen && (
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 mt-2 w-80 sm:w-96 rounded-xl border shadow-2xl p-3 z-50 text-xs space-y-2 animate-fadeIn"
                  style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                >
                  {/* Header Popover */}
                  <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#E9E5DC' }}>
                    <div className="flex items-center gap-1.5 font-bold text-xs text-[#262626]">
                      <ListOrdered className="w-4 h-4 text-[#262626]" />
                      <span>Tiến trình kịch bản</span>
                      <span className="font-mono text-[10px] text-[#8C8C8C]">({steps.length} bước)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsStepsMenuOpen(false)}
                      className="p-1 rounded hover:bg-[#F2EFE9] text-[#8C8C8C] hover:text-[#262626] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Danh sách các bước dạng cuộn */}
                  <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                    {steps.map((st, idx) => {
                      const isActive = isPlaying && currentStepIndex === idx;
                      const isPast = isPlaying && !isActive && visitedSteps.has(idx);
                      const stDetail = getStepActionDetail(st, language);

                      return (
                        <div
                          key={st.step_id || idx}
                          className="p-2 rounded-lg border transition-all flex flex-col gap-1.5 select-none"
                          style={{
                            backgroundColor: isActive ? '#FFFFFF' : isPast ? '#E9E5DC' : '#F2EFE9',
                            borderColor: isActive ? '#262626' : '#BFBFBD',
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                              <span
                                className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-bold text-[10px] shrink-0 ${isActive
                                    ? 'bg-[#262626] text-white'
                                    : isPast
                                      ? 'bg-[#BFBFBD] text-[#262626]'
                                      : 'bg-[#E9E5DC] text-[#262626]'
                                  }`}
                              >
                                {idx + 1}
                              </span>
                              {/* Nhãn loại bước rộng cố định để tiêu đề các bước thẳng một cột */}
                              <span
                                className="w-[78px] px-1 py-0.5 rounded text-[9px] text-center truncate font-mono font-bold tracking-wider border shrink-0"
                                style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                                title={stDetail.label}
                              >
                                {stDetail.label === 'CREATE_REQUEST' ? 'REQUEST' : stDetail.label}
                              </span>
                              {/* Tiêu đề dài tự xuống dòng, không cắt bằng dấu ba chấm */}
                              <span className="flex-1 min-w-0 font-bold text-xs leading-snug break-words">
                                {st.title || stDetail.shortChip}
                              </span>
                            </div>

                            {st.type === 'MOVE' && !isPlaying && (
                              <button
                                type="button"
                                onClick={() => setEditingStepIdx(editingStepIdx === idx ? null : idx)}
                                className="p-1 rounded border transition-colors cursor-pointer shrink-0 hover:bg-[#FAF8F5]"
                                style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                                title={editingStepIdx === idx ? 'Đóng bảng đổi điểm mốc' : 'Đổi điểm mốc xuất phát / đích đến'}
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* Bảng chỉnh sửa điểm mốc nếu đang mở */}
                          {editingStepIdx === idx && st.type === 'MOVE' && (
                            <div
                              className="mt-1 pt-2 border-t space-y-2 p-2 rounded-lg"
                              style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                            >
                              <div className="flex items-center justify-between text-[10px] font-bold">
                                <span>Đổi Điểm Mốc (A ➔ B)</span>
                                <button
                                  type="button"
                                  onClick={() => setEditingStepIdx(null)}
                                  className="p-0.5 rounded hover:bg-[#FAF8F5] cursor-pointer text-[#262626] transition-colors"
                                  title="Hoàn tất và đóng"
                                >
                                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                                </button>
                              </div>

                              <div className="space-y-0.5">
                                <label className="block text-[9px] font-bold uppercase text-[#8C8C8C]">
                                  Từ Điểm Mốc (Start):
                                </label>
                                <select
                                  value={st.params?.from_waypoint || 'CURRENT'}
                                  onChange={(e) =>
                                    handleUpdateMoveStepWaypoints(
                                      idx,
                                      e.target.value,
                                      st.params?.target_value || st.params?.target_waypoint_id || 'FRONT_DESK'
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
                                <label className="block text-[9px] font-bold uppercase text-[#8C8C8C]">
                                  Đến Điểm Mốc (Goal):
                                </label>
                                <select
                                  value={st.params?.target_value || st.params?.target_waypoint_id || 'FRONT_DESK'}
                                  onChange={(e) =>
                                    handleUpdateMoveStepWaypoints(
                                      idx,
                                      st.params?.from_waypoint || 'CURRENT',
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

                              {/* Phát loa quảng cáo khi di chuyển */}
                              <div className="space-y-0.5 pt-1 border-t" style={{ borderColor: '#BFBFBD' }}>
                                <label className="block text-[9px] font-bold uppercase text-[#4F46E5] flex items-center gap-1">
                                  <Megaphone className="w-2.5 h-2.5" />
                                  <span>Phát loa quảng cáo khi di chuyển:</span>
                                </label>
                                <input
                                  type="text"
                                  value={st.params?.broadcast_speech || ''}
                                  onChange={(e) => handleUpdateMoveStepBroadcast(idx, e.target.value)}
                                  placeholder="vd: Nhà hàng tầng 2 ưu đãi tiệc trà chiều..."
                                  className="w-full px-2 py-1 rounded text-[10px] font-medium border focus:outline-none"
                                  style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* NHOM 3: TỐC ĐỘ (1x, 2x, 4x TRỰC TIẾP), TÙY CHỌN, PHÁT VÀ ĐÓNG */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 3 NÚT TỐC ĐỘ MÔ PHỎNG TRỰC TIẾP TRÊN THANH CÔNG CỤ (KHÔNG CẦN POPUP) */}
          <div
            className="flex items-center p-0.5 rounded-lg border shadow-xs"
            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' }}
            title="Tốc độ mô phỏng trực tiếp"
          >
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSimSpeed(spd)}
                className={`h-7 px-2 text-[11px] font-mono font-bold rounded-md cursor-pointer transition-all ${simSpeed === spd
                    ? 'bg-[#262626] text-white shadow-xs'
                    : 'text-[#262626] hover:bg-[#FAF8F5]'
                  }`}
                title={`Đặt tốc độ ${spd}x`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* TÙY CHỌN: CHỈ DÙNG ICON SLIDERS (LOOP, TTS, ROS 2) */}
          <div className="relative" ref={settingsMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsSettingsMenuOpen((prev) => !prev);
                setIsMapMenuOpen(false);
                setIsWorkflowMenuOpen(false);
              }}
              className={`h-8 w-8 rounded-lg border text-xs font-bold flex items-center justify-center shadow-xs cursor-pointer transition-all ${isSettingsMenuOpen
                  ? 'bg-[#262626] text-white border-[#262626]'
                  : 'hover:bg-[#FAF8F5]'
                }`}
              style={!isSettingsMenuOpen ? { backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' } : {}}
              title={`Tùy chọn nâng cao: ${isLoopMode ? 'Lặp lại, ' : ''}Âm thanh, ROS 2`}
            >
              <div className="relative flex items-center justify-center">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span
                  className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border-2 border-white ${isRosEnabled && isRosConnected ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
                    }`}
                />
              </div>
            </button>

            {/* DROPDOWN POPOVER TÙY CHỌN */}
            {isSettingsMenuOpen && (
              <div
                className="absolute top-full right-0 mt-1.5 w-68 rounded-xl border shadow-2xl p-3 z-50 text-xs space-y-3 animate-fadeIn"
                style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#E9E5DC' }}>
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#262626]" />
                    <span>Tùy chọn mô phỏng</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsMenuOpen(false)}
                    className="p-1 rounded hover:bg-[#F2EFE9] text-[#8C8C8C] hover:text-[#262626] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 1. Tốc độ mô phỏng */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">
                    Tốc độ mô phỏng:
                  </div>
                  <div className="flex p-0.5 rounded-lg border bg-[#F2EFE9]" style={{ borderColor: '#E9E5DC' }}>
                    {[1, 2, 4].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setSimSpeed(spd)}
                        className={`flex-1 py-1 text-xs font-bold rounded cursor-pointer transition-colors ${simSpeed === spd ? 'bg-[#262626] text-white shadow-xs' : 'text-[#262626] hover:bg-[#E9E5DC]'
                          }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Tuần tra lặp lại (Patrol Loop) */}
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !isLoopMode;
                    setIsLoopMode(nextVal);
                    isLoopModeRef.current = nextVal;
                    onNotify(
                      nextVal
                        ? 'Đã bật Chế độ Tuần tra lặp lại (Patrol Loop)'
                        : 'Đã tắt Chế độ Tuần tra lặp lại',
                      'info'
                    );
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border flex items-center justify-between font-semibold hover:bg-[#F2EFE9] cursor-pointer transition-colors text-left text-xs"
                  style={{ borderColor: '#E9E5DC' }}
                >
                  <span className="text-[#262626]">Tuần tra lặp lại (Loop)</span>
                  <span
                    className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded ${isLoopMode ? 'bg-indigo-100 text-indigo-800' : 'bg-[#E9E5DC] text-[#8C8C8C]'
                      }`}
                  >
                    {isLoopMode ? 'BẬT' : 'TẮT'}
                  </span>
                </button>

                {/* 3. Giọng đọc TTS (Voice Audio) */}
                <button
                  type="button"
                  onClick={() => setIsMuted((prev) => !prev)}
                  className="w-full px-2.5 py-1.5 rounded-lg border flex items-center justify-between font-semibold hover:bg-[#F2EFE9] cursor-pointer transition-colors text-left text-xs"
                  style={{ borderColor: '#E9E5DC' }}
                >
                  <span className="text-[#262626]">Giọng nói Robot (TTS)</span>
                  <span
                    className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded ${!isMuted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                  >
                    {!isMuted ? 'BẬT' : 'TẮT'}
                  </span>
                </button>

                {/* 3b. Pin giả lập (cùng ngưỡng với màn hình robot) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">
                    <span>Pin giả lập</span>
                    <span className="font-mono text-[#262626]">{simBatteryPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={simBatteryPercent}
                    onChange={(e) => setSimBatteryPercent(Number(e.target.value))}
                    className="w-full cursor-pointer accent-[#262626]"
                  />
                  <p className="text-[10px] leading-snug text-[#8C8C8C]">
                    Từ {BATTERY_LOW_PERCENT}%: xong khách hiện tại rồi về trạm sạc. Từ {BATTERY_CRITICAL_PERCENT}%: dừng ngay để về sạc. Nhận khách lại khi đạt {BATTERY_RESUME_PERCENT}%.
                  </p>
                </div>

                {/* 4. Cổng kết nối ROS 2 */}
                <div className="pt-2 border-t space-y-1.5" style={{ borderColor: '#E9E5DC' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8C8C]">
                      ROS 2 Bridge (Port 9090)
                    </span>
                    <span
                      className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded flex items-center gap-1 ${isRosEnabled && isRosConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                        }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isRosEnabled && isRosConnected ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} />
                      {isRosEnabled && isRosConnected ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
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
                    className="w-full py-1 px-2 rounded-lg border text-xs font-semibold text-center hover:bg-[#F2EFE9] cursor-pointer transition-colors"
                    style={{ borderColor: '#E9E5DC', color: '#262626' }}
                  >
                    {isRosEnabled && isRosConnected ? 'Ngắt kết nối ROS 2' : 'Kết nối lại ROS 2'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* NÚT PHÁT: ICON BUTTON CAO CẤP */}
          <button
            type="button"
            onClick={handleDispatchToRobot}
            className="h-8 w-8 rounded-lg text-white flex items-center justify-center shadow-xs transition-all cursor-pointer shrink-0 hover:bg-[#363636]"
            style={{ backgroundColor: '#262626' }}
            title={rc('Send workflow to robot')}
          >
            <Send className="w-3.5 h-3.5" />
          </button>

          {/* NÚT ĐÓNG: ICON X GỌN GÀNG */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-lg border flex items-center justify-center cursor-pointer shadow-xs hover:bg-[#FAF8F5]"
              style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
              title={rc('Close simulator')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-300 px-3 py-1.5 shrink-0">
        <SimulatorMapMode mode={interactionMode} onChange={handleInteractionModeChange}
          busy={isPlaying || Boolean(currentPath && !currentPath.preview)} language={language} showZones={showZones}
          onToggleZones={() => setShowZones((value) => !value)} />
        <span className="text-[11px] text-stone-500">
          {language === 'VI'
            ? (isMapEditing ? 'Chọn hoặc kéo vùng/điểm để sửa. Click sàn không di chuyển robot.' : 'Click sàn hoặc endpoint để điều hướng. Vùng và điểm đã khóa chỉnh sửa.')
            : (isMapEditing ? 'Select or drag a zone/endpoint to edit. Floor clicks do not move the robot.' : 'Click the floor or an endpoint to navigate. Zone and endpoint editing is locked.')}
        </span>
      </div>

      <SimulatorGuestControls simulation={simulatedGuest} language={language} isPlaying={isPlaying}
        isPaused={isPaused} isCharging={isChargeRoutineRunning} promotionInterrupted={promotionInterrupted}
        ticket={guestRequest.ticket} />

      {/* KHONG GIAN SA BAN 2D TOAN MAN HINH (FULL-WIDTH GROUND FLOOR VIEWPORT) */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <main
          className="flex-1 w-full h-full relative p-0 sm:p-1 flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: '#F2EFE9' }}
        >
          {/* HUD Tieu de Sanh Khach San o goc tren ben trai */}
          <div className="absolute top-3 left-4 z-10 select-none pointer-events-none flex items-center gap-2">
            <span
              className="font-mono font-bold text-xs px-2 py-0.5 rounded-md border shadow-2xs"
              style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#1c1917' }}
            >
              Ground
            </span>
            <span className="font-mono text-[11px] font-medium" style={{ color: '#78716c' }}>
              Sảnh Khách Sạn • 19.60m × 12.60m
            </span>
          </div>

          {/* BANNER HUONG DAN & DIEU KHIEN KHI DANG VE VUNG (KHONG BI AN DI) */}
          {zoneDrawType && (
            <div
              className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3.5 py-2 rounded-xl border shadow-2xl flex items-center gap-3 animate-fadeIn text-xs max-w-[90%] select-none"
              style={{ backgroundColor: '#262626', borderColor: '#BFBFBD', color: '#F2EFE9' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      zoneDrawType === 'KEEP_OUT'
                        ? '#DC2626'
                        : zoneDrawType === 'SPEED_ZONE'
                          ? '#D97706'
                          : '#E11D48',
                  }}
                />
                <span className="font-semibold">
                  {zoneDrawShape === 'polygon'
                    ? `Vẽ ${zoneDrawType === 'KEEP_OUT' ? 'Cấm Vào' : zoneDrawType === 'SPEED_ZONE' ? 'Giới Hạn Tốc Độ' : 'Cấm Dừng'}: click từng đỉnh (${zoneDraft?.vertices?.length || 0}/64 đỉnh)`
                    : `Vẽ ${zoneDrawType === 'KEEP_OUT' ? 'Cấm Vào' : zoneDrawType === 'SPEED_ZONE' ? 'Giới Hạn Tốc Độ' : 'Cấm Dừng'}: kéo chuột trên sa bàn`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {zoneDrawShape === 'polygon' && (
                  <>
                    <button
                      type="button"
                      disabled={(zoneDraft?.vertices?.length || 0) < 3}
                      onClick={finishPolygon}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs cursor-pointer transition-all shadow-xs"
                    >
                      ✓ Hoàn tất / Lưu
                    </button>
                    <button
                      type="button"
                      disabled={!zoneDraft?.vertices?.length}
                      onClick={() => setZoneDraft((draft) => draft && { ...draft, vertices: draft.vertices.slice(0, -1) })}
                      className="px-2 py-1 rounded-lg bg-[#3F3F46] hover:bg-[#52525B] disabled:opacity-40 text-white text-xs cursor-pointer transition-colors"
                      title="Xóa điểm vừa chấm gần nhất"
                    >
                      Bỏ đỉnh cuối
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => { setZoneDrawType(null); setZoneDraft(null); }}
                  className="px-2 py-1 rounded-lg border border-[#71717A] hover:bg-[#3F3F46] text-[#D4D4D8] text-xs cursor-pointer transition-colors"
                  title="Hủy bỏ chế độ vẽ (hoặc nhấn Esc)"
                >
                  Hủy (Esc)
                </button>
              </div>
            </div>
          )}

          {/* Thanh huong dan dieu huong truc quan & HUD Trang thai Vung cua Robot */}
          <div className="absolute top-3 right-4 z-10 flex flex-col items-end gap-1.5 select-none pointer-events-none">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-xs text-xs font-medium backdrop-blur-xs"
              style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
            >
              {isMapEditing ? (
                <span title="Chế độ sửa Vùng (Kéo thả & Định vị)">
                  <Move className="w-3.5 h-3.5 text-amber-700" />
                </span>
              ) : (
                <span title="Click sàn bản đồ để điều hướng Robot">
                  <Navigation className="w-3.5 h-3.5 text-[#8C8C8C]" />
                </span>
              )}
              <span
                className="font-mono font-bold px-1.5 py-0.5 rounded border text-[11px]"
                style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
                title="Tọa độ Robot hiện tại (X, Y)"
              >
                {robotPose.x}m, {robotPose.y}m · {linearSpeed.toFixed(2)} m/s
              </span>
              <span
                className={`font-mono font-bold px-1.5 py-0.5 rounded border text-[11px] ${batteryGuard.mode === BATTERY_MODE.CRITICAL
                    ? 'bg-red-100 text-red-800 border-red-300'
                    : batteryGuard.mode === BATTERY_MODE.LOW
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : ''
                  }`}
                style={batteryGuard.mode === BATTERY_MODE.OK ? { backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' } : {}}
                title="Pin giả lập, đổi trong Tùy chọn mô phỏng"
              >
                Pin {simBatteryPercent}%
              </span>

              {/* Chip HUD Trang thai Vung hien tai cua Robot */}
              {activeRobotZone ? (
                <span
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-mono font-bold text-[10px] border shadow-2xs ${activeRobotZone.type === 'KEEP_OUT'
                      ? 'bg-red-100 text-red-800 border-red-300 animate-pulse'
                      : activeRobotZone.type === 'SPEED_ZONE' || activeRobotZone.type === 'SLOW_SPEED'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  title={
                    activeRobotZone.type === 'KEEP_OUT'
                      ? 'Cảnh báo: Robot đang trong Vùng Cấm!'
                      : activeRobotZone.type === 'SPEED_ZONE' || activeRobotZone.type === 'SLOW_SPEED'
                        ? `Robot trong Vùng Giới hạn tốc độ ${activeRobotZone.speed_limit || 0.20}m/s`
                        : 'Robot đang trong Vùng Cấm Dừng'
                  }
                >
                  {activeRobotZone.type === 'KEEP_OUT' && <Ban className="w-3 h-3 text-red-600" />}
                  {(activeRobotZone.type === 'SPEED_ZONE' || activeRobotZone.type === 'SLOW_SPEED') && (
                    <Gauge className="w-3 h-3 text-amber-600" />
                  )}
                  {activeRobotZone.type === 'NO_STOP' && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                  <span>
                    {activeRobotZone.type === 'KEEP_OUT'
                      ? 'CẤM'
                      : activeRobotZone.type === 'SPEED_ZONE' || activeRobotZone.type === 'SLOW_SPEED'
                        ? `${activeRobotZone.speed_limit || 0.20}m/s`
                        : 'CẤM DỪNG'}
                  </span>
                </span>
              ) : (
                <span
                  className="px-1.5 py-0.5 rounded font-mono text-[9.5px] border font-bold"
                  style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#8C8C8C' }}
                  title="Robot đang trong vùng tự do an toàn"
                >
                  Sảnh Tự Do
                </span>
              )}
            </div>

            {/* Trạng thái pin yếu */}
            {batteryStatusText && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-xs text-[11px] font-semibold max-w-md"
                style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D', color: '#92400E' }}
              >
                <BatteryLow className="w-3.5 h-3.5 shrink-0" />
                <span>{batteryStatusText}</span>
              </div>
            )}

            {/* Toast Cảnh Báo An Toàn Vùng (Nổi khi vi phạm hoặc click vùng cấm) */}
            {zoneAlert && (
              <div
                role="status"
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
                  aria-label={language === 'VI' ? 'Đóng thông báo' : 'Dismiss notification'}
                  className="p-1 rounded hover:bg-black/5 cursor-pointer shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {requestPhase && !isPaused && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[min(440px,94%)] max-h-[90%] overflow-y-auto rounded-xl border bg-white p-4 shadow-xl">
              <WorkflowGuestRequestPanel key={activeStep.step_id + ':' + stepRun} workflowId={activeWorkflow.id} phase={requestPhase}
                session={guestRequest} setSession={setGuestRequest} preview english={language === 'EN'}
                onNext={() => handleStepFinish()} onCancel={handleStopSim} />
            </div>
          )}
          {/* KHUNG LUA CHON CUA KHACH (BUOC CHOICE) - dung chung voi man hinh robot */}
          {activeStep?.type === 'CHOICE' && (
            <div
              className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 w-[min(520px,92%)] rounded-2xl border shadow-2xl p-3 bg-white/95 backdrop-blur-xs"
              style={{ borderColor: '#BFBFBD' }}
            >
              <KioskChoicePrompt
                step={activeStep}
                disabled={isPaused}
                remainingSec={Math.ceil(((getChoiceTimeoutSec(activeStep) / (simSpeed || 1)) * (100 - stepProgress)) / 100)}
                onChoose={(optionId) => handleStepFinish({ type: OUTCOME.CHOSEN, optionId })}
                onCancel={() => handleStepFinish({ type: OUTCOME.CANCEL })}
              />
            </div>
          )}

          {/* FLOATING ZOOM CONTROLS (PHÓNG TO / THU NHỎ / RESET ZOOM TRÊN BẢN ĐỒ) */}
          <div
            className="absolute bottom-4 right-4 z-20 flex items-center gap-1 p-1 rounded-xl border shadow-lg backdrop-blur-xs select-none"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#BFBFBD' }}
          >
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomScale <= 0.75}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#262626] hover:bg-[#F2EFE9] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Thu nhỏ bản đồ (Zoom Out)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleResetZoom}
              className="h-7 px-2 rounded-lg font-mono font-bold text-[11px] text-[#262626] hover:bg-[#F2EFE9] cursor-pointer transition-colors"
              title="Khôi phục kích thước 100% (Reset Zoom)"
            >
              {Math.round(zoomScale * 100)}%
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomScale >= 2.5}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#262626] hover:bg-[#F2EFE9] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Phóng to bản đồ (Zoom In)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-4 bg-[#BFBFBD] mx-0.5" />

            <button
              type="button"
              onClick={handleResetZoom}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#262626] hover:bg-[#F2EFE9] cursor-pointer transition-colors"
              title="Căn giữa toàn màn hình"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <svg
            ref={svgRef}
            viewBox={dynamicViewBox}
            onClick={handleMapClick}
            onWheel={handleWheelZoom}
            onPointerDown={handleSvgPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            className={`w-full h-full object-contain select-none ${isPanning
                ? 'cursor-grabbing'
                : dragState
                  ? 'cursor-grabbing'
                  : isZoneEditMode || selectedZone
                    ? 'cursor-default'
                    : 'cursor-crosshair'
              }`}
          >
            <defs>
              {/* Pattern soc cheo do nhe cho KEEP_OUT */}
              <pattern id="keepoutStripes" width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="16" stroke="#EF4444" strokeWidth="2" opacity="0.16" />
              </pattern>
              {/* Pattern cham ho phach nhe cho SPEED_ZONE */}
              <pattern id="speedZonePattern" width="14" height="14" patternUnits="userSpaceOnUse">
                <circle cx="3" cy="3" r="1.5" fill="#F59E0B" opacity="0.18" />
              </pattern>
              {/* Pattern soc cheo do hong nhe cho NO_STOP */}
              <pattern id="nostopStripes" width="14" height="14" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="14" stroke="#F43F5E" strokeWidth="2" opacity="0.16" />
              </pattern>
            </defs>

            <rect x="0" y="0" width="560" height="385" fill="#F4F2ED" />

            <text x="35" y="24" className="text-xs font-mono font-bold tracking-wider" fill="#1c1917" fontFamily="sans-serif">
              Ground
            </text>
            <text x="95" y="24" className="text-[10px] font-mono" fill="#8C8C8C" fontFamily="sans-serif">
              Sảnh Khách Sạn • 19.60m x 12.60m (490x315 • Gazebo 1:1)
            </text>

            <LobbyFloorPlan />
            {/* LOP 3 VUNG CHUC NANG (KEEP-OUT, SPEED ZONE, NO-STOP) TRUOC MAT BANG SAU TUONG SAN */}
            {showZones &&
              zones.map((zone) => {
                const rect = zoneToSvgRect(zone);
                const ZoneShape = isPolygonZone(zone) ? 'polygon' : 'rect';
                const shapeProps = isPolygonZone(zone)
                  ? { points: zone.vertices.map((p) => `${35 + p.x * 25},${35 + (12.60 - p.y) * 25}`).join(' ') }
                  : { ...rect, transform: `rotate(${-Number(zone.yaw || 0)}, ${rect.x + rect.width / 2}, ${rect.y + rect.height / 2})` };
                const isKeepOut = zone.type === 'KEEP_OUT';
                const isSpeed = zone.type === 'SPEED_ZONE' || zone.type === 'SLOW_SPEED';
                const isSelected = isMapEditing && selectedZone?.id === zone.id;
                const isDraggingThis = dragState?.zoneId === zone.id;

                const fillPattern = isKeepOut
                  ? 'url(#keepoutStripes)'
                  : isSpeed
                    ? 'url(#speedZonePattern)'
                    : 'url(#nostopStripes)';

                const strokeColor = isKeepOut ? '#F87171' : isSpeed ? '#FBBF24' : '#FB7185';
                const bgTint = isKeepOut
                  ? 'rgba(239, 68, 68, 0.05)'
                  : isSpeed
                    ? 'rgba(245, 158, 11, 0.05)'
                    : 'rgba(244, 63, 94, 0.05)';


                const isZoneInteractable = isMapEditing && !zoneDrawType;

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
                    className={`select-none transition-opacity ${!isZoneInteractable
                        ? 'pointer-events-none'
                        : isDraggingThis
                          ? 'cursor-grabbing opacity-90 pointer-events-auto'
                          : isSelected
                            ? 'cursor-grab hover:opacity-95 pointer-events-auto'
                            : 'cursor-pointer hover:opacity-95 pointer-events-auto'
                      }`}
                  >
                    {/* Nen mau tint nhe */}
                    <ZoneShape
                      {...shapeProps}
                      fill={bgTint}
                      style={{ pointerEvents: isZoneInteractable ? 'all' : 'none' }}
                    />
                    {/* Lop hoa van pattern */}
                    <ZoneShape
                      {...shapeProps}
                      fill={fillPattern}
                      style={{ pointerEvents: 'none' }}
                    />
                    {/* Vien bao net dut ky thuat */}
                    <ZoneShape
                      {...shapeProps}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isSelected ? '2' : '1.2'}
                      strokeDasharray={isKeepOut ? '6 4' : isSpeed ? '5 3' : '4 3'}
                      strokeOpacity="0.75"
                      style={{ pointerEvents: 'none' }}
                    />

                    {/* Chú thích vùng bằng ICON và MÀU RIÊNG ở góc trên bên phải của vùng (Click vao Icon de chon va sua Vung) */}
                    <g
                      transform={`translate(${rect.x + rect.width - (isSpeed ? 26 : 16)}, ${rect.y + 4})`}
                      className="select-none cursor-pointer group"
                      style={{ pointerEvents: isZoneInteractable ? 'auto' : 'none' }}
                      onClick={(e) => {
                        if (!isZoneInteractable || e.shiftKey) return;
                        e.stopPropagation();
                        const nextSelected = isSelected ? null : zone;
                        setSelectedZone(nextSelected);
                        setIsZoneEditMode(Boolean(nextSelected));
                      }}
                      title={`Click vào Icon để chọn và chỉnh sửa Vùng: ${zone.name}`}
                    >
                      {isKeepOut && (
                        <g filter="drop-shadow(0 1px 2px rgba(0,0,0,0.20))">
                          {/* Vòng nền đỏ riêng biệt */}
                          <circle cx="6.5" cy="6.5" r="6" fill="#DC2626" />
                          {/* Icon Cấm Vào (Ban / Circle Slash) */}
                          <circle cx="6.5" cy="6.5" r="3.8" fill="none" stroke="#FFFFFF" strokeWidth="1.1" />
                          <line x1="3.8" y1="3.8" x2="9.2" y2="9.2" stroke="#FFFFFF" strokeWidth="1.1" />
                        </g>
                      )}
                      {!isKeepOut && !isSpeed && (
                        <g filter="drop-shadow(0 1px 2px rgba(0,0,0,0.20))">
                          {/* Vòng nền hồng đỏ riêng biệt */}
                          <circle cx="6.5" cy="6.5" r="6" fill="#E11D48" />
                          {/* Icon Cấm Dừng (Stop / Octagon Hand) */}
                          <polygon points="4.5,2.5 8.5,2.5 10.5,4.5 10.5,8.5 8.5,10.5 4.5,10.5 2.5,8.5 2.5,4.5" fill="#FFFFFF" />
                          <rect x="4.5" y="5.8" width="4" height="1.2" rx="0.3" fill="#E11D48" />
                        </g>
                      )}
                      {isSpeed && (
                        <g filter="drop-shadow(0 1px 2px rgba(0,0,0,0.20))">
                          {/* Pill badge nền cam hổ phách */}
                          <rect x="0" y="0" width="24" height="12" rx="6" fill="#D97706" />
                          {/* Gauge arc & needle */}
                          <path d="M 4 8.5 A 3 3 0 1 1 9 8.5" fill="none" stroke="#FFFFFF" strokeWidth="0.9" strokeLinecap="round" />
                          <line x1="6.5" y1="6.5" x2="8" y2="5" stroke="#FFFFFF" strokeWidth="0.9" strokeLinecap="round" />
                          <text
                            x="16"
                            y="8.5"
                            textAnchor="middle"
                            fill="#FFFFFF"
                            className="text-[5.5px] font-mono font-bold"
                            fontFamily="sans-serif"
                          >
                            {zone.speed_limit || 0.2}
                          </text>
                        </g>
                      )}
                    </g>

                    {/* TAY NAM GOC VUONG MINI FIGMA/CAD (6x6px trang vien xam dam, thanh lich, khong hinh tron, khong hao quang) */}
                    {isSelected && !isPolygonZone(zone) && (
                      <g className="zone-resize-handles">
                        {Object.entries(zoneCorners(zone)).map(([corner, position]) => {
                          const point = meterToSvg(position.x, position.y);
                          const handle = { cx: point.x, cy: point.y, type: `RESIZE_${corner.toUpperCase()}`,
                            cursor: ['nw', 'se'].includes(corner) ? 'cursor-nwse-resize' : 'cursor-nesw-resize' };
                          return (
                          <g key={handle.type}>
                            {/* Vung nhan click tang hinh de de trỏ chuot */}
                            <rect
                              x={handle.cx - 8}
                              y={handle.cy - 8}
                              width="16"
                              height="16"
                              fill="transparent"
                              className={`${handle.cursor} select-none`}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                handleZonePointerDown(e, zone, handle.type);
                              }}
                            />
                            {/* Mau vuong mini Figma style: 6x6px trang vien xam dam */}
                            <rect
                              x={handle.cx - 3}
                              y={handle.cy - 3}
                              width="6"
                              height="6"
                              rx="1"
                              fill="#FFFFFF"
                              stroke="#262626"
                              strokeWidth="1.2"
                              className={`pointer-events-none ${handle.cursor}`}
                            />
                          </g>
                        ); })}
                      </g>
                    )}

                    {/* TAY NAM DINH & CANH CUA POLYGON KHI DUOC CHON */}
                    {isSelected && isPolygonZone(zone) && (
                      <g className="polygon-vertex-handles">
                        {/* Edge hover: nút bấm thêm đỉnh tại cạnh */}
                        {zoneEdgeHover && zoneEdgeHover.zoneId === zone.id && (
                          <g
                            className="cursor-copy"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const result = insertZoneVertex(zone, zoneEdgeHover.edgeIndex, zoneEdgeHover.point);
                              if (result.error) {
                                onNotify(result.error, 'warning');
                                return;
                              }
                              const updated = result.zone;
                              setZones((prev) => prev.map((z) => (z.id === zone.id ? updated : z)));
                              setSelectedZone(updated);
                              setSelectedZoneVertex(result.vertexIndex);
                              setHasUnsavedZones(true);
                              setDragState({
                                type: 'ZONE_VERTEX',
                                zoneId: zone.id,
                                vertex: result.vertexIndex,
                                pointerId: e.pointerId,
                                startClientX: e.clientX,
                                startClientY: e.clientY,
                                initialZone: { ...updated },
                              });
                            }}
                          >
                            <circle
                              cx={zoneEdgeHover.svgPoint.x}
                              cy={zoneEdgeHover.svgPoint.y}
                              r="7"
                              fill="#0F172A"
                              stroke="#22D3EE"
                              strokeWidth="2"
                            />
                            <line
                              x1={zoneEdgeHover.svgPoint.x - 3}
                              y1={zoneEdgeHover.svgPoint.y}
                              x2={zoneEdgeHover.svgPoint.x + 3}
                              y2={zoneEdgeHover.svgPoint.y}
                              stroke="#22D3EE"
                              strokeWidth="1.5"
                            />
                            <line
                              x1={zoneEdgeHover.svgPoint.x}
                              y1={zoneEdgeHover.svgPoint.y - 3}
                              x2={zoneEdgeHover.svgPoint.x}
                              y2={zoneEdgeHover.svgPoint.y + 3}
                              stroke="#22D3EE"
                              strokeWidth="1.5"
                            />
                          </g>
                        )}

                        {/* Các đỉnh của Polygon (kéo thả hoặc chọn đỉnh để xóa) */}
                        {zone.vertices.map((v, vIdx) => {
                          const vSvg = meterToSvg(v.x, v.y);
                          const isSelectedV = selectedZoneVertex === vIdx;
                          return (
                            <g key={vIdx}>
                              {/* Hitbox lớn để dễ nhấn chuột */}
                              <circle
                                cx={vSvg.x}
                                cy={vSvg.y}
                                r="10"
                                fill="transparent"
                                className="cursor-crosshair select-none"
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setSelectedZoneVertex(vIdx);
                                  setDragState({
                                    type: 'ZONE_VERTEX',
                                    zoneId: zone.id,
                                    vertex: vIdx,
                                    pointerId: e.pointerId,
                                    startClientX: e.clientX,
                                    startClientY: e.clientY,
                                    initialZone: { ...zone },
                                  });
                                }}
                              />
                              {/* Nốt đỉnh hiển thị */}
                              <circle
                                cx={vSvg.x}
                                cy={vSvg.y}
                                r={isSelectedV ? 6 : 4}
                                fill={isSelectedV ? '#FBBF24' : '#FFFFFF'}
                                stroke={isSelectedV ? '#FFFFFF' : '#0891B2'}
                                strokeWidth={isSelectedV ? '2' : '1.5'}
                                className="pointer-events-none"
                              />
                            </g>
                          );
                        })}
                      </g>
                    )}
                  </g>
                );
              })}

            {/* POLYGON DRAFT: Hien thi cac dinh da chon khi dang ve da giac */}
            {isMapEditing && zoneDrawType && zoneDrawShape === 'polygon' && zoneDraft?.vertices && (() => {
              const ZONE_COLORS = { KEEP_OUT: '#F87171', SPEED_ZONE: '#FBBF24', NO_STOP: '#FB7185' };
              const color = ZONE_COLORS[zoneDrawType] || '#22D3EE';
              const toSvg = (p) => meterToSvg(p.x, p.y);
              const svgVerts = zoneDraft.vertices.map(toSvg);
              const cursorSvg = zoneDraft.cursor ? toSvg(zoneDraft.cursor) : null;
              const allPoints = cursorSvg ? [...svgVerts, cursorSvg] : svgVerts;
              return (
                <g style={{ pointerEvents: 'none' }}>
                  {/* Preview polygon fill */}
                  {allPoints.length >= 3 && (
                    <polygon
                      points={allPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill={`${color}25`}
                      stroke={color}
                      strokeWidth="1.5"
                      strokeDasharray="5,3"
                    />
                  )}
                  {/* Preview line from last vertex to cursor */}
                  {svgVerts.length >= 1 && cursorSvg && (
                    <line
                      x1={svgVerts[svgVerts.length - 1].x} y1={svgVerts[svgVerts.length - 1].y}
                      x2={cursorSvg.x} y2={cursorSvg.y}
                      stroke={color} strokeWidth="1.2" strokeDasharray="4,3"
                    />
                  )}
                  {/* Vertices dots */}
                  {svgVerts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 5 : 3.5}
                      fill={i === 0 ? '#22D3EE' : '#FFFFFF'} stroke={color} strokeWidth="1.5" />
                  ))}
                  {/* Snap hint at first vertex */}
                  {svgVerts.length >= 3 && cursorSvg && (() => {
                    const dist = Math.hypot(cursorSvg.x - svgVerts[0].x, cursorSvg.y - svgVerts[0].y);
                    return dist < 15 ? (
                      <circle cx={svgVerts[0].x} cy={svgVerts[0].y} r="8"
                        fill="none" stroke="#22D3EE" strokeWidth="2" opacity="0.7" />
                    ) : null;
                  })()}
                </g>
              );
            })()}

            {/* CAC DIEM MOC ENDPOINTS TREN SA BAN - 3 LOAI CHUAN (WAYPOINT, CHARGER, PARK), HO TRO KEO THA & SUA TEN */}
            {endpoints.map((ep) => {
              const wpSvg = meterToSvg(ep.x, ep.y);
              const isTarget =
                currentPath?.targetPoint &&
                Math.abs(currentPath.targetPoint.x - ep.x) < 0.25 &&
                Math.abs(currentPath.targetPoint.y - ep.y) < 0.25;
              const isSelected = isMapEditing && selectedEndpoint?.id === ep.id;
              const isDraggingThis = dragEndpointState?.endpointId === ep.id;
              const isHovered = hoveredEndpointId === ep.id;
              const showLabel = isSelected || isDraggingThis || isHovered;

              const tmpl = getEndpointTemplateInfo(ep.type);
              const epColor = tmpl.color || '#262626';

              // Ten diem moc do nguoi dung dat (Ty le nho gon, tinh te)
              const nameText = ep.name || 'Điểm mốc';
              const badgeWidth = Math.max(20, nameText.length * 2.5 + 8);
              const isTopHalf = ep.y > 3.0;
              const badgeOffsetY = isTopHalf ? 7.0 : -7.0;

              return (
                <g
                  key={ep.id}
                  data-endpoint="true"
                  data-endpoint-id={ep.id}
                  onMouseEnter={() => setHoveredEndpointId(ep.id)}
                  onMouseLeave={() => setHoveredEndpointId((prev) => (prev === ep.id ? null : prev))}
                  onPointerDown={(e) => handleEndpointPointerDown(e, ep)}
                  onPointerUp={(e) => { if (isMapEditing) handleSvgPointerUp(e); }}
                  onClick={(e) => {
                    if (zoneDrawType || e.shiftKey) return;
                    e.stopPropagation();
                    if (wasDraggingRef.current) return;
                    if (isMapEditing) {
                      setSelectedEndpoint(ep);
                      setSelectedZone(null);
                      setIsEndpointEditMode(true);
                    } else {
                      handleNavigateToGoal(ep.x, ep.y, ep.name);
                    }
                  }}
                  style={{ pointerEvents: zoneDrawType ? 'none' : 'auto' }}
                  className={`select-none ${isDraggingThis ? 'cursor-grabbing' : 'cursor-pointer'} group`}
                >
                  {/* 1. Vung nhan dien Pointer va Halo khi duoc chon */}
                  {isSelected && (
                    <circle
                      cx={wpSvg.x}
                      cy={wpSvg.y}
                      r="13"
                      fill={epColor}
                      fillOpacity="0.12"
                      stroke={epColor}
                      strokeOpacity="0.6"
                      strokeWidth="1.2"
                      strokeDasharray="3 2"
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

                  {/* 2. Diem tron filled dac mau theo loai Endpoint (co vien trang tuong phan ro net) */}
                  <circle
                    cx={wpSvg.x}
                    cy={wpSvg.y}
                    r={isSelected ? 6.5 : isHovered ? 5.8 : 4.8}
                    fill={epColor}
                    stroke="#FFFFFF"
                    strokeWidth={isSelected ? '2.0' : isHovered ? '1.8' : '1.4'}
                    filter="drop-shadow(0 1px 3px rgba(0,0,0,0.20))"
                    className="transition-all duration-150"
                  />

                  {/* 4. The Nhan ten Endpoint - Ty le nho gon tinh te */}
                  {showLabel && (
                    <g
                      transform={`translate(${wpSvg.x}, ${wpSvg.y + badgeOffsetY})`}
                      className="cursor-pointer transition-all duration-150"
                    >
                      {/* Card nen trang / xam tinh gon */}
                      <rect
                        x={-badgeWidth / 2}
                        y="-3.8"
                        width={badgeWidth}
                        height="7.6"
                        rx="1.8"
                        fill={isSelected ? '#18181B' : '#FFFFFF'}
                        stroke={isSelected ? epColor : '#BFBFBD'}
                        strokeWidth={isSelected ? '0.9' : '0.6'}
                        filter="drop-shadow(0 1px 2px rgba(0,0,0,0.14))"
                      />

                      {/* Dot mau phan biet loai Endpoint */}
                      <circle
                        cx={-badgeWidth / 2 + 2.8}
                        cy="0"
                        r="0.9"
                        fill={epColor}
                        className="pointer-events-none"
                      />

                      {/* Chu ten do nguoi dung dat */}
                      <text
                        x="1.5"
                        y="1.1"
                        textAnchor="middle"
                        fill={isSelected ? '#FFFFFF' : '#18181B'}
                        className="text-[3.6px] font-semibold tracking-tight truncate pointer-events-none"
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
              const labelWidth = Math.max(42, targetLabel.length * 3.8 + 10);

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
                  {/* 1. Duong dan huong ne tuong (Polyline uon quanh qua cua mo - Mau nhat thanh lich) */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#94A3B8"
                    strokeWidth="1.6"
                    strokeDasharray="4 3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.55"
                  />

                  {/* 2. Vet duong robot da lan banh qua toi vi tri hien tai (Mau Slate nhat diu mat, khong bi dam den) */}
                  <path
                    d={traveledPathData}
                    fill="none"
                    stroke="#475569"
                    strokeWidth="2.0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.65"
                  />

                  {/* 3. Vong tron dich den tinh gon gang */}
                  <g>
                    <circle
                      cx={targetSvg.x}
                      cy={targetSvg.y}
                      r="10"
                      fill="rgba(71, 85, 105, 0.04)"
                      stroke="#64748B"
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                      strokeOpacity="0.55"
                    />
                    <g transform={`translate(${targetSvg.x}, ${targetSvg.y - 9.5})`}>
                      <rect
                        x={-labelWidth / 2}
                        y="-5"
                        width={labelWidth}
                        height="10"
                        rx="2"
                        fill="#334155"
                        fillOpacity="0.92"
                        stroke="#475569"
                        strokeWidth="0.8"
                        filter="drop-shadow(0 1px 2px rgba(0,0,0,0.10))"
                      />
                      <text
                        x="0"
                        y="1.8"
                        textAnchor="middle"
                        className="text-[5.2px] font-bold fill-white tracking-wide"
                        fontFamily="sans-serif"
                      >
                        {targetLabel}
                      </text>
                    </g>
                  </g>
                </g>
              );
            })()}

            <SimulatorGuestMarker guest={simulatedGuest.guest} language={language} ticket={guestRequest.ticket} />

            {/* ROBOT MARKER KEM BONG BONG ACTION HUD THONG MINH TREN DAU ROBOT */}
            {(() => {
              const robotSvg = meterToSvg(robotPose.x, robotPose.y);
              const svgAngle = -(robotPose.yaw * 180) / Math.PI;

              return (
                <g transform={`translate(${robotSvg.x}, ${robotSvg.y})`}>
                  {/* BONG BONG TRANG THAI TINH GON TREN DAU ROBOT (Ty le nho gon, tinh te) */}
                  {(() => {
                    const statusText = robotStatus.label;
                    const pillWidth = Math.max(46, statusText.length * 4.2 + 14);
                    return (
                      <g transform="translate(0, -12)" className="pointer-events-none select-none">
                        {/* Card nen trang tinh te */}
                        <rect
                          x={-pillWidth / 2}
                          y="-5.5"
                          width={pillWidth}
                          height="11"
                          rx="2.5"
                          fill="#FFFFFF"
                          stroke="#BFBFBD"
                          strokeWidth="0.8"
                          filter="drop-shadow(0 1px 3px rgba(0,0,0,0.12))"
                        />
                        {/* Mui ten tro xuong robot */}
                        <polygon points="-2,5.5 2,5.5 0,8.5" fill="#FFFFFF" stroke="#BFBFBD" strokeWidth="0.8" />
                        <line x1="-1.8" y1="5.5" x2="1.8" y2="5.5" stroke="#FFFFFF" strokeWidth="1.2" />

                        {/* Dot trang thai nho */}
                        <circle
                          cx={-pillWidth / 2 + 5.5}
                          cy="0"
                          r="1.6"
                          fill={robotStatus.dotColor}
                          className={robotStatus.isMoving ? 'animate-pulse' : ''}
                        />

                        {/* Chu trang thai cua robot */}
                        <text
                          x="2"
                          y="1.8"
                          textAnchor="middle"
                          className="text-[5.5px] font-bold tracking-wider uppercase"
                          fill="#262626"
                          fontFamily="sans-serif"
                        >
                          {statusText}
                        </text>
                      </g>
                    );
                  })()}

                  {/* Robot hinh chu nhat mau xam don gian, toi gian ky thuat (Kich thuoc nho gon hon) */}
                  <g transform={`rotate(${svgAngle})`}>
                    {/* 2 Banh xe mau xam den o 2 ben hong xe */}
                    <rect x="-5" y="-8.5" width="10" height="2.2" rx="0.5" fill="#18181b" />
                    <rect x="-5" y="6.3" width="10" height="2.2" rx="0.5" fill="#18181b" />

                    {/* Than xe hinh chu nhat mau xam toi gian */}
                    <rect
                      x="-8"
                      y="-6"
                      width="16"
                      height="12"
                      rx="2"
                      fill="#64748b"
                      stroke="#334155"
                      strokeWidth="1.2"
                      filter="drop-shadow(0 1px 3px rgba(0,0,0,0.15))"
                    />

                    {/* Tam LiDAR nho mau xam dam */}
                    <circle cx="-2" cy="0" r="2.2" fill="#334155" stroke="#94a3b8" strokeWidth="0.6" />
                    <circle cx="-2" cy="0" r="0.8" fill="#cbd5e1" />

                    {/* Mui ten chi huong dau xe (+X) mau trang tinh gon */}
                    <polygon points="6,0 3,-2.2 3,2.2" fill="#ffffff" />
                  </g>
                </g>
              );
            })()}
          </svg>

          {/* FLOATING ACTION BAR TINH GON O DUOI DAY SA BAN (EDIT ZONE & DRAG/RESIZE) */}
          {isMapEditing && selectedZone && (
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

              {/* 4. Thong so toa do & O nhap kich thuoc hoac thong tin dinh Polygon */}
              {isPolygonZone(selectedZone) ? (
                <div
                  className="flex items-center gap-2 px-2 py-1 rounded-lg font-mono text-[11px] border shrink-0"
                  style={{ backgroundColor: '#F2EFE9', borderColor: '#E9E5DC', color: '#262626' }}
                >
                  <span className="font-bold text-[#0891B2]">Đa giác: {selectedZone.vertices.length} đỉnh</span>
                  {selectedZoneVertex !== null ? (
                    <span className="font-bold text-amber-700">(Đang chọn đỉnh #{selectedZoneVertex + 1})</span>
                  ) : (
                    <span className="text-[#8C8C8C] text-[10px]">(Click đỉnh để kéo/xóa, click cạnh để thêm)</span>
                  )}
                </div>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg font-mono text-[10.5px] border shrink-0"
                  style={{ backgroundColor: '#F2EFE9', borderColor: '#E9E5DC', color: '#262626' }}
                >
                  <span className="text-[#8C8C8C]">Tâm:</span>
                  <span className="font-bold">({Number(selectedZone.x).toFixed(1)}m, {Number(selectedZone.y).toFixed(1)}m)</span>
                  <span className="text-[#8C8C8C] ml-1">KT:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.4"
                    max="8.0"
                    value={selectedZone.width || 2.0}
                    onChange={(e) => handleUpdateSelectedZone('width', Math.max(0.3, parseFloat(e.target.value) || 0.4))}
                    className="w-12 px-1 py-0.5 rounded text-center font-bold border focus:outline-none"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                    title="Chiều rộng vùng (m)"
                  />
                  <span className="text-[#8C8C8C]">×</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.4"
                    max="8.0"
                    value={selectedZone.height || 2.0}
                    onChange={(e) => handleUpdateSelectedZone('height', Math.max(0.3, parseFloat(e.target.value) || 0.4))}
                    className="w-12 px-1 py-0.5 rounded text-center font-bold border focus:outline-none"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                    title="Chiều dài vùng (m)"
                  />
                  <span className="text-[#8C8C8C]">m</span>
                </div>
              )}

              {/* Nut xoa dinh dang chon (cho Polygon Zone) */}
              {isPolygonZone(selectedZone) && selectedZoneVertex !== null && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedVertex}
                  disabled={selectedZone.vertices.length <= 3}
                  className="px-2 py-1 rounded-lg border text-red-600 bg-red-50 hover:bg-red-100 border-red-200 cursor-pointer transition-colors flex items-center gap-1 text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  title="Xóa đỉnh này (hoặc bấm phím Delete/Backspace trên bàn phím, tối thiểu 3 đỉnh)"
                >
                  <MinusCircle className="w-3.5 h-3.5" />
                  <span>Xóa đỉnh #{selectedZoneVertex + 1}</span>
                </button>
              )}

              {/* 5. Nut Dat lai vi tri mac dinh ban dau (neu la vung mac dinh) */}
              {SIMULATOR_HOTEL_ZONES.some((d) => d.id === selectedZone.id) && (
                <button
                  type="button"
                  onClick={() => {
                    const def = SIMULATOR_HOTEL_ZONES.find((d) => d.id === selectedZone.id);
                    if (def) {
                      const next = zones.map((z) => (z.id === def.id ? { ...def } : z));
                      setZones(next);
                      setSelectedZone(def);
                      setHasUnsavedZones(true);
                      onNotify(`Đã đặt lại vị trí mặc định cho "${def.name}".`, 'info');
                    }
                  }}
                  className="p-1.5 rounded-lg border text-[#8C8C8C] hover:text-[#262626] hover:bg-[#F2EFE9] border-[#BFBFBD] cursor-pointer transition-colors shrink-0"
                  title="Đặt lại vị trí mặc định ban đầu của vùng này"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              {/* 6. Nut Luu Vung nhanh (Pure Icon Button) */}
              <button
                type="button"
                onClick={handleSaveZones}
                disabled={isSavingZones || !hasUnsavedZones}
                className={`p-1.5 rounded-lg border cursor-pointer transition-colors shrink-0 flex items-center justify-center ${hasUnsavedZones
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700 animate-pulse'
                    : 'bg-[#F2EFE9] text-[#8C8C8C] border-[#BFBFBD] cursor-not-allowed'
                  }`}
                title={isSavingZones ? 'Đang lưu cấu hình vùng...' : 'Lưu cấu hình vùng vào CSDL'}
              >
                <Save className={`w-3.5 h-3.5 ${isSavingZones ? 'animate-spin' : ''}`} />
              </button>

              {/* 6. Nut Xoa Vung (Delete Zone) */}
              <button
                type="button"
                onClick={() => handleDeleteZone(selectedZone.id)}
                className="p-1.5 rounded-lg border text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border-red-200 cursor-pointer transition-colors shrink-0"
                title="Xóa vùng này khỏi bản đồ"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* 7. Nut Hoan tat / Dong che do sua */}
              <button
                type="button"
                onClick={() => {
                  setSelectedZone(null);
                  setIsZoneEditMode(false);
                }}
                className="p-1.5 rounded-lg border text-[#8C8C8C] hover:text-[#262626] hover:bg-[#F2EFE9] border-transparent hover:border-[#BFBFBD] cursor-pointer transition-colors shrink-0"
                title="Hoàn tất và đóng thanh chỉnh sửa"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              </button>
            </div>
          )}

          {/* FLOATING ACTION BAR TINH GON O DUOI DAY SA BAN (EDIT ENDPOINT: DAT TEN, LOAI, TOA DO, DIEN DEN, XOA) */}
          {isMapEditing && selectedEndpoint && (
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
