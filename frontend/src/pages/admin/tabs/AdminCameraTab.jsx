import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';

const DEFAULT_STREAM_URL = 'http://100.99.72.51:8554/stream';
const HEALTH_CHECK_INTERVAL_MS = 5000;

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

  const reloadStream = () => {
    setStreamKey(Date.now());
    setStreamError(false);
    setIsStreaming(true);
  };

  // Teleop Motion state
  const [activeMotion, setActiveMotion] = useState('stop');
  const [controlIp, setControlIp] = useState(() => import.meta.env.VITE_PI5_IP || '100.99.72.51');
  const [speed, setSpeed] = useState(75);
  const speedRef = useRef(75);

  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const pressedKeysRef = useRef(new Set());
  const activeMotionRef = useRef('stop');

  const handleSpeedChange = useCallback(
    async (newSpeed) => {
      const clamped = Math.max(20, Math.min(100, newSpeed));
      setSpeed(clamped);
      speedRef.current = clamped;
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
      setActiveMotion(cmd);
      activeMotionRef.current = cmd;
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

  const handleStreamError = () => {
    setStreamError(true);
    setIsConnected(false);
  };

  const handleStreamLoad = () => {
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
              streamError ? 'hidden' : 'block'
            }`}
          />
        ) : null}

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
