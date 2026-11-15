import { useCallback, useEffect, useMemo, useRef } from 'react';
import { executeWorkflow } from '../../../../services/workflowApi';
import { findBrokenFlowLinks } from '../../../../utils/workflowFlow';
import {
  BATTERY_CRITICAL_PERCENT,
  BATTERY_RESUME_PERCENT,
  describeBatteryStatus,
  findChargeRoutine,
} from '../../../../utils/batteryPolicy';
import { useLowBatteryGuard } from '../../../../hooks/useLowBatteryGuard';
import {
  ROBOT_INITIAL_POSE,
  GAZEBO_LOBBY_WAYPOINTS,
  svgToMeter,
  getActiveSimulatorZone,
  resolveNoStopPassthrough,
} from './workflowSimulatorUtils';

/**
 * Manages simulated low-battery protection, playback start/pause/stop/step/reset,
 * floorplan click navigation, and robot dispatch actions.
 */
export function useWorkflowPlaybackControls({
  localWorkflows,
  setLocalWorkflows,
  selectedWorkflowId,
  setSelectedWorkflowId,
  activeWorkflow,
  steps,
  isPlaying,
  setIsPlaying,
  isPaused,
  setIsPaused,
  setCurrentStepIndex,
  setVisitedSteps,
  setStepProgress,
  setCurrentPath,
  currentPathRef,
  setManualNavLabel,
  setGuestRequest,
  setSimGuestPresent,
  simBatteryPercent,
  setRobotPose,
  robotPoseRef,
  endpointsRef,
  zonesRef,
  selectedZone,
  setSelectedZone,
  isZoneEditMode,
  setIsZoneEditMode,
  dragState,
  selectedEndpoint,
  setSelectedEndpoint,
  isEndpointEditMode,
  setIsEndpointEditMode,
  dragEndpointState,
  wasDraggingRef,
  timerRef,
  animFrameRef,
  stopSpeakingRef,
  rosClientRef,
  setZoneAlert,
  getSvgPointFromClient,
  handleStepFinish,
  handleNavigateToGoal,
  onNotify,
  onClose,
}) {
  // PIN YEU: tu chay kich ban ve tram sac theo utils/batteryPolicy (giong man hinh robot)
  const chargeRoutine = useMemo(() => findChargeRoutine(localWorkflows), [localWorkflows]);
  const isChargeRoutineRunning = isPlaying && activeWorkflow?.id === chargeRoutine.id;
  const isServingGuestInSim =
    isPlaying && !isChargeRoutineRunning && activeWorkflow?.id !== 'wf-06-idle-promo';
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
      onNotify(
        `Pin dưới ${BATTERY_CRITICAL_PERCENT}%: dừng kịch bản đang chạy để về trạm sạc.`,
        'warning'
      );
    },
    onChargeNeeded: () =>
      onNotify(
        'Robot đã tới trạm sạc. Trên robot thật, màn hình robot gửi phiếu Maintenance để nhân viên tới cắm sạc.',
        'info'
      ),
  });

  const batteryStatusText = describeBatteryStatus({
    mode: batteryGuard.mode,
    percent: simBatteryPercent,
    isRoutineRunning: isChargeRoutineRunning,
    isWaitingForCharge: batteryGuard.isWaitingForCharge,
  });

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
    setGuestRequest({});
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
    if (
      firstStep?.type === 'MOVE' &&
      firstStep?.params?.from_waypoint &&
      firstStep.params.from_waypoint !== 'CURRENT'
    ) {
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
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (stopSpeakingRef.current) stopSpeakingRef.current();
    }
  };

  const handleStopSim = () => {
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
    if (wasDraggingRef.current || dragState || dragEndpointState) return;
    if (e.target?.closest?.('[data-endpoint]')) return;
    if (e.target?.closest?.('[data-zone]') || e.target?.closest?.('.zone-resize-handles')) return;

    if (isZoneEditMode || selectedZone || isEndpointEditMode || selectedEndpoint) {
      if (selectedZone) setSelectedZone(null);
      if (selectedEndpoint) setSelectedEndpoint(null);
      setIsZoneEditMode(false);
      setIsEndpointEditMode(false);
      return;
    }

    const pt = getSvgPointFromClient(e.clientX, e.clientY);
    const svgX = pt.x;
    const svgY = pt.y;

    // Chi tiep nhan click trong pham vi sanh (X 50..950, Y 40..580 chuan 10m x 6m)
    if (svgX < 50 || svgX > 950 || svgY < 40 || svgY > 580) return;

    const meter = svgToMeter(svgX, svgY);

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

  return {
    batteryGuard,
    batteryStatusText,
    handleStartSim,
    handlePauseSim,
    handleStopSim,
    handleNextStep,
    handleReset,
    handleMapClick,
    handleDispatchToRobot,
  };
}
