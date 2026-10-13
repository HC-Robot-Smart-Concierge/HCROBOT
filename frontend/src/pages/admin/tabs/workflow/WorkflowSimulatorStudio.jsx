import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
  Compass,
  Radio,
  Send,
  Eye,
  Mic,
  MessageSquare,
  ClipboardList,
  Star,
  Navigation,
  Wifi,
  WifiOff,
  Edit3,
  Check,
} from 'lucide-react';
import { useSpeechSynthesis } from '../../../../hooks/useSpeechSynthesis';
import {
  RosbridgeClient,
  ROS_TOPICS,
  ROS_MSG_TYPES,
  quaternionToYaw,
} from '../../../../services/rosbridgeService';
import { executeWorkflow } from '../../../../services/workflowApi';
import {
  ROBOT_INITIAL_POSE,
  GAZEBO_LOBBY_WAYPOINTS,
  STANDARD_LOBBY_WAYPOINTS,
  meterToSvg,
  svgToMeter,
  calculateSafeWaypoints,
  getStepActionDetail,
  BUILTIN_SIMULATOR_WORKFLOWS,
} from './workflowSimulatorUtils';

export const WorkflowSimulatorStudio = ({
  workflows = [],
  initialWorkflowId = null,
  onClose = null,
  onNotify = () => {},
}) => {
  // Danh sach kich ban hieu luc (co fallback noi bo neu backend chua tra ve hoac loi mang)
  const effectiveWorkflows =
    Array.isArray(workflows) && workflows.length > 0
      ? workflows
      : BUILTIN_SIMULATOR_WORKFLOWS;

  const [localWorkflows, setLocalWorkflows] = useState(() => effectiveWorkflows);

  useEffect(() => {
    if (Array.isArray(workflows) && workflows.length > 0) {
      setLocalWorkflows(workflows);
    }
  }, [workflows]);

  // Chon kich ban
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(() => {
    if (initialWorkflowId) return initialWorkflowId;
    return effectiveWorkflows[0]?.id || 'wf-01-welcome';
  });

  const activeWorkflow =
    localWorkflows.find((w) => w.id === selectedWorkflowId) ||
    localWorkflows[0];
  const steps = activeWorkflow?.steps || [];

  // Che do chinh sua nhanh diem moc cua buoc MOVE ngay tai sa ban
  const [editingStepIdx, setEditingStepIdx] = useState(null);

  const handleUpdateMoveStepWaypoints = (stepIdx, fromKey, toKey) => {
    const targetWp = GAZEBO_LOBBY_WAYPOINTS[toKey] || GAZEBO_LOBBY_WAYPOINTS.FRONT_DESK;
    const fromWp = fromKey === 'CURRENT' ? null : GAZEBO_LOBBY_WAYPOINTS[fromKey];

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
  });

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
    handleNavigateToGoal(meter.x, meter.y, `${meter.x}m, ${meter.y}m`);
  };

  const handleDispatchToKiosk = async () => {
    try {
      await executeWorkflow(selectedWorkflowId);
      onNotify('Đã phát lệnh kích hoạt kịch bản tới Robot Kiosk thành công.', 'success');
    } catch {
      onNotify('Kích hoạt kịch bản tới Kiosk (Chế độ mô phỏng nội bộ).', 'info');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-75px)] w-full overflow-hidden select-none" style={{ backgroundColor: '#F2EFE9' }}>
      {/* THANH DIEU KHIEN CHINH - Đồng bộ màu xám #E9E5DC của Sidebar trái */}
      <div
        className="h-14 px-4 border-b flex items-center justify-between gap-4 shrink-0"
        style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#262626] animate-pulse" />
            <span className="font-bold text-xs uppercase tracking-wider text-[#262626] hidden sm:inline">
              Gia Lap
            </span>
            {/* NUT BAT / TAT KET NOI ROS 2 (PORT 9090) */}
            <button
              type="button"
              onClick={() => {
                const nextState = !isRosEnabled;
                setIsRosEnabled(nextState);
                if (nextState) {
                  onNotify('Đang kích hoạt kết nối ROS 2 (port 9090)...', 'info');
                } else {
                  onNotify('Đã ngắt kết nối ROS 2. Chuyển sang chế độ Giả lập thuần Web.', 'info');
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border transition-all cursor-pointer shadow-xs ${
                isRosEnabled
                  ? isRosConnected
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  : 'text-[#262626] hover:bg-[#BFBFBD]'
              }`}
              style={!isRosEnabled ? { backgroundColor: '#F2EFE9', borderColor: '#BFBFBD' } : {}}
              title={
                isRosEnabled
                  ? isRosConnected
                    ? 'ROS 2 đang ONLINE (Click để ngắt kết nối và chạy giả lập Web)'
                    : 'Đang đợi ROS 2 port 9090 (Click để tắt và chạy giả lập Web)'
                  : 'Đang ở chế độ Giả lập thuần Web (Click để bật lại kết nối ROS 2 port 9090)'
              }
            >
              {isRosEnabled ? (
                <>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isRosConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  <span>{isRosConnected ? 'ROS 2: ONLINE' : 'ROS 2: CONNECTING'}</span>
                  <span className="text-[9px] font-sans font-normal opacity-70 border-l border-current/30 pl-1 ml-0.5">
                    Tắt ROS
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-[#8C8C8C]" />
                  <span>GIẢ LẬP WEB</span>
                  <span
                    className="text-[9px] font-sans font-semibold px-1 py-0.2 rounded border ml-0.5"
                    style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
                  >
                    Bật ROS
                  </span>
                </>
              )}
            </button>
          </div>

          <select
            value={selectedWorkflowId}
            onChange={(e) => {
              handleStopSim();
              setSelectedWorkflowId(e.target.value);
            }}
            className="h-8 px-2.5 rounded-lg border text-xs font-bold shadow-xs focus:outline-none max-w-[280px] sm:max-w-[340px] truncate cursor-pointer"
            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
          >
            {effectiveWorkflows.map((wf) => (
              <option key={wf.id} value={wf.id}>
                {wf.name}
              </option>
            ))}
          </select>
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
            onClick={handleDispatchToKiosk}
            className="h-8 px-3 rounded-lg text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer shrink-0 hover:bg-[#363636]"
            style={{ backgroundColor: '#262626' }}
            title="Phat kich ban nay toi man hinh Robot Kiosk"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Phat Toi Kiosk</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded-lg border text-xs font-bold cursor-pointer shadow-xs hover:bg-[#FAF8F5]"
              style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
            >
              Dong
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

              <p className="text-[11px] font-medium leading-snug line-clamp-2" style={{ color: '#262626' }} title={activeDetail.detailText}>
                {activeDetail.detailText}
              </p>
            </div>
          </div>

          {/* Danh sach cac buoc xep doc (Vertical Timeline) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
            {steps.map((step, idx) => {
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
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold tracking-wider border"
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

                    <p
                      className="text-[10px] leading-relaxed line-clamp-2"
                      style={{ color: '#8C8C8C' }}
                      title={stepDetail.detailText}
                    >
                      {stepDetail.detailText}
                    </p>

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
                            {STANDARD_LOBBY_WAYPOINTS.map((wp) => (
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
                            {STANDARD_LOBBY_WAYPOINTS.map((wp) => (
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
            })}
          </div>
        </aside>

        {/* COT PHAI: TOAN BO KHONG GIAN SA BAN 2D SANH GROUND FLOOR */}
        <main
          className="flex-1 min-w-0 h-full relative p-2 flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: '#F2EFE9' }}
        >
        {/* Thanh huong dan dieu huong truc quan */}
        <div
          className="absolute top-3 right-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-xs text-xs font-medium pointer-events-none select-none backdrop-blur-xs"
          style={{ backgroundColor: '#E9E5DC', borderColor: '#BFBFBD', color: '#262626' }}
        >
          <Navigation className="w-3.5 h-3.5 text-[#8C8C8C]" />
          <span>Click điểm mốc hoặc vị trí sàn để robot di chuyển tới đó</span>
          <span
            className="font-mono font-bold px-1.5 py-0.5 rounded border ml-1"
            style={{ backgroundColor: '#F2EFE9', borderColor: '#BFBFBD', color: '#262626' }}
          >
            ({robotPose.x}m, {robotPose.y}m)
          </span>
        </div>

        <svg
          ref={svgRef}
          viewBox="0 0 1000 620"
          onClick={handleMapClick}
          className="w-full h-full object-contain select-none cursor-crosshair"
        >
          <defs>
            <pattern id="blueprintDots" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="#BFBFBD" />
            </pattern>
          </defs>

          {/* Nen san co luoi cham */}
          <rect x="0" y="0" width="1000" height="620" fill="#F2EFE9" />
          <rect x="50" y="50" width="900" height="500" fill="url(#blueprintDots)" />

          <text x="50" y="36" className="text-xs font-mono font-bold tracking-widest uppercase" fill="#8C8C8C" fontFamily="sans-serif">
            Mặt bằng sảnh khách sạn • 10m x 6m
          </text>

          {/* MAT BANG KIEN TRUC SANH TANG TRET (ARCHITECTURAL VECTOR BLUEPRINT 10M x 6M) */}
          {/* 1. KHUNG TUONG BAO NGOAI (OUTER WALLS: X 50..950, Y 50..550) */}
          <rect
            x="50"
            y="50"
            width="900"
            height="500"
            fill="#FFFFFF"
            stroke="#262626"
            strokeWidth="3.5"
          />

          {/* 2. VACH NGAN CHIA SANH (X = 446 ~ 4.4m) KEM CUA MO 1 CANH */}
          {/* Vach Bac (Y 50 den 265) */}
          <line x1="446" y1="50" x2="446" y2="265" stroke="#1c1917" strokeWidth="3" />
          {/* Cua mo 1 canh xoay ve phia Gian Trai (Lobby) */}
          <line x1="446" y1="335" x2="376" y2="335" stroke="#1c1917" strokeWidth="2.5" />
          <path
            d="M 446 265 A 70 70 0 0 0 376 335"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          {/* Vach Nam (Y 335 den 550) */}
          <line x1="446" y1="335" x2="446" y2="550" stroke="#1c1917" strokeWidth="3" />

          {/* 3. GIAN TRAI: 3 BO SOFA VA BAN TRA HINH VIEN THUOC DOC TUONG TAY */}
          {/* Sofa 1 (Tren) */}
          <g>
            <rect x="54" y="90" width="28" height="95" rx="3" fill="#ffffff" stroke="#1c1917" strokeWidth="2" />
            <line x1="54" y1="122" x2="82" y2="122" stroke="#64748b" strokeWidth="1" />
            <line x1="54" y1="154" x2="82" y2="154" stroke="#64748b" strokeWidth="1" />
            {/* Ban vien thuoc 1 */}
            <rect x="115" y="85" width="36" height="105" rx="18" fill="#ffffff" stroke="#1c1917" strokeWidth="2.5" />
          </g>

          {/* Sofa 2 (Giua) */}
          <g>
            <rect x="54" y="250" width="28" height="95" rx="3" fill="#ffffff" stroke="#1c1917" strokeWidth="2" />
            <line x1="54" y1="282" x2="82" y2="282" stroke="#64748b" strokeWidth="1" />
            <line x1="54" y1="314" x2="82" y2="314" stroke="#64748b" strokeWidth="1" />
            {/* Ban vien thuoc 2 */}
            <rect x="115" y="245" width="36" height="105" rx="18" fill="#ffffff" stroke="#1c1917" strokeWidth="2.5" />
          </g>

          {/* Chu Lobby o giua Gian Trai (Dung nhu hinh cua ong chu) */}
          <text
            x="225"
            y="305"
            textAnchor="middle"
            className="text-base font-bold fill-stone-900"
            fontFamily="sans-serif"
          >
            Lobby
          </text>

          {/* Sofa 3 (Duoi) */}
          <g>
            <rect x="54" y="410" width="28" height="95" rx="3" fill="#ffffff" stroke="#1c1917" strokeWidth="2" />
            <line x1="54" y1="442" x2="82" y2="442" stroke="#64748b" strokeWidth="1" />
            <line x1="54" y1="474" x2="82" y2="474" stroke="#64748b" strokeWidth="1" />
            {/* Ban vien thuoc 3 */}
            <rect x="115" y="405" width="36" height="105" rx="18" fill="#ffffff" stroke="#1c1917" strokeWidth="2.5" />
          </g>

          {/* 4. GIAN PHAI - PHIA NAM: CUA CHINH, FRONT DESK, STAFF ONLY */}
          {/* Cua Chinh (Main Entrance: mo 2 canh sat vach ngan o tuong Nam) */}
          <g>
            {/* Khoang mo cua tuong */}
            <rect x="485" y="546" width="70" height="8" fill="#ffffff" />
            {/* Canh cua trai mo xoay vao trong */}
            <line x1="485" y1="550" x2="520" y2="520" stroke="#1c1917" strokeWidth="2" />
            <path d="M 520 520 A 42 42 0 0 1 520 550" fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="2 2" />
            {/* Canh cua phai mo xoay vao trong */}
            <line x1="555" y1="550" x2="520" y2="520" stroke="#1c1917" strokeWidth="2" />
            <path d="M 520 520 A 42 42 0 0 0 520 550" fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="2 2" />
          </g>

          {/* Quay Tiep Tan (Front Desk: khoi chu nhat dung o giua) */}
          <g>
            <rect x="600" y="295" width="95" height="255" fill="#ffffff" stroke="#1c1917" strokeWidth="3" />
            <text x="647" y="420" textAnchor="middle" className="text-sm font-bold fill-stone-900" fontFamily="sans-serif">
              Front
            </text>
            <text x="647" y="442" textAnchor="middle" className="text-sm font-bold fill-stone-900" fontFamily="sans-serif">
              Desk
            </text>
          </g>

          {/* Phong Staff Only (Goc Dong Nam) */}
          <g>
            {/* Vach ngang phia Bac */}
            <line x1="805" y1="295" x2="950" y2="295" stroke="#1c1917" strokeWidth="3" />
            {/* Vach dung phia Tay (Chua khe cua mo tu y=295 den y=355) */}
            <line x1="805" y1="355" x2="805" y2="550" stroke="#1c1917" strokeWidth="3" />
            {/* Cua mo 1 canh xoay vao trong phong Staff Only */}
            <line x1="805" y1="355" x2="865" y2="355" stroke="#1c1917" strokeWidth="2" />
            <path d="M 805 295 A 60 60 0 0 1 865 355" fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="2 2" />
            <text x="878" y="445" textAnchor="middle" className="text-sm font-bold fill-stone-900" fontFamily="sans-serif">
              Staff Only
            </text>
          </g>

          {/* 5. GIAN PHAI - PHIA BAC: DAY 3 PHONG (WC, THANG MAY, CAU THANG) */}
          <rect x="610" y="50" width="340" height="120" fill="#ffffff" stroke="#1c1917" strokeWidth="3" />
          {/* Vach ngan giua WC va Thang May */}
          <line x1="745" y1="50" x2="745" y2="170" stroke="#1c1917" strokeWidth="2.5" />
          {/* Vach ngan giua Thang May va Cau Thang */}
          <line x1="850" y1="50" x2="850" y2="170" stroke="#1c1917" strokeWidth="2.5" />

          {/* (1) Nha Ve Sinh (Restrooms) - Icon Pictogram Nam / Nu Den */}
          <g>
            {/* Nam */}
            <circle cx="654" cy="82" r="7" fill="#1c1917" />
            <path d="M 645 93 L 663 93 L 663 125 L 658 125 L 658 152 L 650 152 L 650 125 L 645 125 Z" fill="#1c1917" />
            {/* Nu */}
            <circle cx="702" cy="82" r="7" fill="#1c1917" />
            <path d="M 693 93 L 711 93 L 718 125 L 708 125 L 708 152 L 703 152 L 703 125 L 699 125 L 699 152 L 694 152 L 694 125 L 686 125 Z" fill="#1c1917" />
          </g>

          {/* (2) Cum Thang May (Elevator) */}
          <g>
            <rect x="768" y="70" width="64" height="80" fill="none" stroke="#1c1917" strokeWidth="2.5" />
            <line x1="800" y1="70" x2="800" y2="150" stroke="#1c1917" strokeWidth="2" />
            <line x1="794" y1="105" x2="794" y2="115" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />
            <line x1="806" y1="105" x2="806" y2="115" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />
            {/* Mui ten len / xuong */}
            <path d="M 788 95 L 788 80 M 784 84 L 788 80 L 792 84" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 812 80 L 812 95 M 808 91 L 812 95 L 816 91" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          {/* (3) Cau Thang Bo (Stairs) */}
          <g>
            <line x1="900" y1="50" x2="900" y2="170" stroke="#1c1917" strokeWidth="2" />
            {[65, 80, 95, 110, 125, 140, 155].map((sy) => (
              <g key={sy}>
                <line x1="855" y1={sy} x2="896" y2={sy} stroke="#64748b" strokeWidth="1.5" />
                <line x1="904" y1={sy} x2="945" y2={sy} stroke="#64748b" strokeWidth="1.5" />
              </g>
            ))}
          </g>

          {/* CAC DIEM MOC WAYPOINTS TREN SA BAN - CHU THICH TINH GON, PHONG CACH KI THUAT TOI GIAN */}
          {Object.entries(GAZEBO_LOBBY_WAYPOINTS)
            .filter(([k]) =>
              [
                'MAIN_ENTRANCE',
                'FRONT_DESK',
                'ELEVATOR',
                'RESTROOMS',
                'STAIRS',
                'STAFF_ONLY',
                'LOBBY_LOUNGE',
              ].includes(k)
            )
            .map(([k, wp]) => {
              const wpSvg = meterToSvg(wp.x, wp.y);
              const isTarget =
                currentPath?.targetPoint &&
                Math.abs(currentPath.targetPoint.x - wp.x) < 0.25 &&
                Math.abs(currentPath.targetPoint.y - wp.y) < 0.25;

              // Các tiện ích: Cửa chính, Quầy lễ tân, Thang máy, WC, Cầu thang, Phòng NV, Sofa sảnh
              const badgeText = wp.badge || wp.name || k;
              const badgeWidth = Math.max(64, badgeText.length * 7.2 + 14);
              const isTopOffset = wp.offset === 'top';
              const badgeOffsetY = isTopOffset ? -15 : 16;

              return (
                <g
                  key={k}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigateToGoal(wp.x, wp.y, badgeText);
                  }}
                  className="cursor-pointer group select-none"
                >
                  {/* Diem endpoint reticle ky thuat kep */}
                  <circle
                    cx={wpSvg.x}
                    cy={wpSvg.y}
                    r={isTarget ? 7 : 5}
                    fill={isTarget ? '#18181b' : '#ffffff'}
                    stroke={isTarget ? '#18181b' : '#52525b'}
                    strokeWidth={isTarget ? '2' : '1.5'}
                    className="group-hover:stroke-stone-900 group-hover:scale-110 transition-transform"
                  />
                  <circle
                    cx={wpSvg.x}
                    cy={wpSvg.y}
                    r={isTarget ? 2.5 : 2}
                    fill={isTarget ? '#ffffff' : '#18181b'}
                  />

                  {/* Nhan chu thich endpoint: nen trang xam toi gian, chu ro net */}
                  <g transform={`translate(${wpSvg.x}, ${wpSvg.y + badgeOffsetY})`}>
                    <rect
                      x={-badgeWidth / 2}
                      y="-8"
                      width={badgeWidth}
                      height="16"
                      rx="3"
                      fill={isTarget ? '#262626' : '#E9E5DC'}
                      stroke={isTarget ? '#262626' : '#BFBFBD'}
                      strokeWidth="1"
                      filter="drop-shadow(0 1px 2px rgba(0,0,0,0.06))"
                      className="group-hover:stroke-[#262626] group-hover:fill-white transition-colors"
                    />
                    <text
                      x="0"
                      y="3.2"
                      textAnchor="middle"
                      fill={isTarget ? '#ffffff' : '#262626'}
                      className="text-[9px] font-semibold tracking-tight transition-colors"
                      fontFamily="sans-serif"
                    >
                      {badgeText}
                    </text>
                  </g>
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

                {/* 2. Vet duong robot da lan banh qua toi vi tri hien tai */}
                <line
                  x1={meterToSvg(currentPath.waypoints[0].x, currentPath.waypoints[0].y).x}
                  y1={meterToSvg(currentPath.waypoints[0].x, currentPath.waypoints[0].y).y}
                  x2={curSvg.x}
                  y2={curSvg.y}
                  stroke="#18181b"
                  strokeWidth="3.5"
                  strokeLinecap="round"
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
                {/* BONG BONG ACTION HUD TREN DAU ROBOT (TRANG - XAM TOI GIAN) */}
                <g transform="translate(0, -40)">
                  {/* Card nen trang, vien xam tinh te */}
                  <rect
                    x="-105"
                    y="-30"
                    width="210"
                    height="34"
                    rx="6"
                    fill="#ffffff"
                    stroke="#cbd5e1"
                    strokeWidth="1.2"
                    filter="drop-shadow(0 3px 6px rgba(0,0,0,0.08))"
                  />
                  {/* Mui ten tro xuong robot */}
                  <polygon points="-6,4 6,4 0,10" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" />
                  <line x1="-5" y1="4" x2="5" y2="4" stroke="#ffffff" strokeWidth="2" />

                  {/* Badge Enum phan loai buoc */}
                  <rect
                    x="-97"
                    y="-25"
                    width="44"
                    height="14"
                    rx="3"
                    fill="#f1f5f9"
                    stroke="#e2e8f0"
                    strokeWidth="0.8"
                  />
                  <text
                    x="-75"
                    y="-15"
                    textAnchor="middle"
                    className="text-[8.5px] font-mono font-bold fill-stone-700"
                  >
                    {activeDetail.label}
                  </text>

                  {/* Tieu de ngan */}
                  <text
                    x="-45"
                    y="-15"
                    className="text-[8.5px] font-sans font-bold fill-stone-500 uppercase tracking-wider"
                  >
                    {activeDetail.bubbleTitle}
                  </text>

                  {/* Noi dung thuc te buoc */}
                  <text
                    x="0"
                    y="-3"
                    textAnchor="middle"
                    className="text-[9.5px] font-sans font-bold fill-stone-900 truncate"
                  >
                    {activeDetail.bubbleBody.length > 36
                      ? activeDetail.bubbleBody.slice(0, 34) + '...'
                      : activeDetail.bubbleBody}
                  </text>
                </g>

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
      </main>
    </div>
  </div>
);
};

export default WorkflowSimulatorStudio;
