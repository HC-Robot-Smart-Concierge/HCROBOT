import { RobotManualControls } from '../../../components/admin/RobotManualControls';
import { useRobotControlText } from '../../../context/RobotControlLanguage';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Camera,
  Pause,
  Play,
  RefreshCw,
  Maximize2,
  Minimize2,
  SignalZero,
  Settings2,
  Circle,
  ChevronUp,
  ChevronDown,
  Square,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

const DEFAULT_STREAM_URL = '/api/v1/operations/robot/camera/stream';
const HEALTH_CHECK_INTERVAL_MS = 5000;
// Pi dừng động cơ nếu quá HCROBOT_UDP_CMD_TIMEOUT (mặc định 1.0 s) không có lệnh chạy mới
// (robot/udp_command_watchdog.py) -> phải gửi lại lệnh nhanh hơn ngưỡng đó khi đang giữ phím.
const MOTION_RESEND_INTERVAL_MS = 250;

const MOTION_CONFIG = {
  w: { label: 'Forward', eng: 'Forward', icon: ArrowUp, color: 'text-emerald-400' },
  s: { label: 'Backward', eng: 'Backward', icon: ArrowDown, color: 'text-amber-400' },
  a: { label: 'Turn Left', eng: 'Turn Left', icon: ArrowLeft, color: 'text-sky-400' },
  d: { label: 'Turn Right', eng: 'Turn Right', icon: ArrowRight, color: 'text-sky-400' },
  wa: { label: 'Forward Left', eng: 'Arc Left', icon: ArrowUp, color: 'text-teal-400' },
  wd: { label: 'Forward Right', eng: 'Arc Right', icon: ArrowUp, color: 'text-teal-400' },
  sa: { label: 'Backward Left', eng: 'Arc Left', icon: ArrowDown, color: 'text-orange-400' },
  sd: { label: 'Backward Right', eng: 'Arc Right', icon: ArrowDown, color: 'text-orange-400' },
  stop: { label: 'Stop', eng: 'Stop', icon: Square, color: 'text-rose-400' },
};

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
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      pcRef.current = pc;

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setWebrtcStatus('connected');
          setIsConnected(true);
          setStreamError(false);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setWebrtcStatus('connected');
          setIsConnected(true);
          setStreamError(false);
        } else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          setWebrtcStatus('failed');
          setStreamMode('mjpeg');
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setWebrtcStatus('connected');
          setIsConnected(true);
          setStreamError(false);
        } else if (pc.iceConnectionState === 'failed') {
          setWebrtcStatus('failed');
          setStreamMode('mjpeg');
        }
      };

      pc.addTransceiver('video', { direction: 'recvonly' });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (pc.iceGatheringState !== 'complete') {
        await new Promise((resolve) => {
          const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkState);
          setTimeout(() => {
            pc.removeEventListener('icegatheringstatechange', checkState);
            resolve();
          }, 2500);
        });
      }

      const res = await fetch('/api/v1/operations/robot/camera/webrtc-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: pc.localDescription.sdp,
          type: pc.localDescription.type,
          target_ip: controlIp,
          port: 8554,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        throw new Error(`WebRTC offer response status ${res.status}`);
      }

      const answer = await res.json();
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
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

  const computeMotionCommand = useCallback((keysSet) => {
    const isUp = keysSet.has('w') || keysSet.has('arrowup');
    const isDown = keysSet.has('s') || keysSet.has('arrowdown');
    const isLeft = keysSet.has('a') || keysSet.has('arrowleft');
    const isRight = keysSet.has('d') || keysSet.has('arrowright');

    if (isUp && isLeft) return 'wa';
    if (isUp && isRight) return 'wd';
    if (isDown && isLeft) return 'sa';
    if (isDown && isRight) return 'sd';
    if (isUp) return 'w';
    if (isDown) return 's';
    if (isLeft) return 'a';
    if (isRight) return 'd';
    return 'stop';
  }, []);

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
    const validKeys = new Set([
      'w', 's', 'a', 'd',
      'arrowup', 'arrowdown', 'arrowleft', 'arrowright'
    ]);

    const handleKeyDown = (e) => {
      if (
        ['input', 'textarea'].includes(
          document.activeElement?.tagName?.toLowerCase()
        )
      )
        return;
      const key = e.key.toLowerCase();
      if (key === ' ' || key === 'x') {
        pressedKeysRef.current.clear();
        sendControlCommand('stop');
        return;
      }
      if (key === '1') {
        handleSpeedChange(50);
        return;
      }
      if (key === '2') {
        handleSpeedChange(75);
        return;
      }
      if (key === '3') {
        handleSpeedChange(100);
        return;
      }
      if (key === '+' || key === '=') {
        handleSpeedChange(speedRef.current + 10);
        return;
      }
      if (key === '-' || key === '_') {
        handleSpeedChange(speedRef.current - 10);
        return;
      }
      if (validKeys.has(key)) {
        if (!pressedKeysRef.current.has(key)) {
          pressedKeysRef.current.add(key);
          const nextCmd = computeMotionCommand(pressedKeysRef.current);
          if (nextCmd !== activeMotionRef.current) {
            sendControlCommand(nextCmd);
          }
        }
      }
    };

    const handleKeyUp = (e) => {
      if (
        ['input', 'textarea'].includes(
          document.activeElement?.tagName?.toLowerCase()
        )
      )
        return;
      const key = e.key.toLowerCase();
      if (validKeys.has(key)) {
        if (pressedKeysRef.current.has(key)) {
          pressedKeysRef.current.delete(key);
          const nextCmd = computeMotionCommand(pressedKeysRef.current);
          if (nextCmd !== activeMotionRef.current) {
            sendControlCommand(nextCmd);
          }
        }
      }
    };

    const handleBlur = () => {
      if (pressedKeysRef.current.size > 0) {
        pressedKeysRef.current.clear();
        sendControlCommand('stop');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      if (pressedKeysRef.current.size > 0 || activeMotionRef.current !== 'stop') {
        pressedKeysRef.current.clear();
        sendControlCommand('stop');
      }
    };
  }, [active, computeMotionCommand, sendControlCommand]);

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
    const mediaEl = streamMode === 'webrtc' ? videoRef.current : imgRef.current;
    if (!mediaEl) return;
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = streamMode === 'webrtc' ? (mediaEl.videoWidth || 640) : (mediaEl.naturalWidth || 640);
      const h = streamMode === 'webrtc' ? (mediaEl.videoHeight || 480) : (mediaEl.naturalHeight || 480);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(mediaEl, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setSnapshotUrl(dataUrl);

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `pi5_snapshot_${Date.now()}.jpg`;
      link.click();
    } catch {
      // cross-origin restrictions may prevent this
    }
  };

  const cameraView = (
    <div className="robot-camera-view">
      <canvas ref={canvasRef} className="hidden" />
      {/* Settings Modal / Floating Panel */}
      {showSettings && (
        <form
          onSubmit={handleApplyUrl}
          className="flex items-center gap-3 p-3 bg-white/95 backdrop-blur-md rounded-xl border border-[#BFBFBD] shadow-lg animate-fadeIn shrink-0 z-30"
        >
          <label className="text-[11px] font-bold text-[#262626] whitespace-nowrap">
            {rc('Stream URL:')}
          </label>
          <input
            type="text"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="/api/v1/operations/robot/camera/stream"
            className="flex-1 px-3 py-1.5 bg-[#F2EFE9] border border-[#BFBFBD] rounded-lg text-xs font-mono text-[#262626] placeholder-[#8C8C8C] focus:outline-none focus:border-[#262626]"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-[#262626] text-[#F2EFE9] rounded-lg text-xs font-bold hover:bg-black transition-all cursor-pointer"
          > {rc("Apply")} </button>
          <button
            type="button"
            onClick={() => setShowSettings(false)}
            className="px-2.5 py-1.5 bg-stone-100 text-stone-700 rounded-lg text-xs font-bold hover:bg-stone-200 transition-all cursor-pointer border border-stone-300"
          > {rc("Close")} </button>
        </form>
      )}

      {/* Maximized Camera Stream Viewport */}
      <div
        ref={containerRef}
        className={`robot-camera-viewport relative flex-1 bg-black rounded-2xl overflow-hidden border border-[#BFBFBD] shadow-sm transition-all flex flex-col ${
          isFullscreen ? 'rounded-none' : ''
        }`}
      >
        {/* Stream Controls Overlay - Top Floating HUD */}
        <div className="robot-camera-toolbar flex items-center justify-between gap-2">
          <span className="robot-camera-title"><Video size={15} /> Camera FPV <small>Pi 5</small></span>
          {/* Left: Stream Status & Resolution Badges */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md text-[10px] font-bold border bg-[#262626]/85 text-[#F2EFE9] border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F2EFE9] opacity-90" />
              <span>
                {isStreaming
                  ? streamError
                    ? 'ERROR'
                    : 'LIVE'
                  : 'PAUSED'}
              </span>
            </div>

            <div className="px-2.5 py-1 rounded-full bg-[#262626]/85 backdrop-blur-md text-white/80 text-[9px] font-mono font-bold border border-white/20">
              PI5 1080p
            </div>

            {/* Connection Status Badge */}
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-md transition-colors"
              style={{
                backgroundColor: isConnected ? 'rgba(242, 239, 233, 0.9)' : 'rgba(38, 38, 38, 0.85)',
                color: isConnected ? '#262626' : '#BFBFBD',
                borderColor: isConnected ? '#BFBFBD' : 'rgba(255, 255, 255, 0.2)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: isConnected ? '#262626' : '#8C8C8C' }}
              />
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>

          {/* Right: Action HUD Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const nextMode = streamMode === 'webrtc' ? 'mjpeg' : 'webrtc';
                setStreamMode(nextMode);
                if (nextMode === 'webrtc') {
                  setWebrtcStatus('connecting');
                  startWebRTC();
                }
              }}
              className={`px-2 py-1 rounded-lg text-[10.5px] font-mono tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border backdrop-blur-md ${
                streamMode === 'webrtc'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/70 hover:bg-emerald-900/90'
                  : 'bg-amber-950/80 text-amber-300 border-amber-700/70 hover:bg-amber-900/90'
              }`}
              title={streamMode === 'webrtc' ? 'Che do: WebRTC P2P (click de chuyen sang MJPEG)' : 'Che do: MJPEG (click de chuyen sang WebRTC)'}
            >
              <Circle className={`w-2 h-2 fill-current ${webrtcStatus === 'connected' && streamMode === 'webrtc' ? 'animate-pulse text-emerald-400' : 'text-amber-400'}`} />
              <span>{streamMode === 'webrtc' ? 'WebRTC Live' : 'MJPEG'}</span>
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg backdrop-blur-md border transition-all cursor-pointer ${
                showSettings
                  ? 'bg-white text-black border-white'
                  : 'bg-[#262626]/85 text-white/80 hover:text-white border-white/20'
              }`}
              title={rc("Configure stream URL")}
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={reloadStream}
              className="p-1.5 rounded-lg bg-[#262626]/85 backdrop-blur-md text-white/80 hover:text-white border border-white/20 transition-all cursor-pointer"
              title={rc("Reconnect camera stream")}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={takeSnapshot}
              disabled={!isStreaming || streamError}
              className="p-1.5 rounded-lg bg-[#262626]/85 backdrop-blur-md text-white/80 hover:text-white border border-white/20 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title={rc("Take snapshot")}
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={toggleStream}
              className="p-1.5 rounded-lg bg-[#262626]/85 backdrop-blur-md text-white/80 hover:text-white border border-white/20 transition-all cursor-pointer"
              title={isStreaming ? rc("Pause stream") : rc("Resume stream")}
            >
              {isStreaming ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg bg-[#262626]/85 backdrop-blur-md text-white/80 hover:text-white border border-white/20 transition-all cursor-pointer"
              title={isFullscreen ? rc("Exit fullscreen") : rc("Fullscreen")}
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* WebRTC Video Stream (Primary, Zero Latency) */}
        {isStreaming && streamMode === 'webrtc' ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`robot-camera-image w-full h-full object-contain ${
              streamError || webrtcStatus === 'failed' ? 'opacity-0' : 'opacity-100'
            }`}
          />
        ) : null}

        {/* MJPEG Stream Image (Fallback / HTTP) */}
        {isStreaming && streamMode === 'mjpeg' ? (
          <img
            key={streamKey}
            ref={imgRef}
            src={`${streamUrl}${streamUrl.includes('?') ? '&' : '?'}t=${streamKey}`}
            alt="Pi5 Camera Stream"
            crossOrigin="anonymous"
            onError={handleStreamError}
            onLoad={handleStreamLoad}
            className={`robot-camera-image w-full h-full object-contain ${
              streamError ? 'opacity-0' : 'opacity-100'
            }`}
          />
        ) : null}

        <div className="robot-camera-osd">
          <strong>{Number(telemetry?.linearVelocity ?? 0).toFixed(2)} <small>m/s</small></strong>
          <span>{activeMotion === 'stop' ? rc("Stopped") : rc(MOTION_CONFIG[activeMotion]?.label || activeMotion)}</span>
        </div>

        {/* Offline / Error Overlay */}
        {(!isStreaming || streamError) && (
          <div className="robot-camera-empty absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stone-950/95">
            <div className="w-16 h-16 rounded-2xl bg-stone-800 flex items-center justify-center">
              {streamError ? (
                <SignalZero className="w-8 h-8 text-stone-400" />
              ) : (
                <VideoOff className="w-8 h-8 text-stone-500" />
              )}
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-white">
                {streamError
                  ? rc("Camera unavailable")
                  : rc("Camera stream paused")}
              </h3>
              <p className="text-[11px] text-stone-400 max-w-xs">
                {streamError
                  ? rc("Check that the camera stream and its connection to Pi 5 are running.")
                  : rc("Press Play to resume the stream.")}
              </p>
            </div>
            {streamError && (
              <button
                onClick={reloadStream}
                className="flex items-center gap-2 px-4 py-2 bg-[#F2EFE9] text-[#262626] rounded-xl text-xs font-bold hover:bg-white transition-all cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span> {rc("Reconnect")} </span>
              </button>
            )}
            {!isStreaming && !streamError && (
              <button
                onClick={toggleStream}
                className="flex items-center gap-2 px-4 py-2 bg-[#262626] text-[#F2EFE9] border border-[#BFBFBD] rounded-xl text-xs font-bold hover:bg-black transition-all cursor-pointer"
              >
                <Video className="w-3.5 h-3.5" />
                <span> {rc("Resume Camera Stream")} </span>
              </button>
            )}
          </div>
        )}
        <div className="robot-camera-footer" title={streamMode === 'webrtc' ? 'WebRTC P2P Stream' : streamUrl}>
          <span><span className={`robot-status-dot ${isConnected ? 'is-online' : ''}`} /> {isConnected ? rc('Pi5 Online') : rc('Pi5 Offline')}</span>
          <span>{streamMode === 'webrtc' ? 'WebRTC · Ultra Low Latency' : '1080p · MJPEG'}</span>
        </div>
      </div>

    </div>
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
    <div className="robot-camera-extras">
        {/* Live Movement Logs Panel (Bottom Right, next to D-Pad) */}
        <div className="robot-camera-logs bg-[#18181B]/85 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden transition-all text-xs">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/10 select-none">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-1.5 font-mono">
                <span className={`w-2 h-2 rounded-full ${activeMotion !== 'stop' ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'}`} /> {rc("Movement log")} </span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono transition-all ${
                activeMotion !== 'stop'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-stone-800 text-stone-400'
              }`}>
                {activeMotion !== 'stop' ? `${rc(MOTION_CONFIG[activeMotion]?.label || activeMotion)} • ${speed}%` : rc("Stopped")}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMovementLogs([])}
                className="p-1 text-stone-400 hover:text-rose-400 hover:bg-white/5 rounded transition-all cursor-pointer"
                title={rc("Clear log")}
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => setShowMoveLogs(!showMoveLogs)}
                className="p-1 text-stone-400 hover:text-white hover:bg-white/5 rounded transition-all cursor-pointer"
                title={showMoveLogs ? rc("Collapse") : rc("Expand")}
              >
                {showMoveLogs ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Logs List */}
          {showMoveLogs && (
            <div className="p-2 max-h-40 overflow-y-auto space-y-1 font-mono text-[11px] custom-scrollbar">
              {movementLogs.length === 0 ? (
                <div className="text-center py-4 text-stone-500 text-[10px]"> {rc("No movement commands yet")} </div>
              ) : (
                movementLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`flex items-center justify-between px-2 py-1 rounded-lg transition-all ${
                      log.type === 'stop'
                        ? 'bg-rose-500/10 text-rose-300'
                        : log.type === 'speed'
                        ? 'bg-amber-500/10 text-amber-300'
                        : 'bg-white/5 text-stone-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-stone-500 shrink-0">{log.time}</span>
                      <span className="font-semibold truncate">{log.label}</span>
                    </div>
                    {log.speed && log.type !== 'stop' && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-black/40 text-stone-300 shrink-0 border border-white/5">
                        {log.speed}%
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

    </div>
  );

  return renderWorkspace
    ? renderWorkspace({ cameraView, cameraControls, cameraExtras, activeMotion, isConnected })
    : <div className="robot-camera-standalone">{cameraView}{cameraControls}{cameraExtras}</div>;
};
