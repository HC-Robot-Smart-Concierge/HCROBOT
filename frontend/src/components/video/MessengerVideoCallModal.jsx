import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  AlertCircle,
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
  callerName = 'Khách hàng',
  calleeName = 'Nhân viên hỗ trợ',
  roomNumber = '',
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
  const createFakeVideoStream = (label = 'Khách hàng') => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      // Nền xám đen tối giản theo theme hệ thống
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Vòng tròn xám trung tính thanh lịch
      ctx.fillStyle = '#2d2d2d';
      ctx.beginPath();
      ctx.arc(320, 240, 90, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#444444';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Text Avatar
      ctx.fillStyle = '#f4f4f5';
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, 320, 247);
    };

    draw();
    const interval = setInterval(draw, 500);
    const stream = canvas.captureStream(5);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-xs transition-all duration-300 p-0 lg:p-6"
    >
      {/* Video Call Modal Window: Toàn màn hình trên mobile & landscape, cửa sổ nổi sang trọng trên desktop (lg) */}
      <div className="relative w-full h-full lg:h-[620px] lg:max-w-4xl bg-[#1E1E1E] rounded-none lg:rounded-2xl overflow-hidden shadow-2xl border-0 lg:border lg:border-stone-700/80 flex flex-col">
        {/* TOP BAR */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2.5 sm:py-3 lg:p-4 bg-gradient-to-b from-stone-900/90 via-stone-900/40 to-transparent robot-safe-x">
          <div className="flex items-center gap-3">
            <div className="text-stone-200 text-xs sm:text-sm font-semibold tracking-wide">
              {role === 'guest' ? (calleeName || 'Nhân viên hỗ trợ') : (callerName || 'Khách hàng')}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* CALL DURATION BADGE */}
            {callStatus === 'connected' && (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-md text-[11px] sm:text-xs font-mono font-medium bg-stone-800 border border-stone-700 text-stone-200">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-pulse" />
                <span>
                  {role === 'staff'
                    ? `REC ${formatTime(recordingDuration)}`
                    : formatTime(recordingDuration)}
                </span>
              </div>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition-colors cursor-pointer"
              title="Toàn màn hình"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          </div>
        </div>

        {/* MAIN VIDEO SCREEN */}
        <div className="relative flex-1 bg-[#181818] flex items-center justify-center overflow-hidden">
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
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 text-center z-10 bg-[#181818]/95">
              <div className="relative mb-3 sm:mb-5">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-stone-700 border-t-stone-300 animate-spin" />
              </div>

              <h2 className="text-stone-100 text-sm sm:text-base font-semibold">
                Đang kết nối với nhân viên...
              </h2>

              {errorMessage && (
                <div className="mt-2.5 flex items-center gap-2 text-[11px] sm:text-xs text-stone-300 bg-stone-800 border border-stone-700 px-3 py-1.5 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
                  {errorMessage}
                </div>
              )}
            </div>
          )}

          {/* CALL ENDED OVERLAY */}
          {callStatus === 'ended' && (
            <div className="absolute inset-0 z-30 bg-[#181818]/95 flex flex-col items-center justify-center p-4 sm:p-6 text-center animate-fadeIn">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-300 mb-2.5 shadow-lg">
                <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-stone-100 text-xs sm:text-sm font-semibold">Cuộc gọi đã kết thúc</h3>
            </div>
          )}

          {/* PICTURE-IN-PICTURE: LOCAL SELF VIDEO */}
          <div className="absolute bottom-16 sm:bottom-18 lg:bottom-24 right-3 sm:right-4 w-24 h-32 sm:w-28 sm:h-36 lg:w-40 lg:h-52 rounded-xl overflow-hidden bg-stone-900 border border-stone-700 shadow-xl z-20 transition-all">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoDisabled ? 'hidden' : 'block'}`}
            />
            {isVideoDisabled && (
              <div className="w-full h-full flex flex-col items-center justify-center bg-stone-900 text-stone-400">
                <VideoOff className="w-4 h-4 mb-1 text-stone-500" />
                <span className="text-[9px] sm:text-[10px]">Camera tắt</span>
              </div>
            )}
            <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 text-[9px] sm:text-[10px] text-stone-200 bg-stone-950/80 border border-stone-700/60 px-1.5 py-0.5 rounded font-medium">
              Bạn
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION CONTROLS BAR */}
        <div className="px-4 py-2 sm:py-2.5 lg:py-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-[#1A1A1A] border-t border-stone-800 flex items-center justify-center gap-4 sm:gap-8 z-30 shrink-0 robot-safe-x">
          {/* STAFF ONLY CONTROLS */}
          {role === 'staff' && (
            <>
              {/* MUTE MIC BUTTON */}
              <button
                type="button"
                onClick={toggleMic}
                className="flex flex-col items-center gap-1 focus:outline-none cursor-pointer group"
              >
                <div
                  className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all ${
                    isMicMuted
                      ? 'bg-stone-800 text-stone-400 border border-stone-700'
                      : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
                  }`}
                >
                  {isMicMuted ? <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </div>
                <span className="text-[10px] font-medium text-stone-400">
                  {isMicMuted ? 'Bật Mic' : 'Tắt Mic'}
                </span>
              </button>

              {/* TOGGLE VIDEO BUTTON */}
              <button
                type="button"
                onClick={toggleVideo}
                className="flex flex-col items-center gap-1 focus:outline-none cursor-pointer group"
              >
                <div
                  className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all ${
                    isVideoDisabled
                      ? 'bg-stone-800 text-stone-400 border border-stone-700'
                      : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
                  }`}
                >
                  {isVideoDisabled ? <VideoOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </div>
                <span className="text-[10px] font-medium text-stone-400">
                  {isVideoDisabled ? 'Bật Cam' : 'Tắt Cam'}
                </span>
              </button>

              {/* TOGGLE SPEAKER BUTTON */}
              <button
                type="button"
                onClick={toggleSpeaker}
                className="flex flex-col items-center gap-1 focus:outline-none cursor-pointer group"
              >
                <div
                  className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all ${
                    isSpeakerMuted
                      ? 'bg-stone-800 text-stone-400 border border-stone-700'
                      : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
                  }`}
                >
                  {isSpeakerMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </div>
                <span className="text-[10px] font-medium text-stone-400">
                  {isSpeakerMuted ? 'Bật Loa' : 'Tắt Loa'}
                </span>
              </button>
            </>
          )}

          {/* END CALL BUTTON */}
          <button
            type="button"
            onClick={() => handleEndCall(true)}
            className="flex items-center justify-center gap-2 px-6 py-2 sm:px-8 sm:py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-98 text-stone-200 hover:text-white border border-stone-600 transition-all cursor-pointer shadow-sm"
          >
            <PhoneOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
            <span className="text-xs font-semibold tracking-wide">Kết thúc cuộc gọi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
