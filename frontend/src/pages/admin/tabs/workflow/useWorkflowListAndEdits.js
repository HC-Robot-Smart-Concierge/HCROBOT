import { useEffect, useRef, useState } from 'react';
import { fetchWorkflows, saveWorkflow } from '../../../../services/workflowApi';
import { GAZEBO_LOBBY_WAYPOINTS, calculateSafeWaypoints } from './workflowSimulatorUtils';

/**
 * Manages simulator workflow list synchronization, active workflow selection,
 * outside-click menu dismissal, and inline MOVE step waypoint/broadcast edits.
 */
export function useWorkflowListAndEdits({
  workflows,
  initialWorkflowId,
  endpointsRef,
  robotPoseRef,
  setIsLoopMode,
  isLoopModeRef,
  setCurrentPath,
  setManualNavLabel,
  onNotify,
  onWorkflowUpdated,
}) {
  const [localWorkflows, setLocalWorkflows] = useState(() =>
    Array.isArray(workflows) && workflows.length > 0 ? workflows : []
  );

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

  // Tu dong bat che do Lap lai neu kich ban co kieu kich hoat la PATROL_LOOP
  useEffect(() => {
    if (activeWorkflow?.trigger_type === 'PATROL_LOOP') {
      setIsLoopMode(true);
      isLoopModeRef.current = true;
    }
  }, [selectedWorkflowId, activeWorkflow?.trigger_type]);

  const [editingStepIdx, setEditingStepIdx] = useState(null);
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

    const buildUpdatedStep = (st, i) => {
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
    };

    setLocalWorkflows((prevList) =>
      prevList.map((wf) =>
        wf.id !== selectedWorkflowId
          ? wf
          : { ...wf, steps: (wf.steps || []).map(buildUpdatedStep) }
      )
    );

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
    setManualNavLabel(
      `Lộ trình: ${fromKey === 'CURRENT' ? 'Hiện tại' : (fromWp?.name?.split('(')[0]?.trim() || fromKey)} ➔ ${toCleanName}`
    );

    // Dong bo luu truc tiep vao Database & cap nhat len Tab Danh Sach
    const currentWf = localWorkflows.find((w) => w.id === selectedWorkflowId);
    if (currentWf) {
      const wfToSave = { ...currentWf, steps: (currentWf.steps || []).map(buildUpdatedStep) };
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
    const buildUpdatedStep = (st, i) =>
      i !== stepIdx
        ? st
        : {
            ...st,
            params: {
              ...(st.params || {}),
              broadcast_speech: speechText,
            },
          };

    setLocalWorkflows((prevList) =>
      prevList.map((wf) =>
        wf.id !== selectedWorkflowId
          ? wf
          : { ...wf, steps: (wf.steps || []).map(buildUpdatedStep) }
      )
    );

    const currentWf = localWorkflows.find((w) => w.id === selectedWorkflowId);
    if (currentWf) {
      const wfToSave = { ...currentWf, steps: (currentWf.steps || []).map(buildUpdatedStep) };
      saveWorkflow(wfToSave)
        .then((savedWf) => {
          onWorkflowUpdated?.(savedWf || wfToSave);
        })
        .catch((err) => {
          console.warn('Lỗi lưu lời phát loa vào Database:', err);
        });
    }
  };

  return {
    localWorkflows,
    setLocalWorkflows,
    selectedWorkflowId,
    setSelectedWorkflowId,
    activeWorkflow,
    steps,
    editingStepIdx,
    setEditingStepIdx,
    isWorkflowMenuOpen,
    setIsWorkflowMenuOpen,
    isMapMenuOpen,
    setIsMapMenuOpen,
    mapMenuTab,
    setMapMenuTab,
    isSettingsMenuOpen,
    setIsSettingsMenuOpen,
    isStepsMenuOpen,
    setIsStepsMenuOpen,
    workflowMenuRef,
    mapMenuRef,
    settingsMenuRef,
    stepsMenuRef,
    handleUpdateMoveStepWaypoints,
    handleUpdateMoveStepBroadcast,
  };
}
