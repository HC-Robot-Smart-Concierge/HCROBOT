import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video,
  VideoOff,
  RefreshCw,
  Maximize2,
  Minimize2,
  Signal,
  SignalZero,
  Settings2,
  Camera,
  Circle,
  Download,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowDownRight,
  Square,
  Gamepad2,
  Navigation,
  Gauge,
} from 'lucide-react';

const DEFAULT_STREAM_URL = 'http://100.73.245.66:8554/stream';
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

  // Teleop Motion state
  const [activeMotion, setActiveMotion] = useState('stop');
  const [controlIp, setControlIp] = useState('100.73.245.66');
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
    <div className="w-full h-full flex flex-col p-6 gap-5">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#18181B] text-white flex items-center justify-center shadow-sm">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-stone-900 tracking-tight">
              Pi5 Camera Monitor
            </h2>
            <p className="text-[11px] font-semibold text-stone-500">
              MJPEG Live Stream từ Raspberry Pi 5 qua SSH Tunnel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${
              isConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-600 border-red-200'
            }`}
          >
            {isConnected ? (
              <Signal className="w-3.5 h-3.5" />
            ) : (
              <SignalZero className="w-3.5 h-3.5" />
            )}
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>

          {/* Settings Toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              showSettings
                ? 'bg-[#18181B] text-white'
                : 'text-stone-500 hover:text-stone-900 hover:bg-[#EFECE6]'
            }`}
            title="Cấu hình Stream URL"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Panel (Collapsible) */}
      {showSettings && (
        <form
          onSubmit={handleApplyUrl}
          className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-[#E5E1D8] shadow-sm animate-fadeIn"
        >
          <label className="text-[11px] font-bold text-stone-600 whitespace-nowrap">
            Stream URL
          </label>
          <input
            type="text"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="http://localhost:8554/stream"
            className="flex-1 px-3 py-2 bg-[#FAF8F5] border border-[#E0DCD3] rounded-xl text-xs font-mono text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-600"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-[#18181B] text-white rounded-xl text-[11px] font-bold hover:bg-stone-800 transition-all cursor-pointer"
          >
            Apply
          </button>
        </form>
      )}

      {/* Camera Stream Viewport */}
      <div
        ref={containerRef}
        className={`relative flex-1 bg-black rounded-2xl overflow-hidden border-2 transition-all ${
          isConnected && !streamError
            ? 'border-emerald-500/30'
            : 'border-stone-700/50'
        } ${isFullscreen ? 'rounded-none' : ''}`}
      >
        {/* Stream Controls Overlay - Top */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
          {/* Left: Status Badge */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md text-[10px] font-bold border ${
                isStreaming && !streamError
                  ? 'bg-black/60 text-emerald-400 border-emerald-500/30'
                  : 'bg-black/60 text-red-400 border-red-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isStreaming && !streamError
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-red-400'
                }`}
              />
              <span>
                {isStreaming
                  ? streamError
                    ? 'ERROR'
                    : 'LIVE'
                  : 'PAUSED'}
              </span>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white/70 text-[9px] font-mono font-bold border border-white/10">
              PI5 MJPEG 1080p (Full HD)
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={takeSnapshot}
              disabled={!isStreaming || streamError}
              className="p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white/80 hover:text-white border border-white/10 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Chụp ảnh"
            >
              <Circle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={toggleStream}
              className="p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white/80 hover:text-white border border-white/10 transition-all cursor-pointer"
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
              className="p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white/80 hover:text-white border border-white/10 transition-all cursor-pointer"
              title={isFullscreen ? 'Thoát fullscreen' : 'Fullscreen'}
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
            ref={imgRef}
            src={streamUrl}
            alt="Pi5 Camera Stream"
            crossOrigin="anonymous"
            onError={handleStreamError}
            onLoad={handleStreamLoad}
            className={`w-full h-full object-contain ${
              streamError ? 'hidden' : 'block'
            }`}
          />
        ) : null}

        {/* On-Screen D-Pad Teleop Controller Overlay (8 Hướng + Dừng khẩn) */}
        <div className="absolute bottom-4 right-4 z-10 p-3 bg-black/75 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center gap-2 select-none">
          <div className="flex items-center justify-between w-full px-1 text-[9px] font-bold text-white/70 uppercase tracking-wider">
            <div className="flex items-center gap-1">
              <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>WASD Teleop Control</span>
            </div>
            <span
              className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold ${
                activeMotion !== 'stop'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-stone-400'
              }`}
            >
              {activeMotion.toUpperCase()}
            </span>
          </div>

          {/* Speed Presets Selector */}
          <div className="flex items-center justify-between w-full bg-stone-900/90 px-2 py-1 rounded-xl border border-white/10 text-[10px]">
            <div className="flex items-center gap-1 text-stone-400 font-medium">
              <Gauge className="w-3 h-3 text-amber-400" />
              <span>Tốc độ:</span>
            </div>
            <div className="flex items-center gap-1">
              {[
                { val: 50, label: '50%' },
                { val: 75, label: '75%' },
                { val: 100, label: '100%' },
              ].map((lvl) => (
                <button
                  key={lvl.val}
                  onClick={() => handleSpeedChange(lvl.val)}
                  className={`px-1.5 py-0.5 rounded-lg font-mono text-[9px] font-bold transition-all cursor-pointer ${
                    speed === lvl.val
                      ? 'bg-amber-500 text-stone-950 shadow-sm shadow-amber-500/30'
                      : 'text-stone-300 hover:text-white hover:bg-white/10'
                  }`}
                  title={`Cài đặt vận tốc ${lvl.label} (Phím tắt: ${lvl.val === 50 ? '1' : lvl.val === 75 ? '2' : '3'})`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lưới 3x3: Tiến-Trái, Tiến, Tiến-Phải / Trái, Dừng, Phải / Lùi-Trái, Lùi, Lùi-Phải */}
          <div className="grid grid-cols-3 gap-1.5">
            {/* Hàng 1: WA, W, WD */}
            <button
              onMouseDown={() => sendControlCommand('wa')}
              onMouseUp={() => sendControlCommand('stop')}
              onTouchStart={() => sendControlCommand('wa')}
              onTouchEnd={() => sendControlCommand('stop')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                activeMotion === 'wa'
                  ? 'bg-emerald-500 text-white border-emerald-400 scale-95 shadow-lg shadow-emerald-500/30'
                  : 'bg-stone-800/80 text-stone-300 border-white/10 hover:bg-stone-700'
              }`}
              title="Tiến - Quẹo Trái (W+A)"
            >
              <ArrowUpLeft className="w-4 h-4" />
            </button>

            <button
              onMouseDown={() => sendControlCommand('w')}
              onMouseUp={() => sendControlCommand('stop')}
              onTouchStart={() => sendControlCommand('w')}
              onTouchEnd={() => sendControlCommand('stop')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                activeMotion === 'w'
                  ? 'bg-emerald-500 text-white border-emerald-400 scale-95 shadow-lg shadow-emerald-500/30'
                  : 'bg-stone-800/80 text-stone-200 border-white/10 hover:bg-stone-700'
              }`}
              title="Tiến (W / ArrowUp)"
            >
              <ChevronUp className="w-5 h-5" />
            </button>

            <button
              onMouseDown={() => sendControlCommand('wd')}
              onMouseUp={() => sendControlCommand('stop')}
              onTouchStart={() => sendControlCommand('wd')}
              onTouchEnd={() => sendControlCommand('stop')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                activeMotion === 'wd'
                  ? 'bg-emerald-500 text-white border-emerald-400 scale-95 shadow-lg shadow-emerald-500/30'
                  : 'bg-stone-800/80 text-stone-300 border-white/10 hover:bg-stone-700'
              }`}
              title="Tiến - Quẹo Phải (W+D)"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>

            {/* Hàng 2: A, Stop, D */}
            <button
              onMouseDown={() => sendControlCommand('a')}
              onMouseUp={() => sendControlCommand('stop')}
              onTouchStart={() => sendControlCommand('a')}
              onTouchEnd={() => sendControlCommand('stop')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                activeMotion === 'a'
                  ? 'bg-emerald-500 text-white border-emerald-400 scale-95 shadow-lg shadow-emerald-500/30'
                  : 'bg-stone-800/80 text-stone-200 border-white/10 hover:bg-stone-700'
              }`}
              title="Xoay Trái tại chỗ (A / ArrowLeft)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={() => sendControlCommand('stop')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                activeMotion === 'stop'
                  ? 'bg-red-600/90 text-white border-red-500 shadow-lg shadow-red-500/20'
                  : 'bg-stone-800/80 text-red-400 border-white/10 hover:bg-red-900/50'
              }`}
              title="Dừng Khẩn Cấp (Space / X)"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>

            <button
              onMouseDown={() => sendControlCommand('d')}
              onMouseUp={() => sendControlCommand('stop')}
              onTouchStart={() => sendControlCommand('d')}
              onTouchEnd={() => sendControlCommand('stop')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                activeMotion === 'd'
                  ? 'bg-emerald-500 text-white border-emerald-400 scale-95 shadow-lg shadow-emerald-500/30'
                  : 'bg-stone-800/80 text-stone-200 border-white/10 hover:bg-stone-700'
              }`}
              title="Xoay Phải tại chỗ (D / ArrowRight)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Hàng 3: SA, S, SD */}
            <button
              onMouseDown={() => sendControlCommand('sa')}
              onMouseUp={() => sendControlCommand('stop')}
              onTouchStart={() => sendControlCommand('sa')}
              onTouchEnd={() => sendControlCommand('stop')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                activeMotion === 'sa'
                  ? 'bg-emerald-500 text-white border-emerald-400 scale-95 shadow-lg shadow-emerald-500/30'
                  : 'bg-stone-800/80 text-stone-300 border-white/10 hover:bg-stone-700'
              }`}
              title="Lùi - Quẹo Trái (S+A)"
            >
              <ArrowDownLeft className="w-4 h-4" />
            </button>

            <button
              onMouseDown={() => sendControlCommand('s')}
              onMouseUp={() => sendControlCommand('stop')}
              onTouchStart={() => sendControlCommand('s')}
              onTouchEnd={() => sendControlCommand('stop')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                activeMotion === 's'
                  ? 'bg-emerald-500 text-white border-emerald-400 scale-95 shadow-lg shadow-emerald-500/30'
                  : 'bg-stone-800/80 text-stone-200 border-white/10 hover:bg-stone-700'
              }`}
              title="Lùi (S / ArrowDown)"
            >
              <ChevronDown className="w-5 h-5" />
            </button>

            <button
              onMouseDown={() => sendControlCommand('sd')}
              onMouseUp={() => sendControlCommand('stop')}
              onTouchStart={() => sendControlCommand('sd')}
              onTouchEnd={() => sendControlCommand('stop')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                activeMotion === 'sd'
                  ? 'bg-emerald-500 text-white border-emerald-400 scale-95 shadow-lg shadow-emerald-500/30'
                  : 'bg-stone-800/80 text-stone-300 border-white/10 hover:bg-stone-700'
              }`}
              title="Lùi - Quẹo Phải (S+D)"
            >
              <ArrowDownRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Offline / Error Overlay */}
        {(!isStreaming || streamError) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stone-950/95">
            <div className="w-16 h-16 rounded-2xl bg-stone-800 flex items-center justify-center">
              {streamError ? (
                <SignalZero className="w-8 h-8 text-red-400" />
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
                className="flex items-center gap-2 px-4 py-2 bg-white text-stone-900 rounded-xl text-xs font-bold hover:bg-stone-100 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử kết nối lại</span>
              </button>
            )}
            {!isStreaming && !streamError && (
              <button
                onClick={toggleStream}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-500 transition-all cursor-pointer"
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
        <div className="flex items-center gap-4 text-[10px] font-semibold text-stone-500">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
            {isConnected ? 'Pi5 Online' : 'Pi5 Offline'}
          </span>
          <span className="text-stone-300">|</span>
          <span className="font-mono">{streamUrl}</span>
          {lastHealthCheck && (
            <>
              <span className="text-stone-300">|</span>
              <span>
                Last check:{' '}
                {lastHealthCheck.toLocaleTimeString('vi-VN')}
              </span>
            </>
          )}
        </div>
        <div className="text-[10px] font-bold text-stone-400">
          SSH Tunnel Required: <code className="text-stone-600">ssh -L 8554:localhost:8554 pi@PI5_IP -N</code>
        </div>
      </div>
    </div>
  );
};
