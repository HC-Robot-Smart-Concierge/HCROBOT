import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import {
  Video,
  VideoOff,
  Camera,
  RefreshCw,
  Maximize2,
  Minimize2,
  Smile,
  Frown,
  Meh,
  Activity,
  Sliders,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { getCallSignalingWsUrl } from '../../../services/conciergeApi';

const DEFAULT_SESSION_ID = 'kiosk-live-feed';
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 5,
};

export const AdminPhoneCameraTab = ({ currentUser }) => {
  // Connection States
  const [feedSource, setFeedSource] = useState('webrtc'); // 'webrtc' | 'local_webcam'
  const [sessionId, setSessionId] = useState(DEFAULT_SESSION_ID);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected'
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState(null);

  // AI Emotion Recognition States
  const [isAiEmotionActive, setIsAiEmotionActive] = useState(true);
  const [visionModelReady, setVisionModelReady] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [detectedEmotion, setDetectedEmotion] = useState('neutral');
  const [smileScore, setSmileScore] = useState(0);
  const [frownScore, setFrownScore] = useState(0);
  const [overrideEmotion, setOverrideEmotion] = useState(null);
  const [emotionLogs, setEmotionLogs] = useState([]);

  // Teleop robot control target IP
  const [controlIp, setControlIp] = useState(() => import.meta.env.VITE_PI5_IP || '100.99.72.51');

  // Refs
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const landmarkerRef = useRef(null);
  const noFaceCountRef = useRef(0);
  const localStreamRef = useRef(null);
  const containerRef = useRef(null);

  // 1. Khoi tao Google MediaPipe Face Landmarker
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
        console.warn('[AdminPhoneCameraTab] MediaPipe model init fallback:', err);
      }
    };

    initLandmarker();

    return () => {
      isCancelled = true;
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch {}
      }
    };
  }, []);

  // 2. Ket noi WebRTC vao phong Kiosk Video Stream
  const cleanupWebRTC = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      localStreamRef.current = null;
    }
    setHasRemoteVideo(false);
    setConnectionStatus('disconnected');
  }, []);

  const connectWebRTC = useCallback(() => {
    cleanupWebRTC();
    setConnectionStatus('connecting');

    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Nhận media stream từ robot phone kiosk
      pc.ontrack = (event) => {
        if (videoRef.current && event.streams && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setHasRemoteVideo(true);
          setConnectionStatus('connected');
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'candidate',
              candidate: event.candidate,
            })
          );
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnectionStatus('connected');
        } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
          setConnectionStatus('disconnected');
          setHasRemoteVideo(false);
        }
      };

      const wsUrl = getCallSignalingWsUrl(sessionId, 'staff', currentUser?.name || 'AdminStaff');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'check_peer' }));
      };

      ws.onmessage = async (msgEvent) => {
        try {
          const data = JSON.parse(msgEvent.data);
          if (data.type === 'peer_joined' || data.type === 'peer_present') {
            // Khi co robot phone trong phong, tao Offer de ket noi
            const offer = await pc.createOffer({
              offerToReceiveVideo: true,
              offerToReceiveAudio: true,
            });
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: 'offer', offer }));
          } else if (data.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', answer }));
          } else if (data.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          } else if (data.type === 'candidate') {
            if (data.candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
          } else if (data.type === 'peer_disconnected') {
            setConnectionStatus('disconnected');
            setHasRemoteVideo(false);
          }
        } catch (err) {
          console.warn('[AdminPhoneCameraTab] Signaling message error:', err);
        }
      };

      ws.onerror = () => {
        setConnectionStatus('disconnected');
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
      };
    } catch (err) {
      console.warn('[AdminPhoneCameraTab] WebRTC setup error:', err);
      setConnectionStatus('disconnected');
    }
  }, [cleanupWebRTC, sessionId, currentUser]);

  // 3. Che do Camera cuc bo (Local Webcam Test)
  const connectLocalWebcam = useCallback(async () => {
    cleanupWebRTC();
    setConnectionStatus('connecting');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      localStreamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setHasRemoteVideo(true);
      setConnectionStatus('connected');
    } catch (err) {
      console.warn('[AdminPhoneCameraTab] Local camera error:', err);
      setConnectionStatus('disconnected');
    }
  }, [cleanupWebRTC]);

  useEffect(() => {
    if (feedSource === 'webrtc') {
      connectWebRTC();
    } else {
      connectLocalWebcam();
    }
    return () => {
      cleanupWebRTC();
    };
  }, [feedSource, connectWebRTC, connectLocalWebcam, cleanupWebRTC]);

  // 4. Vong lap nhan dien bieu cam MediaPipe tren frame video
  useEffect(() => {
    if (!isAiEmotionActive || connectionStatus !== 'connected') {
      setIsFaceDetected(false);
      return;
    }

    const intervalId = setInterval(() => {
      if (!landmarkerRef.current || !videoRef.current) return;
      const videoEl = videoRef.current;
      if (videoEl.readyState < 2 || videoEl.videoWidth === 0) return;

      try {
        const results = landmarkerRef.current.detect(videoEl);

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

            setDetectedEmotion((prev) => {
              if (prev !== detected) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                setEmotionLogs((logs) => [
                  { id: Date.now(), time: timeStr, emotion: detected, smile, frown },
                  ...logs.slice(0, 19),
                ]);
              }
              return detected;
            });
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
        // Tranh treo khi frame bi gian doan
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, [isAiEmotionActive, connectionStatus]);

  // 5. Override bieu cam thu cong va gui len Robot
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

  // 6. Chup anh Snapshot tu Video
  const handleTakeSnapshot = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setSnapshotUrl(canvas.toDataURL('image/jpeg'));
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  const activeDisplayEmotion = overrideEmotion || detectedEmotion;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col p-4 overflow-y-auto custom-scrollbar gap-4 text-stone-200"
      style={{ background: '#121214' }}
    >
      {/* Top Header & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#18181B] border border-white/10 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-800 border border-white/10 flex items-center justify-center text-stone-200">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wide text-white uppercase font-mono">
                Phone Kiosk Camera & Emotion AI
              </h1>
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-400 animate-pulse'
                    : connectionStatus === 'connecting'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-stone-500'
                }`}
              />
            </div>
            <p className="text-[11px] text-stone-400 font-mono">
              Live feed tu dien thoai Robot (Kiosk) va he thong phan tich bieu cam khach hang
            </p>
          </div>
        </div>

        {/* Action Controls & Feed Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg bg-stone-900 border border-white/10 p-0.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => setFeedSource('webrtc')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                feedSource === 'webrtc'
                  ? 'bg-stone-200 text-stone-900 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Robot Phone (WebRTC)
            </button>
            <button
              type="button"
              onClick={() => setFeedSource('local_webcam')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                feedSource === 'local_webcam'
                  ? 'bg-stone-200 text-stone-900 shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Local Test Webcam
            </button>
          </div>

          <button
            type="button"
            onClick={feedSource === 'webrtc' ? connectWebRTC : connectLocalWebcam}
            className="p-2 rounded-lg bg-stone-900 border border-white/10 hover:bg-stone-800 text-stone-300 hover:text-white transition-all cursor-pointer"
            title="Reconnect Stream"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleTakeSnapshot}
            className="p-2 rounded-lg bg-stone-900 border border-white/10 hover:bg-stone-800 text-stone-300 hover:text-white transition-all cursor-pointer"
            title="Take Snapshot"
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-stone-900 border border-white/10 hover:bg-stone-800 text-stone-300 hover:text-white transition-all cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Grid: Video Stream (Left) + Emotion Analytics HUD (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Left Column: Video Viewport */}
        <div className="lg:col-span-2 flex flex-col bg-[#18181B] border border-white/10 rounded-2xl overflow-hidden relative shadow-lg">
          <div className="flex-1 relative flex items-center justify-center bg-black min-h-[420px]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              webkit-playsinline="true"
              className={`w-full h-full object-contain ${!hasRemoteVideo && 'hidden'}`}
            />

            {!hasRemoteVideo && (
              <div className="flex flex-col items-center justify-center text-center p-6 text-stone-400 gap-3 select-none">
                <VideoOff className="w-12 h-12 text-stone-600" />
                <div>
                  <h3 className="text-sm font-bold text-stone-300 font-mono uppercase">
                    {feedSource === 'webrtc'
                      ? 'Waiting for Robot Phone Video Stream...'
                      : 'Local Camera Standby'}
                  </h3>
                  <p className="text-xs text-stone-500 font-mono mt-1">
                    {feedSource === 'webrtc'
                      ? `Dang cho tin hieu WebRTC tu dien thoai Robot (Session: ${sessionId})`
                      : 'Nhan nut Reconnect de cap quyen truy cap camera may tinh'}
                  </p>
                </div>
              </div>
            )}

            {/* Overlaid Status Badges */}
            <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-black/60 backdrop-blur-md border border-white/10 text-white">
                {feedSource === 'webrtc' ? 'PHONE KIOSK FEED' : 'LOCAL WEBCAM'}
              </span>
              <span
                className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold border backdrop-blur-md ${
                  isFaceDetected
                    ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                    : 'bg-black/60 border-white/10 text-stone-400'
                }`}
              >
                {isFaceDetected ? 'FACE TRACKED' : 'SEARCHING FACE'}
              </span>
            </div>

            {/* Overlaid Active Emotion Badge */}
            {hasRemoteVideo && isFaceDetected && (
              <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 pointer-events-none">
                {activeDisplayEmotion === 'happy' ? (
                  <Smile className="w-4 h-4 text-emerald-400" />
                ) : activeDisplayEmotion === 'unhappy' ? (
                  <Frown className="w-4 h-4 text-rose-400" />
                ) : (
                  <Meh className="w-4 h-4 text-amber-400" />
                )}
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  {activeDisplayEmotion}
                </span>
                <span className="text-[10px] font-mono text-stone-400">
                  Smile: {Math.round(smileScore * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Footer Information */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 border-t border-white/10 text-[11px] font-mono text-stone-400">
            <div className="flex items-center gap-3">
              <span>Status: <strong className="text-stone-200">{connectionStatus.toUpperCase()}</strong></span>
              <span>AI Engine: <strong className="text-stone-200">{visionModelReady ? 'MEDIAPIPE READY' : 'INITIALIZING'}</strong></span>
            </div>
            {feedSource === 'webrtc' && (
              <div className="flex items-center gap-2">
                <span>Room:</span>
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  className="bg-stone-900 border border-white/10 rounded px-2 py-0.5 text-[11px] text-white font-mono w-32"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Emotion Analytics & Diagnostics */}
        <div className="flex flex-col gap-4">
          {/* Emotion Card & Gauge */}
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-stone-300" />
                <span className="text-xs font-bold font-mono uppercase text-white tracking-wider">
                  AI Expression Analytics
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAiEmotionActive((prev) => !prev)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer border ${
                  isAiEmotionActive
                    ? 'bg-stone-200 text-stone-900 border-white'
                    : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                }`}
              >
                {isAiEmotionActive ? 'AI ON' : 'AI OFF'}
              </button>
            </div>

            {/* Current Emotion State */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-stone-400 uppercase">Current Expression</span>
                <span className="text-base font-bold font-mono tracking-wide text-white uppercase mt-0.5">
                  {activeDisplayEmotion}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-1 rounded bg-stone-800 text-stone-300 border border-stone-700">
                {overrideEmotion ? 'MANUAL OVERRIDE' : 'REALTIME AI'}
              </span>
            </div>

            {/* Gauges for Smile & Frown */}
            <div className="space-y-2.5 font-mono text-xs">
              <div>
                <div className="flex justify-between text-stone-400 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Smile className="w-3.5 h-3.5 text-stone-300" /> Smile Level
                  </span>
                  <span className="font-bold text-stone-200">{Math.round(smileScore * 100)}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-900 overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-stone-200 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round(smileScore * 100))}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-stone-400 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Frown className="w-3.5 h-3.5 text-stone-400" /> Frown / Distress Level
                  </span>
                  <span className="font-bold text-stone-200">{Math.round(frownScore * 100)}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-900 overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-stone-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round(frownScore * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Test Robot Expression Buttons */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <span className="text-[10px] font-mono text-stone-400 block uppercase">
                Test / Override Robot Expression:
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: null, label: 'AUTO' },
                  { id: 'happy', label: 'HAPPY' },
                  { id: 'neutral', label: 'NEUTRAL' },
                  { id: 'unhappy', label: 'UNHAPPY' },
                  { id: 'look_up', label: 'UP' },
                  { id: 'look_left', label: 'LEFT' },
                  { id: 'look_right', label: 'RIGHT' },
                  { id: 'look_around', label: 'AROUND' },
                ].map((mode) => (
                  <button
                    key={String(mode.id)}
                    type="button"
                    onClick={() => handleOverrideEmotion(mode.id)}
                    className={`py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                      overrideEmotion === mode.id
                        ? 'bg-stone-200 text-stone-900 border-white shadow-xs'
                        : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interaction Timeline Log */}
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-4 shadow-lg flex-1 flex flex-col min-h-[200px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-stone-400" />
                <span className="text-xs font-bold font-mono uppercase text-white tracking-wider">
                  Expression History Log
                </span>
              </div>
              <span className="text-[10px] font-mono text-stone-500">{emotionLogs.length} events</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
              {emotionLogs.length === 0 ? (
                <div className="text-center py-6 text-stone-500 text-xs font-mono">
                  No emotion changes detected in current session yet
                </div>
              ) : (
                emotionLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-[11px] font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-stone-500 text-[10px]">{log.time}</span>
                      <span
                        className={`font-bold uppercase ${
                          log.emotion === 'happy'
                            ? 'text-emerald-400'
                            : log.emotion === 'unhappy'
                            ? 'text-rose-400'
                            : 'text-stone-300'
                        }`}
                      >
                        {log.emotion}
                      </span>
                    </div>
                    <span className="text-stone-400 text-[10px]">
                      S: {Math.round(log.smile * 100)}% | F: {Math.round(log.frown * 100)}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Snapshot Preview Modal if Captured */}
      {snapshotUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-4 max-w-xl w-full flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase text-white">Snapshot Captured</span>
              <button
                type="button"
                onClick={() => setSnapshotUrl(null)}
                className="text-stone-400 hover:text-white text-xs font-mono cursor-pointer"
              >
                Close
              </button>
            </div>
            <img src={snapshotUrl} alt="Snapshot" className="rounded-xl w-full object-contain max-h-[400px]" />
            <div className="flex justify-end gap-2">
              <a
                href={snapshotUrl}
                download={`kiosk-snapshot-${Date.now()}.jpg`}
                className="px-3 py-1.5 rounded-lg bg-stone-200 text-stone-900 font-mono text-xs font-bold hover:bg-white"
              >
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

