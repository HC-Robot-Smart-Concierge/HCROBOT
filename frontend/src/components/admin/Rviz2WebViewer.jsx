import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ExternalLink,
  Maximize2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Compass,
  Play,
  ScanLine,
  Loader2,
} from 'lucide-react';

export const buildRvizVncUrl = (host = '127.0.0.1', port = 6080, options = {}) => {
  const { autoconnect = true, resize = 'scale', reconnect = true } = options;
  const baseUrl = `http://${host}:${port}/vnc.html`;
  const params = new URLSearchParams({
    autoconnect: String(autoconnect),
    resize,
    reconnect: String(reconnect),
  });
  return `${baseUrl}?${params.toString()}`;
};

export const Rviz2WebViewer = ({
  host = '127.0.0.1',
  port = 6080,
  onStartMapping,
  onStartNavigation,
  isRuntimeBusy = false,
  activeMapName = 'phong_lam_viec',
}) => {
  const [iframeKey, setIframeKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isServerReachable, setIsServerReachable] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const containerRef = useRef(null);

  const streamUrl = buildRvizVncUrl(host, port);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      await fetch(`http://${host}:${port}/vnc.html`, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      setIsServerReachable(true);
    } catch {
      setIsServerReachable(false);
    } finally {
      setIsChecking(false);
    }
  }, [host, port]);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 12000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  const handleReload = () => {
    setIframeKey((prev) => prev + 1);
    checkConnection();
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col rounded-xl overflow-hidden border border-[#BFBFBD] bg-[#191C23]"
    >
      {/* Control Toolbar */}
      <div className="h-10 px-3 bg-[#111317] border-b border-[#2A2E39] flex items-center justify-between text-xs text-[#BFBFBD] shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold tracking-wide text-white">
            <Compass className="w-4 h-4 text-emerald-400" />
            <span>ROS 2 RVIZ2 3D LIVE</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border border-[#333846] bg-[#1A1E27]">
            {isServerReachable ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="text-emerald-300">STREAMING ONLINE (:6080)</span>
              </>
            ) : isChecking ? (
              <>
                <RefreshCw className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
                <span className="text-amber-300">DANG KIEM TRA...</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                <span className="text-rose-300">OFFLINE (CHUA BAT RVIZ WEB)</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReload}
            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-[#222733] hover:bg-[#2C3242] text-stone-200 border border-[#384054] flex items-center gap-1.5 transition-all cursor-pointer"
            title="Tai lai luong VNC"
          >
            <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Tai Lai</span>
          </button>

          <a
            href={streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-[#222733] hover:bg-[#2C3242] text-stone-200 border border-[#384054] flex items-center gap-1.5 transition-all cursor-pointer"
            title="Mo RViz2 trong tab trinh duyet rieng"
          >
            <ExternalLink className="w-3 h-3 text-stone-400" />
            <span>Tab Rieng</span>
          </a>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="p-1.5 text-[11px] font-semibold rounded bg-[#222733] hover:bg-[#2C3242] text-stone-200 border border-[#384054] flex items-center gap-1 transition-all cursor-pointer"
            title={isFullscreen ? 'Thu nho' : 'Toan man hinh'}
          >
            <Maximize2 className="w-3.5 h-3.5 text-stone-400" />
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-black">
        <iframe
          key={iframeKey}
          src={streamUrl}
          title="ROS 2 RViz2 SLAM Web Stream"
          className="w-full h-full border-0 block"
          allow="fullscreen"
        />

        {/* Offline Banner / Launch Helper */}
        {isServerReachable === false && (
          <div className="absolute inset-0 bg-[#111317]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-stone-200 z-10">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3">
              <Terminal className="w-6 h-6 text-rose-400" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              CHUA KET NOI DUOC VOI RVIZ2 WEB SERVER (:6080)
            </h3>
            <p className="text-xs text-stone-400 max-w-lg mb-4 leading-relaxed">
              Chọn chế độ bên dưới. Backend sẽ tự bật WSL2, ROS 2, Rosbridge và RViz; không cần chạy lệnh PowerShell.
            </p>

            <div className="grid grid-cols-2 gap-3 max-w-xl w-full mb-4">
              <button
                type="button"
                onClick={onStartMapping}
                disabled={isRuntimeBusy || !onStartMapping}
                className="p-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-50 text-left transition-colors cursor-pointer"
              >
                <ScanLine className="w-5 h-5 text-cyan-300 mb-1.5" />
                <span className="block text-xs font-bold text-white">BẮT ĐẦU QUÉT MAP</span>
                <span className="block text-[10px] text-stone-400 mt-1">Slam Toolbox cập nhật vật cản cố định vào map.</span>
              </button>
              <button
                type="button"
                onClick={onStartNavigation}
                disabled={isRuntimeBusy || !onStartNavigation}
                className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50 text-left transition-colors cursor-pointer"
              >
                <Play className="w-5 h-5 text-amber-300 mb-1.5" />
                <span className="block text-xs font-bold text-white">CHẠY NAVIGATION</span>
                <span className="block text-[10px] text-stone-400 mt-1">Nạp map tĩnh: {activeMapName || 'chưa chọn'}</span>
              </button>
            </div>

            {isRuntimeBusy && (
              <div className="flex items-center gap-2 mb-3 text-xs text-amber-300 font-mono">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang khởi động ROS 2, vui lòng chờ...</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReload}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thu Ket Noi Lai</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Hint Bar */}
      <div className="h-6 px-3 bg-[#111317] border-t border-[#2A2E39] flex items-center justify-between text-[11px] text-stone-400 font-mono shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold">RVIZ2 TIPS:</span>
          <span>Click "2D Goal Pose" tren thanh cong cu cua RViz de ra lenh xe tu hanh Nav2.</span>
        </div>
        <div className="text-[10px] text-stone-500">
          Render: OpenGL 4.5 Mesa / C++ OGRE Engine
        </div>
      </div>
    </div>
  );
};
