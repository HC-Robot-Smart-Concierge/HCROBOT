import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCallSignalingWsUrl } from '../../../services/conciergeApi';
import { WEBRTC_ICE_SERVERS } from '../../../hooks/useKioskStreamBroadcaster';
import { usePhoneCameraVision } from './usePhoneCameraVision';
import {
  AdminPhoneCameraHeader,
  AdminPhoneCameraViewportPanel,
} from './AdminPhoneCameraViewportPanel';
import { AdminPhoneCameraAnalyticsPanel } from './AdminPhoneCameraAnalyticsPanel';

const DEFAULT_SESSION_ID = 'kiosk-live-feed';

export const AdminPhoneCameraTab = ({ currentUser }) => {
  // Connection States
  const [feedSource, setFeedSource] = useState('webrtc'); // 'webrtc' | 'local_webcam'
  const [sessionId, setSessionId] = useState(DEFAULT_SESSION_ID);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected'
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState(null);

  // Huong xoay video: Doc tu localStorage hoac mac dinh 90 do cho dien thoai nam ngang
  const [videoRotation, setVideoRotationState] = useState(() => {
    try {
      const saved = localStorage.getItem('kiosk_video_rotation');
      if (saved !== null) return parseInt(saved, 10);
    } catch {}
    return 90;
  });

  const setVideoRotation = useCallback((valOrFn) => {
    setVideoRotationState((prev) => {
      const nextVal = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      try {
        localStorage.setItem('kiosk_video_rotation', String(nextVal));
      } catch {}
      return nextVal;
    });
  }, []);

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
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);
  const containerRef = useRef(null);

  usePhoneCameraVision({
    isAiEmotionActive,
    connectionStatus,
    videoRef,
    canvasRef,
    setVisionModelReady,
    setIsFaceDetected,
    setDetectedEmotion,
    setSmileScore,
    setFrownScore,
    setBlendshapeMetrics,
  });

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
    remoteStreamRef.current = null;
    iceCandidateQueueRef.current = [];
    setHasRemoteVideo(false);
    setConnectionStatus('disconnected');

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  const connectWebRTC = useCallback(() => {
    cleanupWebRTC();
    setConnectionStatus('connecting');

    try {
      const pc = new RTCPeerConnection(WEBRTC_ICE_SERVERS);
      pcRef.current = pc;

      // Nhan media stream tu robot phone kiosk
      pc.ontrack = (event) => {
        event.track.enabled = true;

        let incomingStream = event.streams && event.streams[0];
        if (!incomingStream) {
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
          }
          if (!remoteStreamRef.current.getTracks().some((t) => t.id === event.track.id)) {
            remoteStreamRef.current.addTrack(event.track);
          }
          incomingStream = remoteStreamRef.current;
        } else {
          remoteStreamRef.current = incomingStream;
        }

        const videoEl = videoRef.current;
        if (videoEl) {
          if (videoEl.srcObject !== incomingStream) {
            videoEl.srcObject = incomingStream;
          }
          videoEl.muted = true;
          videoEl.playsInline = true;

          const playPromise = videoEl.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {});
          }

          videoEl.onloadedmetadata = () => {
            videoEl.play().catch(() => {});
          };
        }

        event.track.onunmute = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(() => {});
          }
          setHasRemoteVideo(true);
          setConnectionStatus('connected');
        };

        setHasRemoteVideo(true);
        setConnectionStatus('connected');
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
          setHasRemoteVideo(true);
        } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
          setConnectionStatus('disconnected');
          setHasRemoteVideo(false);
        }
      };

      const wsUrl = getCallSignalingWsUrl(sessionId, 'staff', currentUser?.name || 'AdminStaff');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'ready_for_offer' }));
      };

      ws.onmessage = async (msgEvent) => {
        try {
          const data = JSON.parse(msgEvent.data);

          if (data.type === 'peer_joined' && data.role === 'guest') {
            ws.send(JSON.stringify({ type: 'ready_for_offer' }));
          } else if (data.type === 'kiosk_ready') {
            ws.send(JSON.stringify({ type: 'ready_for_offer' }));
          } else if (data.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

            while (iceCandidateQueueRef.current.length > 0) {
              const cand = iceCandidateQueueRef.current.shift();
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {}
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', answer }));
          } else if (data.type === 'candidate') {
            if (data.candidate) {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              } else {
                iceCandidateQueueRef.current.push(data.candidate);
              }
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
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.play().catch(() => {});
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

  // 6. Chup anh Snapshot tu Video (ho tro tinh ca huong xoay video)
  const handleTakeSnapshot = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const isSideways = videoRotation === 90 || videoRotation === 270;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    canvas.width = isSideways ? vh : vw;
    canvas.height = isSideways ? vw : vh;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((videoRotation * Math.PI) / 180);
      ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh);
      if (canvasRef.current) {
        ctx.drawImage(canvasRef.current, -vw / 2, -vh / 2, vw, vh);
      }
      setSnapshotUrl(canvas.toDataURL('image/jpeg'));
    }
  }, [videoRotation]);

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
      className="w-full h-full flex flex-col p-4 overflow-y-auto custom-scrollbar gap-4 text-[#262626] font-sans select-none"
      style={{ background: '#F2EFE9' }}
    >      <AdminPhoneCameraHeader
        connectionStatus={connectionStatus}
        hasRemoteVideo={hasRemoteVideo}
        feedSource={feedSource}
        setFeedSource={setFeedSource}
        videoRotation={videoRotation}
        setVideoRotation={setVideoRotation}
        connectWebRTC={connectWebRTC}
        handleTakeSnapshot={handleTakeSnapshot}
        toggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
      />
      {/* Main Grid: Video Stream with Landmark Canvas (Left) + Emotion Analytics HUD (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        <AdminPhoneCameraViewportPanel
          feedSource={feedSource}
          sessionId={sessionId}
          setSessionId={setSessionId}
          connectionStatus={connectionStatus}
          hasRemoteVideo={hasRemoteVideo}
          videoRef={videoRef}
          canvasRef={canvasRef}
          videoRotation={videoRotation}
          isFaceDetected={isFaceDetected}
          visionModelReady={visionModelReady}
          activeDisplayEmotion={activeDisplayEmotion}
          smileScore={smileScore}
          frownScore={frownScore}
          snapshotUrl={snapshotUrl}
          setSnapshotUrl={setSnapshotUrl}
        />

        <AdminPhoneCameraAnalyticsPanel
          isAiEmotionActive={isAiEmotionActive}
          setIsAiEmotionActive={setIsAiEmotionActive}
          activeDisplayEmotion={activeDisplayEmotion}
          overrideEmotion={overrideEmotion}
          handleOverrideEmotion={handleOverrideEmotion}
          smileScore={smileScore}
          frownScore={frownScore}
          blendshapeMetrics={blendshapeMetrics}
        />
      </div>
    </div>
  );
};
