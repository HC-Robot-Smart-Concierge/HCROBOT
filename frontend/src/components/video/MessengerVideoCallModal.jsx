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

  // 4. Dừng ghi hình và tự động upload lên Cloudinary
  const stopRecordingAndUpload = async () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Đợi 300ms gom chunk cuối
    await new Promise((resolve) => setTimeout(resolve, 400));

    if (recordedChunksRef.current.length > 0) {
      setCallStatus('uploading');
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const durationSec = recordingDuration;
      const startedAt = callStartTimeRef.current;
      const endedAt = new Date().toISOString();

      try {
        const uploadRes = await uploadCallRecording(sessionId, blob, durationSec, startedAt, endedAt);
        setUploadStatus({
          success: true,
          url: uploadRes.recording_url,
          message: uploadRes.message || 'Đã lưu bản ghi cuộc gọi lên Cloudinary!',
        });
        onCallEnded(uploadRes);
      } catch (upErr) {
        console.error('[VideoCall] Lỗi upload record:', upErr);
        setUploadStatus({
          success: false,
          message: 'Lỗi upload lên Cloudinary: ' + upErr.message,
        });
      }
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
          } else if (data.type === 'call_end') {
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
      pcRef.current.close();
      pcRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  // Kết thúc cuộc gọi
  const handleEndCall = async (notifyPeer = true) => {
    if (notifyPeer && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'call_end' }));
      } catch (e) {}
    }

    setCallStatus('ended');
    await stopRecordingAndUpload();

    setTimeout(() => {
      cleanUpResources();
      onClose();
    }, 2000);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md transition-all duration-300"
    >
      {/* Video Call Modal Window */}
      <div className="relative w-full h-full md:max-w-4xl md:h-[600px] bg-neutral-900 md:rounded-2xl overflow-hidden shadow-2xl border border-neutral-800 flex flex-col">
        {/* TOP BAR */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
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
                  <ShieldCheck className="w-3 h-3" /> Đường truyền mã hóa P2P
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* RECORDING BADGE */}
            {isRecording && callStatus === 'connected' && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/50 text-red-400 text-xs font-mono font-semibold animate-pulse">
                <Disc className="w-3.5 h-3.5" />
                <span>REC {formatTime(recordingDuration)}</span>
              </div>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 transition-all"
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
          {callStatus !== 'connected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-pulse">
                  <PhoneCall className="w-10 h-10 animate-bounce" />
                </div>
                {/* Ripple Circles */}
                <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-ping" />
              </div>

              <h2 className="text-white text-lg font-bold mb-1">
                {role === 'guest' ? 'Đang kết nối tới Tổng Đài Concierge...' : 'Cuộc gọi đến từ Robot Kiosk...'}
              </h2>
              <p className="text-neutral-400 text-xs max-w-sm mb-4">
                {hasNoCamera
                  ? 'Máy tính không có camera vật lý. Hệ thống đã kích hoạt chế độ Thoại 2 chiều và Avatar ảo.'
                  : 'Hệ thống đang thiết lập luồng WebRTC Peer-to-Peer và sẵn sàng ghi hình cuộc gọi...'}
              </p>

              {errorMessage && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/60 border border-red-800 px-3 py-1.5 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  {errorMessage}
                </div>
              )}
            </div>
          )}

          {/* UPLOADING TO CLOUDINARY OVERLAY */}
          {callStatus === 'uploading' && (
            <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
              <h3 className="text-white text-sm font-bold">Đang lưu bản ghi cuộc gọi lên Cloudinary...</h3>
              <p className="text-neutral-400 text-xs mt-1">
                File video đang được đóng gói và cập nhật vào CSDL HumanSupportSession.
              </p>
            </div>
          )}

          {/* UPLOAD SUCCESS / RESULT NOTICE */}
          {uploadStatus && (
            <div className="absolute top-20 left-4 right-4 z-30 p-3 rounded-xl bg-neutral-900/90 border border-emerald-500/50 flex items-center gap-3 backdrop-blur-md">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="flex-1 text-left">
                <div className="text-xs font-bold text-white">{uploadStatus.message}</div>
                {uploadStatus.url && (
                  <a
                    href={uploadStatus.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-400 hover:underline truncate block"
                  >
                    Xem video: {uploadStatus.url}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* PICTURE-IN-PICTURE: LOCAL SELF VIDEO */}
          <div className="absolute bottom-24 right-4 w-32 h-44 md:w-44 md:h-60 rounded-xl overflow-hidden bg-neutral-900 border-2 border-neutral-700/80 shadow-2xl z-20 transition-all hover:scale-105">
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

        {/* BOTTOM ACTION CONTROLS BAR (MESSENGER DOCK) */}
        <div className="p-4 bg-neutral-900/95 border-t border-neutral-800/80 flex items-center justify-center gap-4 z-20">
          {/* MUTE MIC BUTTON */}
          <button
            onClick={toggleMic}
            className={`p-3.5 rounded-full transition-all duration-200 ${
              isMicMuted
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                : 'bg-neutral-800 hover:bg-neutral-700 text-white'
            }`}
            title={isMicMuted ? 'Bật Mic' : 'Tắt Mic'}
          >
            {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* TOGGLE VIDEO BUTTON */}
          <button
            onClick={toggleVideo}
            className={`p-3.5 rounded-full transition-all duration-200 ${
              isVideoDisabled
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                : 'bg-neutral-800 hover:bg-neutral-700 text-white'
            }`}
            title={isVideoDisabled ? 'Bật Camera' : 'Tắt Camera'}
          >
            {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* TOGGLE SPEAKER MUTE */}
          <button
            onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
            className={`p-3.5 rounded-full transition-all duration-200 ${
              isSpeakerMuted
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-neutral-800 hover:bg-neutral-700 text-white'
            }`}
            title={isSpeakerMuted ? 'Bật Loa' : 'Tắt Loa'}
          >
            {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {/* END CALL BUTTON (RED HANGUP) */}
          <button
            onClick={() => handleEndCall(true)}
            className="px-6 py-3.5 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all"
            title="Kết thúc cuộc gọi"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="text-xs hidden sm:inline">Kết thúc & Lưu Record</span>
          </button>
        </div>
      </div>
    </div>
  );
};
