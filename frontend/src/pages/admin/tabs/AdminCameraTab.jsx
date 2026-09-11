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
  Square,
  Gamepad2,
  Navigation,
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

  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const sendControlCommand = useCallback(
    async (cmd) => {
      setActiveMotion(cmd);
      try {
        await fetch('/api/v1/operations/robot/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: cmd,
            target_ip: controlIp,
            port: 9999,
          }),
        });
      } catch (err) {
        console.warn('Control command error:', err);
      }
    },
    [controlIp]
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        ['input', 'textarea'].includes(
          document.activeElement?.tagName?.toLowerCase()
        )
      )
        return;
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') sendControlCommand('w');
      else if (key === 's' || key === 'arrowdown') sendControlCommand('s');
      else if (key === 'a' || key === 'arrowleft') sendControlCommand('a');
      else if (key === 'd' || key === 'arrowright') sendControlCommand('d');
      else if (key === ' ' || key === 'x') sendControlCommand('stop');
    };

    const handleKeyUp = (e) => {
      if (
        ['input', 'textarea'].includes(
          document.activeElement?.tagName?.toLowerCase()
        )
      )
        return;
      const key = e.key.toLowerCase();
      if (
        [
          'w',
          's',
          'a',
          'd',
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
        ].includes(key)
      ) {
        sendControlCommand('stop');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [sendControlCommand]);

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

        {/* On-Screen D-Pad Teleop Controller Overlay */}
        <div className="absolute bottom-4 right-4 z-10 p-3 bg-black/65 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center gap-1.5 select-none">
          <div className="flex items-center gap-1 text-[9px] font-bold text-white/70 uppercase tracking-wider mb-0.5">
            <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>WASD Teleop Control</span>
          </div>

          {/* Up (W) */}
          <button
            onMouseDown={() => sendControlCommand('w')}
            onMouseUp={() => sendControlCommand('stop')}
            onTouchStart={() => sendControlCommand('w')}
            onTouchEnd={() => sendControlCommand('stop')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
              activeMotion === 'w'
                ? 'bg-emerald-500 text-white border-emerald-400 scale-95'
                : 'bg-stone-800/80 text-stone-200 border-white/10 hover:bg-stone-700'
            }`}
            title="Tiến (W / ArrowUp)"
          >
            <ChevronUp className="w-5 h-5" />
          </button>

          {/* Left - Stop - Right */}
          <div className="flex items-center gap-1.5">
            <button
              onMouseDown={() => sendControlCommand('a')}
              onMouseUp={() => sendControlCommand('stop')}
              onTouchStart={() => sendControlCommand('a')}
              onTouchEnd={() => sendControlCommand('stop')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                activeMotion === 'a'
                  ? 'bg-emerald-500 text-white border-emerald-400 scale-95'
                  : 'bg-stone-800/80 text-stone-200 border-white/10 hover:bg-stone-700'
              }`}
              title="Quẹo Trái (A / ArrowLeft)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={() => sendControlCommand('stop')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                activeMotion === 'stop'
                  ? 'bg-red-600/80 text-white border-red-500'
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
                  ? 'bg-emerald-500 text-white border-emerald-400 scale-95'
                  : 'bg-stone-800/80 text-stone-200 border-white/10 hover:bg-stone-700'
              }`}
              title="Quẹo Phải (D / ArrowRight)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Down (S) */}
          <button
            onMouseDown={() => sendControlCommand('s')}
            onMouseUp={() => sendControlCommand('stop')}
            onTouchStart={() => sendControlCommand('s')}
            onTouchEnd={() => sendControlCommand('stop')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
              activeMotion === 's'
                ? 'bg-emerald-500 text-white border-emerald-400 scale-95'
                : 'bg-stone-800/80 text-stone-200 border-white/10 hover:bg-stone-700'
            }`}
            title="Lùi (S / ArrowDown)"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
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
