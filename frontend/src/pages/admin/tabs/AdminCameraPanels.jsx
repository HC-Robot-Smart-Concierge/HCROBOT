import React from 'react';
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
  Trash2,
} from 'lucide-react';
import { MOTION_CONFIG } from './adminCameraUtils';

export const AdminCameraViewPanel = ({
  rc,
  canvasRef,
  showSettings,
  setShowSettings,
  handleApplyUrl,
  customUrl,
  setCustomUrl,
  containerRef,
  isFullscreen,
  isStreaming,
  streamError,
  isConnected,
  streamMode,
  setStreamMode,
  webrtcStatus,
  setWebrtcStatus,
  startWebRTC,
  reloadStream,
  takeSnapshot,
  toggleStream,
  toggleFullscreen,
  videoRef,
  imgRef,
  streamKey,
  streamUrl,
  handleStreamError,
  handleStreamLoad,
  telemetry,
  activeMotion,
}) => (
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
        >
          {' '}
          {rc('Apply')}{' '}
        </button>
        <button
          type="button"
          onClick={() => setShowSettings(false)}
          className="px-2.5 py-1.5 bg-stone-100 text-stone-700 rounded-lg text-xs font-bold hover:bg-stone-200 transition-all cursor-pointer border border-stone-300"
        >
          {' '}
          {rc('Close')}{' '}
        </button>
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
        <span className="robot-camera-title">
          <Video size={15} /> Camera FPV <small>Pi 5</small>
        </span>
        {/* Left: Stream Status & Resolution Badges */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md text-[10px] font-bold border bg-[#262626]/85 text-[#F2EFE9] border-white/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F2EFE9] opacity-90" />
            <span>
              {isStreaming ? (streamError ? 'ERROR' : 'LIVE') : 'PAUSED'}
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
            title={
              streamMode === 'webrtc'
                ? 'Che do: WebRTC P2P (click de chuyen sang MJPEG)'
                : 'Che do: MJPEG (click de chuyen sang WebRTC)'
            }
          >
            <Circle
              className={`w-2 h-2 fill-current ${
                webrtcStatus === 'connected' && streamMode === 'webrtc'
                  ? 'animate-pulse text-emerald-400'
                  : 'text-amber-400'
              }`}
            />
            <span>{streamMode === 'webrtc' ? 'WebRTC Live' : 'MJPEG'}</span>
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg backdrop-blur-md border transition-all cursor-pointer ${
              showSettings
                ? 'bg-white text-black border-white'
                : 'bg-[#262626]/85 text-white/80 hover:text-white border-white/20'
            }`}
            title={rc('Configure stream URL')}
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={reloadStream}
            className="p-1.5 rounded-lg bg-[#262626]/85 backdrop-blur-md text-white/80 hover:text-white border border-white/20 transition-all cursor-pointer"
            title={rc('Reconnect camera stream')}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={takeSnapshot}
            disabled={!isStreaming || streamError}
            className="p-1.5 rounded-lg bg-[#262626]/85 backdrop-blur-md text-white/80 hover:text-white border border-white/20 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title={rc('Take snapshot')}
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleStream}
            className="p-1.5 rounded-lg bg-[#262626]/85 backdrop-blur-md text-white/80 hover:text-white border border-white/20 transition-all cursor-pointer"
            title={isStreaming ? rc('Pause stream') : rc('Resume stream')}
          >
            {isStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-[#262626]/85 backdrop-blur-md text-white/80 hover:text-white border border-white/20 transition-all cursor-pointer"
            title={isFullscreen ? rc('Exit fullscreen') : rc('Fullscreen')}
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
        <strong>
          {Number(telemetry?.linearVelocity ?? 0).toFixed(2)} <small>m/s</small>
        </strong>
        <span>
          {activeMotion === 'stop'
            ? rc('Stopped')
            : rc(MOTION_CONFIG[activeMotion]?.label || activeMotion)}
        </span>
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
              {streamError ? rc('Camera unavailable') : rc('Camera stream paused')}
            </h3>
            <p className="text-[11px] text-stone-400 max-w-xs">
              {streamError
                ? rc('Check that the camera stream and its connection to Pi 5 are running.')
                : rc('Press Play to resume the stream.')}
            </p>
          </div>
          {streamError && (
            <button
              onClick={reloadStream}
              className="flex items-center gap-2 px-4 py-2 bg-[#F2EFE9] text-[#262626] rounded-xl text-xs font-bold hover:bg-white transition-all cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span> {rc('Reconnect')} </span>
            </button>
          )}
          {!isStreaming && !streamError && (
            <button
              onClick={toggleStream}
              className="flex items-center gap-2 px-4 py-2 bg-[#262626] text-[#F2EFE9] border border-[#BFBFBD] rounded-xl text-xs font-bold hover:bg-black transition-all cursor-pointer"
            >
              <Video className="w-3.5 h-3.5" />
              <span> {rc('Resume Camera Stream')} </span>
            </button>
          )}
        </div>
      )}
      <div
        className="robot-camera-footer"
        title={streamMode === 'webrtc' ? 'WebRTC P2P Stream' : streamUrl}
      >
        <span>
          <span className={`robot-status-dot ${isConnected ? 'is-online' : ''}`} />{' '}
          {isConnected ? rc('Pi5 Online') : rc('Pi5 Offline')}
        </span>
        <span>{streamMode === 'webrtc' ? 'WebRTC · Ultra Low Latency' : '1080p · MJPEG'}</span>
      </div>
    </div>
  </div>
);

export const AdminCameraLogsPanel = ({
  rc,
  activeMotion,
  speed,
  movementLogs,
  onClearLogs,
  showMoveLogs,
  onToggleLogs,
}) => (
  <div className="robot-camera-extras">
    {/* Live Movement Logs Panel (Bottom Right, next to D-Pad) */}
    <div className="robot-camera-logs bg-[#18181B]/85 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden transition-all text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/10 select-none">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-1.5 font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                activeMotion !== 'stop' ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'
              }`}
            />{' '}
            {rc('Movement log')}{' '}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono transition-all ${
              activeMotion !== 'stop'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-stone-800 text-stone-400'
            }`}
          >
            {activeMotion !== 'stop'
              ? `${rc(MOTION_CONFIG[activeMotion]?.label || activeMotion)} • ${speed}%`
              : rc('Stopped')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClearLogs}
            className="p-1 text-stone-400 hover:text-rose-400 hover:bg-white/5 rounded transition-all cursor-pointer"
            title={rc('Clear log')}
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={onToggleLogs}
            className="p-1 text-stone-400 hover:text-white hover:bg-white/5 rounded transition-all cursor-pointer"
            title={showMoveLogs ? rc('Collapse') : rc('Expand')}
          >
            {showMoveLogs ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Logs List */}
      {showMoveLogs && (
        <div className="p-2 max-h-40 overflow-y-auto space-y-1 font-mono text-[11px] custom-scrollbar">
          {movementLogs.length === 0 ? (
            <div className="text-center py-4 text-stone-500 text-[10px]">
              {' '}
              {rc('No movement commands yet')}{' '}
            </div>
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
