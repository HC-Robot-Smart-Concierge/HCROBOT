import { useCallback } from 'react';
import { resolveNextStepIndex } from '../../../../utils/workflowFlow';
import {
  calculateSafeWaypoints,
  getActiveSimulatorZone,
  resolveNoStopPassthrough,
} from './workflowSimulatorUtils';

/**
 * Provides handleStepFinish and handleNavigateToGoal (zone safety checks,
 * obstacle-safe waypoints, ROS goal dispatch, and internal 0.35m/s web animation).
 */
export function useWorkflowNavigation({
  timerRef,
  animFrameRef,
  stopSpeakingRef,
  rosClientRef,
  isRosEnabledRef,
  robotPoseRef,
  setRobotPose,
  zonesRef,
  stepsRef,
  isLoopModeRef,
  simSpeedRef,
  currentPathRef,
  setCurrentPath,
  setStepProgress,
  setCurrentStepIndex,
  setIsPlaying,
  setIsPaused,
  setStepRun,
  setZoneAlert,
  setManualNavLabel,
  onNotify,
}) {
  // Chuyen buoc ke tiep
  // outcome: { type: 'CHOSEN' | 'TIMEOUT' | 'CANCEL', optionId } cho buoc CHOICE; bo trong = xong buoc
  const handleStepFinish = useCallback((outcome) => {
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
        const blockingZone = getActiveSimulatorZone(
          blockedMidpoint.x,
          blockedMidpoint.y,
          zonesRef.current
        );
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
        // Khong chay animation gia lap noi bo de dong bo ti le 1:1 va khong bi giat rung
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

        const activeSeg =
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
          const lastYaw =
            segments.length > 0 ? segments[segments.length - 1].segYaw : robotPoseRef.current.yaw;
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

  return { handleStepFinish, handleNavigateToGoal };
}
