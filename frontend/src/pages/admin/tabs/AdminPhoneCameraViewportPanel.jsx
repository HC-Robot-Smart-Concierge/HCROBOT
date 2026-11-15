import React from 'react';
import { Camera, RefreshCw, Maximize2, Minimize2, Smile, Frown, Meh, VideoOff, RotateCw } from 'lucide-react';

export const AdminPhoneCameraViewportPanel = ({
  feedSource, sessionId, setSessionId, connectionStatus, hasRemoteVideo, videoRef, canvasRef, videoRotation, isFaceDetected, visionModelReady, activeDisplayEmotion, smileScore, frownScore, snapshotUrl, setSnapshotUrl,
}) => (
  <>
        {/* Left Column: Video Viewport + Overlaid Canvas (System Theme) */}
        <div
          className="lg:col-span-2 flex flex-col border rounded-2xl overflow-hidden relative shadow-xs"
          style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
        >
          <div className="flex-1 relative flex items-center justify-center bg-stone-950 min-h-[420px] overflow-hidden p-2 rounded-t-2xl">
            {/* Container chua Video va Canvas duoc Xoay dong bo */}
            <div
              className="relative flex items-center justify-center transition-all duration-300"
              style={{
                transform: `rotate(${videoRotation}deg)`,
                width: videoRotation % 180 !== 0 ? '420px' : '100%',
                height: videoRotation % 180 !== 0 ? '100%' : '100%',
                maxHeight: videoRotation % 180 !== 0 ? '560px' : '440px',
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-contain ${!hasRemoteVideo && 'hidden'}`}
              />

              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full object-contain pointer-events-none ${
                  !hasRemoteVideo && 'hidden'
                }`}
              />
            </div>

            {!hasRemoteVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-stone-400 gap-3 select-none bg-stone-950/95">
                <VideoOff className="w-12 h-12 text-stone-600" />
                <div>
                  <h3 className="text-sm font-bold text-stone-200 font-mono uppercase">
                    {feedSource === 'webrtc'
                      ? 'Waiting for Robot Phone Video Stream...'
                      : 'Local Camera Standby'}
                  </h3>
                  <p className="text-xs text-stone-400 font-mono mt-1">
                    {feedSource === 'webrtc'
                      ? `Dang cho tin hieu WebRTC tu dien thoai Robot (Session: ${sessionId})`
                      : 'Nhan nut Reconnect de cap quyen truy cap camera may tinh'}
                  </p>
                </div>
              </div>
            )}

            {/* Overlaid Status Badges (System Theme Warm Overlay) */}
            <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
              <span
                className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border shadow-xs"
                style={{ background: 'rgba(250, 248, 245, 0.95)', borderColor: '#BFBFBD', color: '#262626' }}
              >
                {feedSource === 'webrtc' ? 'PHONE KIOSK FEED' : 'LOCAL WEBCAM'}
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border backdrop-blur-md ${
                  isFaceDetected
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-black/60 border-white/20 text-stone-300'
                }`}
              >
                {isFaceDetected ? 'EXPRESSION ANCHORS' : 'SEARCHING FACE'}
              </span>
            </div>

            {/* Overlaid Active Emotion Badge */}
            {hasRemoteVideo && isFaceDetected && (
              <div
                className="absolute bottom-3 left-3 border px-3 py-1.5 rounded-xl flex items-center gap-2 pointer-events-none shadow-sm"
                style={{ background: 'rgba(250, 248, 245, 0.95)', borderColor: '#BFBFBD' }}
              >
                {activeDisplayEmotion === 'happy' ? (
                  <Smile className="w-4 h-4 text-emerald-600" />
                ) : activeDisplayEmotion === 'unhappy' ? (
                  <Frown className="w-4 h-4 text-rose-600" />
                ) : (
                  <Meh className="w-4 h-4 text-sky-600" />
                )}
                <span
                  className="text-xs font-mono font-bold uppercase tracking-wider"
                  style={{ color: '#262626' }}
                >
                  {activeDisplayEmotion}
                </span>
                <span className="text-[10px] font-mono" style={{ color: '#8C8C8C' }}>
                  Smile: {Math.round(smileScore * 100)}% | Frown: {Math.round(frownScore * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Footer Information (System Theme: Sand-Beige #E9E5DC, Border #BFBFBD) */}
          <div
            className="flex items-center justify-between px-4 py-2.5 border-t text-[11px] font-mono"
            style={{ background: '#E9E5DC', borderColor: '#BFBFBD', color: '#555555' }}
          >
            <div className="flex items-center gap-3">
              <span>
                Status: <strong style={{ color: '#262626' }}>{connectionStatus.toUpperCase()}</strong>
              </span>
              <span>
                AI Engine:{' '}
                <strong style={{ color: '#262626' }}>
                  {visionModelReady ? 'EXPRESSION AI' : 'INITIALIZING'}
                </strong>
              </span>
              <span>
                Orientation: <strong style={{ color: '#262626' }}>{videoRotation}°</strong>
              </span>
            </div>
            {feedSource === 'webrtc' && (
              <div className="flex items-center gap-2">
                <span style={{ color: '#555555' }}>Room:</span>
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  className="border rounded px-2 py-0.5 text-[11px] font-mono w-32 outline-none"
                  style={{ background: '#FFFFFF', borderColor: '#BFBFBD', color: '#262626' }}
                />
              </div>
            )}
          </div>
        </div>
      {/* Snapshot Preview Modal if Captured (System Theme) */}
      {snapshotUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="border rounded-2xl p-5 max-w-xl w-full flex flex-col gap-3 shadow-2xl"
            style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: '#BFBFBD' }}>
              <span
                className="text-xs font-mono font-bold uppercase"
                style={{ color: '#262626' }}
              >
                Snapshot Captured with Mesh
              </span>
              <button
                type="button"
                onClick={() => setSnapshotUrl(null)}
                className="text-xs font-mono font-bold cursor-pointer transition-colors"
                style={{ color: '#8C8C8C' }}
              >
                Close
              </button>
            </div>
            <img
              src={snapshotUrl}
              alt="Snapshot"
              className="rounded-xl w-full object-contain max-h-[400px] border"
              style={{ borderColor: '#BFBFBD' }}
            />
            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: '#BFBFBD' }}>
              <a
                href={snapshotUrl}
                download={`kiosk-snapshot-${Date.now()}.jpg`}
                className="px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold transition-all shadow-xs"
                style={{ background: '#262626', color: '#FFFFFF' }}
              >
                Download
              </a>
            </div>
          </div>
        </div>
      )}
  </>
);

export const AdminPhoneCameraHeader = ({
  connectionStatus, hasRemoteVideo, feedSource, setFeedSource, videoRotation, setVideoRotation, connectWebRTC, handleTakeSnapshot, toggleFullscreen, isFullscreen,
}) => (
      <div
        className="flex flex-wrap items-center justify-between gap-3 border rounded-2xl p-4 shadow-xs"
        style={{ background: '#FAF8F5', borderColor: '#BFBFBD' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-xs"
            style={{ background: '#262626', color: '#FFFFFF' }}
          >
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                className="text-sm font-bold tracking-wide uppercase font-mono"
                style={{ color: '#262626' }}
              >
                Phone Kiosk Camera & Emotion AI
              </h1>
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' && hasRemoteVideo
                    ? 'bg-emerald-500 animate-pulse'
                    : connectionStatus === 'connecting'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-stone-400'
                }`}
              />
            </div>
            <p className="text-[11px] font-mono" style={{ color: '#8C8C8C' }}>
              Live feed tu dien thoai Robot (Kiosk) voi cac diem bieu cam then chot (Key Expression Anchors)
            </p>
          </div>
        </div>

        {/* Action Controls & Feed Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Cụm chọn nguồn Feed */}
          <div
            className="flex items-center rounded-xl border p-0.5 text-xs font-mono"
            style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
          >
            <button
              type="button"
              onClick={() => setFeedSource('webrtc')}
              className="px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer"
              style={
                feedSource === 'webrtc'
                  ? { background: '#262626', color: '#FFFFFF' }
                  : { background: 'transparent', color: '#555555' }
              }
            >
              Robot Phone (WebRTC)
            </button>
            <button
              type="button"
              onClick={() => setFeedSource('local_webcam')}
              className="px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer"
              style={
                feedSource === 'local_webcam'
                  ? { background: '#262626', color: '#FFFFFF' }
                  : { background: 'transparent', color: '#555555' }
              }
            >
              Local Test Webcam
            </button>
          </div>

          {/* Bộ chọn nhanh góc xoay video 4 nấc (0°, 90°, 180°, 270°) */}
          <div
            className="flex items-center rounded-xl border p-0.5 text-xs font-mono"
            style={{ background: '#E9E5DC', borderColor: '#BFBFBD' }}
          >
            <span className="px-2 text-[11px] uppercase font-bold flex items-center gap-1" style={{ color: '#8C8C8C' }}>
              <RotateCw className="w-3.5 h-3.5" style={{ color: '#262626' }} /> Xoay:
            </span>
            {[
              { deg: 0, label: '0°' },
              { deg: 90, label: '90°' },
              { deg: 180, label: '180°' },
              { deg: 270, label: '270°' },
            ].map((item) => (
              <button
                key={item.deg}
                type="button"
                onClick={() => setVideoRotation(item.deg)}
                className="px-2 py-1 rounded-lg font-bold transition-all cursor-pointer"
                style={
                  videoRotation === item.deg
                    ? { background: '#262626', color: '#FFFFFF' }
                    : { background: 'transparent', color: '#555555' }
                }
                title={`Xoay video ${item.deg} độ`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Nút Reconnect (Đen hệ thống) */}
          <button
            type="button"
            onClick={feedSource === 'webrtc' ? connectWebRTC : connectLocalWebcam}
            className="p-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 hover:opacity-90"
            style={{ background: '#262626', color: '#FFFFFF' }}
            title="Reconnect Stream"
          >
            <RefreshCw className="w-4 h-4 text-white" />
          </button>

          {/* Nút Take Snapshot (Đen hệ thống) */}
          <button
            type="button"
            onClick={handleTakeSnapshot}
            className="p-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 hover:opacity-90"
            style={{ background: '#262626', color: '#FFFFFF' }}
            title="Take Snapshot"
          >
            <Camera className="w-4 h-4 text-white" />
          </button>

          {/* Nút Fullscreen (Đen hệ thống) */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 hover:opacity-90"
            style={{ background: '#262626', color: '#FFFFFF' }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>

);
