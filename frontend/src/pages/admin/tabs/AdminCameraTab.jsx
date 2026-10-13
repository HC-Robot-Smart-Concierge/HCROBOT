import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import {
  Video,
  VideoOff,
  RefreshCw,
  Maximize2,
  Minimize2,
  SignalZero,
  Settings2,
  Circle,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Square,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

const DEFAULT_STREAM_URL = 'http://100.99.72.51:8554/stream';
const HEALTH_CHECK_INTERVAL_MS = 5000;

const MOTION_CONFIG = {
  w: { label: 'Tiến', eng: 'Forward', icon: ArrowUp, color: 'text-emerald-400' },
  s: { label: 'Lùi', eng: 'Backward', icon: ArrowDown, color: 'text-amber-400' },
  a: { label: 'Xoay Trái', eng: 'Turn Left', icon: ArrowLeft, color: 'text-sky-400' },
  d: { label: 'Xoay Phải', eng: 'Turn Right', icon: ArrowRight, color: 'text-sky-400' },
  wa: { label: 'Tiến-Trái', eng: 'Arc Left', icon: ArrowUp, color: 'text-teal-400' },
  wd: { label: 'Tiến-Phải', eng: 'Arc Right', icon: ArrowUp, color: 'text-teal-400' },
  sa: { label: 'Lùi-Trái', eng: 'Arc Left', icon: ArrowDown, color: 'text-orange-400' },
  sd: { label: 'Lùi-Phải', eng: 'Arc Right', icon: ArrowDown, color: 'text-orange-400' },
  stop: { label: 'Dừng', eng: 'Stop', icon: Square, color: 'text-rose-400' },
};

export const AdminCameraTab = ({ currentUser }) => {
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

  // AI Emotion Recognition States (Pi5 Camera)
  const [isAiEmotionActive, setIsAiEmotionActive] = useState(true);
  const [visionModelReady, setVisionModelReady] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [detectedEmotion, setDetectedEmotion] = useState('neutral');
  const [smileScore, setSmileScore] = useState(0);
  const [frownScore, setFrownScore] = useState(0);
  const [overrideEmotion, setOverrideEmotion] = useState(null);
  const [showEmotionHud, setShowEmotionHud] = useState(true);

  const landmarkerRef = useRef(null);
  const noFaceCountRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);

  const reloadStream = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setStreamKey(Date.now());
    setStreamError(false);
    setIsStreaming(true);
  }, []);

  // Teleop Motion state
  const [activeMotion, setActiveMotion] = useState('stop');
  const [controlIp, setControlIp] = useState(() => import.meta.env.VITE_PI5_IP || '100.99.72.51');
  const [speed, setSpeed] = useState(75);
  const speedRef = useRef(75);

  // Live Movement Logs
  const [movementLogs, setMovementLogs] = useState([
    {
      id: 1,
      time: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
      label: 'Hệ thống sẵn sàng',
      type: 'info',
    },
  ]);
  const [showMoveLogs, setShowMoveLogs] = useState(true);

  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const pressedKeysRef = useRef(new Set());
  const activeMotionRef = useRef('stop');

  // Khởi tạo Google MediaPipe Face Landmarker cho ảnh Pi5 Stream
  useEffect(() => {
    let isCancelled = false;

    const initLandmarker = async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
        if (isCancelled) return;

        const landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: true,
          runningMode: 'IMAGE',
          numFaces: 1,
        });

        if (isCancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setVisionModelReady(true);
      } catch (err) {
        console.warn('[AdminCameraTab] MediaPipe model init fallback:', err);
      }
    };

    initLandmarker();

    return () => {
      isCancelled = true;
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch {
          // ignore cleanup error
        }
      }
    };
  }, []);

  // Vòng lặp phân tích biểu cảm trực tiếp từ luồng ảnh Pi5
  useEffect(() => {
    if (!isAiEmotionActive || !isStreaming || streamError) {
      setIsFaceDetected(false);
      return;
    }

    const intervalId = setInterval(() => {
      if (!landmarkerRef.current || !imgRef.current) return;
      const imgEl = imgRef.current;
      if (!imgEl.complete || imgEl.naturalWidth === 0) return;

      try {
        const results = landmarkerRef.current.detect(imgEl);

        if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
          setIsFaceDetected(true);
          noFaceCountRef.current = 0;

          if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
            const categories = results.faceBlendshapes[0].categories;
            let sLeft = 0;
            let sRight = 0;
            let bDownL = 0;
            let bDownR = 0;
            let mFrownL = 0;
            let mFrownR = 0;

            for (const c of categories) {
              if (c.categoryName === 'mouthSmileLeft') sLeft = c.score;
              else if (c.categoryName === 'mouthSmileRight') sRight = c.score;
              else if (c.categoryName === 'browDownLeft') bDownL = c.score;
              else if (c.categoryName === 'browDownRight') bDownR = c.score;
              else if (c.categoryName === 'mouthFrownLeft') mFrownL = c.score;
              else if (c.categoryName === 'mouthFrownRight') mFrownR = c.score;
            }

            const smile = (sLeft + sRight) / 2;
            const frown = Math.max((bDownL + bDownR) / 2, (mFrownL + mFrownR) / 2);
            setSmileScore(smile);
            setFrownScore(frown);

            let detected = 'neutral';
            if (smile >= 0.35) {
              detected = 'happy';
            } else if (frown >= 0.28) {
              detected = 'unhappy';
            }
            setDetectedEmotion(detected);
          }
        } else {
          noFaceCountRef.current += 1;
          if (noFaceCountRef.current >= 3) {
            setIsFaceDetected(false);
            setDetectedEmotion('neutral');
            setSmileScore(0);
            setFrownScore(0);
          }
        }
      } catch {
        // Nuốt lỗi cross-origin hoặc frame gián đoạn để tránh treo loop
      }
    }, 600);

    return () => clearInterval(intervalId);
  }, [isAiEmotionActive, isStreaming, streamError]);

  const handleOverrideEmotion = useCallback(
    async (emo) => {
      setOverrideEmotion(emo);
      if (emo) {
        try {
          await fetch('/api/v1/operations/robot/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              command: `emotion:${emo}`,
              target_ip: controlIp,
              port: 9999,
            }),
          });
        } catch {
          // ignore
        }
      }
    },
    [controlIp]
  );

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
          label: `Đổi tốc độ: ${clamped}%`,
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

      setMovementLogs((prev) => [
        {
          id: Date.now() + Math.random(),
          time: nowStr,
          cmd,
          label: `${info.label} (${info.eng})`,
          speed: speedRef.current,
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
            speed: speedRef.current,
          }),
        });
      } catch (err) {
        console.warn('Control command error:', err);
      }
    },
    [controlIp]
  );

  useEffect(() => {
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
    };
  }, [computeMotionCommand, sendControlCommand]);

  const checkHealth = useCallback(async () => {
    try {
      const healthUrl = streamUrl.replace('/stream', '/health');
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        setIsConnected(true);
        setLastHealthCheck(new Date());
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
    if (!imgRef.current) return;
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = imgRef.current.naturalWidth || 1920;
      canvas.height = imgRef.current.naturalHeight || 1080;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgRef.current, 0, 0);
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

  return (
    <div className="w-full h-full flex flex-col p-2.5 sm:p-3 gap-2">
      <canvas ref={canvasRef} className="hidden" />

      {/* Settings Modal / Floating Panel */}
      {showSettings && (
        <form
          onSubmit={handleApplyUrl}
          className="flex items-center gap-3 p-3 bg-white/95 backdrop-blur-md rounded-xl border border-[#BFBFBD] shadow-lg animate-fadeIn shrink-0 z-30"
        >
          <label className="text-[11px] font-bold text-[#262626] whitespace-nowrap">
            Stream URL:
          </label>
          <input
            type="text"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="http://localhost:8554/stream"
            className="flex-1 px-3 py-1.5 bg-[#F2EFE9] border border-[#BFBFBD] rounded-lg text-xs font-mono text-[#262626] placeholder-[#8C8C8C] focus:outline-none focus:border-[#262626]"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-[#262626] text-[#F2EFE9] rounded-lg text-xs font-bold hover:bg-black transition-all cursor-pointer"
          >
            Áp Dụng
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(false)}
            className="px-2.5 py-1.5 bg-stone-100 text-stone-700 rounded-lg text-xs font-bold hover:bg-stone-200 transition-all cursor-pointer border border-stone-300"
          >
            Đóng
          </button>
        </form>
      )}

      {/* Maximized Camera Stream Viewport */}
      <div
        ref={containerRef}
        className={`relative flex-1 bg-black rounded-2xl overflow-hidden border border-[#BFBFBD] shadow-sm transition-all flex flex-col ${
          isFullscreen ? 'rounded-none' : ''
        }`}
      >
        {/* Stream Controls Overlay - Top Floating HUD */}
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2">
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
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg backdrop-blur-md border transition-all cursor-pointer ${
                showSettings
                  ? 'bg-white text-black border-white'
                  : 'bg-[#262626]/85 text-white/80 hover:text-white border-white/20'
              }`}
              title="Cấu hình Stream URL"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={reloadStream}
              className="p-1.5 rounded-lg bg-[#262626]/85 backdrop-blur-md text-white/80 hover:text-white border border-white/20 transition-all cursor-pointer"
              title="Tải lại kết nối luồng camera"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={takeSnapshot}
              disabled={!isStreaming || streamError}
              className="p-1.5 rounded-lg bg-[#262626]/85 backdrop-blur-md text-white/80 hover:text-white border border-white/20 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Chụp ảnh"
            >
              <Circle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={toggleStream}
              className="p-1.5 rounded-lg bg-[#262626]/85 backdrop-blur-md text-white/80 hover:text-white border border-white/20 transition-all cursor-pointer"
              title={isStreaming ? 'Dừng stream' : 'Bật stream'}
            >
              {isStreaming ? (
                <VideoOff className="w-3.5 h-3.5" />
              ) : (
                <Video className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg bg-[#262626]/85 backdrop-blur-md text-white/80 hover:text-white border border-white/20 transition-all cursor-pointer"
              title={isFullscreen ? 'Thoát fullscreen' : 'Toàn màn hình'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* MJPEG Stream Image */}
        {isStreaming ? (
          <img
            key={streamKey}
            ref={imgRef}
            src={`${streamUrl}${streamUrl.includes('?') ? '&' : '?'}t=${streamKey}`}
            alt="Pi5 Camera Stream"
            crossOrigin="anonymous"
            onError={handleStreamError}
            onLoad={handleStreamLoad}
            className={`w-full h-full object-contain ${
              streamError ? 'opacity-0' : 'opacity-100'
            }`}
          />
        ) : null}

        {/* Reconnecting Overlay khi stream bị gián đoạn */}
        {streamError && isStreaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-xs z-10 text-stone-300">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-stone-400" />
            <p className="text-xs font-mono font-bold tracking-wider uppercase text-stone-200">
              Đang tự động kết nối lại luồng Camera...
            </p>
            <p className="text-[10px] text-stone-500 font-mono mt-1">{streamUrl}</p>
            <button
              onClick={reloadStream}
              className="mt-4 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-medium border border-stone-600 transition-all cursor-pointer text-stone-200"
            >
              Thử lại ngay
            </button>
          </div>
        )}

        {/* AI Emotion Recognition Panel - Top-Left HUD (Không dùng emoji, tone xám tối giản) */}
        <div className="absolute top-14 left-3 z-20 w-[270px] bg-[#18181B]/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl p-3 text-stone-200 select-none animate-fadeIn flex flex-col gap-2.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
              <span className="text-[10px] font-mono font-bold tracking-wider text-stone-200 uppercase">
                Biểu cảm AI Pi5
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsAiEmotionActive((prev) => !prev)}
                className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold transition-all cursor-pointer border ${
                  isAiEmotionActive
                    ? 'bg-stone-200 text-stone-900 border-white shadow-xs'
                    : 'bg-stone-800 text-stone-400 border-stone-700 hover:text-stone-200'
                }`}
                title="Bật/Tắt module nhận diện biểu cảm"
              >
                {isAiEmotionActive ? 'BẬT' : 'TẮT'}
              </button>
              <button
                type="button"
                onClick={() => setShowEmotionHud((prev) => !prev)}
                className="text-[10px] font-mono text-stone-400 hover:text-stone-200 px-1 cursor-pointer"
                title={showEmotionHud ? 'Thu gọn' : 'Mở rộng'}
              >
                {showEmotionHud ? '▲' : '▼'}
              </button>
            </div>
          </div>

          {showEmotionHud && (
            <>
              {/* Trạng thái khuôn mặt & AI Model */}
              <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                <div className="p-1.5 rounded-lg bg-black/40 border border-white/5 flex flex-col">
                  <span className="text-stone-400">TRẠNG THÁI AI</span>
                  <span className="font-bold text-stone-200">
                    {visionModelReady ? 'SẴN SÀNG' : 'ĐANG TẢI...'}
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-black/40 border border-white/5 flex flex-col">
                  <span className="text-stone-400">KHUÔN MẶT</span>
                  <span
                    className={`font-bold ${
                      isFaceDetected ? 'text-stone-100' : 'text-stone-400'
                    }`}
                  >
                    {isFaceDetected ? 'ĐÃ KHÓA' : 'CHƯA PHÁT HIỆN'}
                  </span>
                </div>
              </div>

              {/* Biểu cảm hiện tại */}
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono text-stone-400">BIỂU CẢM HIỆN TẠI</span>
                  <span className="text-xs font-bold tracking-wide text-white">
                    {(overrideEmotion || detectedEmotion) === 'happy'
                      ? 'VUI VẺ'
                      : (overrideEmotion || detectedEmotion) === 'unhappy'
                      ? 'KHÓ CHỊU'
                      : 'BÌNH THƯỜNG'}
                  </span>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-stone-800 text-stone-300 border border-stone-700">
                  {overrideEmotion ? 'THỦ CÔNG' : 'AI QUÉT'}
                </span>
              </div>

              {/* Thước đo Nụ cười & Cau mày */}
              <div className="space-y-1.5 text-[9px] font-mono">
                <div>
                  <div className="flex justify-between text-stone-400 mb-0.5">
                    <span>NỤ CƯỜI (SMILE)</span>
                    <span className="text-stone-200 font-bold">
                      {Math.round(smileScore * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-stone-800 overflow-hidden">
                    <div
                      className="h-full bg-stone-200 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round(smileScore * 100))}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-stone-400 mb-0.5">
                    <span>CAU MÀY (FROWN)</span>
                    <span className="text-stone-200 font-bold">
                      {Math.round(frownScore * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-stone-800 overflow-hidden">
                    <div
                      className="h-full bg-stone-400 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round(frownScore * 100))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Bộ nút can thiệp / Thử nghiệm thủ công */}
              <div className="pt-1 border-t border-white/10 space-y-1">
                <span className="text-[8px] font-mono text-stone-400 block uppercase">
                  Kiểm tra phản ứng Robot:
                </span>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: null, label: 'TỰ ĐỘNG' },
                    { id: 'happy', label: 'VUI VẺ' },
                    { id: 'neutral', label: 'BÌNH THƯỜNG' },
                    { id: 'unhappy', label: 'KHÓ CHỊU' },
                  ].map((mode) => (
                    <button
                      key={String(mode.id)}
                      type="button"
                      onClick={() => handleOverrideEmotion(mode.id)}
                      className={`py-1 rounded-md text-[8px] font-mono font-bold transition-all cursor-pointer border ${
                        overrideEmotion === mode.id
                          ? 'bg-stone-200 text-stone-900 border-white shadow-xs'
                          : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                      }`}
                      title={mode.id ? `Ghi đè biểu cảm: ${mode.label}` : 'Để AI tự động nhận diện'}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Telemetry OSD Strip (Bottom-Left) */}
        <div className="absolute bottom-4 left-4 z-10 px-3 py-2 bg-[#18181B]/80 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl flex items-center gap-3 text-[10px] font-mono text-stone-300 select-none">
          <div className="flex items-center gap-1.5 border-r border-white/10 pr-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-white font-bold">PIN: 92%</span>
            <span className="text-stone-400 text-[9px]">(24.8V)</span>
          </div>

          <div className="flex items-center gap-1.5 border-r border-white/10 pr-3">
            <span className="text-stone-400">V:</span>
            <span className="text-white font-bold">{activeMotion !== 'stop' ? (speed * 0.005).toFixed(2) : '0.00'} m/s</span>
          </div>

          <div className="flex items-center gap-1.5 border-r border-white/10 pr-3">
            <span className="text-stone-400">VẬT CẢN:</span>
            <span className="text-emerald-400 font-bold">1.45 m</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-stone-400">HƯỚNG:</span>
            <span className="text-white font-bold">90°</span>
          </div>
        </div>

        {/* Live Movement Logs Panel (Bottom Right, next to D-Pad) */}
        <div className="absolute bottom-4 right-40 z-10 w-72 max-w-[calc(100vw-360px)] bg-[#18181B]/85 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden transition-all text-xs">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/10 select-none">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-1.5 font-mono">
                <span className={`w-2 h-2 rounded-full ${activeMotion !== 'stop' ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'}`} />
                LOG DI CHUYỂN
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono transition-all ${
                activeMotion !== 'stop'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-stone-800 text-stone-400'
              }`}>
                {activeMotion !== 'stop' ? `${MOTION_CONFIG[activeMotion]?.label || activeMotion} • ${speed}%` : 'Đã dừng'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMovementLogs([])}
                className="p-1 text-stone-400 hover:text-rose-400 hover:bg-white/5 rounded transition-all cursor-pointer"
                title="Xóa nhật ký"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => setShowMoveLogs(!showMoveLogs)}
                className="p-1 text-stone-400 hover:text-white hover:bg-white/5 rounded transition-all cursor-pointer"
                title={showMoveLogs ? "Thu gọn" : "Mở rộng"}
              >
                {showMoveLogs ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Logs List */}
          {showMoveLogs && (
            <div className="p-2 max-h-40 overflow-y-auto space-y-1 font-mono text-[11px] custom-scrollbar">
              {movementLogs.length === 0 ? (
                <div className="text-center py-4 text-stone-500 text-[10px]">Chưa có lệnh di chuyển nào</div>
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

        {/* Minimalist Cross D-Pad Teleop Controller Overlay */}
        <div className="absolute bottom-4 right-4 z-10 p-2.5 bg-[#18181B]/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center gap-2 select-none">
          {/* Speed Presets Selector */}
          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10">
            {[
              { val: 50, label: '50%' },
              { val: 75, label: '75%' },
              { val: 100, label: '100%' },
            ].map((lvl) => (
              <button
                key={lvl.val}
                onClick={() => handleSpeedChange(lvl.val)}
                className={`px-2 py-0.5 rounded-md font-mono text-[9px] font-bold transition-all cursor-pointer ${
                  speed === lvl.val
                    ? 'bg-[#F2EFE9] text-[#262626] shadow-xs'
                    : 'text-stone-400 hover:text-white'
                }`}
                title={`Vận tốc ${lvl.label} (Phím: ${lvl.val === 50 ? '1' : lvl.val === 75 ? '2' : '3'})`}
              >
                {lvl.label}
              </button>
            ))}
          </div>

          {/* Cross D-Pad Cluster (W, A, S, D + STOP) */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            {/* W - Tiến */}
            <button
              onMouseDown={() => sendControlCommand('w')}
              onMouseUp={() => sendControlCommand('stop')}
              onTouchStart={() => sendControlCommand('w')}
              onTouchEnd={() => sendControlCommand('stop')}
              className={`absolute top-0 w-9 h-9 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                activeMotion === 'w' || activeMotion === 'wa' || activeMotion === 'wd'
                  ? 'bg-[#F2EFE9] text-[#262626] border-white scale-95 shadow-md'
                  : 'bg-stone-900/90 text-stone-200 border-white/10 hover:bg-stone-800'
              }`}
              title="Tiến (W / Phím Lên)"
            >
              <ChevronUp className="w-4 h-4" />
              <span className="text-[7px] font-mono leading-none font-bold opacity-60">W</span>
            </button>

            {/* A - Xoay Trái */}
            <button
              onMouseDown={() => sendControlCommand('a')}
              onMouseUp={() => sendControlCommand('stop')}
              onTouchStart={() => sendControlCommand('a')}
              onTouchEnd={() => sendControlCommand('stop')}
              className={`absolute left-0 w-9 h-9 rounded-xl flex items-center justify-center gap-0.5 transition-all cursor-pointer border ${
                activeMotion === 'a' || activeMotion === 'wa' || activeMotion === 'sa'
                  ? 'bg-[#F2EFE9] text-[#262626] border-white scale-95 shadow-md'
                  : 'bg-stone-900/90 text-stone-200 border-white/10 hover:bg-stone-800'
              }`}
              title="Xoay Trái (A / Phím Trái)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-[7px] font-mono leading-none font-bold opacity-60">A</span>
            </button>

            {/* STOP - Trung tâm */}
            <button
              onClick={() => sendControlCommand('stop')}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer border z-10 ${
                activeMotion === 'stop'
                  ? 'bg-[#262626] text-[#F2EFE9] border-white/30 shadow-xs'
                  : 'bg-stone-900/90 text-stone-300 border-white/10 hover:bg-stone-800'
              }`}
              title="Dừng Khẩn Cấp (Space / X)"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>

            {/* D - Xoay Phải */}
            <button
              onMouseDown={() => sendControlCommand('d')}
              onMouseUp={() => sendControlCommand('stop')}
              onTouchStart={() => sendControlCommand('d')}
              onTouchEnd={() => sendControlCommand('stop')}
              className={`absolute right-0 w-9 h-9 rounded-xl flex items-center justify-center gap-0.5 transition-all cursor-pointer border ${
                activeMotion === 'd' || activeMotion === 'wd' || activeMotion === 'sd'
                  ? 'bg-[#F2EFE9] text-[#262626] border-white scale-95 shadow-md'
                  : 'bg-stone-900/90 text-stone-200 border-white/10 hover:bg-stone-800'
              }`}
              title="Xoay Phải (D / Phím Phải)"
            >
              <span className="text-[7px] font-mono leading-none font-bold opacity-60">D</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* S - Lùi */}
            <button
              onMouseDown={() => sendControlCommand('s')}
              onMouseUp={() => sendControlCommand('stop')}
              onTouchStart={() => sendControlCommand('s')}
              onTouchEnd={() => sendControlCommand('stop')}
              className={`absolute bottom-0 w-9 h-9 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                activeMotion === 's' || activeMotion === 'sa' || activeMotion === 'sd'
                  ? 'bg-[#F2EFE9] text-[#262626] border-white scale-95 shadow-md'
                  : 'bg-stone-900/90 text-stone-200 border-white/10 hover:bg-stone-800'
              }`}
              title="Lùi (S / Phím Xuống)"
            >
              <span className="text-[7px] font-mono leading-none font-bold opacity-60">S</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Offline / Error Overlay */}
        {(!isStreaming || streamError) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stone-950/95">
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
                  ? 'Không thể kết nối Camera'
                  : 'Camera Stream đang tạm dừng'}
              </h3>
              <p className="text-[11px] text-stone-400 max-w-xs">
                {streamError
                  ? 'Kiểm tra SSH tunnel và camera_stream.py trên Pi 5 đang chạy.'
                  : 'Nhấn nút Play để tiếp tục xem stream.'}
              </p>
            </div>
            {streamError && (
              <button
                onClick={() => {
                  setStreamError(false);
                  setIsStreaming(true);
                  checkHealth();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-[#F2EFE9] text-[#262626] rounded-xl text-xs font-bold hover:bg-white transition-all cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử kết nối lại</span>
              </button>
            )}
            {!isStreaming && !streamError && (
              <button
                onClick={toggleStream}
                className="flex items-center gap-2 px-4 py-2 bg-[#262626] text-[#F2EFE9] border border-[#BFBFBD] rounded-xl text-xs font-bold hover:bg-black transition-all cursor-pointer"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Bật Camera Stream</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4 text-[10px] font-semibold text-[#8C8C8C]">
          <span className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: isConnected ? '#262626' : '#8C8C8C' }}
            />
            <span style={{ color: isConnected ? '#262626' : '#8C8C8C' }}>
              {isConnected ? 'Pi5 Online' : 'Pi5 Offline'}
            </span>
          </span>
          <span className="text-[#BFBFBD]">|</span>
          <span className="font-mono">{streamUrl}</span>
          {lastHealthCheck && (
            <>
              <span className="text-[#BFBFBD]">|</span>
              <span>
                Last check:{' '}
                {lastHealthCheck.toLocaleTimeString('vi-VN')}
              </span>
            </>
          )}
        </div>
        <div className="text-[10px] font-bold text-[#8C8C8C]">
          SSH Tunnel Required: <code className="px-1.5 py-0.5 rounded bg-[#E9E5DC] text-[#262626] border border-[#BFBFBD] font-mono text-[9px]">ssh -L 8554:localhost:8554 pi@PI5_IP -N</code>
        </div>
      </div>
    </div>
  );
};
