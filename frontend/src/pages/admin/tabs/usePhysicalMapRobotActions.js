import { useEffect, useRef } from 'react';
import {
  ROS_TOPICS,
  ROS_MSG_TYPES,
  createInitialPoseMsg,
} from '../../../services/rosbridgeService';
import {
  localizationFromManager,
  navigationBlockingReason,
  obstacleClearanceAt,
  sendNav2Endpoint,
  TURN_CLEARANCE_M,
} from './physicalMapNavigation';
import { endpointZoneViolation } from './physicalMapZones';

export function usePhysicalMapRobotActions({
  connectionMode, deleteZoneVertexRef, dockEndpoint, lastGoalSentAtRef, locManagerRef, localizationRef, mapConfig, maxLinearSpeed, nav2Runtime, navigationRef, pi5Ip, robotPose, rosClientRef, setDragState, setInvertHeading, setIsAddEndpointMode, setIsNavigating, setIsPoseSetMode, setIsSettingPose, setLocalizationReady, setNavPath, setNavStatus, setNavigatingEndpointId, setPoseDraft, setSelectedGoal, setSelectedZoneVertex, setTrail, setZoneDraft, setZoneDrawType, speedPercent, zones,
}) {
  // ==========================================
  const handleApplyInitialPose = async (px, py, pyawRad) => {
    setIsSettingPose(true);
    setPoseDraft({ x: px, y: py, yaw: pyawRad });
    setNavStatus(`Đang đặt vị trí ban đầu (${px.toFixed(2)}, ${py.toFixed(2)})...`);

    try {
      if (!rosClientRef.current?.isConnected) throw new Error('Chưa kết nối Nav2. Bật Nav2 với map này trước.');
      if (nav2Runtime.mode !== 'NAVIGATION' || nav2Runtime.activeMap !== mapConfig.mapId) {
        throw new Error('Bật Navigation với đúng map đang chọn trước khi đặt vị trí.');
      }
      rosClientRef.current.publish('/robot/nav_cancel', 'std_msgs/Empty', {});
      localizationRef.current = { mapId: mapConfig.mapId, requestedAt: Date.now(), confirmed: false };
      setLocalizationReady(false);
      const sent = rosClientRef.current.publish(
          ROS_TOPICS.INITIAL_POSE,
          ROS_MSG_TYPES.POSE_WITH_COVARIANCE,
          createInitialPoseMsg(px, py, pyawRad)
        );
      if (!sent) throw new Error('Không gửi được vị trí tới AMCL.');
      setNavStatus(`Đã gửi vị trí (${px.toFixed(2)}, ${py.toFixed(2)}); chờ AMCL khớp LiDAR với map.`);
      setIsNavigating(false);
      setNavPath([]);
      setSelectedGoal(null);
      setNavigatingEndpointId(null);

      // Pose da duoc dat dung huong that => khong can dao dau xe 180° tren giao dien nua
      setInvertHeading(false);
      setTrail([]);
      setIsPoseSetMode(false);
      setPoseDraft(null);
    } catch (err) {
      console.warn('[AdminPhysicalMapTab] Set initial pose error:', err);
      setNavStatus(`Lỗi đặt vị trí ban đầu: ${err.message}`);
    } finally {
      setIsSettingPose(false);
    }
  };

  const handleSetPoseAtDock = () => {
    const dock = dockEndpoint;
    if (!dock) {
      setNavStatus('Map này chưa có điểm Dock. Dùng “Chọn trên map” tại đúng vị trí xe đang đứng.');
      return;
    }
    handleApplyInitialPose(Number(dock.x) || 0, Number(dock.y) || 0, Number(dock.yaw) || 0);
  };

  const handleRelocalize = async () => {
    if (!navigationRef.current.poseAt) {
      setNavStatus('Chưa có vị trí trên map. Dùng “Chọn trên map” để đặt vị trí trước.');
      return;
    }
    await handleApplyInitialPose(robotPose.x, robotPose.y, robotPose.yaw);
  };

  // Every endpoint uses map-frame localization and Nav2's live obstacle costmap.
  // Tra ve true neu da gui goal toi Nav2.
  const handleSendGoal = (gx, gy, gyaw = 0.0) => {
    try {
      // KEEP_OUT: Nav2 da coi la vat can (mask), nhung bao ro ten vung. NO_STOP: chi duoc di
      // ngang qua => khong nhan dich ben trong (Nav2 khong co khai niem "cam dung").
      const zoneReason = endpointZoneViolation({ x: gx, y: gy }, zones);
      if (zoneReason) throw new Error(zoneReason);
      const loc = localizationFromManager(locManagerRef.current.msg, locManagerRef.current.at);
      const navState = {
        runtime: nav2Runtime, mapId: mapConfig.mapId, physical: connectionMode === 'pi5',
        localized: loc.fresh
          ? loc.localized
          : localizationRef.current.confirmed && localizationRef.current.mapId === mapConfig.mapId,
        localizationReason: loc.fresh ? loc.reason : undefined,
        ...navigationRef.current,
      };
      // Bao loi Nav2/dinh vi truoc, roi moi hoi ve cho quay dau (khong hoi xong lai bao loi khac).
      const blocking = navigationBlockingReason({ ...navState, connected: !!rosClientRef.current?.isConnected });
      if (blocking) throw new Error(blocking);
      // Endpoint sat tuong: toi noi xe khong quay dau duoc (Pi chan xoay khi hong < 13 cm) => ket
      // khi di endpoint tiep theo (log 08/11). Hoi truoc; endpoint Dock/tram sac sat tuong van di duoc.
      const clearance = obstacleClearanceAt(navigationRef.current.costmap, gx, gy, TURN_CLEARANCE_M);
      if (clearance < TURN_CLEARANCE_M) {
        const cm = Math.round(clearance * 100);
        const go = window.confirm(
          `Endpoint chỉ cách tường/vật cản khoảng ${cm} cm (cần ≥ ${Math.round(TURN_CLEARANCE_M * 100)} cm để quay đầu).\n\n`
          + 'Xe vẫn tới được, nhưng tới nơi có thể KHÔNG quay đầu được vì Pi chặn xoay khi hông sát vật '
          + '=> dễ kẹt khi đi endpoint tiếp theo.\n\nVẫn đi tới endpoint này?'
        );
        if (!go) {
          throw new Error(`Đã huỷ: endpoint quá sát vật cản (${cm} cm). Dời endpoint ra cách tường ≥ 25 cm (vòng tròn vàng trên map).`);
        }
      }
      sendNav2Endpoint(rosClientRef.current, navState, { x: gx, y: gy, yaw: gyaw }, mapConfig,
        navigationRef.current.costmap);
      lastGoalSentAtRef.current = Date.now();
      setSelectedGoal({ x: gx, y: gy });
      setIsNavigating(true);
      setNavPath([]);
      setNavStatus(`Nav2 đang lập đường tránh vật cản tới (${gx.toFixed(2)}, ${gy.toFixed(2)})...`);
      return true;
    } catch (err) {
      setNavStatus(err.message);
      setIsNavigating(false);
      setSelectedGoal(null);
      setNavigatingEndpointId(null);
      return false;
    }
  };

  // Dieu khien Teleop thu cong
  const physicalTeleopRef = useRef({ timer: null, command: null, deliver: null });
  const deliverTeleopCommand = (commandDirection, linearVel, angularVel) => {
    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publishManualCmdVel(linearVel, angularVel);
      return;
    }
    if (nav2Runtime.mode === 'EXPLORING') {
      setNavStatus('Mất kết nối ROS: chưa thể nhường quyền lái tay. Kết nối lại hoặc dừng tự quét.');
      return;
    }
    if (connectionMode === 'pi5') {
      try {
        // Thanh trượt chỉ áp dụng cho tiến/lùi. Xoay tại chỗ gửi speed=null để
        // Pi dùng TELEOP_PWM_TURN riêng (lidar_service.py).
        const isTurn = commandDirection === 'left' || commandDirection === 'right';
        let speed = speedPercent;
        if (commandDirection === 'stop') speed = 0;
        else if (isTurn) speed = null;
        fetch(`http://${pi5Ip}:8000/api/v1/map/teleop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: commandDirection, speed }),
        });
      } catch (err) {
        console.warn('[AdminPhysicalMapTab] Pi5 teleop error:', err);
      }
      return;
    }

  };
  physicalTeleopRef.current.deliver = deliverTeleopCommand;
  const sendTeleopCommand = (commandDirection, linearVel, angularVel) => {
    const control = physicalTeleopRef.current;
    if (control.timer) clearInterval(control.timer);
    control.timer = null;
    control.command = commandDirection === 'stop' ? null : commandDirection;
    control.deliver(commandDirection, linearVel, angularVel);
    if (control.command) {
      control.timer = setInterval(() => control.deliver(commandDirection, linearVel, angularVel), 100);
    }
  };
  useEffect(() => {
    const release = () => {
      const control = physicalTeleopRef.current;
      if (control.timer) clearInterval(control.timer);
      control.timer = null;
      if (control.command) control.deliver('stop', 0, 0);
      control.command = null;
    };
    window.addEventListener('blur', release);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('blur', release);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      release();
    };
  }, []);

  const handleStop = () => {
    // Che do ROS 2: huy goal Nav2 (bridge goi cancel_goal + gui stop cho Pi); chi /cmd_vel=0
    // thi controller Nav2 van phat lenh va xe chay tiep.
    if (rosClientRef.current?.isConnected) {
      rosClientRef.current.publish('/robot/nav_cancel', 'std_msgs/Empty', {});
    }
    sendTeleopCommand('stop', 0.0, 0.0);
    setIsNavigating(false);
    setSelectedGoal(null);
    setNavigatingEndpointId(null);
    setNavPath([]);
    setNavStatus('Đã dừng khẩn cấp (STOP)');
  };

  // Keyboard controls WASD
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.defaultPrevented) return;
      const key = e.key.toLowerCase();
      if (key === 'escape') {
        setSelectedZoneVertex(null);
        // Huy ve vung dang do dang
        setZoneDrawType(null);
        setZoneDraft(null);
        setIsAddEndpointMode(false);
        setIsPoseSetMode(false);
        setPoseDraft(null);
        setDragState((cur) => (cur?.type === 'ZONE_DRAW' ? null : cur));
        return;
      }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (key === 'delete') {
        if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.isContentEditable
          && !e.target.closest?.('[role="dialog"], [role="textbox"]') && deleteZoneVertexRef.current?.()) {
          e.preventDefault();
        }
        return;
      }
      // Space activates focused popup buttons; it must not also send a motor command.
      if (e.target.closest?.('[role="dialog"]') && [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) return;
      if (key === 'w' || key === 'arrowup') {
        e.preventDefault();
        sendTeleopCommand('forward', maxLinearSpeed, 0.0);
      } else if (key === 's' || key === 'arrowdown') {
        e.preventDefault();
        sendTeleopCommand('backward', -maxLinearSpeed, 0.0);
      } else if (key === 'a' || key === 'arrowleft') {
        e.preventDefault();
        sendTeleopCommand('left', 0.0, 0.5);
      } else if (key === 'd' || key === 'arrowright') {
        e.preventDefault();
        sendTeleopCommand('right', 0.0, -0.5);
      } else if (key === ' ') {
        e.preventDefault();
        handleStop();
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (physicalTeleopRef.current.command && ['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        sendTeleopCommand('stop', 0.0, 0.0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [maxLinearSpeed]);

  return {
    handleApplyInitialPose,
    handleSetPoseAtDock,
    handleRelocalize,
    handleSendGoal,
    sendTeleopCommand,
    handleStop,
  };
}
