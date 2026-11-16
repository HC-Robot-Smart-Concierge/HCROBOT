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
 * Hook quan ly Camera truoc tren Dien thoai (Robot Kiosk) va stream WebRTC ve Admin.
 * Phone dong vai tro la BROADCASTER (Offerer) duy nhat de tranh xung dot SDP Offer.
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
  const isRequestingRef = useRef(false);
  const permissionDeniedRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);

  // 1. Khoi tao va xin quyen Camera truoc tren Dien thoai (chan spam tren moi cu cham)
  const startCamera = useCallback(async (manual = false) => {
    if (streamRef.current && streamRef.current.active) {
      setIsCameraActive(true);
      setNeedsUserGesture(false);
      return streamRef.current;
    }

    if (manual) {
      permissionDeniedRef.current = false;
    }

    if (isRequestingRef.current || permissionDeniedRef.current) {
      return null;
    }

    isRequestingRef.current = true;
    try {
      setCameraError(null);

      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Trinh duyet khong ho tro navigator.mediaDevices.getUserMedia');
      }

      // Xin quyen camera truoc voi do phan giai ho tro ca Portrait va Landscape
      const isLandscape = typeof window !== 'undefined' && window.innerWidth > window.innerHeight;
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: isLandscape ? 1280 : 720, min: 480 },
          height: { ideal: isLandscape ? 720 : 1280, min: 360 },
          aspectRatio: { ideal: isLandscape ? 1.7777777778 : 0.5625 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsCameraActive(true);
      setNeedsUserGesture(false);
      permissionDeniedRef.current = false;
      return mediaStream;
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        permissionDeniedRef.current = true;
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
          permissionDeniedRef.current = false;
          return fallbackStream;
        } catch (fbErr) {
          if (fbErr.name === 'NotAllowedError' || fbErr.name === 'SecurityError') {
            permissionDeniedRef.current = true;
          }
          setCameraError(fbErr.message || 'Khong the khoi dong Camera');
          setNeedsUserGesture(true);
          setIsCameraActive(false);
        }
      }
      return null;
    } finally {
      isRequestingRef.current = false;
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

  // 2. Tu dong kich hoat camera 1 lan duy nhat khi render (khong spam tren moi cu chi cham man hinh)
  useEffect(() => {
    if (!enabled || isPaused) return undefined;

    if (!hasRequestedRef.current) {
      hasRequestedRef.current = true;
      startCamera();
    }
  }, [enabled, isPaused, startCamera]);

  // 3. WebRTC Broadcaster: Phone lam Offerer gui video ve Admin
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
    iceCandidateQueueRef.current = [];
    setIsBroadcasting(false);
  }, []);

  const sendOffer = useCallback(async (pc, ws) => {
    if (!pc || !ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      if (pc.signalingState !== 'stable') return;
      const offer = await pc.createOffer({
        offerToReceiveVideo: false,
        offerToReceiveAudio: false,
      });
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: 'offer', offer }));
    } catch (e) {
      // ignore
    }
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
          track.enabled = true;
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
          // Bao hieu vao phong
          ws.send(JSON.stringify({ type: 'kiosk_ready' }));
        };

        ws.onmessage = async (msgEvent) => {
          try {
            const data = JSON.parse(msgEvent.data);

            if (data.type === 'peer_joined' && data.role === 'staff') {
              // Khi Admin (Staff) vua vao phong -> Phone tao Offer gui cho Admin
              await sendOffer(pc, ws);
            } else if (data.type === 'ready_for_offer') {
              // Admin bao san sang nhan Offer
              await sendOffer(pc, ws);
            } else if (data.type === 'answer') {
              // Admin gui Answer lai
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
              // Xu ly hang doi candidate da luu
              while (iceCandidateQueueRef.current.length > 0) {
                const cand = iceCandidateQueueRef.current.shift();
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {}
              }
            } else if (data.type === 'candidate') {
              if (data.candidate) {
                if (pc.remoteDescription) {
                  await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } else {
                  iceCandidateQueueRef.current.push(data.candidate);
                }
              }
            }
          } catch (e) {
            // ignore
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
    [cleanupSignaling, enabled, isPaused, sessionId, sendOffer]
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
