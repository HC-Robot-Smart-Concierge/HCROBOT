import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FilesetResolver, FaceLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import {
  Camera,
  RefreshCw,
  Maximize2,
  Minimize2,
  Smile,
  Frown,
  Meh,
  Activity,
  Sparkles,
  VideoOff,
  Eye,
  Sliders,
  CheckCircle,
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

  // Detailed Facial Blendshapes Metrics
  const [blendshapeMetrics, setBlendshapeMetrics] = useState({
    smileLeft: 0,
    smileRight: 0,
    browDownLeft: 0,
    browDownRight: 0,
    mouthFrownLeft: 0,
    mouthFrownRight: 0,
    eyeSquint: 0,
    jawOpen: 0,
  });

  // Teleop robot control target IP
  const [controlIp, setControlIp] = useState(() => import.meta.env.VITE_PI5_IP || '100.99.72.51');

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
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
        // Fallback init silent
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

  // 2. Ket noi WebRTC vao phong Kiosk Video Stream tu Phone
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

    // Xoa sach canvas overlay
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  const connectWebRTC = useCallback(() => {
    cleanupWebRTC();
    setConnectionStatus('connecting');

    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Nhan media stream tu robot phone kiosk
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
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        setConnectionStatus('disconnected');
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
      };
    } catch {
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
    } catch {
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

  // 4. Vong lap nhan dien MediaPipe va Ve Luoi Khuon Mat (Face Mesh & Connectors)
  useEffect(() => {
    if (!isAiEmotionActive || connectionStatus !== 'connected') {
      setIsFaceDetected(false);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    const intervalId = setInterval(() => {
      if (!landmarkerRef.current || !videoRef.current) return;
      const videoEl = videoRef.current;
      if (videoEl.readyState < 2 || videoEl.videoWidth === 0) return;

      const canvas = canvasRef.current;
      const ctx = canvas ? canvas.getContext('2d') : null;

      try {
        const results = landmarkerRef.current.detect(videoEl);

        if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
          setIsFaceDetected(true);
          noFaceCountRef.current = 0;

          const landmarks = results.faceLandmarks[0];

          // 4.1. Trich xuat cac chi so co mat Blendshapes
          let currentDetected = 'neutral';
          if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
            const categories = results.faceBlendshapes[0].categories;
            let sLeft = 0;
            let sRight = 0;
            let bDownL = 0;
            let bDownR = 0;
            let mFrownL = 0;
            let mFrownR = 0;
            let eyeSquint = 0;
            let jawOpen = 0;

            for (const c of categories) {
              if (c.categoryName === 'mouthSmileLeft') sLeft = c.score;
              else if (c.categoryName === 'mouthSmileRight') sRight = c.score;
              else if (c.categoryName === 'browDownLeft') bDownL = c.score;
              else if (c.categoryName === 'browDownRight') bDownR = c.score;
              else if (c.categoryName === 'mouthFrownLeft') mFrownL = c.score;
              else if (c.categoryName === 'mouthFrownRight') mFrownR = c.score;
              else if (c.categoryName === 'eyeSquintLeft') eyeSquint = Math.max(eyeSquint, c.score);
              else if (c.categoryName === 'eyeSquintRight') eyeSquint = Math.max(eyeSquint, c.score);
              else if (c.categoryName === 'jawOpen') jawOpen = c.score;
            }

            const smile = (sLeft + sRight) / 2;
            const frown = Math.max((bDownL + bDownR) / 2, (mFrownL + mFrownR) / 2);
            setSmileScore(smile);
            setFrownScore(frown);

            setBlendshapeMetrics({
              smileLeft: sLeft,
              smileRight: sRight,
              browDownLeft: bDownL,
              browDownRight: bDownR,
              mouthFrownLeft: mFrownL,
              mouthFrownRight: mFrownR,
              eyeSquint,
              jawOpen,
            });

            if (smile >= 0.35) {
              currentDetected = 'happy';
            } else if (frown >= 0.28) {
              currentDetected = 'unhappy';
            }

            setDetectedEmotion(currentDetected);
          }

          // 4.2. Ve Luoi Mat (Face Mesh Wireframe & Landmarks) voi DrawingUtils
          if (canvas && ctx) {
            if (canvas.width !== videoEl.videoWidth || canvas.height !== videoEl.videoHeight) {
              canvas.width = videoEl.videoWidth;
              canvas.height = videoEl.videoHeight;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const drawingUtils = new DrawingUtils(ctx);

            // Mau sac dong theo bieu cam de nhan biet ngay lap tuc
            let tesselationColor = 'rgba(56, 189, 248, 0.22)'; // Neutral Sky Blue
            let eyebrowsColor = '#38BDF8';
            let lipsColor = '#E2E8F0';
            let eyesColor = '#0EA5E9';
            let ovalColor = '#0284C7';
            let landmarkColor = '#BAE6FD';

            if (currentDetected === 'happy') {
              // Vui ve: Mau xanh luc bao ruc sang
              tesselationColor = 'rgba(16, 185, 129, 0.25)';
              eyebrowsColor = '#6EE7B7';
              lipsColor = '#10B981';
              eyesColor = '#34D399';
              ovalColor = '#059669';
              landmarkColor = '#A7F3D0';
            } else if (currentDetected === 'unhappy') {
              // Kho chiu: Mau do hong canh bao
              tesselationColor = 'rgba(244, 63, 94, 0.28)';
              eyebrowsColor = '#F43F5E';
              lipsColor = '#FB7185';
              eyesColor = '#E11D48';
              ovalColor = '#BE123C';
              landmarkColor = '#FECDD3';
            }

            // 1. Luoi da giac toan bo khuon mat (Tesselation Mesh)
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
              color: tesselationColor,
              lineWidth: 0.7,
            });

            // 2. Duong noi long may (Dam hon khi cau may kho chiu)
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, {
              color: eyebrowsColor,
              lineWidth: currentDetected === 'unhappy' ? 2.5 : 1.5,
            });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, {
              color: eyebrowsColor,
              lineWidth: currentDetected === 'unhappy' ? 2.5 : 1.5,
            });

            // 3. Duong vien mat va con nguoi
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, {
              color: eyesColor,
              lineWidth: 1.5,
            });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, {
              color: eyesColor,
              lineWidth: 1.5,
            });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, {
              color: '#FFFFFF',
              lineWidth: 1.5,
            });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, {
              color: '#FFFFFF',
              lineWidth: 1.5,
            });

            // 4. Khung vien khuon mat
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, {
              color: ovalColor,
              lineWidth: 1.5,
            });

            // 5. Vien moi (Day va noi bat hon khi cuoi)
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, {
              color: lipsColor,
              lineWidth: currentDetected === 'happy' ? 2.5 : 1.5,
            });

            // 6. Cac diem moc co mat (Landmark Dots)
            drawingUtils.drawLandmarks(landmarks, {
              color: landmarkColor,
              radius: 1,
            });
          }
        } else {
          noFaceCountRef.current += 1;
          if (noFaceCountRef.current >= 3) {
            setIsFaceDetected(false);
            setDetectedEmotion('neutral');
            setSmileScore(0);
            setFrownScore(0);
            if (canvas && ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
          }
        }
      } catch {
        // Tranh treo khi frame bi gian doan
      }
    }, 200);

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
      // Chup kem ca lop mesh neu dang co
      if (canvasRef.current) {
        ctx.drawImage(canvasRef.current, 0, 0, canvas.width, canvas.height);
      }
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
              Live feed tu dien thoai Robot (Kiosk) voi luoi bieu cam Landmark Mesh 478 diem
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

      {/* Main Grid: Video Stream with Landmark Canvas (Left) + Emotion Analytics HUD (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Left Column: Video Viewport + Overlaid Canvas */}
        <div className="lg:col-span-2 flex flex-col bg-[#18181B] border border-white/10 rounded-2xl overflow-hidden relative shadow-lg">
          <div className="flex-1 relative flex items-center justify-center bg-black min-h-[420px] overflow-hidden">
            {/* The Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              webkit-playsinline="true"
              className={`w-full h-full object-contain ${!hasRemoteVideo && 'hidden'}`}
            />

            {/* The Landmark Mesh Canvas Element */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full object-contain pointer-events-none ${
                !hasRemoteVideo && 'hidden'
              }`}
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
                {isFaceDetected ? 'FACE MESH 478 PTS' : 'SEARCHING FACE'}
              </span>
            </div>

            {/* Overlaid Active Emotion Badge */}
            {hasRemoteVideo && isFaceDetected && (
              <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 pointer-events-none">
                {activeDisplayEmotion === 'happy' ? (
                  <Smile className="w-4 h-4 text-emerald-400" />
                ) : activeDisplayEmotion === 'unhappy' ? (
                  <Frown className="w-4 h-4 text-rose-400" />
                ) : (
                  <Meh className="w-4 h-4 text-sky-400" />
                )}
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  {activeDisplayEmotion}
                </span>
                <span className="text-[10px] font-mono text-stone-400">
                  Smile: {Math.round(smileScore * 100)}% | Frown: {Math.round(frownScore * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Footer Information */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 border-t border-white/10 text-[11px] font-mono text-stone-400">
            <div className="flex items-center gap-3">
              <span>
                Status: <strong className="text-stone-200">{connectionStatus.toUpperCase()}</strong>
              </span>
              <span>
                AI Engine:{' '}
                <strong className="text-stone-200">
                  {visionModelReady ? 'MEDIAPIPE 478 MESH' : 'INITIALIZING'}
                </strong>
              </span>
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

        {/* Right Column: AI Emotion Analytics & Facial Mesh Diagnostics (No Log) */}
        <div className="flex flex-col gap-4">
          {/* Main Emotion Analytics Card */}
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
                    <Smile className="w-3.5 h-3.5 text-emerald-400" /> Smile Level
                  </span>
                  <span className="font-bold text-stone-200">{Math.round(smileScore * 100)}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-900 overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round(smileScore * 100))}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-stone-400 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Frown className="w-3.5 h-3.5 text-rose-400" /> Frown / Distress Level
                  </span>
                  <span className="font-bold text-stone-200">{Math.round(frownScore * 100)}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-900 overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-rose-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round(frownScore * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Test Robot Expression Override Buttons */}
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

          {/* Facial Landmark Mesh & Blendshapes Diagnostic Panel (Thay the cho Log da xoa) */}
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-4 shadow-lg flex-1 flex flex-col gap-3 font-mono">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold uppercase text-white tracking-wider">
                  Facial Mesh & Blendshapes
                </span>
              </div>
              <span className="text-[10px] text-stone-400">478 Points</span>
            </div>

            {/* Muscle Blendshapes Diagnostic Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <div className="text-[11px] font-bold text-stone-300 flex items-center justify-between">
                  <span>Mouth Corners (Smile L/R)</span>
                  <span className="text-emerald-400">
                    {Math.round(blendshapeMetrics.smileLeft * 100)}% | {Math.round(blendshapeMetrics.smileRight * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-stone-900 overflow-hidden flex gap-0.5">
                  <div
                    className="h-full bg-emerald-500/80 transition-all duration-200"
                    style={{ width: `${Math.round(blendshapeMetrics.smileLeft * 50)}%` }}
                  />
                  <div
                    className="h-full bg-emerald-400 transition-all duration-200"
                    style={{ width: `${Math.round(blendshapeMetrics.smileRight * 50)}%` }}
                  />
                </div>
              </div>

              <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <div className="text-[11px] font-bold text-stone-300 flex items-center justify-between">
                  <span>Brow Depression (Distress L/R)</span>
                  <span className="text-rose-400">
                    {Math.round(blendshapeMetrics.browDownLeft * 100)}% | {Math.round(blendshapeMetrics.browDownRight * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-stone-900 overflow-hidden flex gap-0.5">
                  <div
                    className="h-full bg-rose-500/80 transition-all duration-200"
                    style={{ width: `${Math.round(blendshapeMetrics.browDownLeft * 50)}%` }}
                  />
                  <div
                    className="h-full bg-rose-400 transition-all duration-200"
                    style={{ width: `${Math.round(blendshapeMetrics.browDownRight * 50)}%` }}
                  />
                </div>
              </div>

              <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <div className="text-[11px] font-bold text-stone-300 flex items-center justify-between">
                  <span>Mouth Frown (Sadness L/R)</span>
                  <span className="text-amber-400">
                    {Math.round(blendshapeMetrics.mouthFrownLeft * 100)}% | {Math.round(blendshapeMetrics.mouthFrownRight * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-stone-900 overflow-hidden flex gap-0.5">
                  <div
                    className="h-full bg-amber-500/80 transition-all duration-200"
                    style={{ width: `${Math.round(blendshapeMetrics.mouthFrownLeft * 50)}%` }}
                  />
                  <div
                    className="h-full bg-amber-400 transition-all duration-200"
                    style={{ width: `${Math.round(blendshapeMetrics.mouthFrownRight * 50)}%` }}
                  />
                </div>
              </div>

              {/* Eye Squint and Jaw Opening */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-xl bg-black/40 border border-white/5 flex flex-col justify-between">
                  <span className="text-stone-400">Eye Squint</span>
                  <span className="text-sm font-bold text-stone-200 mt-1">
                    {Math.round(blendshapeMetrics.eyeSquint * 100)}%
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-black/40 border border-white/5 flex flex-col justify-between">
                  <span className="text-stone-400">Jaw Open</span>
                  <span className="text-sm font-bold text-stone-200 mt-1">
                    {Math.round(blendshapeMetrics.jawOpen * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Mesh Status Note */}
            <div className="mt-auto pt-2 border-t border-white/10 text-[10px] text-stone-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-sky-400" />
                Mesh Wireframe Active
              </span>
              <span className="text-stone-500">GPU Accelerated</span>
            </div>
          </div>
        </div>
      </div>

      {/* Snapshot Preview Modal if Captured */}
      {snapshotUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-4 max-w-xl w-full flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase text-white">Snapshot Captured with Mesh</span>
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
