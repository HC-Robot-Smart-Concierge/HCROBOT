import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchRos2RuntimeStatus } from '../../services/workflowApi';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  MonitorUp,
  Play,
  Radar,
  RefreshCw,
  ScanLine,
} from 'lucide-react';

export const buildFoxgloveWsUrl = (host = '127.0.0.1', port = 8765) =>
  `ws://${host}:${port}`;

export const buildFoxgloveWebUrl = (websocketUrl) => {
  const query = new URLSearchParams({
    ds: 'foxglove-websocket',
    'ds.url': websocketUrl,
    openIn: 'web',
  });
  return `https://app.foxglove.dev/~/view?${query.toString()}`;
};

export const buildFoxgloveDesktopUrl = (websocketUrl) => {
  const query = new URLSearchParams({
    ds: 'foxglove-websocket',
    'ds.url': websocketUrl,
    openIn: 'desktop',
  });
  return `https://app.foxglove.dev/~/view?${query.toString()}`;
};

export const FoxgloveWebViewer = ({
  host = '127.0.0.1',
  port = 8765,
  onStartMapping,
  onStartNavigation,
  isRuntimeBusy = false,
  activeMapName = 'phong_lam_viec',
}) => {
  const [isBridgeReachable, setIsBridgeReachable] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const websocketUrl = useMemo(() => buildFoxgloveWsUrl(host, port), [host, port]);
  const foxgloveWebUrl = useMemo(() => buildFoxgloveWebUrl(websocketUrl), [websocketUrl]);
  const foxgloveDesktopUrl = useMemo(() => buildFoxgloveDesktopUrl(websocketUrl), [websocketUrl]);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      const runtime = await fetchRos2RuntimeStatus();
      setIsBridgeReachable(Boolean(runtime?.foxglove_online));
    } catch {
      setIsBridgeReachable(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
    const intervalId = window.setInterval(checkConnection, 10000);
    return () => window.clearInterval(intervalId);
  }, [checkConnection]);

  return (
    <div className="relative w-full h-full flex flex-col rounded-xl overflow-hidden border border-[#BFBFBD] bg-[#111827]">
      <div className="h-10 px-3 bg-[#111317] border-b border-[#2A2E39] flex items-center justify-between text-xs text-[#BFBFBD] shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold tracking-wide text-white">
            <Radar className="w-4 h-4 text-cyan-400" />
            <span>FOXGLOVE ROS 2 • TAB RIÊNG</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border border-[#333846] bg-[#1A1E27]">
            {isBridgeReachable ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="text-emerald-300">BRIDGE ONLINE (:8765)</span>
              </>
            ) : isChecking ? (
              <>
                <RefreshCw className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
                <span className="text-amber-300">ĐANG KIỂM TRA...</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                <span className="text-rose-300">BRIDGE OFFLINE (:8765)</span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={checkConnection}
          className="px-2.5 py-1 text-[11px] font-semibold rounded bg-[#222733] hover:bg-[#2C3242] text-stone-200 border border-[#384054] flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
          <span>Kiểm tra lại</span>
        </button>
      </div>

      <div className="relative flex-1 min-h-0 overflow-y-auto bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#082f49] px-6 py-8 flex items-center justify-center">
        <div className="w-full max-w-3xl rounded-2xl border border-cyan-400/20 bg-[#0b1220]/90 shadow-2xl p-6 text-stone-100">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-cyan-400/10 border border-cyan-300/30 flex items-center justify-center mb-4">
              <MonitorUp className="w-8 h-8 text-cyan-300" />
            </div>
            <h2 className="text-xl font-extrabold text-white">Mở bản đồ realtime trong Foxglove</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              Foxglove không được nhúng trong Web Admin vì tính năng Embed cần gói trả phí.
              Dữ liệu ROS 2 vẫn truyền trực tiếp từ Foxglove Bridge qua <strong>{websocketUrl}</strong>.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <a
                href={foxgloveWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-cyan-950/40 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>MỞ FOXGLOVE TAB RIÊNG</span>
              </a>
              <a
                href="/foxglove/hcrobot-slam-layout.json"
                download="hcrobot-slam-layout.json"
                className="px-4 py-3 rounded-xl border border-emerald-400/40 bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-200 font-bold text-sm flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>TẢI LAYOUT 2D</span>
              </a>
              <a
                href={foxgloveDesktopUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3 rounded-xl border border-slate-500 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center gap-2 transition-colors"
              >
                <MonitorUp className="w-4 h-4" />
                <span>MỞ APP DESKTOP</span>
              </a>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <h3 className="text-xs font-extrabold text-cyan-300">THIẾT LẬP MỘT LẦN ĐỂ GIỐNG ẢNH MẪU</h3>
              <ol className="mt-3 list-decimal pl-5 space-y-2 text-xs leading-relaxed text-slate-300">
                <li>Tải file <strong>hcrobot-slam-layout.json</strong>.</li>
                <li>Trong Foxglove chọn <strong>Layouts → Import from file</strong>.</li>
                <li>Chọn layout <strong>HCROBOT SLAM 2D</strong>.</li>
                <li>Fixed frame và Display frame đều là <strong>map</strong>, Follow mode là <strong>Off</strong>.</li>
                <li>Bật topic <strong>/foxglove/robot_marker</strong>; không thêm URDF custom layer vì Foxglove Web phóng sai primitive trên máy này.</li>
                <li>Các lớp local/global costmap, Grid xanh và nhãn TF đã được tắt để bản đồ dễ nhìn.</li>
              </ol>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
              <h3 className="text-xs font-extrabold text-amber-300">KHỞI ĐỘNG ROS 2</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onStartMapping}
                  disabled={isRuntimeBusy || !onStartMapping}
                  className="p-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-50 text-left transition-colors cursor-pointer"
                >
                  <ScanLine className="w-4 h-4 text-cyan-300 mb-1" />
                  <span className="block text-xs font-bold text-white">QUÉT MAP</span>
                  <span className="block text-[10px] text-slate-400 mt-1">SLAM Toolbox realtime</span>
                </button>
                <button
                  type="button"
                  onClick={onStartNavigation}
                  disabled={isRuntimeBusy || !onStartNavigation}
                  className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-50 text-left transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4 text-amber-300 mb-1" />
                  <span className="block text-xs font-bold text-white">NAVIGATION</span>
                  <span className="block text-[10px] text-slate-400 mt-1">Map: {activeMapName || 'chưa chọn'}</span>
                </button>
              </div>
              {isRuntimeBusy && (
                <div className="mt-3 flex items-center gap-2 text-xs text-amber-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang khởi động ROS 2...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="h-7 px-3 bg-[#111317] border-t border-[#2A2E39] flex items-center justify-between text-[11px] text-stone-400 font-mono shrink-0 select-none">
        <span><strong className="text-cyan-400">TOPICS:</strong> /map • /scan • /tf • /foxglove/robot_marker</span>
        <span>Viewer: app.foxglove.dev</span>
      </div>
    </div>
  );
};
