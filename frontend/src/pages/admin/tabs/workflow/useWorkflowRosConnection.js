import { useEffect } from 'react';
import {
  RosbridgeClient,
  ROS_TOPICS,
  ROS_MSG_TYPES,
  quaternionToYaw,
} from '../../../../services/rosbridgeService';

/**
 * Connects to rosbridge_websocket for /robot_pose, /odom fallback, and /goal_reached,
 * and smoothly LERP-interpolates Gazebo telemetry onto the 2D floorplan at 60fps.
 */
export function useWorkflowRosConnection({
  isRosEnabled,
  setIsRosConnected,
  rosClientRef,
  targetTelemetryPoseRef,
  robotPoseRef,
  setRobotPose,
  isRosEnabledRef,
  isRosConnectedRef,
  currentPathRef,
  setCurrentPath,
  stepsRef,
  currentStepIndexRef,
  isPlayingRef,
  setStepProgress,
  setManualNavLabel,
  handleStepFinishRef,
}) {
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
            const distRemaining = Math.hypot(
              pos.x - curPath.targetPoint.x,
              pos.y - curPath.targetPoint.y
            );
            const totalDist = curPath.totalDistance || 1.0;
            const progress = Math.max(
              0,
              Math.min(99, Math.round(((totalDist - distRemaining) / totalDist) * 100))
            );
            setStepProgress(progress);

            // Nguong den noi theo tieu chuan vi tri thuc cua Gazebo (0.35m)
            if (distRemaining < 0.35) {
              setStepProgress(100);
              setCurrentPath(null);
              currentPathRef.current = null;
              if (isPlayingRef.current) {
                handleStepFinishRef.current?.();
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
              handleStepFinishRef.current?.();
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
  }, [isRosEnabled]);
}
