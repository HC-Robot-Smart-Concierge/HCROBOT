import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FoxgloveViewer } from '@foxglove/embed';
import { fetchRos2RuntimeStatus } from '../../services/workflowApi';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Maximize2,
  Play,
  Radar,
  RefreshCw,
  ScanLine,
} from 'lucide-react';

const HCROBOT_SLAM_LAYOUT = {
  version: 1,
  content: {
    type: 'panel',
    panelType: 'ThreeDee',
    version: 1,
    title: 'HCROBOT SLAM realtime',
    config: {
      fixedFrame: 'map',
      followTf: 'base_link',
      followMode: 'follow-position',
      publish: {
        type: 'pose',
        poseTopic: '/goal_pose',
        poseEstimateTopic: '/initialpose',
        pointTopic: '/clicked_point',
        poseEstimateXDeviation: 0.5,
        poseEstimateYDeviation: 0.5,
        poseEstimateThetaDeviation: 0.26,
      },
      cameraState: {
        distance: 14,
        perspective: false,
        phi: 0,
        thetaOffset: 0,
        target: [0, 0, 0],
        targetOffset: [0, 0, 0],
      },
      scene: {
        backgroundColor: '#111827',
        transforms: {
          visible: false,
          showLabel: false,
          axisSize: 0.25,
          lineWidth: 1,
        },
      },
      topics: {
        '/map': {
          visible: true,
          colorMode: 'map',
          alpha: 1,
          drawBehind: true,
          frameLocked: false,
        },
        '/scan': {
          visible: true,
          pointSize: 4,
          pointShape: 'circle',
          decayTime: 0,
          colorMode: 'flat',
          flatColor: '#ff2bd6',
          frameLocked: true,
        },
      },
      layers: {
        'hcrobot-floor-grid': {
          instanceId: 'hcrobot-floor-grid',
          layerId: 'foxglove.Grid',
          label: 'Lưới tọa độ map',
          visible: true,
          frameId: 'map',
          size: 30,
          divisions: 60,
          lineWidth: 1,
          color: '#47556988',
          drawBehind: true,
          position: [0, 0, -0.02],
          rotation: [0, 0, 0],
        },
      },
    },
  },
};

export const buildFoxgloveWsUrl = (host = '127.0.0.1', port = 8765) =>
  `ws://${host}:${port}`;

export const buildFoxgloveWebUrl = (websocketUrl) => {
  const query = new URLSearchParams({
    ds: 'foxglove-websocket',
    'ds.url': websocketUrl,
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
  const [viewerKey, setViewerKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBridgeReachable, setIsBridgeReachable] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [viewerError, setViewerError] = useState('');
  const containerRef = useRef(null);
  const viewerParentRef = useRef(null);

  const websocketUrl = useMemo(() => buildFoxgloveWsUrl(host, port), [host, port]);
  const foxgloveWebUrl = useMemo(() => buildFoxgloveWebUrl(websocketUrl), [websocketUrl]);

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

  useEffect(() => {
    if (!viewerParentRef.current) return undefined;

    setViewerError('');
    const viewer = new FoxgloveViewer({
      parent: viewerParentRef.current,
      orgSlug: import.meta.env.VITE_FOXGLOVE_ORG_SLUG || undefined,
      colorScheme: 'dark',
      embeddedViewer: 'React',
      initialDataSource: {
        type: 'live',
        protocol: 'foxglove-websocket',
        url: websocketUrl,
      },
      initialLayoutParams: {
        storageKey: 'hcrobot-slam-realtime-v1',
        layout: HCROBOT_SLAM_LAYOUT,
      },
    });

    const handleViewerError = (event) => {
      setViewerError(event.detail || 'Foxglove Embed không tải được.');
    };
    viewer.addEventListener('error', handleViewerError);

    const iframe = viewerParentRef.current.querySelector('iframe');
    if (iframe) {
      iframe.title = 'Foxglove ROS 2 SLAM realtime';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = '0';
      iframe.setAttribute('allow', 'fullscreen');
    }

    return () => {
      viewer.removeEventListener('error', handleViewerError);
      viewer.destroy();
    };
  }, [viewerKey, websocketUrl]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleReload = () => {
    setViewerKey((current) => current + 1);
    checkConnection();
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col rounded-xl overflow-hidden border border-[#BFBFBD] bg-[#111827]"
    >
      <div className="h-10 px-3 bg-[#111317] border-b border-[#2A2E39] flex items-center justify-between text-xs text-[#BFBFBD] shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold tracking-wide text-white">
            <Radar className="w-4 h-4 text-cyan-400" />
            <span>FOXGLOVE ROS 2 • SLAM REALTIME</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border border-[#333846] bg-[#1A1E27]">
            {isBridgeReachable ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="text-emerald-300">FOXGLOVE BRIDGE ONLINE (:8765)</span>
              </>
            ) : isChecking ? (
              <>
                <RefreshCw className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
                <span className="text-amber-300">ĐANG KIỂM TRA...</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                <span className="text-rose-300">OFFLINE (CHƯA BẬT :8765)</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReload}
            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-[#222733] hover:bg-[#2C3242] text-stone-200 border border-[#384054] flex items-center gap-1.5 transition-all cursor-pointer"
            title="Tải lại Foxglove"
          >
            <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Tải lại</span>
          </button>
          <a
            href={foxgloveWebUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-[#222733] hover:bg-[#2C3242] text-stone-200 border border-[#384054] flex items-center gap-1.5 transition-all cursor-pointer"
            title="Mở Foxglove trong tab riêng"
          >
            <ExternalLink className="w-3 h-3 text-stone-400" />
            <span>Foxglove riêng</span>
          </a>
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="p-1.5 rounded bg-[#222733] hover:bg-[#2C3242] text-stone-200 border border-[#384054] transition-all cursor-pointer"
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            <Maximize2 className="w-3.5 h-3.5 text-stone-400" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-[#111827]">
        <div key={viewerKey} ref={viewerParentRef} className="absolute inset-0" />

        {viewerError && isBridgeReachable && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-xl rounded-lg border border-amber-400/40 bg-amber-950/90 px-4 py-2 text-xs text-amber-100 shadow-xl">
            Không nhúng được Foxglove: {viewerError} Hãy dùng nút <strong>Foxglove riêng</strong>.
          </div>
        )}

        {isBridgeReachable === false && (
          <div className="absolute inset-0 bg-[#111317]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-stone-200 z-10">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3">
              <Radar className="w-6 h-6 text-cyan-300" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">CHƯA KẾT NỐI FOXGLOVE BRIDGE (:8765)</h3>
            <p className="text-xs text-stone-400 max-w-lg mb-4 leading-relaxed">
              Chọn chế độ bên dưới. Backend sẽ tự bật WSL2, ROS 2, Foxglove Bridge và layout map realtime.
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
                <span className="block text-[10px] text-stone-400 mt-1">SLAM Toolbox cập nhật /map từ LiDAR realtime.</span>
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
                <span>Đang khởi động ROS 2 và Foxglove...</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleReload}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử kết nối lại</span>
            </button>
          </div>
        )}
      </div>

      <div className="h-6 px-3 bg-[#111317] border-t border-[#2A2E39] flex items-center justify-between text-[11px] text-stone-400 font-mono shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold">FOXGLOVE:</span>
          <span>Fixed frame: map • Hiển thị: /map + /scan + /tf • Robot: /robot_description</span>
        </div>
        <span className="text-[10px] text-stone-500">Foxglove WebSocket Protocol</span>
      </div>
    </div>
  );
};
