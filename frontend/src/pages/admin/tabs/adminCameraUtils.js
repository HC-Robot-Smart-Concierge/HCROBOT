import {
  Square,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

export const MOTION_CONFIG = {
  w: { label: 'Forward', eng: 'Forward', icon: ArrowUp, color: 'text-emerald-400' },
  s: { label: 'Backward', eng: 'Backward', icon: ArrowDown, color: 'text-amber-400' },
  a: { label: 'Turn Left', eng: 'Turn Left', icon: ArrowLeft, color: 'text-sky-400' },
  d: { label: 'Turn Right', eng: 'Turn Right', icon: ArrowRight, color: 'text-sky-400' },
  wa: { label: 'Forward Left', eng: 'Arc Left', icon: ArrowUp, color: 'text-teal-400' },
  wd: { label: 'Forward Right', eng: 'Arc Right', icon: ArrowUp, color: 'text-teal-400' },
  sa: { label: 'Backward Left', eng: 'Arc Left', icon: ArrowDown, color: 'text-orange-400' },
  sd: { label: 'Backward Right', eng: 'Arc Right', icon: ArrowDown, color: 'text-orange-400' },
  stop: { label: 'Stop', eng: 'Stop', icon: Square, color: 'text-rose-400' },
};

export const computeMotionCommand = (keysSet) => {
  const isUp = keysSet.has('w') || keysSet.has('arrowup');
  const isDown = keysSet.has('s') || keysSet.has('arrowdown');
  const isLeft = keysSet.has('a') || keysSet.has('arrowleft');
  const isRight = keysSet.has('d') || keysSet.has('arrowright');

  if (isUp && isLeft) return 'wa';
  if (isUp && isRight) return 'wd';
  if (isDown && isLeft) return 'sa';
  if (isDown && isRight) return 'sd';
  if (isUp) return 'w';
  if (isDown) return 's';
  if (isLeft) return 'a';
  if (isRight) return 'd';
  return 'stop';
};

export const connectWebRtcStream = async ({
  pcRef,
  controlIp,
  videoRef,
  setWebrtcStatus,
  setIsConnected,
  setStreamError,
  setStreamMode,
}) => {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  });
  pcRef.current = pc;

  pc.ontrack = (event) => {
    if (videoRef.current && event.streams && event.streams[0]) {
      videoRef.current.srcObject = event.streams[0];
      setWebrtcStatus('connected');
      setIsConnected(true);
      setStreamError(false);
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') {
      setWebrtcStatus('connected');
      setIsConnected(true);
      setStreamError(false);
    } else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
      setWebrtcStatus('failed');
      setStreamMode('mjpeg');
    }
  };

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
      setWebrtcStatus('connected');
      setIsConnected(true);
      setStreamError(false);
    } else if (pc.iceConnectionState === 'failed') {
      setWebrtcStatus('failed');
      setStreamMode('mjpeg');
    }
  };

  pc.addTransceiver('video', { direction: 'recvonly' });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  if (pc.iceGatheringState !== 'complete') {
    await new Promise((resolve) => {
      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', checkState);
      setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, 2500);
    });
  }

  const res = await fetch('/api/v1/operations/robot/camera/webrtc-offer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sdp: pc.localDescription.sdp,
      type: pc.localDescription.type,
      target_ip: controlIp,
      port: 8554,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(`WebRTC offer response status ${res.status}`);
  }

  const answer = await res.json();
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
};

export const captureVideoSnapshot = ({ streamMode, videoEl, imgEl, canvasEl }) => {
  const mediaEl = streamMode === 'webrtc' ? videoEl : imgEl;
  if (!mediaEl || !canvasEl) return null;
  try {
    const w = streamMode === 'webrtc' ? (mediaEl.videoWidth || 640) : (mediaEl.naturalWidth || 640);
    const h = streamMode === 'webrtc' ? (mediaEl.videoHeight || 480) : (mediaEl.naturalHeight || 480);
    canvasEl.width = w;
    canvasEl.height = h;
    const ctx = canvasEl.getContext('2d');
    ctx.drawImage(mediaEl, 0, 0, w, h);
    const dataUrl = canvasEl.toDataURL('image/jpeg', 0.95);

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `pi5_snapshot_${Date.now()}.jpg`;
    link.click();
    return dataUrl;
  } catch {
    return null;
  }
};

export const attachCameraTeleopKeyboard = ({
  pressedKeysRef,
  activeMotionRef,
  speedRef,
  handleSpeedChange,
  sendControlCommand,
}) => {
  const validKeys = new Set([
    'w', 's', 'a', 'd',
    'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  ]);

  const handleKeyDown = (e) => {
    if (['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase())) return;
    const key = e.key.toLowerCase();
    if (key === ' ' || key === 'x') {
      pressedKeysRef.current.clear();
      sendControlCommand('stop');
      return;
    }
    if (key === '1') return handleSpeedChange(50);
    if (key === '2') return handleSpeedChange(75);
    if (key === '3') return handleSpeedChange(100);
    if (key === '+' || key === '=') return handleSpeedChange(speedRef.current + 10);
    if (key === '-' || key === '_') return handleSpeedChange(speedRef.current - 10);
    if (validKeys.has(key) && !pressedKeysRef.current.has(key)) {
      pressedKeysRef.current.add(key);
      const nextCmd = computeMotionCommand(pressedKeysRef.current);
      if (nextCmd !== activeMotionRef.current) sendControlCommand(nextCmd);
    }
  };

  const handleKeyUp = (e) => {
    if (['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase())) return;
    const key = e.key.toLowerCase();
    if (validKeys.has(key) && pressedKeysRef.current.has(key)) {
      pressedKeysRef.current.delete(key);
      const nextCmd = computeMotionCommand(pressedKeysRef.current);
      if (nextCmd !== activeMotionRef.current) sendControlCommand(nextCmd);
    }
  };

  const handleBlur = () => {
    if (pressedKeysRef.current.size > 0) {
      pressedKeysRef.current.clear();
      sendControlCommand('stop');
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', handleBlur);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('blur', handleBlur);
    if (pressedKeysRef.current.size > 0 || activeMotionRef.current !== 'stop') {
      pressedKeysRef.current.clear();
      sendControlCommand('stop');
    }
  };
};

