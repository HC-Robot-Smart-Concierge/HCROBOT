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
  Languages,
  Check,
  Globe,
  Sparkles,
  Send,
} from 'lucide-react';
import { uploadCallRecording, getCallSignalingWsUrl } from '../../services/conciergeApi';
import { quickTranslateText, synthesizeSpeech } from '../../services/aiApi';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:relay.metered.ca:80' },
    {
      urls: 'turn:relay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:relay.metered.ca:80?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

function base64ToUint8Array(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const MessengerVideoCallModal = ({
  isOpen = false,
  sessionId = 'default-call',
  role = 'guest', // 'guest' (Kiosk/User) | 'staff' (Concierge Specialist)
  callerName = 'Khách hàng',
  calleeName = 'Nhân viên hỗ trợ',
  roomNumber = '',
  ticketCode = null,
  guestLanguage = 'Tiếng Việt', // 'Tiếng Việt' | 'English'
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

  // Live Subtitle & Auto-Translation State (EN ⇄ VI)
  // Mode: 'auto' (Tự động dịch thông minh 2 chiều) | 'bypass' (Thuần Việt - Không dịch)
  const [translateMode, setTranslateMode] = useState('auto');
  // Mặc định phiên dịch là English để Robot Kiosk bắt trọn câu nói tiếng Anh của khách nước ngoài
  const [activeGuestLanguage, setActiveGuestLanguage] = useState(
    guestLanguage === 'Tiếng Việt' && translateMode === 'bypass' ? 'Tiếng Việt' : 'English'
  );
  const [activeSubtitle, setActiveSubtitle] = useState(null);
  const [interimText, setInterimText] = useState('');
  const [callTranscripts, setCallTranscripts] = useState([]);
  const [showTranslateSettings, setShowTranslateSettings] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testCustomText, setTestCustomText] = useState('');
  const [isTestTranslating, setIsTestTranslating] = useState(false);

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

  // Speech Recognition & Subtitle Refs
  const speechRecognitionRef = useRef(null);
  const subtitleTimeoutRef = useRef(null);
  const callTranscriptsRef = useRef([]);
  const isMicMutedRef = useRef(false);
  const checkPeerIntervalRef = useRef(null);
  const serverLanIpRef = useRef(null);
  const interpreterAudioRef = useRef(null);
  const playInterpreterAudioRef = useRef(null);
  const activeGuestLanguageRef = useRef('English');
  const translateModeRef = useRef('auto');

  // Web Audio Context & Persistent Player for Autoplay Bypass
  const audioContextRef = useRef(null);
  const activeAudioSourceRef = useRef(null);
  const persistentAudioRef = useRef(null);
  const lastProcessedTextRef = useRef('');
  const lastProcessedTimeRef = useRef(0);
  const pendingTranscriptRef = useRef('');
  const sttSilenceTimerRef = useRef(null);
  const handleProcessSpokenTextRef = useRef(null);

  // Chống lặp vòng lặp âm thanh (Acoustic Echo Loop Prevention) khi loa Kiosk phát giọng đọc AI
  const isAiSpeakingRef = useRef(false);
  const ttsActiveUntilRef = useRef(0);
  const lastPlayedTtsTextRef = useRef('');
  const [sttStatusMessage, setSttStatusMessage] = useState('');

  useEffect(() => {
    activeGuestLanguageRef.current = activeGuestLanguage;
  }, [activeGuestLanguage]);

  useEffect(() => {
    translateModeRef.current = translateMode;
  }, [translateMode]);

  // 1. Tạo Canvas Stream giả lập trong trường hợp máy tính KHÔNG CÓ WEBCAM (Tương thích iOS Safari)
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
    let stream;
    if (typeof canvas.captureStream === 'function') {
      stream = canvas.captureStream(5);
      stream._canvasInterval = setInterval(draw, 500);
    } else if (typeof canvas.webkitCaptureStream === 'function') {
      stream = canvas.webkitCaptureStream(5);
      stream._canvasInterval = setInterval(draw, 500);
    } else {
      // iOS Safari WebKit fallback: MediaStream rỗng không throw lỗi
      stream = new MediaStream();
    }
    return stream;
  };

  // 2. Lấy Media Stream của thiết bị (Đa tầng fallback cho cả PC và iPhone Safari)
  const acquireLocalMedia = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('[VideoCall] navigator.mediaDevices.getUserMedia không được hỗ trợ');
      return createFakeVideoStream(role === 'staff' ? 'Concierge Staff' : 'Hotel Guest');
    }

    // Tầng 1: Thử camera trước + mic tiêu chuẩn
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: role === 'staff'
          ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      setHasNoCamera(false);
      return stream;
    } catch (videoError) {
      console.warn('[VideoCall] Thử camera tiêu chuẩn thất bại:', videoError?.message || videoError?.name);
    }

    // Tầng 2: Thử video + audio cơ bản không ràng buộc resolution (iOS Safari)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setHasNoCamera(false);
      return stream;
    } catch (basicErr) {
      console.warn('[VideoCall] Thử video+audio cơ bản thất bại:', basicErr?.message || basicErr?.name);
    }

    // Tầng 3: Thử chỉ Mic + Fake canvas video (nếu không có camera hoặc bị chặn)
    setHasNoCamera(true);
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const fakeVideoStream = createFakeVideoStream(role === 'staff' ? 'Nhân viên Concierge' : 'Robot Kiosk');
      return new MediaStream([
        ...audioStream.getAudioTracks(),
        ...fakeVideoStream.getVideoTracks(),
      ]);
    } catch (audioError) {
      console.warn('[VideoCall] Cả mic và camera đều không truy cập được:', audioError);
      if (audioError?.name === 'NotAllowedError' || audioError?.name === 'PermissionDeniedError') {
        setErrorMessage('Quyền Micro hoặc Camera chưa được cấp. Hãy kiểm tra cài đặt trình duyệt trên thiết bị (biểu tượng ổ khóa/Cài đặt Safari) để Cho phép Micro & Camera.');
      } else if (audioError?.name === 'NotReadableError' || audioError?.name === 'TrackStartError') {
        setErrorMessage('Camera hoặc Micro đang bị ứng dụng khác chiếm giữ. Hệ thống tự động chuyển sang luồng đàm thoại dự phòng.');
      }
      return createFakeVideoStream('No Device Available');
    }
  };

  // 3. Khởi tạo ghi hình cuộc gọi (MediaRecorder hỗ trợ cả video/mp4 trên Safari)
  const startRecording = (stream) => {
    try {
      if (!window.MediaRecorder) {
        console.warn('[VideoCall] MediaRecorder không được hỗ trợ trên trình duyệt này');
        return;
      }

      recordedChunksRef.current = [];
      let mimeType = '';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
          mimeType = 'video/webm;codecs=vp9,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          mimeType = 'video/webm;codecs=vp8,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          mimeType = 'video/webm';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => {
        setIsRecording(true);
        if (!callStartTimeRef.current) {
          callStartTimeRef.current = new Date().toISOString();
        }
      };

      recorder.start(1000); // 1s slice
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn('[VideoCall] Lỗi khởi tạo MediaRecorder (bỏ qua ghi hình):', err);
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

      // Upload chạy ngầm không chặn giao diện và lưu kèm bản ghi chép phụ đề hội thoại
      uploadCallRecording(sessionId, blob, durationSec, startedAt, endedAt, callTranscriptsRef.current)
        .then((uploadRes) => {
          onCallEnded(uploadRes);
        })
        .catch((upErr) => {
          console.warn('[VideoCall] Background upload notice:', upErr);
        });
    }
  };

  // Khởi tạo AudioContext cho Web Audio API (miễn nhiễm với chính sách chặn autoplay của trình duyệt)
  const getOrCreateAudioContext = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
      return audioContextRef.current;
    } catch (e) {
      console.warn('[VideoCall Audio] Không thể khởi tạo AudioContext:', e);
      return null;
    }
  }, []);

  // Unlock Audio trên mọi tương tác của người dùng (Click, Touch, Answer Call, v.v.)
  const primeAudioContext = useCallback(() => {
    const ctx = getOrCreateAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (persistentAudioRef.current) {
      try {
        persistentAudioRef.current.play().then(() => {
          persistentAudioRef.current.pause();
        }).catch(() => {});
      } catch (e) {}
    }
    // Safari iOS: Đảm bảo âm thanh WebRTC đối phương được mở và play khi người dùng tương tác
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = isSpeakerMuted;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [getOrCreateAudioContext, isSpeakerMuted]);

  // Phát âm thanh thông dịch AI (Edge Neural TTS) kèm kỹ thuật Audio Ducking & Chống lặp vòng âm thanh:
  // Tự động hạ volume WebRTC đối phương xuống 10% trong khi AI nói để nghe rõ, rồi hồi phục về 100%
  const playInterpreterAudio = useCallback(async (audioBase64, spokenText = '') => {
    if (!audioBase64 || isSpeakerMuted) return;

    try {
      console.log(`[VideoCall Audio] [${role}] Bắt đầu phát âm thanh AI (${audioBase64.length} base64 chars)`);
      isAiSpeakingRef.current = true;
      setIsAiSpeaking(true);
      ttsActiveUntilRef.current = Date.now() + 15000;
      if (spokenText) {
        lastPlayedTtsTextRef.current = spokenText.trim();
      }

      // Audio Ducking: Giảm volume WebRTC đối phương xuống 10% để nghe rõ tiếng phiên dịch AI
      if (remoteVideoRef.current) {
        console.log(`[VideoCall Audio] [${role}] Đang giảm âm lượng WebRTC đối phương xuống 10% để phát giọng AI`);
        remoteVideoRef.current.volume = 0.1;
      }

      const handleAudioFinished = () => {
        console.log(`[VideoCall Audio] [${role}] Giọng đọc AI kết thúc -> Hồi phục âm lượng WebRTC về 100%`);
        isAiSpeakingRef.current = false;
        setIsAiSpeaking(false);
        ttsActiveUntilRef.current = Date.now() + 850; // 850ms cooldown buffer chống micro thu lại tiếng loa
        if (remoteVideoRef.current) {
          remoteVideoRef.current.volume = 1.0;
        }
        activeAudioSourceRef.current = null;
      };

      // 1. Dừng nguồn âm thanh cũ nếu đang phát
      if (activeAudioSourceRef.current) {
        try {
          activeAudioSourceRef.current.stop();
        } catch (e) {}
        activeAudioSourceRef.current = null;
      }
      if (persistentAudioRef.current) {
        try {
          persistentAudioRef.current.pause();
        } catch (e) {}
      }

      // 2. Thử phát bằng Web Audio API AudioContext (Miễn nhiễm 100% với lỗi Autoplay trên Safari & Chrome)
      const ctx = getOrCreateAudioContext();
      if (ctx) {
        try {
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
          const uint8 = base64ToUint8Array(audioBase64);
          const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          source.onended = handleAudioFinished;
          activeAudioSourceRef.current = source;
          source.start(0);
          console.log(`[VideoCall Audio] [${role}] Âm thanh AI đang phát to rõ qua Web Audio API AudioContext!`);
          return;
        } catch (ctxErr) {
          console.warn('[VideoCall Audio] Web Audio API decode lỗi, fallback sang HTML5 Audio:', ctxErr);
        }
      }

      // 3. Fallback: Phát bằng persistent HTML5 Audio Element
      if (persistentAudioRef.current) {
        const audioEl = persistentAudioRef.current;
        audioEl.src = `data:audio/mp3;base64,${audioBase64}`;
        audioEl.currentTime = 0;
        audioEl.onended = handleAudioFinished;
        audioEl.onerror = (e) => {
          console.warn('[VideoCall Audio] HTML5 Audio Element lỗi:', e);
          handleAudioFinished();
        };
        const playPromise = audioEl.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log(`[VideoCall Audio] [${role}] Âm thanh AI đang phát to rõ qua HTML5 Audio Element!`);
            })
            .catch((err) => {
              console.warn('[VideoCall Audio] HTML5 Audio autoplay bị chặn:', err);
              handleAudioFinished();
            });
        }
      } else {
        handleAudioFinished();
      }
    } catch (e) {
      console.warn(`[VideoCall Audio] [${role}] Lỗi phát âm thanh:`, e);
      setIsAiSpeaking(false);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.volume = 1.0;
      }
    }
  }, [isSpeakerMuted, role, getOrCreateAudioContext]);

  useEffect(() => {
    playInterpreterAudioRef.current = playInterpreterAudio;
  }, [playInterpreterAudio]);

  // 5. Kết nối WebSocket Signaling & RTCPeerConnection
  const setupWebRTC = useCallback(async () => {
    try {
      primeAudioContext();
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
        console.log('[VideoCall] ontrack received track:', event.track.kind, event.track.id);

        // Luôn duy trì 1 MediaStream duy nhất làm nguồn video/audio cho remoteVideoRef
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }

        // Bật track âm thanh / hình ảnh
        event.track.enabled = true;

        // Thêm track vào remoteStreamRef nếu chưa có
        if (!remoteStreamRef.current.getTracks().some((t) => t.id === event.track.id)) {
          remoteStreamRef.current.addTrack(event.track);
          console.log('[VideoCall] Added track to remoteStreamRef:', event.track.kind, 'total tracks:', remoteStreamRef.current.getTracks().length);
        }

        // Khi track bắt đầu nhận dữ liệu thực tế (unmute)
        event.track.onunmute = () => {
          console.log('[VideoCall] Remote track unmuted (media flowing):', event.track.kind);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(() => {});
          }
        };

        if (remoteVideoRef.current) {
          if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
          }
          const playPromise = remoteVideoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((e) => {
              if (e.name !== 'AbortError') {
                console.warn('[VideoCall] Auto-play video notice:', e);
                if (e.name === 'NotAllowedError') {
                  remoteVideoRef.current.muted = true;
                  remoteVideoRef.current.play().catch(() => {});
                }
              }
            });
          }
        }
        setCallStatus('connected');
        if (!mediaRecorderRef.current && remoteStreamRef.current) {
          startRecording(remoteStreamRef.current);
        }
      };

      // Theo dõi trạng thái kết nối WebRTC P2P
      pc.onconnectionstatechange = async () => {
        console.log('[VideoCall] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setCallStatus('connected');
          if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(() => {});
          }
        } else if (pc.connectionState === 'failed') {
          console.warn('[VideoCall] Connection failed, attempting ICE restart...');
          if (role === 'guest' && pc.restartIce && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            try {
              pc.restartIce();
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              wsRef.current.send(JSON.stringify({ type: 'offer', sdp: offer }));
              console.log('[VideoCall] Dispatched ICE restart offer');
            } catch (iceErr) {
              console.error('[VideoCall] ICE restart error:', iceErr);
            }
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[VideoCall] ICE state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setCallStatus('connected');
          if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(() => {});
          }
        }
      };

      // Xử lý ICE Candidate (gửi candidate gốc và de-anonymized candidate cho local LAN)
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(`[VideoCall] [${role}] Generated ICE candidate:`, event.candidate.candidate);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'candidate',
                candidate: event.candidate,
              })
            );
          }

          // Chỉ de-anonymize mDNS candidate nếu ĐÂY LÀ ROBOT KIOSK TRÊN MÁY TÍNH (role === 'guest')
          // TUYỆT ĐỐI không thay thế cho thiết bị di động (role === 'staff') vì sẽ làm iPhone gửi nhầm IP của PC
          if (role === 'guest') {
            const candStr = event.candidate.candidate;
            const lanIp = serverLanIpRef.current;
            if (candStr && candStr.includes('.local') && lanIp && lanIp !== '127.0.0.1') {
              const unmDnsStr = candStr.replace(/[a-zA-Z0-9_\-]+\.local/g, lanIp);
              if (unmDnsStr !== candStr && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                console.log(`[VideoCall] [${role}] Dispatched de-anonymized LAN candidate:`, unmDnsStr);
                wsRef.current.send(
                  JSON.stringify({
                    type: 'candidate',
                    candidate: {
                      candidate: unmDnsStr,
                      sdpMid: event.candidate.sdpMid,
                      sdpMLineIndex: event.candidate.sdpMLineIndex,
                      usernameFragment: event.candidate.usernameFragment,
                    },
                  })
                );
              }
            }
          }
        } else {
          console.log(`[VideoCall] [${role}] ICE candidate gathering finished (null)`);
        }
      };

      // Mở kết nối WebSocket Signaling
      const wsUrl = getCallSignalingWsUrl(sessionId, role, role === 'guest' ? callerName : calleeName);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Keepalive ping định kỳ 10s để giữ kết nối WebSocket không bị Cloudflare Tunnel timeout
      if (checkPeerIntervalRef.current) clearInterval(checkPeerIntervalRef.current);
      checkPeerIntervalRef.current = setInterval(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          } catch (e) {}
        }
      }, 10000);

      ws.onopen = () => {
        console.log('[VideoCall] Signaling WS Connected for session:', sessionId);
        if (role === 'guest') {
          setCallStatus('ringing');
        }
      };

      ws.onmessage = async (evt) => {
        try {
          const data = JSON.parse(evt.data);

          if (data.type === 'server_info' && data.lan_ip) {
            console.log('[VideoCall] Received server LAN IP:', data.lan_ip);
            serverLanIpRef.current = data.lan_ip;
          } else if (data.type === 'peer_joined') {
            console.log('[VideoCall] Peer joined:', data.name, 'as role:', data.role, 'signalingState:', pc.signalingState);
            if (role === 'guest') {
              // Chỉ tạo Offer khi signalingState là 'stable' (tránh duplicate offer gây InvalidStateError)
              if (pc.signalingState !== 'stable') {
                console.log('[VideoCall] Bỏ qua tạo Offer vì signalingState không phải stable:', pc.signalingState);
                return;
              }
              try {
                const offer = await pc.createOffer({
                  offerToReceiveAudio: true,
                  offerToReceiveVideo: true,
                });
                await pc.setLocalDescription(offer);
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
                  console.log('[VideoCall] Sent Offer to staff');
                }
              } catch (offerErr) {
                console.error('[VideoCall] Create offer error:', offerErr);
              }
            }
          } else if (data.type === 'offer') {
            console.log('[VideoCall] Received Offer from peer, signalingState:', pc.signalingState);
            try {
              if (pc.signalingState !== 'stable') {
                console.log('[VideoCall] Rollback local state để nhận offer mới');
                await pc.setLocalDescription({ type: 'rollback' });
              }
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
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'answer', sdp: answer }));
                console.log('[VideoCall] Sent Answer to guest');
              }
              setCallStatus('connected');
            } catch (ansErr) {
              console.error('[VideoCall] Error handling offer:', ansErr);
            }
          } else if (data.type === 'answer') {
            console.log('[VideoCall] Received Answer from peer, signalingState:', pc.signalingState);
            // Quan trọng: Chỉ gọi setRemoteDescription khi đang ở trạng thái 'have-local-offer'
            if (pc.signalingState === 'have-local-offer') {
              try {
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
              } catch (ansErr) {
                console.error('[VideoCall] Error applying answer:', ansErr);
              }
            } else {
              console.log('[VideoCall] Bỏ qua Answer dư thừa vì signalingState là:', pc.signalingState);
            }
            // Đảm bảo callStatus chuyển sang connected
            setCallStatus('connected');
          } else if (data.type === 'candidate') {
            if (data.candidate) {
              const candStr = data.candidate.candidate || data.candidate;
              console.log(`[VideoCall] [${role}] Received candidate from peer:`, candStr);
              if (pc.remoteDescription && pc.remoteDescription.type) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                  console.log(`[VideoCall] [${role}] Successfully applied candidate`);
                } catch (candErr) {
                  console.warn(`[VideoCall] [${role}] Error adding ICE candidate:`, candErr);
                }
              } else {
                console.log(`[VideoCall] [${role}] Queued candidate (waiting for remoteDescription)`);
                iceCandidatesQueueRef.current.push(data.candidate);
              }
            }
          } else if (data.type === 'call_end' || data.type === 'peer_disconnected') {
            console.log('[VideoCall] Đối phương đã kết thúc cuộc gọi:', data.type);
            handleEndCall(false);
          } else if (data.type === 'live_subtitle') {
            console.log(`[VideoCall WS] [${role}] Nhận được live_subtitle từ ${data.senderRole}:`, {
              original: data.originalText,
              translated: data.translatedText,
              needsTranslation: data.needsTranslation,
              hasAudio: Boolean(data.audioBase64),
            });
            // Quy tắc 3: Chỉ hiển thị bảng dịch trên màn hình khi có nhu cầu phiên dịch thực sự
            if (data.needsTranslation) {
              setActiveSubtitle(data);
              if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
              subtitleTimeoutRef.current = setTimeout(() => {
                setActiveSubtitle(null);
              }, 6000);
            } else {
              setActiveSubtitle(null);
            }

            const transcriptItem = {
              speaker: data.senderRole === 'staff' ? 'Staff' : 'Guest',
              speaker_name: data.senderRole === 'staff' ? calleeName : callerName,
              raw_transcript: data.originalText,
              translated_text: data.translatedText,
              needs_translation: data.needsTranslation,
              source_lang: data.sourceLang,
              target_lang: data.targetLang,
              timestamp: new Date().toISOString(),
            };
            setCallTranscripts((prev) => [...prev, transcriptItem]);
            callTranscriptsRef.current.push(transcriptItem);

            // Quy tắc 2: Tự động phát âm thanh thông dịch AI (Jenny) cho Robot Kiosk khi Staff nói tiếng Việt & có bản dịch tiếng Anh
            if (role === 'guest' && data.senderRole === 'staff' && data.needsTranslation && data.audioBase64 && playInterpreterAudioRef.current) {
              console.log(`[VideoCall WS] [guest] Kích hoạt phát âm thanh thông dịch AI (Jenny) cho Robot Kiosk!`);
              playInterpreterAudioRef.current(data.audioBase64, data.translatedText);
            }
          } else if (data.type === 'live_audio') {
            if (role === 'guest' && data.senderRole === 'staff' && data.audioBase64 && playInterpreterAudioRef.current) {
              console.log(`[VideoCall WS] [guest] Nhận live_audio tách biệt và kích hoạt phát TTS (Jenny)!`);
              playInterpreterAudioRef.current(data.audioBase64, data.translatedText);
            }
          } else if (data.type === 'translate_mode_change') {
            if (data.mode) {
              setTranslateMode(data.mode);
              translateModeRef.current = data.mode;
            }
            if (data.guestLang) {
              setActiveGuestLanguage(data.guestLang);
              activeGuestLanguageRef.current = data.guestLang;
            }
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
      isMicMutedRef.current = false;
      setCallStatus('calling');
      setRecordingDuration(0);
      setUploadStatus(null);
      setErrorMessage('');
      setActiveSubtitle(null);
      setInterimText('');
      setCallTranscripts([]);
      callTranscriptsRef.current = [];
      setupWebRTC();
    }

    return () => {
      cleanUpResources();
    };
  }, [isOpen, setupWebRTC]);

  // Độc lập tính thời lượng cuộc gọi khi kết nối thành công (cho cả Kiosk Robot và Staff iPhone)
  useEffect(() => {
    let callTimer = null;
    if (callStatus === 'connected') {
      if (!callStartTimeRef.current) {
        callStartTimeRef.current = new Date().toISOString();
      }
      callTimer = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (callTimer) clearInterval(callTimer);
    };
  }, [callStatus]);

  // Dọn dẹp tài nguyên
  const cleanUpResources = () => {
    if (checkPeerIntervalRef.current) {
      clearInterval(checkPeerIntervalRef.current);
      checkPeerIntervalRef.current = null;
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (sttSilenceTimerRef.current) {
      clearTimeout(sttSilenceTimerRef.current);
      sttSilenceTimerRef.current = null;
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current._isManualStop = true;
        speechRecognitionRef.current.stop();
        speechRecognitionRef.current.abort();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }

    if (subtitleTimeoutRef.current) {
      clearTimeout(subtitleTimeoutRef.current);
      subtitleTimeoutRef.current = null;
    }

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

    if (activeAudioSourceRef.current) {
      try {
        activeAudioSourceRef.current.stop();
      } catch (e) {}
      activeAudioSourceRef.current = null;
    }

    if (persistentAudioRef.current) {
      try {
        persistentAudioRef.current.pause();
      } catch (e) {}
    }

    if (interpreterAudioRef.current) {
      try {
        interpreterAudioRef.current.pause();
        interpreterAudioRef.current = null;
      } catch (e) {}
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = 1.0;
    }
    setIsAiSpeaking(false);
  };

  // Chốt câu nói hoàn chỉnh và gửi sang luồng dịch
  const commitSpokenText = useCallback((text) => {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();
    const now = Date.now();

    // 1. Chống lặp âm thanh phản xạ từ loa AI (Acoustic Echo Loop Prevention):
    // Nếu loa đang phát giọng đọc hoặc vừa dứt lời trong vòng 850ms -> Bỏ qua ngay!
    if (isAiSpeakingRef.current || now < ttsActiveUntilRef.current) {
      console.log(`[VideoCall STT] [${role}] Bỏ qua âm phản xạ từ loa AI (Echo loop prevention): "${cleanText}"`);
      return;
    }

    // 2. Chống lặp câu trùng khớp với bản dịch AI vừa phát
    if (lastPlayedTtsTextRef.current && cleanText.toLowerCase() === lastPlayedTtsTextRef.current.toLowerCase()) {
      console.log(`[VideoCall STT] [${role}] Bỏ qua câu trùng khớp bản dịch AI vừa phát: "${cleanText}"`);
      return;
    }

    // 3. Chống lặp câu nói của chính mình trong vòng 2.5 giây
    if (
      cleanText.toLowerCase() === lastProcessedTextRef.current.toLowerCase() &&
      now - lastProcessedTimeRef.current < 2500
    ) {
      console.log(`[VideoCall STT] [${role}] Bỏ qua câu lặp lại: "${cleanText}"`);
      return;
    }

    lastProcessedTextRef.current = cleanText;
    lastProcessedTimeRef.current = now;
    pendingTranscriptRef.current = '';
    setInterimText('');

    console.log(`[VideoCall STT] [${role}] ===> CHỐT CÂU NÓI ĐỂ PHIÊN DỊCH: "${cleanText}"`);
    if (handleProcessSpokenTextRef.current) {
      handleProcessSpokenTextRef.current(cleanText);
    }
  }, [role]);

  // Khởi tạo nhận diện giọng nói Web Speech API (Client-side Streaming có Silence Debounce Timer)
  const startSpeechRecognition = useCallback(() => {
    if (isEndingRef.current || isMicMutedRef.current) return;
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.warn('[VideoCall STT] Web Speech API không được hỗ trợ trên trình duyệt này');
      setSttStatusMessage('Trình duyệt hiện tại không hỗ trợ nhận diện giọng nói tự động. Bạn vẫn nghe nói và đàm thoại video bình thường.');
      return;
    }

    if (sttSilenceTimerRef.current) {
      clearTimeout(sttSilenceTimerRef.current);
      sttSilenceTimerRef.current = null;
    }

    // Dừng sạch sẽ instance cũ để tránh InvalidStateError race-condition
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current._isManualStop = true;
        speechRecognitionRef.current.abort();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // Xác định ngôn ngữ lắng nghe micro:
      // - Nhân viên (role === 'staff'): Luôn nói tiếng Việt ('vi-VN')
      // - Khách tại Robot Kiosk (role === 'guest'):
      //   + Nếu translateMode === 'bypass' -> Khách nói tiếng Việt ('vi-VN')
      //   + Nếu activeGuestLanguage === 'English' -> Lắng nghe tiếng Anh ('en-US')
      //   + Nếu activeGuestLanguage === 'Tiếng Việt' -> Lắng nghe tiếng Việt ('vi-VN')
      const isGuestEnglish = (activeGuestLanguage === 'English') && (translateMode !== 'bypass');
      const listenLang = role === 'staff'
        ? 'vi-VN'
        : (isGuestEnglish ? 'en-US' : 'vi-VN');
      recognition.lang = listenLang;

      console.log(`[VideoCall STT] [${role}] Khởi tạo SpeechRecognition: lang=[${listenLang}], guestLang=[${activeGuestLanguage}], mode=[${translateMode}]`);

      recognition.onstart = () => {
        console.log(`[VideoCall STT] [${role}] Micro STT đang hoạt động và lắng nghe trực tiếp bằng [${listenLang}]`);
        setSttStatusMessage('');
      };

      recognition.onresult = (event) => {
        // Nếu loa AI đang nói -> Ngăn chặn xử lý input
        if (isAiSpeakingRef.current || Date.now() < ttsActiveUntilRef.current) {
          return;
        }

        let interim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const transcript = res[0] ? res[0].transcript : '';
          if (res.isFinal) {
            finalChunk += transcript;
          } else {
            interim += transcript;
          }
        }

        const candidate = (finalChunk || interim || '').trim();
        if (candidate) {
          pendingTranscriptRef.current = candidate;
          setInterimText(candidate);
          console.log(`[VideoCall STT] [${role}] Đang nghe: "${candidate}" (final: ${Boolean(finalChunk)})`);
        }

        // 1. Nếu có final chunk từ Speech API -> Chốt câu ngay lập tức!
        if (finalChunk.trim()) {
          if (sttSilenceTimerRef.current) {
            clearTimeout(sttSilenceTimerRef.current);
            sttSilenceTimerRef.current = null;
          }
          commitSpokenText(finalChunk.trim());
          return;
        }

        // 2. Nếu là interim kết quả tạm thời:
        // Đặt silence debounce timer 850ms. Khi người nói dừng lại 850ms mà chưa emit isFinal,
        // hệ thống tự động chốt câu interim này để dịch ngay lập tức (không để bị nuốt chữ)!
        if (sttSilenceTimerRef.current) {
          clearTimeout(sttSilenceTimerRef.current);
        }
        sttSilenceTimerRef.current = setTimeout(() => {
          sttSilenceTimerRef.current = null;
          if (pendingTranscriptRef.current && pendingTranscriptRef.current.trim().length > 1) {
            console.log(`[VideoCall STT] [${role}] Người nói đã dừng lời (850ms silence) -> Tự động chốt câu interim!`);
            commitSpokenText(pendingTranscriptRef.current);
          }
        }, 850);
      };

      recognition.onerror = (err) => {
        if (err.error === 'not-allowed' || err.error === 'service-not-allowed') {
          console.warn(`[VideoCall STT] [${role}] Quyền nhận diện giọng nói bị từ chối hoặc không được cấp:`, err.error);
          recognition._hasPermError = true;
          setSttStatusMessage('Quyền nhận diện giọng nói chưa được cấp trên trình duyệt này. Cuộc gọi vẫn tiếp tục bình thường.');
        } else if (err.error !== 'no-speech' && err.error !== 'aborted') {
          console.warn(`[VideoCall STT] [${role}] Cảnh báo STT:`, err.error);
        }
      };

      recognition.onend = () => {
        if (recognition._isManualStop) {
          console.log(`[VideoCall STT] [${role}] Đã dừng thủ công instance cũ.`);
          return;
        }

        // Nếu còn câu đang nghe dở trong pendingTranscriptRef khi recognition ngắt:
        if (pendingTranscriptRef.current && pendingTranscriptRef.current.trim().length > 1) {
          console.log(`[VideoCall STT] [${role}] Chốt câu dở trước khi restart STT: "${pendingTranscriptRef.current}"`);
          commitSpokenText(pendingTranscriptRef.current);
        }

        if (!isEndingRef.current && !isMicMutedRef.current && callStatus === 'connected' && !recognition._hasPermError) {
          // Trì hoãn nhẹ 150ms để giải phóng audio stream rồi mới khởi động lại
          setTimeout(() => {
            if (!recognition._isManualStop && !isEndingRef.current && !isMicMutedRef.current && callStatus === 'connected' && !recognition._hasPermError) {
              try {
                recognition.start();
                console.log(`[VideoCall STT] [${role}] Tự động kích hoạt lại vòng lặp lắng nghe`);
              } catch (e) {
                console.warn(`[VideoCall STT] [${role}] Lỗi restart STT:`, e.message);
              }
            }
          }, 150);
        }
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
    } catch (e) {
      console.warn(`[VideoCall STT] [${role}] Không thể khởi động STT:`, e);
      setSttStatusMessage('Không thể kích hoạt bộ nhận diện giọng nói trên thiết bị này.');
    }
  }, [role, activeGuestLanguage, translateMode, callStatus, commitSpokenText]);

  // Kích hoạt STT khi cuộc gọi đã kết nối thành công
  useEffect(() => {
    if (callStatus === 'connected' && !isMicMuted) {
      startSpeechRecognition();
    }
    return () => {
      if (sttSilenceTimerRef.current) {
        clearTimeout(sttSilenceTimerRef.current);
        sttSilenceTimerRef.current = null;
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current._isManualStop = true;
          speechRecognitionRef.current.abort();
        } catch (e) {}
        speechRecognitionRef.current = null;
      }
    };
  }, [callStatus, isMicMuted, startSpeechRecognition]);

  // Xử lý dịch và phát tán phụ đề
  const handleProcessSpokenText = useCallback(async (spokenText) => {
    if (!spokenText || !spokenText.trim()) return;

    try {
      const curMode = translateModeRef.current;
      const curGuestLang = activeGuestLanguageRef.current; // 'English' | 'Tiếng Việt'
      console.log(`[VideoCall Translation] [${role}] Bắt đầu dịch: "${spokenText}" (mode: ${curMode}, guestLang: ${curGuestLang})`);

      // 1. CƯỠNG BỨC THỦ CÔNG: Nếu người dùng bấm nút [ Thuần Việt ] để override test
      if (curMode === 'bypass') {
        const payload = {
          type: 'live_subtitle',
          senderRole: role,
          originalText: spokenText,
          translatedText: spokenText,
          needsTranslation: false,
          sourceLang: 'vi',
          targetLang: 'vi',
          audioBase64: null,
          timestamp: Date.now(),
        };

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(payload));
        }
        displaySubtitleLocally(payload);
        return;
      }

      // 2. KHÁCH Ở ROBOT KIOSK NÓI (role === 'guest'):
      if (role === 'guest') {
        // Gửi lên Backend với source_lang = 'auto' để AI tự động nhận diện tiếng Anh hay tiếng Việt
        const res = await quickTranslateText({
          text: spokenText,
          sourceLang: 'auto',
          targetLang: 'vi', // Concierge luôn nghe tiếng Việt
          sessionId: sessionId,
          senderRole: role,
          withAudio: false, // Quy tắc 1: Nhân viên thấy bản dịch tiếng Việt, không cần phát loa AI đè tiếng khách
        });

        console.log(`[VideoCall Translation] [guest] Kết quả backend:`, {
          original: spokenText,
          translated: res.translated_text,
          detected_lang: res.source_lang,
          needs_translation: res.needs_translation,
        });

        // AI TỰ ĐỘNG CẬP NHẬT TRẠNG THÁI PHIÊN DỰA TRÊN NGÔN NGỮ CÂU NÓI:
        if (res.source_lang === 'en') {
          // Khách nói tiếng Anh -> Cập nhật phiên sang English
          if (curGuestLang !== 'English') {
            setActiveGuestLanguage('English');
            activeGuestLanguageRef.current = 'English';
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'translate_mode_change',
                mode: 'auto',
                guestLang: 'English',
              }));
            }
          }
        } else if (res.source_lang === 'vi') {
          // Khách nói tiếng Việt -> Cập nhật phiên sang Tiếng Việt
          if (curGuestLang !== 'Tiếng Việt') {
            setActiveGuestLanguage('Tiếng Việt');
            activeGuestLanguageRef.current = 'Tiếng Việt';
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'translate_mode_change',
                mode: 'auto',
                guestLang: 'Tiếng Việt',
              }));
            }
          }
        }
        // Nếu res.source_lang === 'neutral' (vd: ok, yeah, ah...) -> Không đổi ngôn ngữ phiên

        const payload = {
          type: 'live_subtitle',
          senderRole: role,
          originalText: spokenText,
          translatedText: res.translated_text || spokenText,
          needsTranslation: Boolean(res.needs_translation),
          sourceLang: res.source_lang || 'vi',
          targetLang: 'vi',
          audioBase64: null,
          timestamp: Date.now(),
        };

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(payload));
          console.log(`[VideoCall WS] [guest] Đã phát tán live_subtitle sang màn hình Nhân viên`);
        }
        displaySubtitleLocally(payload);
        return;
      }

      // 3. NHÂN VIÊN CONCIERGE NÓI (role === 'staff'):
      if (role === 'staff') {
        const isGuestSpeakingEnglish = (curGuestLang === 'English') && (curMode !== 'bypass');

        if (isGuestSpeakingEnglish) {
          // Quy tắc 2: Khách đang dùng tiếng Anh -> Dịch siêu tốc (< 100ms) không đợi TTS
          const res = await quickTranslateText({
            text: spokenText,
            sourceLang: 'vi',
            targetLang: 'en',
            sessionId: sessionId,
            senderRole: role,
            withAudio: false,
          });

          console.log(`[VideoCall Translation] [staff] Dịch sang English cho Robot:`, {
            original: spokenText,
            translated: res.translated_text,
            needs_translation: res.needs_translation,
          });

          const payload = {
            type: 'live_subtitle',
            senderRole: role,
            originalText: spokenText,
            translatedText: res.translated_text || spokenText,
            needsTranslation: Boolean(res.needs_translation),
            sourceLang: 'vi',
            targetLang: 'en',
            audioBase64: null,
            timestamp: Date.now(),
          };

          // Gửi phụ đề lập tức sang Robot Kiosk và hiển thị cục bộ ngay tức thì (< 100ms)
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(payload));
            console.log(`[VideoCall WS] [staff] Đã phát tán live_subtitle tức thời sang Robot Kiosk`);
          }
          displaySubtitleLocally(payload);

          // Kích hoạt tổng hợp giọng đọc TTS (Jenny) bất đồng bộ trong nền, không làm chậm hiển thị phụ đề
          if (res.needs_translation && res.translated_text) {
            synthesizeSpeech(res.translated_text, { language: 'en-US', voice: 'en-US-JennyNeural' })
              .then((audioData) => {
                if (audioData?.audio_base64 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'live_audio',
                    senderRole: role,
                    audioBase64: audioData.audio_base64,
                    translatedText: res.translated_text,
                    timestamp: Date.now(),
                  }));
                  console.log(`[VideoCall WS] [staff] Đã phát tán live_audio sang Robot Kiosk (${audioData.audio_base64.length} bytes)`);
                }
              })
              .catch((err) => {
                console.warn('[VideoCall Audio] Background TTS synthesis failed:', err);
              });
          }
          return;
        } else {
          // Quy tắc 3 & 4: Khách đang dùng tiếng Việt -> KHÔNG DỊCH sang tiếng Anh, KHÔNG PHÁT TTS!
          // Giữ hội thoại tiếng Việt tự nhiên hoàn toàn.
          console.log(`[VideoCall Translation] [staff] Khách đang nói tiếng Việt -> Giữ nguyên tiếng Việt tự nhiên, không dịch sang tiếng Anh.`);
          const payload = {
            type: 'live_subtitle',
            senderRole: role,
            originalText: spokenText,
            translatedText: spokenText,
            needsTranslation: false,
            sourceLang: 'vi',
            targetLang: 'vi',
            audioBase64: null,
            timestamp: Date.now(),
          };

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(payload));
          }
          displaySubtitleLocally(payload);
          return;
        }
      }
    } catch (err) {
      console.warn('[VideoCall] Subtitle process error:', err);
      // Fail-safe: Lỗi dịch vụ dịch KHÔNG làm gián đoạn cuộc gọi WebRTC!
      displaySubtitleLocally({
        type: 'live_subtitle',
        senderRole: role,
        originalText: spokenText,
        translatedText: spokenText,
        needsTranslation: false,
        sourceLang: 'vi',
        targetLang: 'vi',
        audioBase64: null,
        timestamp: Date.now(),
      });
    }
  }, [role, sessionId]);

  useEffect(() => {
    handleProcessSpokenTextRef.current = handleProcessSpokenText;
  }, [handleProcessSpokenText]);

  // Giả lập câu nói của Khách (English hoặc Tiếng Việt) để kiểm tra âm thanh TTS & phụ đề ngay tại Kiosk
  const handleSimulateGuestSpeech = async (text) => {
    if (!text || !text.trim() || isTestTranslating) return;
    try {
      setIsTestTranslating(true);
      setInterimText('');
      await handleProcessSpokenText(text.trim());
    } finally {
      setIsTestTranslating(false);
    }
  };

  // Giả lập câu nói của Nhân viên (Tiếng Việt -> Dịch sang Tiếng Anh cho Khách) để kiểm tra giọng đọc Jenny tại Kiosk
  const handleSimulateStaffSpeech = async (text) => {
    if (!text || !text.trim() || isTestTranslating) return;
    try {
      setIsTestTranslating(true);
      setInterimText('');
      const res = await quickTranslateText({
        text: text.trim(),
        sourceLang: 'vi',
        targetLang: 'en',
        sessionId: sessionId,
        senderRole: 'staff',
        withAudio: true,
      });

      const payload = {
        type: 'live_subtitle',
        senderRole: 'staff',
        originalText: text.trim(),
        translatedText: res.translated_text || text.trim(),
        needsTranslation: Boolean(res.needs_translation),
        sourceLang: 'vi',
        targetLang: 'en',
        audioBase64: res.audio_base64 || null,
        timestamp: Date.now(),
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }
      displaySubtitleLocally(payload);

      // Phát âm thanh tiếng Anh (Jenny) trực tiếp ra loa Kiosk
      if (payload.needsTranslation && payload.audioBase64 && playInterpreterAudioRef.current) {
        playInterpreterAudioRef.current(payload.audioBase64, payload.translatedText);
      }
    } catch (err) {
      console.warn('[VideoCall] Simulate staff speech error:', err);
    } finally {
      setIsTestTranslating(false);
    }
  };

  const displaySubtitleLocally = (payload) => {
    // 1. Luôn ghi lại nhật ký hội thoại đầy đủ
    const transcriptItem = {
      speaker: payload.senderRole === 'staff' ? 'Staff' : 'Guest',
      speaker_name: payload.senderRole === 'staff' ? calleeName : callerName,
      raw_transcript: payload.originalText,
      translated_text: payload.translatedText,
      needs_translation: payload.needsTranslation,
      source_lang: payload.sourceLang,
      target_lang: payload.targetLang,
      timestamp: new Date().toISOString(),
    };
    setCallTranscripts((prev) => [...prev, transcriptItem]);
    callTranscriptsRef.current.push(transcriptItem);

    // 2. Quy tắc 3 & 4: Khách nói tiếng Việt hoặc không cần dịch -> KHÔNG hiển thị bảng dịch trên màn hình
    if (payload.needsTranslation) {
      setActiveSubtitle(payload);
      if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
      subtitleTimeoutRef.current = setTimeout(() => {
        setActiveSubtitle(null);
      }, 6000);
    } else {
      setActiveSubtitle(null);
    }
  };

  // Thay đổi chế độ dịch và thông báo cho peer đối diện
  const handleToggleTranslateMode = (newMode, newLang = null) => {
    setTranslateMode(newMode);
    const targetLang = newLang || (newMode === 'auto' ? 'English' : 'Tiếng Việt');
    setActiveGuestLanguage(targetLang);
    setShowTranslateSettings(false);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'translate_mode_change',
        mode: newMode,
        guestLang: targetLang,
      }));
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
        const nextMuted = !audioTrack.enabled;
        setIsMicMuted(nextMuted);
        isMicMutedRef.current = nextMuted;

        if (nextMuted) {
          if (speechRecognitionRef.current) {
            try { speechRecognitionRef.current.stop(); } catch (e) {}
          }
        } else {
          startSpeechRecognition();
        }
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
      onClick={primeAudioContext}
      onTouchStart={primeAudioContext}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-xs transition-all duration-300 p-0 lg:p-6"
    >
      {/* Thẻ audio cố định để giải phóng autoplay trên iOS Safari / Chrome */}
      <audio ref={persistentAudioRef} playsInline autoPlay={false} style={{ display: 'none' }} />

      {/* Video Call Modal Window: Toàn màn hình trên mobile & landscape, cửa sổ nổi sang trọng trên desktop (lg) */}
      <div className="relative w-full h-full lg:h-[620px] lg:max-w-4xl bg-[#1E1E1E] rounded-none lg:rounded-2xl overflow-hidden shadow-2xl border-0 lg:border lg:border-stone-700/80 flex flex-col">
        {/* TOP BAR */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 lg:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] bg-gradient-to-b from-stone-900/95 via-stone-900/60 to-transparent robot-safe-x">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="text-stone-200 text-xs sm:text-sm font-semibold tracking-wide truncate max-w-[110px] sm:max-w-[160px] md:max-w-xs">
              {role === 'guest' ? (calleeName || 'Nhân viên hỗ trợ') : (callerName || 'Khách hàng')}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* DIRECT 1-CLICK MODE TOGGLES FOR EASY TESTING */}
            {callStatus === 'connected' && (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <div className="flex items-center bg-stone-900/90 p-0.5 rounded-lg border border-stone-700/80 shadow-inner">
                  {/* 1. NÚT THÔNG DỊCH AI (EN ⇄ VI) */}
                  <button
                    type="button"
                    onClick={() => handleToggleTranslateMode('auto', 'English')}
                    className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
                      translateMode === 'auto' && activeGuestLanguage === 'English'
                        ? 'bg-amber-500/30 text-amber-300 border border-amber-500/60 shadow-sm'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                    }`}
                    title="Bật chế độ Thông dịch AI: Khách nói tiếng Anh ➔ Dịch tiếng Việt; Nhân viên nói tiếng Việt ➔ Dịch tiếng Anh"
                  >
                    <Languages className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
                    <span>EN ⇄ VI</span>
                  </button>

                  {/* 2. NÚT THUẦN VIỆT (KHÔNG DỊCH) */}
                  <button
                    type="button"
                    onClick={() => handleToggleTranslateMode('bypass', 'Tiếng Việt')}
                    className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
                      translateMode === 'bypass' || activeGuestLanguage === 'Tiếng Việt'
                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 shadow-sm'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                    }`}
                    title="Bật chế độ Thuần Việt: Cả 2 bên nói tiếng Việt trực tiếp, không dịch, không phát âm AI"
                  >
                    <span>Thuần Việt</span>
                  </button>

                  {/* 3. NÚT TEST NHANH GIỌNG ĐỌC AI & PHỤ ĐỀ (Ẩn trên mobile nhỏ để tránh tràn) */}
                  <button
                    type="button"
                    onClick={() => setShowTestPanel(!showTestPanel)}
                    className={`hidden md:flex items-center gap-1 px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
                      showTestPanel
                        ? 'bg-amber-500 text-stone-950 font-bold shadow-md'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                    }`}
                    title="Mở bảng công cụ Thử nghiệm Nhanh: 1-click test giọng đọc Edge TTS & phiên dịch tức thì"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>🧪 Thử AI</span>
                  </button>
                </div>

                {isAiSpeaking && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 sm:px-2 py-1 rounded-md border border-emerald-500/50 animate-pulse font-medium">
                    <Volume2 className="w-3 h-3 text-emerald-400" />
                    <span className="hidden sm:inline">AI Đang nói</span>
                  </span>
                )}
              </div>
            )}

            {/* LIVE STT LISTENING BADGE */}
            {callStatus === 'connected' && !isMicMuted && (
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-mono font-medium bg-stone-800 border border-stone-700 text-stone-300"
                title={`Micro đang lắng nghe: ${role === 'staff' ? 'vi-VN' : (activeGuestLanguage === 'English' ? 'en-US' : 'vi-VN')}`}
              >
                <Mic className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                <span className="hidden sm:inline">Mic:</span>
                <span className="text-emerald-300 font-semibold">
                  {role === 'staff' ? 'VI' : (activeGuestLanguage === 'English' ? 'EN' : 'VI')}
                </span>
              </div>
            )}

            {/* CALL DURATION BADGE */}
            {callStatus === 'connected' && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-md text-[10px] sm:text-xs font-mono font-medium bg-stone-800 border border-stone-700 text-stone-200">
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
              className="p-1 sm:p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition-colors cursor-pointer"
              title="Toàn màn hình"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          </div>
        </div>

        {/* STT Status Warning Notification */}
        {sttStatusMessage && (
          <div className="absolute top-14 left-3 right-3 sm:left-4 sm:right-4 z-25 bg-amber-950/85 border border-amber-600/50 text-amber-200 text-xs px-3 py-1.5 rounded-lg flex items-center justify-between shadow-lg backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{sttStatusMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSttStatusMessage('')}
              className="text-amber-400 hover:text-amber-200 ml-2 px-1 text-sm font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* INTERACTIVE LIVE TRANSLATION & TTS TEST BAR */}
        {callStatus === 'connected' && showTestPanel && (
          <div className="absolute top-13 sm:top-15 left-3 right-3 sm:left-6 sm:right-6 z-30 bg-[#141414]/95 backdrop-blur-md border border-amber-500/50 rounded-xl p-2.5 sm:p-3 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Bảng Thử Nghiệm Nhanh Phiên Dịch AI & Giọng Đọc TTS Loa Kiosk</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTestPanel(false)}
                className="text-[11px] text-stone-400 hover:text-stone-200 px-1.5 py-0.5 rounded hover:bg-stone-800 cursor-pointer"
              >
                ✕ Đóng
              </button>
            </div>

            {/* Pre-made quick test chips */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
              <button
                type="button"
                disabled={isTestTranslating}
                onClick={() => handleSimulateGuestSpeech("Where is the swimming pool?")}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Giả lập Khách nói tiếng Anh ➔ AI dịch sang Tiếng Việt + Phát âm giọng Hoài My ra loa máy tính"
              >
                <span>🇺🇸 Khách: "Where is the swimming pool?"</span>
              </button>

              <button
                type="button"
                disabled={isTestTranslating}
                onClick={() => handleSimulateStaffSpeech("Bể bơi nằm ở tầng 3 thưa quý khách")}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Giả lập Staff nói tiếng Việt ➔ AI dịch sang Tiếng Anh + Phát âm giọng Jenny ra loa máy tính"
              >
                <span>🇻🇳 Staff: "Bể bơi nằm ở tầng 3 thưa quý khách"</span>
              </button>

              <button
                type="button"
                disabled={isTestTranslating}
                onClick={() => handleSimulateGuestSpeech("Cho tôi hỏi nhà hàng mở cửa lúc mấy giờ?")}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Giả lập Khách Việt nói tiếng Việt ➔ AI nhận diện tiếng Việt, không dịch, không phát âm đè"
              >
                <span>🇻🇳 Khách: "Nhà hàng mở cửa lúc mấy giờ?"</span>
              </button>
            </div>

            {/* Custom text input test */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testCustomText}
                onChange={(e) => setTestCustomText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && testCustomText.trim()) {
                    handleSimulateGuestSpeech(testCustomText.trim());
                  }
                }}
                placeholder="Nhập câu bất kỳ để test thông dịch & giọng đọc Edge Neural..."
                className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                disabled={!testCustomText.trim() || isTestTranslating}
                onClick={() => handleSimulateGuestSpeech(testCustomText.trim())}
                className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                title="Test giả lập câu này do Khách nói"
              >
                <span>Khách nói</span>
              </button>
              <button
                type="button"
                disabled={!testCustomText.trim() || isTestTranslating}
                onClick={() => handleSimulateStaffSpeech(testCustomText.trim())}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                title="Test giả lập câu này do Staff nói"
              >
                <span>Staff nói</span>
              </button>
            </div>
          </div>
        )}

        {/* MAIN VIDEO SCREEN */}
        <div className="relative flex-1 bg-[#181818] flex items-center justify-center overflow-hidden">
          {/* Remote Video Stream */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            webkit-playsinline="true"
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

          {/* FLOATING CINEMA SUBTITLE BAR (AUTO-TRANSLATE LIVE CAPTIONS) */}
          {((activeSubtitle && activeSubtitle.needsTranslation) || (interimText && activeGuestLanguage === 'English' && translateMode !== 'bypass')) && (
            <div className="absolute bottom-4 sm:bottom-6 lg:bottom-8 left-3 right-3 sm:left-6 sm:right-6 z-25 flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-[#141414]/90 backdrop-blur-md border border-stone-700/80 rounded-2xl px-4 py-2 sm:px-6 sm:py-3 max-w-2xl text-center shadow-2xl space-y-1 pointer-events-auto">
                {/* Interim Live Speech Feedback */}
                {interimText && (!activeSubtitle || !activeSubtitle.needsTranslation) && (
                  <p className="text-stone-300 text-xs sm:text-sm italic font-mono animate-pulse">
                    "{interimText}..."
                  </p>
                )}

                {/* Final Subtitle and Translation */}
                {activeSubtitle && activeSubtitle.needsTranslation && (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-0.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                        {activeSubtitle.senderRole === role
                          ? 'Bạn'
                          : (activeSubtitle.senderRole === 'staff' ? calleeName : callerName)}
                      </span>
                      <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-1">
                        <Languages className="w-3 h-3" />
                        <span>{(activeSubtitle.sourceLang || 'en').toUpperCase()} ➔ {(activeSubtitle.targetLang || 'vi').toUpperCase()}</span>
                      </span>
                      {activeSubtitle.audioBase64 && (
                        <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                          <Volume2 className={`w-2.5 h-2.5 ${isAiSpeaking ? 'animate-bounce text-emerald-300' : ''}`} />
                          <span>AI Voice</span>
                        </span>
                      )}
                    </div>

                    {/* Câu gốc (mờ phía trên nếu có bản dịch) */}
                    <p className="text-stone-400 text-[11px] sm:text-xs italic leading-tight">
                      "{activeSubtitle.originalText}"
                    </p>

                    {/* Câu dịch nổi bật to rõ */}
                    <p className="text-stone-100 text-xs sm:text-sm md:text-base font-semibold leading-relaxed tracking-wide">
                      {activeSubtitle.translatedText}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* PICTURE-IN-PICTURE: LOCAL SELF VIDEO */}
          <div className="absolute bottom-20 sm:bottom-22 lg:bottom-24 right-3 sm:right-4 w-24 h-32 sm:w-28 sm:h-36 lg:w-40 lg:h-52 rounded-xl overflow-hidden bg-stone-900 border border-stone-700 shadow-xl z-20 transition-all">
            {hasNoCamera ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-stone-900 to-stone-950 p-2 text-center select-none">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center mb-1.5 shadow-inner">
                  <Mic className={`w-4 h-4 sm:w-5 sm:h-5 ${isMicMuted ? 'text-red-400' : 'text-emerald-400 animate-pulse'}`} />
                </div>
                <span className="text-[10px] sm:text-[11px] font-semibold text-stone-200">
                  {role === 'guest' ? 'Robot Kiosk' : 'Nhân viên'}
                </span>
                <span className="text-[8px] sm:text-[9px] text-stone-400 leading-tight">
                  {isMicMuted ? 'Micro đã tắt' : 'Đang bật Micro'}
                </span>
              </div>
            ) : (
              <>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  webkit-playsinline="true"
                  muted
                  className={`w-full h-full object-cover ${isVideoDisabled ? 'hidden' : 'block'}`}
                />
                {isVideoDisabled && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-stone-900 text-stone-400">
                    <VideoOff className="w-4 h-4 mb-1 text-stone-500" />
                    <span className="text-[9px] sm:text-[10px]">Camera tắt</span>
                  </div>
                )}
              </>
            )}
            <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 text-[9px] sm:text-[10px] text-stone-200 bg-stone-950/80 border border-stone-700/60 px-1.5 py-0.5 rounded font-medium">
              Bạn
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION CONTROLS BAR */}
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[#1A1A1A] border-t border-stone-800 flex items-center justify-center gap-3 sm:gap-6 lg:gap-8 z-30 shrink-0 robot-safe-x">
          {/* STAFF ONLY CONTROLS */}
          {role === 'staff' && (
            <>
              {/* MUTE MIC BUTTON */}
              <button
                type="button"
                onClick={toggleMic}
                className="flex flex-col items-center gap-1 focus:outline-none cursor-pointer group min-w-[44px] min-h-[44px]"
              >
                <div
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all ${
                    isMicMuted
                      ? 'bg-stone-800 text-stone-400 border border-stone-700'
                      : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
                  }`}
                >
                  {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </div>
                <span className="text-[10px] font-medium text-stone-400">
                  {isMicMuted ? 'Bật Mic' : 'Tắt Mic'}
                </span>
              </button>

              {/* TOGGLE VIDEO BUTTON */}
              <button
                type="button"
                onClick={toggleVideo}
                className="flex flex-col items-center gap-1 focus:outline-none cursor-pointer group min-w-[44px] min-h-[44px]"
              >
                <div
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all ${
                    isVideoDisabled
                      ? 'bg-stone-800 text-stone-400 border border-stone-700'
                      : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
                  }`}
                >
                  {isVideoDisabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </div>
                <span className="text-[10px] font-medium text-stone-400">
                  {isVideoDisabled ? 'Bật Cam' : 'Tắt Cam'}
                </span>
              </button>

              {/* TOGGLE SPEAKER BUTTON */}
              <button
                type="button"
                onClick={toggleSpeaker}
                className="flex flex-col items-center gap-1 focus:outline-none cursor-pointer group min-w-[44px] min-h-[44px]"
              >
                <div
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all ${
                    isSpeakerMuted
                      ? 'bg-stone-800 text-stone-400 border border-stone-700'
                      : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
                  }`}
                >
                  {isSpeakerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
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
            className="flex items-center justify-center gap-2 px-5 py-2.5 sm:px-8 sm:py-2.5 min-h-[44px] rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-98 text-stone-200 hover:text-white border border-stone-600 transition-all cursor-pointer shadow-sm"
          >
            <PhoneOff className="w-4 h-4 text-red-400" />
            <span className="text-xs font-semibold tracking-wide">Kết thúc cuộc gọi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
