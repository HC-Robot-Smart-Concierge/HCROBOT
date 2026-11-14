import { useState, useEffect, useRef, useCallback } from 'react';
import { getCallSignalingWsUrl } from '../services/conciergeApi';

const DEFAULT_SESSION_ID = 'kiosk-live-feed';

export const WEBRTC_ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:relay.metered.ca:80' },
  ],
  iceCandidatePoolSize: 10,
};

/**
 * useKioskStreamBroadcaster
 * Hook quan ly Camera truoc tren Dien thoai (Robot Kiosk) va tu dong stream WebRTC ve Admin.
 * Ho tro co che User Gesture bat buoc tren iOS Safari / PWA Standalone.
 */
export const useKioskStreamBroadcaster = ({
  enabled = true,
  sessionId = DEFAULT_SESSION_ID,
  isPaused = false,
  onEmotionDetect,
}) => {
  const [stream, setStream] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const hasRequestedRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);

  // 1. Khoi tao va xin quyen Camera truoc tren Dien thoai
  const startCamera = useCallback(async () => {
    if (streamRef.current && streamRef.current.active) {
      setIsCameraActive(true);
      setNeedsUserGesture(false);
      return streamRef.current;
    }

    try {
      setCameraError(null);

      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Trinh duyet khong ho tro navigator.mediaDevices.getUserMedia');
      }

      // Xin quyen camera truoc
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          frameRate: { ideal: 20, max: 30 },
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsCameraActive(true);
      setNeedsUserGesture(false);
      return mediaStream;
    } catch (err) {
      // Neu iOS yeu cau tuong tac nguoi dung hoac tu choi
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        setNeedsUserGesture(true);
        setIsCameraActive(false);
      } else {
        // Thu fallback video co ban
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          streamRef.current = fallbackStream;
          setStream(fallbackStream);
          setIsCameraActive(true);
          setNeedsUserGesture(false);
          return fallbackStream;
        } catch (fbErr) {
          setCameraError(fbErr.message || 'Khong the khoi dong Camera');
          setNeedsUserGesture(true);
          setIsCameraActive(false);
        }
      }
      return null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setIsCameraActive(false);
  }, []);

  // 2. Tu dong kich hoat camera ngay khi render, va lang nghe moi cu chi cham dau tien tren iOS
  useEffect(() => {
    if (!enabled || isPaused) return undefined;

    if (!hasRequestedRef.current) {
      hasRequestedRef.current = true;
      startCamera();
    }

    // Lang nghe cu chi cham / click dau tien tren man hinh neu iOS chan autoStart ngam
    const handleUserGesture = () => {
      if (!streamRef.current || !streamRef.current.active) {
        startCamera();
      }
    };

    document.addEventListener('touchstart', handleUserGesture, { capture: true, passive: true });
    document.addEventListener('pointerdown', handleUserGesture, { capture: true, passive: true });
    document.addEventListener('click', handleUserGesture, { capture: true, passive: true });

    return () => {
      document.removeEventListener('touchstart', handleUserGesture, { capture: true });
      document.removeEventListener('pointerdown', handleUserGesture, { capture: true });
      document.removeEventListener('click', handleUserGesture, { capture: true });
    };
  }, [enabled, isPaused, startCamera]);

  // 3. WebRTC Broadcaster: Gui luong video ve phong signaling tren Laptop
  const cleanupSignaling = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
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
    setIsBroadcasting(false);
  }, []);

  const connectSignaling = useCallback(
    (currentStream) => {
      if (!currentStream || !enabled || isPaused) return;
      cleanupSignaling();

      try {
        const pc = new RTCPeerConnection(WEBRTC_ICE_SERVERS);
        pcRef.current = pc;

        // Add cac track video tu camera truoc vao PeerConnection
        currentStream.getVideoTracks().forEach((track) => {
          pc.addTrack(track, currentStream);
        });

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
            setIsBroadcasting(true);
          } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
            setIsBroadcasting(false);
          }
        };

        const wsUrl = getCallSignalingWsUrl(sessionId, 'guest', 'RobotKioskPhone');
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'check_peer' }));
        };

        ws.onmessage = async (msgEvent) => {
          try {
            const data = JSON.parse(msgEvent.data);

            if (data.type === 'offer') {
              // Admin (Staff) gui Offer -> Phone phan hoi Answer
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
            } else if (data.type === 'peer_joined' && data.role === 'staff') {
              // Khi Admin vua vao phong, neu chua bat dau, tao Offer
              if (pc.signalingState === 'stable') {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                ws.send(JSON.stringify({ type: 'offer', offer }));
              }
            }
          } catch (e) {
            // ignore parse error
          }
        };

        ws.onclose = () => {
          setIsBroadcasting(false);
          // Tu dong thu ket noi lai sau 3 giay neu camera van con song
          if (streamRef.current && streamRef.current.active && enabled && !isPaused) {
            reconnectTimeoutRef.current = setTimeout(() => {
              if (streamRef.current && streamRef.current.active) {
                connectSignaling(streamRef.current);
              }
            }, 3000);
          }
        };
      } catch (err) {
        setIsBroadcasting(false);
      }
    },
    [cleanupSignaling, enabled, isPaused, sessionId]
  );

  // Khi stream camera san sang -> ket noi WebRTC
  useEffect(() => {
    if (stream && !isPaused && enabled) {
      connectSignaling(stream);
    } else {
      cleanupSignaling();
    }

    return () => {
      cleanupSignaling();
    };
  }, [stream, isPaused, enabled, connectSignaling, cleanupSignaling]);

  return {
    stream,
    isCameraActive,
    isBroadcasting,
    needsUserGesture,
    cameraError,
    startCamera,
    stopCamera,
  };
};
