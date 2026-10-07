import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  PhoneCall,
  Volume2,
  VolumeX,
  Share2,
  Maximize2,
  Minimize2,
  Disc,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { uploadCallRecording, getCallSignalingWsUrl } from '../../services/conciergeApi';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

export const MessengerVideoCallModal = ({
  isOpen = false,
  sessionId = 'default-call',
  role = 'guest', // 'guest' (Kiosk/User) | 'staff' (Concierge Specialist)
  callerName = 'Khách tại Sảnh',
  calleeName = 'Tổng Đài Viên Concierge',
  roomNumber = 'Sảnh S1',
  ticketCode = null,
  onClose = () => {},
  onCallEnded = () => {},
}) => {
  // Call status: 'calling' | 'ringing' | 'connected' | 'ended' | 'uploading'
  const [callStatus, setCallStatus] = useState('calling');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null); // { success: true/false, url, message }
  const [errorMessage, setErrorMessage] = useState('');
  const [hasNoCamera, setHasNoCamera] = useState(false);

  // References
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const modalContainerRef = useRef(null);

  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const callStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);
  const isEndingRef = useRef(false);

  // 1. Tạo Canvas Stream giả lập trong trường hợp máy tính KHÔNG CÓ WEBCAM
  const createFakeVideoStream = (label = 'Audio Only') => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    let hue = 210;

    const draw = () => {
      hue = (hue + 1) % 360;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Gradient Circle
      const grad = ctx.createRadialGradient(320, 240, 20, 320, 240, 180);
      grad.addColorStop(0, `hsl(${hue}, 70%, 45%)`);
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(320, 240, 140, 0, Math.PI * 2);
      ctx.fill();

      // Text Avatar
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, 320, 240);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      ctx.fillText('Live Audio Call • Camera Off', 320, 275);
    };

    draw();
    const interval = setInterval(draw, 100);
    const stream = canvas.captureStream(15);
    stream._canvasInterval = interval;
    return stream;
  };

  // 2. Lấy Media Stream của thiết bị (Hỗ trợ fallback thông minh nếu không có Camera)
  const acquireLocalMedia = async () => {
    try {
      // Thử xin cả video và mic
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      return stream;
    } catch (videoError) {
      console.warn('[VideoCall] Không tìm thấy camera thật hoặc bị từ chối:', videoError.name);
      setHasNoCamera(true);

      // Thử xin chỉ âm thanh (Mic)
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const fakeVideoStream = createFakeVideoStream(role === 'staff' ? 'Concierge Staff' : 'Hotel Guest');
        
        // Gộp audio thật + video canvas giả lập
        const combinedStream = new MediaStream([
          ...audioStream.getAudioTracks(),
          ...fakeVideoStream.getVideoTracks(),
        ]);
        return combinedStream;
      } catch (audioError) {
        console.error('[VideoCall] Cả mic và camera đều không truy cập được:', audioError);
        // Fallback hoàn toàn bằng canvas
        const fakeStream = createFakeVideoStream('No Device Available');
        return fakeStream;
      }
    }
  };

  // 3. Khởi tạo ghi hình cuộc gọi (MediaRecorder)
  const startRecording = (stream) => {
    try {
      if (!window.MediaRecorder) {
        console.warn('[VideoCall] MediaRecorder không được hỗ trợ trên trình duyệt này');
        return;
      }

      recordedChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => {
        setIsRecording(true);
        callStartTimeRef.current = new Date().toISOString();
        timerIntervalRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
      };

      recorder.start(1000); // 1s slice
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.error('[VideoCall] Lỗi khởi tạo MediaRecorder:', err);
    }
  };

  // 4. Dừng ghi hình và tự động lưu trong nền (Hoàn toàn ẩn không hiển thị Cloudinary cho khách)
  const stopRecordingAndUpload = async () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }

    // Đợi 300ms gom chunk cuối
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (recordedChunksRef.current.length > 0) {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const durationSec = recordingDuration;
      const startedAt = callStartTimeRef.current;
      const endedAt = new Date().toISOString();

      // Upload chạy ngầm không chặn giao diện và không lộ tên dịch vụ lưu trữ
      uploadCallRecording(sessionId, blob, durationSec, startedAt, endedAt)
        .then((uploadRes) => {
          onCallEnded(uploadRes);
        })
        .catch((upErr) => {
          console.warn('[VideoCall] Background upload notice:', upErr);
        });
    }
  };

  // 5. Kết nối WebSocket Signaling & RTCPeerConnection
  const setupWebRTC = useCallback(async () => {
    try {
      const stream = await acquireLocalMedia();
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Khởi tạo RTCPeerConnection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Thêm các track local vào peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Lắng nghe stream từ đối phương (hỗ trợ cả Safari iOS không bọc streams array)
      pc.ontrack = (event) => {
        console.log('[VideoCall] ontrack received track:', event.track.kind);
        let stream = event.streams && event.streams[0];
        if (!stream) {
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
          }
          remoteStreamRef.current.addTrack(event.track);
          stream = remoteStreamRef.current;
        } else {
          remoteStreamRef.current = stream;
        }

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch((e) => console.warn('[VideoCall] Auto-play video error:', e));
        }
        setCallStatus('connected');
        if (!mediaRecorderRef.current && stream) {
          startRecording(stream);
        }
      };

      // Theo dõi trạng thái kết nối WebRTC P2P
      pc.onconnectionstatechange = () => {
        console.log('[VideoCall] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setCallStatus('connected');
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[VideoCall] ICE state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setCallStatus('connected');
        }
      };

      // Xử lý ICE Candidate
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

      // Mở kết nối WebSocket Signaling
      const wsUrl = getCallSignalingWsUrl(sessionId, role, role === 'guest' ? callerName : calleeName);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[VideoCall] Signaling WS Connected for session:', sessionId);
        if (role === 'guest') {
          setCallStatus('ringing');
        }
      };

      ws.onmessage = async (evt) => {
        try {
          const data = JSON.parse(evt.data);

          if (data.type === 'peer_joined') {
            console.log('[VideoCall] Peer joined:', data.name, 'as role:', data.role);
            if (role === 'guest') {
              // Guest tạo Offer gửi cho Staff (yêu cầu cả âm thanh và video 2 chiều)
              const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
              });
              await pc.setLocalDescription(offer);
              ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
            }
          } else if (data.type === 'offer') {
            console.log('[VideoCall] Received Offer from peer');
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

            // Xử lý hàng đợi ICE candidates đến sớm trước khi remoteDescription sẵn sàng
            while (iceCandidatesQueueRef.current.length > 0) {
              const cand = iceCandidatesQueueRef.current.shift();
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.warn('[VideoCall] Error adding queued candidate:', e);
              }
            }

            const answer = await pc.createAnswer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', sdp: answer }));
            setCallStatus('connected');
          } else if (data.type === 'answer') {
            console.log('[VideoCall] Received Answer from peer');
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

            // Xử lý hàng đợi ICE candidates đến sớm
            while (iceCandidatesQueueRef.current.length > 0) {
              const cand = iceCandidatesQueueRef.current.shift();
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.warn('[VideoCall] Error adding queued candidate:', e);
              }
            }
            setCallStatus('connected');
          } else if (data.type === 'candidate') {
            if (data.candidate) {
              if (pc.remoteDescription && pc.remoteDescription.type) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (candErr) {
                  console.warn('[VideoCall] Error adding ICE candidate:', candErr);
                }
              } else {
                iceCandidatesQueueRef.current.push(data.candidate);
              }
            }
          } else if (data.type === 'call_end' || data.type === 'peer_disconnected') {
            console.log('[VideoCall] Đối phương đã kết thúc cuộc gọi:', data.type);
            handleEndCall(false);
          }
        } catch (msgErr) {
          console.warn('[VideoCall] Parse signaling msg error:', msgErr);
        }
      };

      ws.onerror = (err) => {
        console.error('[VideoCall] WS Signaling Error:', err);
      };

      ws.onclose = () => {
        console.log('[VideoCall] WS Signaling Closed');
      };
    } catch (err) {
      console.error('[VideoCall] Setup error:', err);
      setErrorMessage(err.message || 'Không thể thiết lập cuộc gọi');
    }
  }, [sessionId, role, callerName, calleeName]);

  // Khởi động khi modal mở
  useEffect(() => {
    if (isOpen) {
      isEndingRef.current = false;
      setCallStatus('calling');
      setRecordingDuration(0);
      setUploadStatus(null);
      setErrorMessage('');
      setupWebRTC();
    }

    return () => {
      cleanUpResources();
    };
  }, [isOpen, setupWebRTC]);

  // Dọn dẹp tài nguyên
  const cleanUpResources = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      if (localStreamRef.current._canvasInterval) {
        clearInterval(localStreamRef.current._canvasInterval);
      }
    }

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {}
      pcRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }
  };

  // Kết thúc cuộc gọi (Đồng bộ ngắt kết nối lập tức cho cả 2 thiết bị)
  const handleEndCall = (notifyPeer = true) => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    if (notifyPeer && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'call_end' }));
      } catch (e) {}
    }

    setCallStatus('ended');

    // Dừng phát camera và micro ngay lập tức để tắt đèn thiết bị
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Dừng ghi hình và upload trong nền ngầm
    stopRecordingAndUpload();

    // Tự động đóng modal sau 1.2s hiển thị thông báo kết thúc
    setTimeout(() => {
      cleanUpResources();
      onClose();
    }, 1200);
  };

  // Bật/tắt Loa (Âm thanh từ đối phương)
  const toggleSpeaker = () => {
    setIsSpeakerMuted((prev) => {
      const next = !prev;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.muted = next;
      }
      return next;
    });
  };

  // Bật/tắt Mic
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  // Bật/tắt Video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
      }
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!modalContainerRef.current) return;
    if (!document.fullscreenElement) {
      modalContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Format mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalContainerRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md transition-all duration-300 p-0 md:p-6"
    >
      {/* Video Call Modal Window */}
      <div className="relative w-full h-[100dvh] md:h-[620px] md:max-w-4xl bg-neutral-900 md:rounded-2xl overflow-hidden shadow-2xl border border-neutral-800 flex flex-col">
        {/* TOP BAR */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="text-white text-sm font-bold flex items-center gap-2">
                {role === 'guest' ? calleeName : callerName}
                {ticketCode && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                    {ticketCode}
                  </span>
                )}
              </div>
              <div className="text-neutral-400 text-xs flex items-center gap-1.5">
                <span>{roomNumber}</span>
                <span>•</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Trực tuyến P2P
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* CALL DURATION BADGE */}
            {callStatus === 'connected' && (
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold ${
                  role === 'staff'
                    ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                    : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    role === 'staff' ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'
                  }`}
                />
                <span>
                  {role === 'staff'
                    ? `REC ${formatTime(recordingDuration)}`
                    : formatTime(recordingDuration)}
                </span>
              </div>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 transition-all cursor-pointer"
              title="Toàn màn hình"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* MAIN VIDEO SCREEN */}
        <div className="relative flex-1 bg-neutral-950 flex items-center justify-center overflow-hidden">
          {/* Remote Video Stream */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={isSpeakerMuted}
            className={`w-full h-full object-cover transition-opacity duration-500 ${
              callStatus === 'connected' ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* CALLING / RINGING / CONNECTING OVERLAY */}
          {callStatus !== 'connected' && callStatus !== 'ended' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-neutral-950/90">
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-pulse">
                  <PhoneCall className="w-10 h-10 animate-bounce" />
                </div>
                {/* Ripple Circles */}
                <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-ping" />
              </div>

              <h2 className="text-white text-lg font-bold mb-1">
                {role === 'guest'
                  ? 'Đang kết nối tới Tổng Đài Concierge...'
                  : 'Cuộc gọi đến từ Robot Kiosk...'}
              </h2>
              <p className="text-neutral-400 text-xs max-w-sm mb-4">
                {hasNoCamera
                  ? 'Thiết bị không có camera vật lý. Hệ thống tự động kích hoạt chế độ Thoại 2 chiều.'
                  : 'Đang kết nối tín hiệu video call độ trễ thấp...'}
              </p>

              {errorMessage && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/60 border border-red-800 px-3 py-1.5 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  {errorMessage}
                </div>
              )}
            </div>
          )}

          {/* CALL ENDED OVERLAY (KHÔNG HIỆN THỊ CLOUDINARY CHO KHÁCH HÀNG) */}
          {callStatus === 'ended' && (
            <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-red-400 mb-4 shadow-xl">
                <PhoneOff className="w-8 h-8" />
              </div>
              <h3 className="text-white text-base font-bold">Cuộc gọi đã kết thúc</h3>
              <p className="text-neutral-400 text-xs mt-1.5">
                Cảm ơn bạn đã liên hệ bộ phận Trợ lý Concierge.
              </p>
            </div>
          )}

          {/* PICTURE-IN-PICTURE: LOCAL SELF VIDEO */}
          <div className="absolute bottom-28 right-4 w-32 h-44 md:w-44 md:h-60 rounded-xl overflow-hidden bg-neutral-900 border-2 border-neutral-700/80 shadow-2xl z-20 transition-all hover:scale-105">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoDisabled ? 'hidden' : 'block'}`}
            />
            {isVideoDisabled && (
              <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-800 text-neutral-400">
                <VideoOff className="w-6 h-6 mb-1" />
                <span className="text-[10px]">Camera tắt</span>
              </div>
            )}
            <div className="absolute bottom-1.5 left-2 text-[10px] text-white/90 bg-black/60 px-1.5 py-0.5 rounded font-semibold">
              Bạn
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION CONTROLS BAR (FACETIME / MESSENGER STYLE DOCK) */}
        <div className="px-4 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-neutral-900/98 border-t border-neutral-800/80 flex items-center justify-center gap-6 sm:gap-10 z-30 shrink-0 backdrop-blur-md">
          {/* STAFF ONLY CONTROLS: BẬT/TẮT MIC, CAM, LOA */}
          {role === 'staff' && (
            <>
              {/* MUTE MIC BUTTON */}
              <button
                type="button"
                onClick={toggleMic}
                className="flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer group"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    isMicMuted
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-lg shadow-red-500/20 scale-105'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700/60'
                  }`}
                >
                  {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </div>
                <span
                  className={`text-[11px] font-medium transition-colors ${
                    isMicMuted ? 'text-red-400 font-semibold' : 'text-neutral-400 group-hover:text-neutral-200'
                  }`}
                >
                  {isMicMuted ? 'Bật Mic' : 'Tắt Mic'}
                </span>
              </button>

              {/* TOGGLE VIDEO BUTTON */}
              <button
                type="button"
                onClick={toggleVideo}
                className="flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer group"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    isVideoDisabled
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-lg shadow-red-500/20 scale-105'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700/60'
                  }`}
                >
                  {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </div>
                <span
                  className={`text-[11px] font-medium transition-colors ${
                    isVideoDisabled ? 'text-red-400 font-semibold' : 'text-neutral-400 group-hover:text-neutral-200'
                  }`}
                >
                  {isVideoDisabled ? 'Bật Cam' : 'Tắt Cam'}
                </span>
              </button>

              {/* TOGGLE SPEAKER BUTTON */}
              <button
                type="button"
                onClick={toggleSpeaker}
                className="flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer group"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    isSpeakerMuted
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-lg shadow-amber-500/20 scale-105'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700/60'
                  }`}
                >
                  {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </div>
                <span
                  className={`text-[11px] font-medium transition-colors ${
                    isSpeakerMuted ? 'text-amber-400 font-semibold' : 'text-neutral-400 group-hover:text-neutral-200'
                  }`}
                >
                  {isSpeakerMuted ? 'Bật Loa' : 'Tắt Loa'}
                </span>
              </button>
            </>
          )}

          {/* END CALL BUTTON (RED HANGUP - HIỂN THỊ CẢ 2 BÊN) */}
          <button
            type="button"
            onClick={() => handleEndCall(true)}
            className="flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer active:scale-95 transition-transform group"
          >
            <div
              className={`rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-lg shadow-red-600/40 border border-red-500 transition-all ${
                role === 'guest' ? 'px-8 py-3.5 gap-2.5' : 'w-12 h-12'
              }`}
            >
              <PhoneOff className="w-5 h-5" />
              {role === 'guest' && (
                <span className="text-xs font-bold tracking-wide">Kết thúc cuộc gọi</span>
              )}
            </div>
            {role === 'staff' && (
              <span className="text-[11px] font-bold text-red-400 group-hover:text-red-300">
                Kết thúc
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
