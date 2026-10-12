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
  Sparkles,
  ClipboardList,
  Star,
  Navigation,
  Wifi,
  WifiOff,
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

  // Chon kich ban
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(() => {
    if (initialWorkflowId) return initialWorkflowId;
    return effectiveWorkflows[0]?.id || 'wf-01-welcome';
  });

  const activeWorkflow =
    effectiveWorkflows.find((w) => w.id === selectedWorkflowId) ||
    effectiveWorkflows[0];
  const steps = activeWorkflow?.steps || [];

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

    const client = new RosbridgeClient('ws://localhost:9090', {
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
    (targetX, targetY, targetName = 'Điểm đã chọn', fromWorkflow = false) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (stopSpeakingRef.current) stopSpeakingRef.current();

      const startPoint = { x: robotPoseRef.current.x, y: robotPoseRef.current.y };
      const goalPoint = { x: Number(targetX.toFixed(2)), y: Number(targetY.toFixed(2)) };

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
      const wpName = params.waypoint_name || params.target_value || 'Diem den';

      if (isNaN(targetX) || isNaN(targetY)) {
        const wp = GAZEBO_LOBBY_WAYPOINTS[params.target_value] || GAZEBO_LOBBY_WAYPOINTS.ROBOT_STANDBY;
        targetX = wp?.x ?? 8.2;
        targetY = wp?.y ?? 3.6;
      }

      handleNavigateToGoal(targetX, targetY, wpName, true);
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
    <div className="flex flex-col h-[calc(100vh-75px)] w-full bg-[#f4f2ee] overflow-hidden select-none">
      {/* THANH DIEU KHIEN CHINH (h-14 shrink-0) */}
      <div className="h-14 px-4 bg-[#D9D5CC] border-b border-[#BFBFBD] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-800 animate-pulse" />
            <span className="font-bold text-xs uppercase tracking-wider text-stone-900 hidden sm:inline">
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
                  : 'bg-stone-200 text-stone-700 border-stone-300 hover:bg-stone-300'
              }`}
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
                  <WifiOff className="w-3 h-3 text-stone-500" />
                  <span>GIẢ LẬP WEB</span>
                  <span className="text-[9px] font-sans font-semibold text-cyan-800 bg-cyan-100 px-1 py-0.2 rounded border border-cyan-300 ml-0.5">
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
            className="h-8 px-2.5 rounded-lg border border-stone-400 bg-white text-xs font-bold text-stone-800 shadow-xs focus:outline-none focus:ring-1 focus:ring-cyan-600 max-w-[280px] sm:max-w-[340px] truncate cursor-pointer"
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
              className="h-8 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Chay</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handlePauseSim}
                className="h-8 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
              >
                {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{isPaused ? 'Tiep' : 'Dung'}</span>
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="h-8 px-2.5 rounded-lg bg-stone-700 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                title="Chuyen buoc tiep theo"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleStopSim}
                className="h-8 px-2.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                title="Huy kich ban"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="h-8 px-2.5 rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
            title="Ve vi tri tram cho sảnh"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Toc do mo phong */}
          <div className="hidden lg:flex items-center bg-white border border-stone-300 rounded-lg p-0.5 shadow-xs">
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSimSpeed(spd)}
                className={`px-2 py-0.5 text-[11px] font-bold rounded cursor-pointer ${
                  simSpeed === spd ? 'bg-cyan-700 text-white' : 'text-stone-600 hover:bg-stone-100'
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
                : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100'
            }`}
            title={isMuted ? 'Bat tieng noi' : 'Tat tieng noi'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleDispatchToKiosk}
            className="h-8 px-3 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer shrink-0"
            title="Phat kich ban nay toi man hinh Robot Kiosk"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Phat Toi Kiosk</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded-lg bg-[#262626] text-white text-xs font-bold hover:bg-stone-800 cursor-pointer"
            >
              Dong
            </button>
          )}
        </div>
      </div>

      {/* KHONG GIAN CHINH CHIA 2 COT: SIDEBAR STEPS BEN TRAI VA SA BAN BEN PHAI */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* COT TRAI: DANH SACH CAC BUOC WORKFLOW XEP DOC (w-72 sm:w-80 shrink-0) */}
        <aside className="w-72 sm:w-80 bg-[#ECE8E1] border-r border-[#BFBFBD] flex flex-col shrink-0 overflow-hidden">
          {/* Header Sidebar: Trang thai buoc hien tai & Tien do */}
          <div className="p-3 bg-[#E2DED5] border-b border-[#BFBFBD] shrink-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-cyan-800" />
                <span>Tiến trình kịch bản</span>
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-stone-200/90 text-stone-700 border border-stone-300">
                {steps.length} bước
              </span>
            </div>

            {/* Card trang thai buoc dang thuc thi */}
            <div className="p-2.5 rounded-xl bg-white border border-stone-300 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-stone-500 uppercase">
                    {isPlaying ? `Bước ${currentStepIndex + 1}/${steps.length}` : 'Trạng thái'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black font-mono bg-cyan-800 text-white shadow-xs tracking-wider">
                    {activeDetail.label}
                  </span>
                </div>
                {isPlaying && (
                  <span className="text-xs font-mono font-black text-cyan-800">
                    {stepProgress}%
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {isPlaying && (
                <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mb-1.5 border border-stone-200">
                  <div
                    className="h-full bg-cyan-700 transition-all duration-150 rounded-full"
                    style={{ width: `${stepProgress}%` }}
                  />
                </div>
              )}

              <p className="text-[11px] text-stone-700 font-medium leading-snug line-clamp-2" title={activeDetail.detailText}>
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
                  className={`p-2.5 rounded-xl border transition-all flex items-start gap-2.5 select-none ${
                    isActive
                      ? 'bg-white border-cyan-600 shadow-md ring-2 ring-cyan-500/30'
                      : isPast
                      ? 'bg-[#E3EFE7] border-emerald-300 text-emerald-950'
                      : 'bg-white/70 border-stone-300 hover:bg-white text-stone-700'
                  }`}
                >
                  {/* Badge so thu tu tron */}
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shrink-0 mt-0.5 ${
                      isActive
                        ? 'bg-cyan-800 text-white ring-2 ring-cyan-400'
                        : isPast
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {idx + 1}
                  </div>

                  {/* Noi dung buoc */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold tracking-wider ${
                          isActive
                            ? 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                            : isPast
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-stone-100 text-stone-600 border border-stone-200'
                        }`}
                      >
                        {stepDetail.label}
                      </span>
                      <span
                        className={`text-[11px] font-bold truncate ${
                          isActive ? 'text-cyan-950' : isPast ? 'text-emerald-900' : 'text-stone-800'
                        }`}
                        title={step.title || stepDetail.shortChip}
                      >
                        {step.title || stepDetail.shortChip}
                      </span>
                    </div>

                    <p
                      className={`text-[10px] leading-relaxed line-clamp-2 ${
                        isActive ? 'text-stone-700 font-medium' : isPast ? 'text-stone-600' : 'text-stone-500'
                      }`}
                      title={stepDetail.detailText}
                    >
                      {stepDetail.detailText}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* COT PHAI: TOAN BO KHONG GIAN SA BAN 2D SANH GROUND FLOOR */}
        <main className="flex-1 min-w-0 h-full relative bg-white p-2 flex items-center justify-center overflow-hidden">
        {/* Thanh huong dan dieu huong truc quan */}
        <div className="absolute top-3 right-4 z-10 flex items-center gap-2 bg-stone-900/85 backdrop-blur-xs text-white px-3 py-1.5 rounded-lg border border-cyan-500/40 shadow-sm text-xs font-semibold pointer-events-none select-none">
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>Click điểm mốc hoặc vị trí sàn để robot di chuyển tới đó</span>
          <span className="text-cyan-400 font-mono ml-1">
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
              <circle cx="2" cy="2" r="1.2" fill="#cbd5e1" />
            </pattern>
          </defs>

          {/* Nen san co luoi cham */}
          <rect x="0" y="0" width="1000" height="620" fill="#fdfbf7" />
          <rect x="50" y="50" width="900" height="500" fill="url(#blueprintDots)" />

          <text x="50" y="38" className="text-xl font-black fill-stone-900" fontFamily="sans-serif">
            Ground Floor - Hotel Lobby Arena (10m x 6m)
          </text>

          {/* MAT BANG KIEN TRUC SANH TANG TRET (ARCHITECTURAL VECTOR BLUEPRINT 10M x 6M) */}
          {/* 1. KHUNG TUONG BAO NGOAI (OUTER WALLS: X 50..950, Y 50..550) */}
          <rect
            x="50"
            y="50"
            width="900"
            height="500"
            fill="#ffffff"
            stroke="#1c1917"
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
            {/* Vach dung va vach ngang */}
            <line x1="805" y1="295" x2="805" y2="550" stroke="#1c1917" strokeWidth="3" />
            <line x1="805" y1="295" x2="950" y2="295" stroke="#1c1917" strokeWidth="3" />
            {/* Cua mo 1 canh xoay vao trong phong Staff Only */}
            <line x1="805" y1="345" x2="865" y2="345" stroke="#1c1917" strokeWidth="2" />
            <path d="M 805 295 A 50 50 0 0 1 865 345" fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="2 2" />
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

          {/* CAC DIEM MOC WAYPOINTS TREN SA BAN - KHONG CON TRAM SAC ROBOT, HO TRO CLICK-TO-NAVIGATE */}
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
              const badgeWidth = Math.max(68, badgeText.length * 7.5 + 16);
              const isTopOffset = wp.offset === 'top';
              const badgeOffsetY = isTopOffset ? -16 : 18;

              return (
                <g
                  key={k}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigateToGoal(wp.x, wp.y, badgeText);
                  }}
                  className="cursor-pointer group select-none"
                >
                  {/* Chấm tròn tọa độ tĩnh (hover phát sáng) */}
                  <circle
                    cx={wpSvg.x}
                    cy={wpSvg.y}
                    r={isTarget ? 9 : 6.5}
                    fill={isTarget ? '#0284c7' : '#334155'}
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="group-hover:fill-sky-500 transition-colors"
                  />

                  {/* Pill badge hiển thị tên gọn gàng, thanh lịch */}
                  <g transform={`translate(${wpSvg.x}, ${wpSvg.y + badgeOffsetY})`}>
                    <rect
                      x={-badgeWidth / 2}
                      y="-8.5"
                      width={badgeWidth}
                      height="17"
                      rx="4"
                      fill={isTarget ? '#0284c7' : '#ffffff'}
                      stroke={isTarget ? '#0284c7' : '#94a3b8'}
                      strokeWidth={isTarget ? '1.5' : '1'}
                      filter="drop-shadow(0 1px 2px rgba(0,0,0,0.08))"
                      className="group-hover:stroke-sky-500 group-hover:fill-sky-50 transition-colors"
                    />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      fill={isTarget ? '#ffffff' : '#0f172a'}
                      className={`text-[9px] font-bold ${isTarget ? 'font-black' : ''} group-hover:fill-sky-600 transition-colors`}
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
            const labelWidth = Math.max(90, targetLabel.length * 8 + 20);

            return (
              <g>
                {/* 1. Duong dan huong ne tuong (Polyline uon quanh qua cua mo) */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="3.5"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.65"
                />

                {/* 2. Vet duong robot da lan banh qua toi vi tri hien tai */}
                <line
                  x1={meterToSvg(currentPath.waypoints[0].x, currentPath.waypoints[0].y).x}
                  y1={meterToSvg(currentPath.waypoints[0].x, currentPath.waypoints[0].y).y}
                  x2={curSvg.x}
                  y2={curSvg.y}
                  stroke="#06b6d4"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />

                {/* 3. Vong tron dich den tinh gon gang */}
                <g>
                  <circle
                    cx={targetSvg.x}
                    cy={targetSvg.y}
                    r="13"
                    fill="rgba(2, 132, 199, 0.2)"
                    stroke="#0284c7"
                    strokeWidth="2"
                  />
                  <g transform={`translate(${targetSvg.x}, ${targetSvg.y - 20})`}>
                    <rect
                      x={-labelWidth / 2}
                      y="-9"
                      width={labelWidth}
                      height="18"
                      rx="4"
                      fill="#0369a1"
                      stroke="#38bdf8"
                      strokeWidth="1.2"
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"
                    />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      className="text-[9.5px] font-black fill-white"
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
                {/* BONG BONG ACTION HUD GIAI NGHIA ENUM TREN DAU ROBOT */}
                <g transform="translate(0, -42)">
                  {/* Nen card HUD bo goc */}
                  <rect
                    x="-110"
                    y="-30"
                    width="220"
                    height="36"
                    rx="8"
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    filter="drop-shadow(0 4px 6px rgba(0,0,0,0.25))"
                  />
                  {/* Mui ten tro xuong robot */}
                  <polygon points="-6,6 6,6 0,12" fill="#0f172a" />

                  {/* Header Enum badge */}
                  <text
                    x="-100"
                    y="-15"
                    className="text-[10px] font-mono font-black fill-cyan-400"
                  >
                    [{activeDetail.label}]
                  </text>

                  {/* Tieu de ngan */}
                  <text
                    x="-40"
                    y="-15"
                    className="text-[9px] font-sans font-bold fill-stone-300 uppercase tracking-wider"
                  >
                    {activeDetail.bubbleTitle}
                  </text>

                  {/* Noi dung thuc te (Show gi, noi gi, den dau) */}
                  <text
                    x="0"
                    y="-1"
                    textAnchor="middle"
                    className="text-[10px] font-sans font-semibold fill-white truncate"
                  >
                    {activeDetail.bubbleBody.length > 36
                      ? activeDetail.bubbleBody.slice(0, 34) + '...'
                      : activeDetail.bubbleBody}
                  </text>
                </g>

                {/* Xe Robot hinh chu nhat mo phong 1:1 theo Gazebo (Than vang cam, LiDAR cyan, banh xe 2 ben) */}
                <g transform={`rotate(${svgAngle})`}>
                  {/* Vong quet LiDAR an toan mo rong */}
                  <rect
                    x="-18"
                    y="-16"
                    width="36"
                    height="32"
                    rx="8"
                    fill="rgba(245, 158, 11, 0.15)"
                    stroke="#f59e0b"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />

                  {/* 2 Banh xe mau xam den o 2 ben hong xe */}
                  <rect x="-8" y="-15" width="16" height="4.5" rx="1.5" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                  <rect x="-8" y="10.5" width="16" height="4.5" rx="1.5" fill="#1e293b" stroke="#334155" strokeWidth="1" />

                  {/* Than xe hinh chu nhat mau cam vang dac trung giong Gazebo */}
                  <rect
                    x="-14"
                    y="-12"
                    width="28"
                    height="24"
                    rx="4"
                    fill="#f59e0b"
                    stroke="#d97706"
                    strokeWidth="2"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))"
                  />

                  {/* Cam bien LiDAR hinh tru tron mau cyan tren noc phia sau */}
                  <circle cx="-6" cy="0" r="5" fill="#06b6d4" stroke="#0891b2" strokeWidth="1.2" />
                  <circle cx="-6" cy="0" r="2" fill="#ffffff" />

                  {/* 2 Mat robot phat sang mau cyan o mat truoc (+X) */}
                  <circle cx="10" cy="-5" r="2.2" fill="#06b6d4" stroke="#ffffff" strokeWidth="0.8" />
                  <circle cx="10" cy="5" r="2.2" fill="#06b6d4" stroke="#ffffff" strokeWidth="0.8" />

                  {/* Mui ten dinh huong tien phia truoc */}
                  <polygon points="17,0 12,-4 12,4" fill="#d97706" />
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
