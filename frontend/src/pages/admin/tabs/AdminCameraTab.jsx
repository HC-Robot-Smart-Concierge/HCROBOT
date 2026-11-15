import { RobotManualControls } from '../../../components/admin/RobotManualControls';
import { useRobotControlText } from '../../../context/RobotControlLanguage';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MOTION_CONFIG,
  attachCameraTeleopKeyboard,
  connectWebRtcStream,
  captureVideoSnapshot,
} from './adminCameraUtils';
import { AdminCameraViewPanel, AdminCameraLogsPanel } from './AdminCameraPanels';

const DEFAULT_STREAM_URL = '/api/v1/operations/robot/camera/stream';
const HEALTH_CHECK_INTERVAL_MS = 5000;
// Pi dừng động cơ nếu quá HCROBOT_UDP_CMD_TIMEOUT (mặc định 1.0 s) không có lệnh chạy mới
// (robot/udp_command_watchdog.py) -> phải gửi lại lệnh nhanh hơn ngưỡng đó khi đang giữ phím.
const MOTION_RESEND_INTERVAL_MS = 250;

export const AdminCameraTab = ({ currentUser, active = true, telemetry, emergencyStopVersion = 0, renderWorkspace }) => {
  const rc = useRobotControlText();
  const [streamUrl, setStreamUrl] = useState(
    () => import.meta.env.VITE_PI5_CAMERA_URL || DEFAULT_STREAM_URL
  );
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastHealthCheck, setLastHealthCheck] = useState(null);
  const [streamError, setStreamError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customUrl, setCustomUrl] = useState(streamUrl);
  const [snapshotUrl, setSnapshotUrl] = useState(null);
  const [streamKey, setStreamKey] = useState(() => Date.now());
  const [streamMode, setStreamMode] = useState('webrtc');
  const [webrtcStatus, setWebrtcStatus] = useState('connecting');
  const videoRef = useRef(null);
  const pcRef = useRef(null);

  const reconnectTimeoutRef = useRef(null);

  // Teleop Motion state
  const [activeMotion, setActiveMotion] = useState('stop');
  const [controlIp, setControlIp] = useState(() => import.meta.env.VITE_PI5_IP || '100.99.72.51');

  const startWebRTC = useCallback(async () => {
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }
    setWebrtcStatus('connecting');

    try {
      await connectWebRtcStream({
        pcRef,
        controlIp,
        videoRef,
        setWebrtcStatus,
        setIsConnected,
        setStreamError,
        setStreamMode,
      });
    } catch (err) {
      console.warn('[AdminCameraTab] WebRTC signaling error, switching to MJPEG fallback:', err);
      setWebrtcStatus('failed');
      setStreamMode('mjpeg');
    }
  }, [controlIp]);

  const reloadStream = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setStreamKey(Date.now());
    setStreamError(false);
    setIsStreaming(true);
    if (streamMode === 'webrtc') {
      startWebRTC();
    }
  }, [streamMode, startWebRTC]);

  useEffect(() => {
    if (active && isStreaming && streamMode === 'webrtc') {
      startWebRTC();
    } else if (streamMode !== 'webrtc' && pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }

    return () => {
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {}
        pcRef.current = null;
      }
    };
  }, [active, isStreaming, streamMode, startWebRTC]);
  const [speed, setSpeed] = useState(75);
  const speedRef = useRef(75);
  // Giá trị tạm khi đang kéo thanh trượt; chỉ gửi lên Pi khi thả tay
  const [speedDraft, setSpeedDraft] = useState(null);
  // Tốc độ xoay tại chỗ (A/D) tách riêng với tốc độ tiến/lùi
  const [turnSpeed, setTurnSpeed] = useState(50);
  const turnSpeedRef = useRef(50);

  // Live Movement Logs
  const [movementLogs, setMovementLogs] = useState([
    {
      id: 1,
      time: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
      label: rc("System ready"),
      type: 'info',
    },
  ]);
  const [showMoveLogs, setShowMoveLogs] = useState(false);

  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const pressedKeysRef = useRef(new Set());
  const activeMotionRef = useRef('stop');

  // The shared E-stop keeps the camera's displayed command in sync, without sending another command.
  useEffect(() => {
    pressedKeysRef.current.clear();
    activeMotionRef.current = 'stop';
    setActiveMotion('stop');
  }, [emergencyStopVersion]);

  const handleSpeedChange = useCallback(
    async (newSpeed) => {
      const clamped = Math.max(20, Math.min(100, newSpeed));
      if (clamped === speedRef.current) return;
      setSpeed(clamped);
      speedRef.current = clamped;

      const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
      setMovementLogs((prev) => [
        {
          id: Date.now() + Math.random(),
          time: nowStr,
          cmd: `speed:${clamped}`,
          label: rc("Speed changed: {0}%", [clamped]),
          speed: clamped,
          type: 'speed',
        },
        ...prev.slice(0, 24),
      ]);

      try {
        await fetch('/api/v1/operations/robot/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: `speed:${clamped}`,
            target_ip: controlIp,
            port: 9999,
            speed: clamped,
          }),
        });
      } catch (err) {
        console.warn('Speed set error:', err);
      }
    },
    [controlIp]
  );

  const sendControlCommand = useCallback(
    async (cmd) => {
      if (cmd === activeMotionRef.current && cmd !== 'stop') {
        return;
      }
      setActiveMotion(cmd);
      activeMotionRef.current = cmd;

      const info = MOTION_CONFIG[cmd] || { label: cmd, eng: cmd };
      const nowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
      // Xoay tại chỗ (A/D) dùng thanh "Tốc độ quay", còn lại dùng tốc độ chạy.
      const isSpin = cmd === 'a' || cmd === 'd';
      const cmdSpeed = isSpin ? turnSpeedRef.current : speedRef.current;

      setMovementLogs((prev) => [
        {
          id: Date.now() + Math.random(),
          time: nowStr,
          cmd,
          label: rc(info.label),
          speed: cmdSpeed,
          type: cmd === 'stop' ? 'stop' : 'move',
        },
        ...prev.slice(0, 24),
      ]);

      try {
        await fetch('/api/v1/operations/robot/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: cmd,
            target_ip: controlIp,
            port: 9999,
            speed: cmdSpeed,
          }),
        });
      } catch (err) {
        console.warn('Control command error:', err);
      }
    },
    [controlIp]
  );

  // Đang giữ phím/nút -> gửi lại lệnh hiện tại định kỳ để watchdog trên Pi không cắt động cơ.
  // Nhả tay -> activeMotion = 'stop' -> ngừng gửi.
  useEffect(() => {
    if (activeMotion === 'stop') return undefined;

    const isSpin = activeMotion === 'a' || activeMotion === 'd';
    let inFlight = false;
    let cancelled = false;

    const post = (command, speedVal) =>
      fetch('/api/v1/operations/robot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, target_ip: controlIp, port: 9999, speed: speedVal }),
      });

    const intervalId = setInterval(() => {
      if (inFlight) return; // mạng chậm: không dồn request
      inFlight = true;
      post(activeMotion, isSpin ? turnSpeedRef.current : speedRef.current)
        .catch(() => {})
        .finally(() => {
          inFlight = false;
          // Lệnh gửi lại có thể tới Pi SAU lệnh 'stop' -> gửi 'stop' thêm lần nữa.
          if (cancelled && activeMotionRef.current === 'stop') {
            post('stop', speedRef.current).catch(() => {});
          }
        });
    }, MOTION_RESEND_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [activeMotion, controlIp]);

  useEffect(() => {
    if (!active) return;
    return attachCameraTeleopKeyboard({
      pressedKeysRef,
      activeMotionRef,
      speedRef,
      handleSpeedChange,
      sendControlCommand,
    });
  }, [active, handleSpeedChange, sendControlCommand]);

  const checkHealth = useCallback(async () => {
    try {
      const healthUrl = streamUrl.replace('/stream', '/health');
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const ok = data.online !== false;
        setIsConnected(ok);
        if (ok) setLastHealthCheck(new Date());
      } else {
        setIsConnected(false);
      }
    } catch {
      setIsConnected(false);
    }
  }, [streamUrl]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, HEALTH_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const handleStreamError = useCallback(() => {
    setStreamError(true);
    setIsConnected(false);
    if (!reconnectTimeoutRef.current) {
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        reloadStream();
      }, 2500);
    }
  }, [reloadStream]);

  const handleStreamLoad = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setStreamError(false);
    setIsConnected(true);
  };

  const toggleStream = () => {
    setIsStreaming((prev) => !prev);
    if (!isStreaming) {
      setStreamError(false);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleApplyUrl = (e) => {
    e.preventDefault();
    if (customUrl.trim()) {
      setStreamUrl(customUrl.trim());
      setStreamError(false);
      setShowSettings(false);
    }
  };

  const takeSnapshot = () => {
    const dataUrl = captureVideoSnapshot({
      streamMode,
      videoEl: videoRef.current,
      imgEl: imgRef.current,
      canvasEl: canvasRef.current,
    });
    if (dataUrl) setSnapshotUrl(dataUrl);
  };

  const cameraView = (
    <AdminCameraViewPanel
      rc={rc}
      canvasRef={canvasRef}
      showSettings={showSettings}
      setShowSettings={setShowSettings}
      handleApplyUrl={handleApplyUrl}
      customUrl={customUrl}
      setCustomUrl={setCustomUrl}
      containerRef={containerRef}
      isFullscreen={isFullscreen}
      isStreaming={isStreaming}
      streamError={streamError}
      isConnected={isConnected}
      streamMode={streamMode}
      setStreamMode={setStreamMode}
      webrtcStatus={webrtcStatus}
      setWebrtcStatus={setWebrtcStatus}
      startWebRTC={startWebRTC}
      reloadStream={reloadStream}
      takeSnapshot={takeSnapshot}
      toggleStream={toggleStream}
      toggleFullscreen={toggleFullscreen}
      videoRef={videoRef}
      imgRef={imgRef}
      streamKey={streamKey}
      streamUrl={streamUrl}
      handleStreamError={handleStreamError}
      handleStreamLoad={handleStreamLoad}
      telemetry={telemetry}
      activeMotion={activeMotion}
    />
  );
  const cameraControls = (
    <RobotManualControls
      speed={speed}
      speedDraft={speedDraft}
      onSpeedDraftChange={setSpeedDraft}
      onSpeedChange={handleSpeedChange}
      activeMotion={activeMotion}
      onMove={sendControlCommand}
      onStop={() => sendControlCommand('stop')}
      stopOnLeave
      turnSpeed={turnSpeed}
      onTurnSpeedChange={(val) => {
        setTurnSpeed(val);
        turnSpeedRef.current = val;
      }}
    />
  );
  const cameraExtras = (
    <AdminCameraLogsPanel
      rc={rc}
      activeMotion={activeMotion}
      speed={speed}
      movementLogs={movementLogs}
      onClearLogs={() => setMovementLogs([])}
      showMoveLogs={showMoveLogs}
      onToggleLogs={() => setShowMoveLogs(!showMoveLogs)}
    />
  );

  return renderWorkspace
    ? renderWorkspace({ cameraView, cameraControls, cameraExtras, activeMotion, isConnected })
    : <div className="robot-camera-standalone">{cameraView}{cameraControls}{cameraExtras}</div>;
};
