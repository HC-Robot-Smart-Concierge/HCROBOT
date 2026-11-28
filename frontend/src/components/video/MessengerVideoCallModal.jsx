import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Loader2,
  Maximize2,
  Minimize2,
  AlertCircle,
  Languages,
  Sparkles,
} from 'lucide-react';
import { uploadCallRecording, getCallSignalingWsUrl } from '../../services/conciergeApi';
import { quickTranslateText, synthesizeSpeech, transcribeCallAudio } from '../../services/aiApi';
import {
  TTS_ERROR_CODES,
  evaluateSpokenTextCommit,
  resolveTranslationTarget,
  advanceExpectedSeqOnFailure,
  calculateFrameRms,
  encodeWavBlobFromFloat32,
  normalizeLanguageCode,
} from './videoCallTranslationHelpers';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:relay.metered.ca:80' },
    { urls: 'stun:openrelay.metered.ca:80' },
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
    {
      urls: 'turn:relay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turns:relay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turns:openrelay.metered.ca:443?transport=tcp',
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

// Thời gian chờ im lặng chuẩn theo mô hình đàm thoại Voice AI (Conversational Turn-taking)
// - 1.000ms (1.0s) là chuẩn vàng trong Voice Bot (Google Assistant, Retell, Vapi):
//   + Đủ hấp thu khoảng ngắt nghỉ tự nhiên (~700ms - 800ms) giữa các vế câu mà không cướp lời.
//   + Khi người nói dừng lời, chốt câu dứt khoát sau 1.0s, không bị trễ và không cộng dồn các lượt nói riêng biệt.
const STAFF_CONVERSATIONAL_SILENCE_MS = 600;

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
  const [uploadStatus, setUploadStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasNoCamera, setHasNoCamera] = useState(false);
  const [remoteFallbackFrame, setRemoteFallbackFrame] = useState('');
  const [hasRemoteVideoFrame, setHasRemoteVideoFrame] = useState(false);
  const [peerHasWebRtcVideo, setPeerHasWebRtcVideo] = useState(false);

  // Live Subtitle & Auto-Translation State (EN ⇄ VI)
  const isInitialGuestVi =
    normalizeLanguageCode(guestLanguage) === 'vi' || guestLanguage === 'Tiếng Việt';
  const initialTranslateMode = isInitialGuestVi ? 'bypass' : 'auto';
  // Mode: 'auto' (Dịch phụ đề song ngữ Việt ⇄ Anh) | 'bypass' (Thuần Việt - Không dịch)
  const [translateMode, setTranslateMode] = useState(initialTranslateMode);
  // Chế độ nhận diện ngôn ngữ đầu vào của Micro: 'auto' (Đa ngữ EN/VI theo âm thanh) | 'en' | 'vi'
  const [inputLangMode, setInputLangMode] = useState('auto');
  const [activeGuestLanguage, setActiveGuestLanguage] = useState(
    isInitialGuestVi ? 'Tiếng Việt' : 'English'
  );
  const [activeSubtitle, setActiveSubtitle] = useState(null);
  const [interimText, setInterimText] = useState('');
  const [peerInterim, setPeerInterim] = useState(null);
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
  const lastWebSpeechResultAtRef = useRef(0);
  const timerIntervalRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);
  const isEndingRef = useRef(false);

  // Speech Recognition, Audio Stream STT Adapter & Subtitle Refs
  const speechRecognitionRef = useRef(null);
  const audioSttAdapterRef = useRef(null);
  const lastAudioVadSpeechAtRef = useRef(0);
  const pendingWebSpeechFallbackTimerRef = useRef(null);
  const subtitleTimeoutRef = useRef(null);
  const callTranscriptsRef = useRef([]);
  const isMicMutedRef = useRef(false);
  const isSpeakerMutedRef = useRef(false);
  const checkPeerIntervalRef = useRef(null);
  const peerReconnectTimerRef = useRef(null);
  const serverLanIpRef = useRef(null);
  const serverHostIpsRef = useRef([]);
  const lastInterimSentAtRef = useRef(0);
  const peerInterimTimerRef = useRef(null);
  const interpreterAudioRef = useRef(null);
  const playInterpreterAudioRef = useRef(null);
  const activeGuestLanguageRef = useRef(isInitialGuestVi ? 'Tiếng Việt' : 'English');
  const translateModeRef = useRef(initialTranslateMode);
  const inputLangModeRef = useRef('auto');

  // Quản lý gom lượt nói cho Staff (Staff Turn Accumulation & Conversational Endpointing)
  const turnStartIndexRef = useRef(0);
  const turnCarryoverRef = useRef('');
  const staffTurnTimerRef = useRef(null);
  const staffTurnEpochRef = useRef(0);

  // Web Audio Context & Persistent Player for Autoplay Bypass
  const audioContextRef = useRef(null);
  const activeAudioSourceRef = useRef(null);
  const persistentAudioRef = useRef(null);
  const playbackWatchdogRef = useRef(null);
  const lastProcessedTextRef = useRef('');
  const lastProcessedTimeRef = useRef(0);
  const pendingTranscriptRef = useRef('');
  const sttSilenceTimerRef = useRef(null);
  const handleProcessSpokenTextRef = useRef(null);

  // Chống lặp vòng lặp âm thanh (Acoustic Echo Loop Prevention)
  const isAiSpeakingRef = useRef(false);
  const ttsActiveUntilRef = useRef(0);
  const lastPlayedTtsTextRef = useRef('');
  const staffTtsSeqRef = useRef(0);
  const guestTtsSeqRef = useRef(0);
  const expectedPlaySeqRef = useRef(1);
  const failedSeqsRef = useRef(new Set());
  const outOfOrderWaitTimerRef = useRef(null);
  const callEpochRef = useRef(0);
  const callStatusRef = useRef('calling');
  const [sttStatusMessage, setSttStatusMessage] = useState('');
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);
  const [ttsStatus, setTtsStatus] = useState(null);
  const isManualLockedRef = useRef(false);
  const audioQueueRef = useRef([]);
  const isPlayingAudioRef = useRef(false);
  const playedUtteranceIdsRef = useRef(new Set());
  // utteranceId -> thời điểm (đồng hồ máy nhận) nhận phụ đề; dùng để loại audio quá trễ mà không phụ thuộc đồng hồ máy gửi
  const subtitleReceivedAtRef = useRef(new Map());
  const previousWebRtcVolumeRef = useRef(1.0);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    activeGuestLanguageRef.current = activeGuestLanguage;
  }, [activeGuestLanguage]);

  useEffect(() => {
    translateModeRef.current = translateMode;
  }, [translateMode]);

  useEffect(() => {
    inputLangModeRef.current = inputLangMode;
  }, [inputLangMode]);

  useEffect(() => {
    isSpeakerMutedRef.current = isSpeakerMuted;
  }, [isSpeakerMuted]);

  // 1. Tạo Canvas Stream giả lập trong trường hợp máy tính KHÔNG CÓ WEBCAM (Tương thích iOS Safari)
  const createFakeVideoStream = (label = 'Khách hàng') => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      if (!ctx) return;
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#2d2d2d';
      ctx.beginPath();
      ctx.arc(320, 240, 90, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#444444';
      ctx.lineWidth = 1.5;
      ctx.stroke();

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

    // Tầng 1: Thử camera vật lý (tránh chọn nhầm OBS Virtual Camera nếu có webcam thật) + mic tiêu chuẩn
    try {
      let preferredVideoConstraint = role === 'staff'
        ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 } }
        : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 } };

      if (typeof navigator.mediaDevices.enumerateDevices === 'function') {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          const physicalCam = videoInputs.find(
            (d) => d.label && !/obs|virtual|snap|droidcam|iriun/i.test(d.label)
          );
          if (physicalCam && physicalCam.deviceId && videoInputs.some((d) => /obs|virtual/i.test(d.label || ''))) {
            preferredVideoConstraint = {
              deviceId: { exact: physicalCam.deviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            };
          }
        } catch {
          // Ignore enumerateDevices errors
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: preferredVideoConstraint,
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

  // 3. Khởi tạo ghi hình cuộc gọi (Ưu tiên WebM VP8/Opus bitrate 600kbps tiết kiệm băng thông)
  const startRecording = (stream) => {
    try {
      if (!window.MediaRecorder) {
        return;
      }

      recordedChunksRef.current = [];
      let mimeType = '';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          mimeType = 'video/webm;codecs=vp8,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
          mimeType = 'video/webm;codecs=vp9,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          mimeType = 'video/webm';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        }
      }

      const recorderOptions = {
        videoBitsPerSecond: 600000, // 600 Kbps - rõ nét chuẩn web nhưng siêu nhẹ dung lượng
      };
      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }

      const recorder = new MediaRecorder(stream, recorderOptions);
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

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn('[VideoCall] Lỗi khởi tạo MediaRecorder (bỏ qua ghi hình):', err);
    }
  };

  // 4. Dừng ghi hình và tự động gửi lưu ngầm độc lập với vòng đời đóng UI
  const stopRecordingAndUpload = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const recorder = mediaRecorderRef.current;
    const durationSec = recordingDuration;
    const startedAt = callStartTimeRef.current;
    const endedAt = new Date().toISOString();
    const transcripts = callTranscriptsRef.current ? [...callTranscriptsRef.current] : [];

    const finalizeAndSend = () => {
      if (recordedChunksRef.current && recordedChunksRef.current.length > 0) {
        const mime = recorder?.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        uploadCallRecording(sessionId, blob, durationSec, startedAt, endedAt, transcripts)
          .then((uploadRes) => {
            console.log('[VideoCall] Background recording upload accepted (HTTP 202):', uploadRes);
            if (typeof onCallEnded === 'function') {
              onCallEnded(uploadRes);
            }
          })
          .catch((upErr) => {
            console.warn('[VideoCall] Background upload notice:', upErr?.message || upErr);
          });
      }
    };

    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.addEventListener('stop', finalizeAndSend, { once: true });
        recorder.stop();
      } catch (e) {
        finalizeAndSend();
      }
    } else {
      finalizeAndSend();
    }
  };

  // Khởi tạo AudioContext cho Web Audio API
  const getOrCreateAudioContext = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        // Dùng lại AudioContext dùng chung của Kiosk (useSpeechSynthesis / audioFeedback) nếu đã có:
        // context này đã được mở khóa bởi tương tác trước đó trên trang Robot, nên khi cuộc gọi
        // được mở bằng giọng nói (không có click trong modal) vẫn phát được âm thanh bản dịch.
        const shared = window._sharedAudioCtx;
        if (shared && shared.state !== 'closed') {
          audioContextRef.current = shared;
        } else {
          audioContextRef.current = new AudioCtx();
          window._sharedAudioCtx = audioContextRef.current;
        }
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
      ctx.resume().then(() => {
        if (ctx.state === 'running') {
          setIsAudioBlocked(false);
        }
      }).catch(() => {});
    } else if (ctx && ctx.state === 'running') {
      setIsAudioBlocked(false);
    }
    // Mở khóa luôn AudioContext của bộ thu âm STT (nếu bị tạo ở trạng thái suspended thì onaudioprocess không chạy)
    const sttCtx = audioSttAdapterRef.current?.ctx;
    if (sttCtx && sttCtx.state === 'suspended') {
      sttCtx.resume().catch(() => {});
    }
    if (persistentAudioRef.current) {
      try {
        persistentAudioRef.current.play().then(() => {
          persistentAudioRef.current.pause();
          setIsAudioBlocked(false);
        }).catch(() => {});
      } catch (e) {}
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = isSpeakerMutedRef.current;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [getOrCreateAudioContext]);

  // Hàng đợi phát âm thanh thông dịch AI tuần tự cho cả hai bên (Robot Kiosk & Staff)
  // Bảo vệ chống treo cờ isPlayingAudioRef / isAiSpeakingRef khi AudioContext.resume() bị treo hoặc lỗi
  const processAudioQueue = useCallback(async () => {
    if (isPlayingAudioRef.current) return;
    if (audioQueueRef.current.length === 0) return;
    if (isEndingRef.current || callStatusRef.current === 'ended') {
      audioQueueRef.current = [];
      return;
    }

    // Bo qua cac sequence da duoc danh dau la failed truoc do
    while (failedSeqsRef.current.has(expectedPlaySeqRef.current)) {
      expectedPlaySeqRef.current += 1;
    }

    const headItem = audioQueueRef.current[0];
    if (headItem && headItem.seq && headItem.seq > expectedPlaySeqRef.current) {
      if (!outOfOrderWaitTimerRef.current) {
        console.log(`[VideoCall Queue] [${role}] Waiting for seq=${expectedPlaySeqRef.current} (head seq=${headItem.seq}) max 1.2s`);
        outOfOrderWaitTimerRef.current = setTimeout(() => {
          outOfOrderWaitTimerRef.current = null;
          expectedPlaySeqRef.current = headItem.seq;
          processAudioQueue();
        }, 1200);
        return;
      }
      return;
    }

    if (outOfOrderWaitTimerRef.current) {
      clearTimeout(outOfOrderWaitTimerRef.current);
      outOfOrderWaitTimerRef.current = null;
    }

    const currentItem = audioQueueRef.current.shift();
    if (!currentItem || !currentItem.audioBase64) return;

    if (currentItem.seq) {
      expectedPlaySeqRef.current = Math.max(expectedPlaySeqRef.current, currentItem.seq + 1);
    }

    if (currentItem.utteranceId) {
      playedUtteranceIdsRef.current.add(currentItem.utteranceId);
    }

    const currentEpoch = callEpochRef.current;
    isPlayingAudioRef.current = true;
    let finishedHandled = false;

    const handleAudioFinished = (endReason = 'PLAY_ENDED') => {
      if (finishedHandled) return;
      finishedHandled = true;

      if (playbackWatchdogRef.current) {
        clearTimeout(playbackWatchdogRef.current);
        playbackWatchdogRef.current = null;
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.volume = 1.0;
      }

      const wasSpeaking = isAiSpeakingRef.current;
      isAiSpeakingRef.current = false;
      setIsAiSpeaking(false);
      // Nếu phát âm thanh thực sự diễn ra, đặt đuôi âm học ngắn 280ms; nếu bị chặn/lỗi thì mở khóa ngay (0ms)
      ttsActiveUntilRef.current = wasSpeaking && endReason === 'PLAY_ENDED' ? Date.now() + 280 : 0;
      activeAudioSourceRef.current = null;
      isPlayingAudioRef.current = false;

      console.log(
        `[VideoCall Flow] [${role}] utteranceId=${currentItem.utteranceId || 'unknown'} seq=${currentItem.seq || 0} step=${endReason} volume=1.0`
      );

      if (audioQueueRef.current.length > 0 && !isEndingRef.current && callEpochRef.current === currentEpoch) {
        setTimeout(processAudioQueue, 120);
      }
    };

    const markPlaybackStarted = (durationSec = 4.0, engine = 'web_audio') => {
      isAiSpeakingRef.current = true;
      setIsAiSpeaking(true);
      const boundedMs = Math.min(12000, Math.max(1500, Math.round(durationSec * 1000) + 500));
      ttsActiveUntilRef.current = Date.now() + boundedMs;

      if (currentItem.spokenText) {
        lastPlayedTtsTextRef.current = currentItem.spokenText.trim();
      }

      if (remoteVideoRef.current) {
        // Giữ nguyên 100% âm lượng video gốc, không giảm âm lượng (bỏ ducking theo yêu cầu)
        remoteVideoRef.current.volume = 1.0;
      }

      if (playbackWatchdogRef.current) {
        clearTimeout(playbackWatchdogRef.current);
      }
      playbackWatchdogRef.current = setTimeout(() => {
        handleAudioFinished('PLAY_WATCHDOG_TIMEOUT');
      }, boundedMs + 900);

      console.log(
        `[VideoCall Flow] [${role}] utteranceId=${currentItem.utteranceId || 'unknown'} seq=${currentItem.seq || 0} step=PLAY_STARTED engine=${engine} volume=1.0 len=${(currentItem.spokenText || '').length}`
      );
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

    // 2. Thử phát bằng Web Audio API AudioContext (có timeout 400ms chống treo ctx.resume())
    const ctx = getOrCreateAudioContext();
    if (ctx) {
      try {
        if (ctx.state === 'suspended') {
          await Promise.race([
            ctx.resume().catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, 400)),
          ]);
        }
        if (ctx.state === 'running' && callEpochRef.current === currentEpoch) {
          setIsAudioBlocked(false);
          const uint8 = base64ToUint8Array(currentItem.audioBase64);
          const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          if (callEpochRef.current !== currentEpoch || isEndingRef.current) {
            handleAudioFinished('PLAY_ABORTED');
            return;
          }
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          source.onended = () => handleAudioFinished('PLAY_ENDED');
          activeAudioSourceRef.current = source;
          markPlaybackStarted(audioBuffer.duration || 4.0, 'web_audio');
          source.start(0);
          return;
        }
      } catch (ctxErr) {
        console.warn(
          `[VideoCall Flow] [${role}] utteranceId=${currentItem.utteranceId || 'unknown'} seq=${currentItem.seq || 0} step=PLAYBACK_ERROR code=${TTS_ERROR_CODES.PLAYBACK_DECODE_ERROR} detail="${ctxErr?.message || ctxErr}"`
        );
      }
    }

    // 3. Fallback: Phát bằng persistent HTML5 Audio Element
    if (persistentAudioRef.current && callEpochRef.current === currentEpoch) {
      const audioEl = persistentAudioRef.current;
      audioEl.src = `data:audio/mp3;base64,${currentItem.audioBase64}`;
      audioEl.currentTime = 0;
      audioEl.onended = () => handleAudioFinished('PLAY_ENDED');
      audioEl.onerror = (e) => {
        console.warn(
          `[VideoCall Flow] [${role}] utteranceId=${currentItem.utteranceId || 'unknown'} seq=${currentItem.seq || 0} step=PLAYBACK_ERROR code=${TTS_ERROR_CODES.PLAYBACK_DECODE_ERROR} detail="HTML5 Audio error"`
        );
        handleAudioFinished(TTS_ERROR_CODES.PLAYBACK_DECODE_ERROR);
      };
      try {
        const playPromise = audioEl.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (callEpochRef.current === currentEpoch) {
                setIsAudioBlocked(false);
                markPlaybackStarted(audioEl.duration && Number.isFinite(audioEl.duration) ? audioEl.duration : 4.5, 'html5_audio');
              } else {
                handleAudioFinished('PLAY_ABORTED');
              }
            })
            .catch((err) => {
              console.warn(
                `[VideoCall Flow] [${role}] utteranceId=${currentItem.utteranceId || 'unknown'} seq=${currentItem.seq || 0} step=PLAYBACK_ERROR code=${TTS_ERROR_CODES.PLAYBACK_BLOCKED} detail="${err?.message || err}"`
              );
              setIsAudioBlocked(true);
              handleAudioFinished(TTS_ERROR_CODES.PLAYBACK_BLOCKED);
            });
          return;
        }
      } catch (playErr) {
        console.warn(
          `[VideoCall Flow] [${role}] utteranceId=${currentItem.utteranceId || 'unknown'} seq=${currentItem.seq || 0} step=PLAYBACK_ERROR code=${TTS_ERROR_CODES.PLAYBACK_BLOCKED} detail="${playErr?.message || playErr}"`
        );
      }
    }

    // Preserve the translated speaker identity: blocked playback must not pick an OS voice.

    setIsAudioBlocked(true);
    handleAudioFinished(TTS_ERROR_CODES.PLAYBACK_BLOCKED);
  }, [getOrCreateAudioContext, role]);

  const enqueueInterpreterAudio = useCallback((item) => {
    if (!item?.audioBase64 || isSpeakerMutedRef.current) return;

    if (item.utteranceId && playedUtteranceIdsRef.current.has(item.utteranceId)) {
      console.log(`[VideoCall Queue] Skip already played utteranceId=${item.utteranceId}`);
      return;
    }

    // Chỉ so sánh trên đồng hồ của chính máy nhận: item.timestamp là Date.now() của máy gửi,
    // nếu Robot và Staff lệch giờ > 15s thì mọi audio của một chiều sẽ bị loại oan.
    const subtitleAt = item.utteranceId ? subtitleReceivedAtRef.current.get(item.utteranceId) : null;
    if (subtitleAt && Date.now() - subtitleAt > 15000) {
      console.warn(`[VideoCall Queue] Skip stale audio (>15s after subtitle) utteranceId=${item.utteranceId}`);
      return;
    }

    if (item.seq && item.seq < expectedPlaySeqRef.current) {
      console.warn(`[VideoCall Queue] Skip late audio seq=${item.seq} < expected=${expectedPlaySeqRef.current}`);
      return;
    }

    audioQueueRef.current.push({
      ...item,
      spokenText: item.translatedText || item.spokenText || '',
    });
    audioQueueRef.current.sort((a, b) => (a.seq || 0) - (b.seq || 0));

    if (audioQueueRef.current.length > 3) {
      audioQueueRef.current = audioQueueRef.current.slice(-3);
    }

    console.log(
      `[VideoCall Flow] [${role}] utteranceId=${item.utteranceId || 'unknown'} seq=${item.seq || 0} step=AUDIO_RECEIVED queueLen=${audioQueueRef.current.length}`
    );
    processAudioQueue();
  }, [processAudioQueue, role]);

  const playInterpreterAudio = useCallback((audioBase64, spokenText = '', meta = {}) => {
    enqueueInterpreterAudio({
      audioBase64,
      spokenText,
      ...meta,
    });
  }, [enqueueInterpreterAudio]);

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

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        console.log('[VideoCall] ontrack received track:', event.track.kind, event.track.id);

        const existingTracks = remoteStreamRef.current ? remoteStreamRef.current.getTracks() : [];
        const hasTrack = existingTracks.some((t) => t.id === event.track.id);
        const nextTracks = hasTrack ? existingTracks : [...existingTracks, event.track];
        // Tạo MediaStream mới mỗi khi có track mới (video đến sau audio) để buộc <video> render lại hình ảnh
        remoteStreamRef.current = new MediaStream(nextTracks);

        event.track.enabled = true;

        event.track.onunmute = () => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = new MediaStream(remoteStreamRef.current.getTracks());
            remoteVideoRef.current.play().catch(() => {});
          }
        };

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
          const playPromise = remoteVideoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((e) => {
              if (e.name !== 'AbortError' && e.name === 'NotAllowedError' && remoteVideoRef.current) {
                remoteVideoRef.current.muted = true;
                isSpeakerMutedRef.current = true;
                setIsSpeakerMuted(true);
                remoteVideoRef.current.play().catch(() => {});
              }
            });
          }
        }
        setCallStatus('connected');
        callStatusRef.current = 'connected';
        if (!mediaRecorderRef.current && remoteStreamRef.current) {
          startRecording(remoteStreamRef.current);
        }
      };

      pc.onconnectionstatechange = async () => {
        console.log('[VideoCall] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setCallStatus('connected');
          callStatusRef.current = 'connected';
          if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(() => {});
          }
          markRemoteWebRtcReadyIfConnected();
        } else if (pc.connectionState === 'failed') {
          if (role === 'guest' && pc.restartIce && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            try {
              pc.restartIce();
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              wsRef.current.send(JSON.stringify({ type: 'offer', sdp: offer }));
            } catch (iceErr) {
              console.error('[VideoCall] ICE restart error:', iceErr);
            }
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setCallStatus('connected');
          callStatusRef.current = 'connected';
          if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(() => {});
          }
          markRemoteWebRtcReadyIfConnected();
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'candidate',
                candidate: event.candidate,
              })
            );
          }

          if (role === 'guest') {
            const candStr = event.candidate.candidate;
            const targetIps = serverHostIpsRef.current.length > 0 ? serverHostIpsRef.current : (serverLanIpRef.current ? [serverLanIpRef.current] : []);
            if (candStr && candStr.includes('.local')) {
              for (const targetIp of targetIps) {
                if (targetIp && targetIp !== '127.0.0.1') {
                  const unmDnsStr = candStr.replace(/[a-zA-Z0-9_\-]+\.local/g, targetIp);
                  if (unmDnsStr !== candStr && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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
            }
          }
        }
      };

      const wsUrl = getCallSignalingWsUrl(sessionId, role, role === 'guest' ? callerName : calleeName);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

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
          callStatusRef.current = 'ringing';
        }
        if (role === 'guest' && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'translate_mode_sync',
            mode: translateModeRef.current,
            guestLang: activeGuestLanguageRef.current,
            manualLocked: isManualLockedRef.current,
          }));
        }
        // Fallback: nếu sau 3.5s phía guest vẫn chưa kết nối ICE -> chủ động gửi lại offer
        if (role === 'guest') {
          setTimeout(async () => {
            if (
              !isEndingRef.current &&
              pcRef.current &&
              pcRef.current.connectionState !== 'connected' &&
              pcRef.current.signalingState === 'stable' &&
              wsRef.current &&
              wsRef.current.readyState === WebSocket.OPEN
            ) {
              try {
                const offer = await pcRef.current.createOffer({
                  offerToReceiveAudio: true,
                  offerToReceiveVideo: true,
                });
                await pcRef.current.setLocalDescription(offer);
                wsRef.current.send(JSON.stringify({ type: 'offer', sdp: offer }));
              } catch {}
            }
          }, 3500);
        }
      };

      ws.onmessage = async (evt) => {
        try {
          const data = JSON.parse(evt.data);

          if (data.type === 'server_info') {
            if (data.lan_ip) {
              serverLanIpRef.current = data.lan_ip;
            }
            if (Array.isArray(data.all_ips)) {
              serverHostIpsRef.current = data.all_ips;
            }
          } else if (data.type === 'peer_joined') {
            if (peerReconnectTimerRef.current) {
              clearTimeout(peerReconnectTimerRef.current);
              peerReconnectTimerRef.current = null;
            }
            if (role === 'guest' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'translate_mode_sync',
                mode: translateModeRef.current,
                guestLang: activeGuestLanguageRef.current,
                manualLocked: isManualLockedRef.current,
              }));
            }
            if (role === 'guest') {
              if (pc.signalingState !== 'stable') {
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
                }
              } catch (offerErr) {
                console.error('[VideoCall] Create offer error:', offerErr);
              }
            }
          } else if (data.type === 'offer') {
            try {
              if (pc.signalingState !== 'stable') {
                await pc.setLocalDescription({ type: 'rollback' });
              }
              await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

              while (iceCandidatesQueueRef.current.length > 0) {
                const cand = iceCandidatesQueueRef.current.shift();
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {}
              }

              const answer = await pc.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
              });
              await pc.setLocalDescription(answer);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'answer', sdp: answer }));
              }
              setCallStatus('connected');
              callStatusRef.current = 'connected';
            } catch (ansErr) {
              console.error('[VideoCall] Error handling offer:', ansErr);
            }
          } else if (data.type === 'answer') {
            if (pc.signalingState === 'have-local-offer') {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

                while (iceCandidatesQueueRef.current.length > 0) {
                  const cand = iceCandidatesQueueRef.current.shift();
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (e) {}
                }
              } catch (ansErr) {
                console.error('[VideoCall] Error applying answer:', ansErr);
              }
            }
            setCallStatus('connected');
            callStatusRef.current = 'connected';
          } else if (data.type === 'candidate') {
            if (data.candidate) {
              if (pc.remoteDescription && pc.remoteDescription.type) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (candErr) {}
              } else {
                iceCandidatesQueueRef.current.push(data.candidate);
              }
            }
          } else if (data.type === 'call_end') {
            handleEndCall(false);
          } else if (data.type === 'peer_disconnected') {
            console.warn(`[VideoCall Flow] [${role}] Peer disconnected from signaling server.`);
            if (peerReconnectTimerRef.current) {
              clearTimeout(peerReconnectTimerRef.current);
            }
            peerReconnectTimerRef.current = setTimeout(() => {
              peerReconnectTimerRef.current = null;
              if (
                !isEndingRef.current &&
                (!pcRef.current || pcRef.current.connectionState !== 'connected')
              ) {
                console.log(`[VideoCall Flow] [${role}] Peer did not reconnect after 12s, ending call.`);
                handleEndCall(false);
              }
            }, 12000);
          } else if (data.type === 'live_interim') {
            if (data.senderRole !== role && data.text) {
              setPeerInterim({ senderRole: data.senderRole, text: data.text });
              if (peerInterimTimerRef.current) clearTimeout(peerInterimTimerRef.current);
              peerInterimTimerRef.current = setTimeout(() => setPeerInterim(null), 3500);
            }
          } else if (data.type === 'live_subtitle') {
            if (data.senderRole !== role) {
              setPeerInterim(null);
              console.log(
                `[VideoCall Flow] [${data.senderRole} -> ${role}] utteranceId=${data.utteranceId || 'unknown'} seq=${data.seq || 0} mode=${translateModeRef.current} step=SUBTITLE_RECEIVED src=${data.sourceLang || 'auto'} tgt=${data.targetLang || 'auto'} needsTrans=${data.needsTranslation}`
              );

              // Cập nhật ngôn ngữ thực tế của Guest theo từng lượt nói (per-turn guest language detection)
              if (data.senderRole === 'guest' && data.sourceLang) {
                const normalizedGuestLang = normalizeLanguageCode(data.sourceLang);
                if (normalizedGuestLang) {
                  const updatedLang = normalizedGuestLang === 'vi' ? 'Tiếng Việt' : 'English';
                  activeGuestLanguageRef.current = updatedLang;
                  setActiveGuestLanguage(updatedLang);
                }
              }

              if (data.utteranceId) {
                const receivedMap = subtitleReceivedAtRef.current;
                receivedMap.set(data.utteranceId, Date.now());
                if (receivedMap.size > 50) {
                  receivedMap.delete(receivedMap.keys().next().value);
                }
              }
              // Nếu câu này không cần dịch (sourceLang === targetLang), tiến ngay expectedPlaySeqRef để không chờ live_audio
              if (!data.needsTranslation && typeof data.seq === 'number' && data.seq > 0) {
                expectedPlaySeqRef.current = advanceExpectedSeqOnFailure(
                  expectedPlaySeqRef.current,
                  data.seq,
                  failedSeqsRef.current
                );
              }

              let finalTranslatedText = data.translatedText;
              let finalNeedsTranslation = Boolean(data.needsTranslation);
              let finalSourceLang = data.sourceLang;
              let finalTargetLang = data.targetLang;

              // Nếu khách đang bật EN ('auto') nhưng staff chưa kịp sync nên gửi câu Tiếng Việt chưa dịch -> tự dịch ngay cho khách & nhắc staff sync
              if (
                role === 'guest' &&
                translateModeRef.current === 'auto' &&
                data.senderRole === 'staff' &&
                !finalNeedsTranslation &&
                data.originalText
              ) {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'translate_mode_sync',
                    mode: 'auto',
                    guestLang: 'English',
                    manualLocked: true,
                  }));
                }
                try {
                  const fallbackTrans = await quickTranslateText({
                    text: data.originalText,
                    sourceLang: 'vi',
                    targetLang: 'en',
                    sessionId,
                    senderRole: 'staff',
                    withAudio: false,
                  });
                  if (fallbackTrans?.translated_text) {
                    finalTranslatedText = fallbackTrans.translated_text;
                    finalNeedsTranslation = true;
                    finalSourceLang = 'vi';
                    finalTargetLang = 'en';
                  }
                } catch {}
              }

              // Nếu câu đã dịch hoặc đang ở chế độ dịch -> tự bật song ngữ để hiển thị phụ đề rõ ràng
              if (finalNeedsTranslation && translateModeRef.current === 'bypass') {
                setTranslateMode('auto');
                translateModeRef.current = 'auto';
              }

              const normalizedPayload = {
                ...data,
                translatedText: finalTranslatedText,
                needsTranslation: finalNeedsTranslation,
                sourceLang: finalSourceLang,
                targetLang: finalTargetLang,
              };

              // Hiển thị phụ đề cho người nhận (kể cả khi giữ nguyên câu gốc cùng ngôn ngữ khi đang ở chế độ dịch)
              if (finalNeedsTranslation || translateModeRef.current !== 'bypass') {
                setActiveSubtitle(normalizedPayload);
                if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
                subtitleTimeoutRef.current = setTimeout(() => {
                  setActiveSubtitle(null);
                }, 8000);
              } else {
                setActiveSubtitle(null);
              }

              const transcriptItem = {
                speaker: data.senderRole === 'staff' ? 'Staff' : 'Guest',
                speaker_name: data.senderRole === 'staff' ? calleeName : callerName,
                raw_transcript: data.originalText,
                translated_text: finalTranslatedText,
                needs_translation: finalNeedsTranslation,
                source_lang: finalSourceLang,
                target_lang: finalTargetLang,
                timestamp: new Date().toISOString(),
              };
              setCallTranscripts((prev) => [...prev, transcriptItem]);
              callTranscriptsRef.current.push(transcriptItem);
            }
          } else if (data.type === 'live_audio') {
            if (data.senderRole !== role && data.audioBase64 && playInterpreterAudioRef.current) {
              playInterpreterAudioRef.current(data.audioBase64, data.translatedText, {
                utteranceId: data.utteranceId,
                seq: data.seq,
                timestamp: data.timestamp,
              });
            }
          } else if (data.type === 'live_audio_status') {
            if (data.senderRole !== role && data.status === 'failed') {
              const errCode = data.errorCode || TTS_ERROR_CODES.TTS_AUDIO_EMPTY;
              console.warn(
                `[VideoCall Flow] [${data.senderRole} -> ${role}] utteranceId=${data.utteranceId || 'unknown'} seq=${data.seq || 0} step=LIVE_AUDIO_FAILED code=${errCode} detail="${data.error || ''}"`
              );
              // Bỏ qua seq lỗi ngay lập tức để không làm kẹt các câu kế tiếp trong hàng đợi 1.2s
              expectedPlaySeqRef.current = advanceExpectedSeqOnFailure(
                expectedPlaySeqRef.current,
                data.seq,
                failedSeqsRef.current
              );
              if (outOfOrderWaitTimerRef.current) {
                clearTimeout(outOfOrderWaitTimerRef.current);
                outOfOrderWaitTimerRef.current = null;
              }
              processAudioQueue();

              setTtsStatus({
                utteranceId: data.utteranceId,
                status: 'failed',
                code: errCode,
                message: `Lỗi âm thanh (${errCode})`,
              });
              setTimeout(() => setTtsStatus(null), 3500);
            }
          } else if (data.type === 'video_frame') {
            if (data.senderRole !== role && data.frame) {
              setRemoteFallbackFrame(data.frame);
            }
          } else if (data.type === 'webrtc_video_ready') {
            if (data.senderRole !== role) {
              setPeerHasWebRtcVideo(true);
            }
          } else if (data.type === 'translate_mode_change' || data.type === 'translate_mode_sync') {
            if (data.mode) {
              setTranslateMode(data.mode);
              translateModeRef.current = data.mode;
            }
            const syncedLang = data.guestLang || (data.mode === 'bypass' ? 'Tiếng Việt' : 'English');
            setActiveGuestLanguage(syncedLang);
            activeGuestLanguageRef.current = syncedLang;
            if (data.manualLocked !== undefined) {
              isManualLockedRef.current = Boolean(data.manualLocked);
            }
            if (data.mode === 'bypass') {
              audioQueueRef.current = [];
              if (activeAudioSourceRef.current) {
                try { activeAudioSourceRef.current.stop(); } catch (e) {}
                activeAudioSourceRef.current = null;
              }
              if (persistentAudioRef.current) {
                try { persistentAudioRef.current.pause(); } catch (e) {}
              }
              if (remoteVideoRef.current) {
                remoteVideoRef.current.volume = 1.0;
              }
              setIsAiSpeaking(false);
              isAiSpeakingRef.current = false;
              isPlayingAudioRef.current = false;
              ttsActiveUntilRef.current = 0;
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
  }, [sessionId, role, callerName, calleeName, primeAudioContext, processAudioQueue]);

  const setupWebRTCRef = useRef(null);
  useEffect(() => {
    setupWebRTCRef.current = setupWebRTC;
  }, [setupWebRTC]);

  // Khởi động khi modal mở (chỉ phụ thuộc isOpen, sessionId, role — tuyệt đối không phụ thuộc state UI như tắt loa/mic)
  useEffect(() => {
    if (isOpen) {
      isEndingRef.current = false;
      isMicMutedRef.current = false;
      isSpeakerMutedRef.current = false;
      setIsMicMuted(false);
      setIsSpeakerMuted(false);
      setCallStatus('calling');
      callStatusRef.current = 'calling';
      setRecordingDuration(0);
      setUploadStatus(null);
      setErrorMessage('');
      setRemoteFallbackFrame('');
      setHasRemoteVideoFrame(false);
      setPeerHasWebRtcVideo(false);
      setActiveSubtitle(null);
      setInterimText('');
      setPeerInterim(null);
      setCallTranscripts([]);
      callTranscriptsRef.current = [];
      const defaultMode = isInitialGuestVi ? 'bypass' : 'auto';
      setTranslateMode(defaultMode);
      translateModeRef.current = defaultMode;
      setActiveGuestLanguage(isInitialGuestVi ? 'Tiếng Việt' : 'English');
      activeGuestLanguageRef.current = isInitialGuestVi ? 'Tiếng Việt' : 'English';
      if (setupWebRTCRef.current) {
        setupWebRTCRef.current();
      }
    }

    return () => {
      cleanUpResources();
    };
  }, [isOpen, sessionId, role]);

  // Độc lập tính thời lượng cuộc gọi khi kết nối thành công
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

  // Đồng bộ lại srcObject khi DOM video mount/re-render và kích hoạt relay video qua WS nếu P2P WebRTC chưa lên hình
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (callStatus === 'connected' && remoteVideoRef.current && remoteStreamRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [callStatus, hasNoCamera]);

  const markRemoteWebRtcReadyIfConnected = useCallback(() => {
    const pcState = pcRef.current?.connectionState;
    const iceState = pcRef.current?.iceConnectionState;
    const isIceReady = pcState === 'connected' || iceState === 'connected' || iceState === 'completed';
    if (isIceReady && remoteVideoRef.current && remoteVideoRef.current.videoWidth > 0) {
      setHasRemoteVideoFrame(true);
      setRemoteFallbackFrame('');
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'webrtc_video_ready',
          senderRole: role,
        }));
      }
    }
  }, [role]);

  useEffect(() => {
    if (!isOpen || callStatus !== 'connected' || peerHasWebRtcVideo) return;
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 270;
    const ctx = canvas.getContext('2d');

    const timer = setInterval(() => {
      if (isEndingRef.current || hasNoCamera || isVideoDisabled) return;
      const ws = wsRef.current;
      const videoEl = localVideoRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 180000) return;
      if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth || !ctx) return;

      try {
        ctx.save();
        if (videoEl.videoHeight > videoEl.videoWidth) {
          // Camera điện thoại trả khung hình dọc -> xoay ngang 90 độ cho đúng chiều landscape
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.drawImage(videoEl, -canvas.height / 2, -canvas.width / 2, canvas.height, canvas.width);
        } else {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        }
        ctx.restore();
        const frame = canvas.toDataURL('image/jpeg', 0.55);
        ws.send(JSON.stringify({
          type: 'video_frame',
          senderRole: role,
          frame,
        }));
      } catch {
        // Ignore transient canvas capture errors
      }
    }, 120);

    return () => clearInterval(timer);
  }, [isOpen, callStatus, peerHasWebRtcVideo, hasNoCamera, isVideoDisabled, role]);

  // Dừng riêng adapter thu âm STT từ localStreamRef (KHÔNG làm dừng track WebRTC gốc)
  const stopCallAudioSttAdapter = useCallback(() => {
    if (pendingWebSpeechFallbackTimerRef.current) {
      clearTimeout(pendingWebSpeechFallbackTimerRef.current);
      pendingWebSpeechFallbackTimerRef.current = null;
    }
    if (audioSttAdapterRef.current) {
      const { processor, source, ctx } = audioSttAdapterRef.current;
      audioSttAdapterRef.current.stopped = true;
      try {
        if (processor) {
          processor.onaudioprocess = null;
          processor.disconnect();
        }
      } catch (e) {}
      try {
        if (source) source.disconnect();
      } catch (e) {}
      try {
        if (ctx && ctx.state !== 'closed') {
          ctx.close().catch(() => {});
        }
      } catch (e) {}
      audioSttAdapterRef.current = null;
    }
  }, []);

  // Dọn dẹp tài nguyên
  const cleanUpResources = () => {
    if (checkPeerIntervalRef.current) {
      clearInterval(checkPeerIntervalRef.current);
      checkPeerIntervalRef.current = null;
    }
    if (peerReconnectTimerRef.current) {
      clearTimeout(peerReconnectTimerRef.current);
      peerReconnectTimerRef.current = null;
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (sttSilenceTimerRef.current) {
      clearTimeout(sttSilenceTimerRef.current);
      sttSilenceTimerRef.current = null;
    }

    if (playbackWatchdogRef.current) {
      clearTimeout(playbackWatchdogRef.current);
      playbackWatchdogRef.current = null;
    }

    staffTurnEpochRef.current += 1;
    if (staffTurnTimerRef.current) {
      clearTimeout(staffTurnTimerRef.current);
      staffTurnTimerRef.current = null;
    }
    turnStartIndexRef.current = 0;
    turnCarryoverRef.current = '';

    stopCallAudioSttAdapter();

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
    callEpochRef.current += 1;
    if (outOfOrderWaitTimerRef.current) {
      clearTimeout(outOfOrderWaitTimerRef.current);
      outOfOrderWaitTimerRef.current = null;
    }
    staffTtsSeqRef.current = 0;
    guestTtsSeqRef.current = 0;
    expectedPlaySeqRef.current = 1;
    failedSeqsRef.current.clear();
    audioQueueRef.current = [];
    playedUtteranceIdsRef.current.clear();
    subtitleReceivedAtRef.current.clear();
    isPlayingAudioRef.current = false;
    isAiSpeakingRef.current = false;
    ttsActiveUntilRef.current = 0;
    lastPlayedTtsTextRef.current = '';
    pendingTranscriptRef.current = '';
    setIsAiSpeaking(false);
    setTtsStatus(null);
    setIsAudioBlocked(false);
  };

  // Chốt câu nói hoàn chỉnh và gửi sang luồng dịch (mọi nhánh bỏ qua đều ghi log reason rõ ràng)
  const commitSpokenText = useCallback((text, meta = {}) => {
    const sttEngine = meta.engine || 'web_speech';
    const detectedLangHint = meta.detectedLang || null;
    const now = Date.now();

    const evalRes = evaluateSpokenTextCommit({
      text,
      isMicMuted: isMicMutedRef.current,
      callStatus: callStatusRef.current,
      isAiSpeaking: isAiSpeakingRef.current,
      now,
      ttsActiveUntil: ttsActiveUntilRef.current,
      lastPlayedTtsText: lastPlayedTtsTextRef.current,
      lastProcessedText: lastProcessedTextRef.current,
      lastProcessedTime: lastProcessedTimeRef.current,
      duplicateWindowMs: 2200,
    });

    if (!evalRes.allowed) {
      console.log(
        `[VideoCall Flow] [${role}] step=STT_SKIPPED reason=${evalRes.reason} engine=${sttEngine} len=${evalRes.cleanText.length}`
      );
      return false;
    }

    // Hệ thống chỉ hỗ trợ Tiếng Việt và Tiếng Anh; chặn ký tự ngoài Latin/Việt (Thái, Trung, Hàn, Nhật, Ả Rập...)
    if (/[\u0400-\u04ff\u0600-\u06ff\u0900-\u097f\u0e00-\u0eff\u1780-\u17ff\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(evalRes.cleanText)) {
      console.warn(
        `[VideoCall Flow] [${role}] step=STT_SKIPPED reason=NON_EN_VI_SCRIPT engine=${sttEngine}`
      );
      return false;
    }

    if (pendingWebSpeechFallbackTimerRef.current) {
      clearTimeout(pendingWebSpeechFallbackTimerRef.current);
      pendingWebSpeechFallbackTimerRef.current = null;
    }

    const cleanText = evalRes.cleanText;
    lastProcessedTextRef.current = cleanText;
    lastProcessedTimeRef.current = now;
    pendingTranscriptRef.current = '';
    setInterimText('');

    console.log(
      `[VideoCall Flow] [${role}] step=COMMITTED engine=${sttEngine} detectedLang=${detectedLangHint || 'auto'} len=${cleanText.length}`
    );
    if (handleProcessSpokenTextRef.current) {
      handleProcessSpokenTextRef.current(cleanText, {
        detectedLang: detectedLangHint,
        sttEngine,
      });
    }
    return true;
  }, [role]);

  // Khởi tạo Call Audio Stream STT Adapter:
  // Tách các câu nói từ localStreamRef.current (16kHz Mono WAV) khi dừng lời (VAD silence)
  // và gửi tới Backend Bilingual STT (/api/v1/ai/stt/transcribe) để nhận diện chính xác cả EN & VI từ âm thanh,
  // đồng thời đảm bảo Staff/Robot luôn nhận diện được tiếng nói ngay cả khi Web Speech API bị trình duyệt abort.
  const startCallAudioSttAdapter = useCallback(() => {
    stopCallAudioSttAdapter();
    if (isEndingRef.current || isMicMutedRef.current || callStatusRef.current !== 'connected') {
      return;
    }

    const stream = localStreamRef.current;
    if (!stream || typeof stream.getAudioTracks !== 'function') return;
    const audioTracks = stream.getAudioTracks().filter((t) => t.readyState === 'live');
    if (audioTracks.length === 0) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      let ctx;
      try {
        ctx = new AudioCtx({ sampleRate: 16000 });
      } catch (rateErr) {
        ctx = new AudioCtx();
      }
      if (typeof ctx.createMediaStreamSource !== 'function' || typeof ctx.createScriptProcessor !== 'function') {
        if (ctx.close) ctx.close().catch(() => {});
        return;
      }

      // Tạo MediaStream chỉ gồm audio track (không ảnh hưởng tới track WebRTC gốc)
      const audioOnlyStream = new MediaStream(audioTracks);
      const source = ctx.createMediaStreamSource(audioOnlyStream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      const state = {
        ctx,
        source,
        processor,
        stopped: false,
        isSpeaking: false,
        speechChunks: [],
        preRollChunks: [],
        silenceFrames: 0,
        speechFrames: 0,
        inflight: false,
      };
      audioSttAdapterRef.current = state;

      const sampleRate = ctx.sampleRate || 16000;
      const frameDurationMs = (4096 / sampleRate) * 1000;
      // Tối ưu siêu nhạy (0.0018 thay vì 0.0028): bắt trọn cả tiếng nói nhỏ/thì thầm, không cần hét
      const SPEECH_RMS_THRESHOLD = 0.0018;
      const SILENCE_RMS_THRESHOLD = 0.0011;
      // 550ms im lặng liên tục để chốt câu nhanh và tự nhiên
      const SILENCE_FRAMES_TO_FLUSH = Math.max(3, Math.round(550 / frameDurationMs));
      // Tối thiểu 300ms âm thanh thực tế để loại bỏ tiếng click
      const MIN_SPEECH_FRAMES = Math.max(2, Math.round(300 / frameDurationMs));
      // Tối đa 8 giây âm thanh liên tục
      const MAX_SPEECH_FRAMES = Math.round(8000 / frameDurationMs);

      const flushAudioSegment = async (chunksToFlush) => {
        if (!chunksToFlush || chunksToFlush.length < MIN_SPEECH_FRAMES || state.stopped) return;
        // Chỉ bỏ qua fallback Whisper ở phía Staff khi Web Speech API thực sự vừa trả kết quả (< 2.5s).
        // Nếu Web Speech lỗi network/im lặng trên laptop, tự động fallback sang backend STT.
        const hasRecentWebSpeech =
          lastWebSpeechResultAtRef.current > 0 &&
          Date.now() - lastWebSpeechResultAtRef.current < 2500;
        if (
          role === 'staff' &&
          speechRecognitionRef.current &&
          !speechRecognitionRef.current._hasPermError &&
          hasRecentWebSpeech
        ) {
          return;
        }
        const wavBlob = encodeWavBlobFromFloat32(chunksToFlush, ctx.sampleRate || 16000);
        if (!wavBlob || wavBlob.size < 2500) return;

        // Hệ thống chỉ hỗ trợ Tiếng Việt ('vi') và Tiếng Anh ('en'):
        // Nhân viên mặc định nói Tiếng Việt ('vi'); Khách nói theo ngôn ngữ đang chọn ('vi' hoặc 'en').
        const guestSelectedCode = normalizeLanguageCode(activeGuestLanguageRef.current) || 'en';
        const curInputMode =
          role === 'staff'
            ? 'vi'
            : translateModeRef.current === 'bypass'
              ? 'vi'
              : inputLangModeRef.current !== 'auto'
                ? inputLangModeRef.current
                : guestSelectedCode;
        const preferredLang = role === 'staff' ? 'vi' : guestSelectedCode;

        state.inflight = true;
        try {
          const sttRes = await transcribeCallAudio(wavBlob, {
            language: curInputMode,
            preferredLang,
          });
          if (state.stopped || isEndingRef.current || isMicMutedRef.current) return;
          if (sttRes?.success && sttRes.text) {
            console.log(
              `[VideoCall Flow] [${role}] step=STT_RESULT engine=${sttRes.provider || 'audio_stt'} detectedLang=${sttRes.detected_language} conf=${sttRes.confidence} len=${sttRes.text.length}`
            );
            commitSpokenText(sttRes.text, {
              engine: sttRes.provider || 'audio_stt',
              detectedLang: sttRes.detected_language,
            });
          }
        } catch (err) {
          console.warn(`[VideoCall STT] [${role}] Audio STT adapter error:`, err?.message || err);
        } finally {
          state.inflight = false;
        }
      };

      processor.onaudioprocess = (event) => {
        if (state.stopped || isEndingRef.current || isMicMutedRef.current || callStatusRef.current === 'ended') {
          state.isSpeaking = false;
          state.speechChunks = [];
          state.speechFrames = 0;
          state.silenceFrames = 0;
          return;
        }

        // Không thu âm khi loa AI đang phát để tránh thu tiếng vọng
        if (isAiSpeakingRef.current || Date.now() < ttsActiveUntilRef.current) {
          state.isSpeaking = false;
          state.speechChunks = [];
          state.speechFrames = 0;
          state.silenceFrames = 0;
          return;
        }

        const inputBuffer = event.inputBuffer.getChannelData(0);
        const frameCopy = new Float32Array(inputBuffer.length);
        frameCopy.set(inputBuffer);
        const rms = calculateFrameRms(frameCopy);

        if (rms >= SPEECH_RMS_THRESHOLD) {
          lastAudioVadSpeechAtRef.current = Date.now();
          if (!state.isSpeaking) {
            state.isSpeaking = true;
            state.speechChunks = state.preRollChunks && state.preRollChunks.length > 0 ? [...state.preRollChunks] : [];
            state.speechFrames = 0;
            state.silenceFrames = 0;
          }
          state.speechChunks.push(frameCopy);
          state.speechFrames += 1;
          state.silenceFrames = 0;

          if (state.speechFrames >= MAX_SPEECH_FRAMES) {
            const batch = state.speechChunks;
            state.isSpeaking = false;
            state.speechChunks = [];
            state.speechFrames = 0;
            state.silenceFrames = 0;
            flushAudioSegment(batch);
          }
        } else if (state.isSpeaking) {
          state.speechChunks.push(frameCopy);
          if (rms <= SILENCE_RMS_THRESHOLD) {
            state.silenceFrames += 1;
          } else {
            state.silenceFrames = 0;
          }

          if (state.silenceFrames >= SILENCE_FRAMES_TO_FLUSH) {
            const batch = state.speechChunks;
            const totalSpeechFrames = state.speechFrames;
            state.isSpeaking = false;
            state.speechChunks = [];
            state.speechFrames = 0;
            state.silenceFrames = 0;
            if (totalSpeechFrames >= MIN_SPEECH_FRAMES) {
              flushAudioSegment(batch);
            }
          }
        } else {
          state.preRollChunks = (state.preRollChunks || []).slice(-1);
          state.preRollChunks.push(frameCopy);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      // Context được tạo trong callback bất đồng bộ (offer/answer/ontrack) nên có thể ở trạng thái 'suspended';
      // khi đó onaudioprocess không bao giờ chạy và bộ thu âm STT dự phòng bị câm. primeAudioContext() cũng resume lại khi có tương tác.
      if (ctx.state === 'suspended') {
        ctx.resume()
          .then(() => {
            console.log(`[VideoCall Flow] [${role}] step=STT_ADAPTER_CTX state=${ctx.state}`);
          })
          .catch((resumeErr) => {
            console.warn(`[VideoCall Flow] [${role}] step=STT_ADAPTER_CTX state=${ctx.state} detail="${resumeErr?.message || resumeErr}"`);
          });
      }
      console.log(`[VideoCall Flow] [${role}] step=STT_STARTED engine=audio_stream_adapter inputMode=${inputLangModeRef.current} ctxState=${ctx.state}`);
    } catch (adapterErr) {
      console.warn(`[VideoCall STT] [${role}] Cannot initialize Audio Stream STT Adapter:`, adapterErr);
    }
  }, [role, commitSpokenText, stopCallAudioSttAdapter]);

  // Khởi tạo nhận diện giọng nói Web Speech API (Streaming phụ đề tạm thời + kết hợp Audio Stream Adapter)
  const startSpeechRecognition = useCallback(() => {
    if (isEndingRef.current || isMicMutedRef.current) return;
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.log(`[VideoCall STT] [${role}] Web Speech API unavailable; relying on Audio Stream Bilingual STT Adapter.`);
      return;
    }

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

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // Xác định ngôn ngữ cho Web Speech API:
      // - Nếu người dùng khóa inputLangMode === 'vi' hoặc translateMode === 'bypass' -> 'vi-VN'
      // - Nếu khóa inputLangMode === 'en' -> 'en-US'
      // - Nếu inputLangMode === 'auto' -> mặc định theo vai trò ('vi-VN' cho staff, 'en-US' cho guest),
      //   trong khi Audio Stream Adapter song ngữ sẽ tự động phân loại cả EN & VI từ âm thanh thực tế.
      let listenLang = 'en-US';
      if (role === 'staff') {
        listenLang = 'vi-VN';
      } else if (translateMode === 'bypass' || inputLangMode === 'vi') {
        listenLang = 'vi-VN';
      } else if (inputLangMode === 'en') {
        listenLang = 'en-US';
      } else {
        listenLang = 'en-US';
      }
      recognition.lang = listenLang;

      recognition.onstart = () => {
        console.log(
          `[VideoCall Flow] [${role}] step=STT_STARTED engine=web_speech lang=${listenLang} inputMode=${inputLangMode} mode=${translateMode}`
        );
        if (role === 'staff') {
          turnStartIndexRef.current = 0;
        }
        setSttStatusMessage('');
      };

      const dispatchWebSpeechTranscript = (transcriptText) => {
        const clean = (transcriptText || '').trim();
        if (!clean) return;
        const fixedHint = listenLang.startsWith('vi') ? 'vi' : 'en';

        // Phía Nhân viên (role === 'staff') hoặc câu có dấu thanh tiếng Việt rõ ràng:
        // Commit ngay lập tức, không trì hoãn 1250ms để loại bỏ độ trễ và race condition
        const hasViDiacritics = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(clean);
        if (role === 'staff' || hasViDiacritics) {
          if (pendingWebSpeechFallbackTimerRef.current) {
            clearTimeout(pendingWebSpeechFallbackTimerRef.current);
            pendingWebSpeechFallbackTimerRef.current = null;
          }
          commitSpokenText(clean, {
            engine: 'web_speech',
            detectedLang: 'vi',
          });
          return;
        }

        // Nếu đang ở chế độ Đa ngữ Tự động ('auto') và bộ thu âm Audio Stream VAD vừa thu được giọng nói thực tế,
        // ưu tiên chờ kết quả nhận diện song ngữ từ Audio Stream Adapter (tối đa 1250ms) để tránh nhận sai ngôn ngữ
        // khi khách nói tiếng Việt xen giữa tiếng Anh. Nếu Audio Adapter không phản hồi thì tự động fallback sang kết quả này.
        const audioVadRecentlyActive = Date.now() - lastAudioVadSpeechAtRef.current < 2400;
        if (inputLangModeRef.current === 'auto' && translateModeRef.current !== 'bypass' && audioVadRecentlyActive) {
          if (pendingWebSpeechFallbackTimerRef.current) {
            clearTimeout(pendingWebSpeechFallbackTimerRef.current);
          }
          pendingWebSpeechFallbackTimerRef.current = setTimeout(() => {
            pendingWebSpeechFallbackTimerRef.current = null;
            commitSpokenText(clean, {
              engine: 'web_speech_fallback',
              detectedLang: 'auto',
            });
          }, 1250);
          return;
        }

        commitSpokenText(clean, {
          engine: 'web_speech',
          detectedLang: inputLangModeRef.current === 'auto' ? 'auto' : fixedHint,
        });
      };

      recognition.onresult = (event) => {
        // --- NHÁNH DÀNH RIÊNG CHO STAFF (TIẾNG VIỆT LỄ TÂN) ---
        // Áp dụng chuẩn Conversational Endpointing theo mô hình Voice Bot (1.000ms):
        // 1. Chỉ lấy kết quả từ turnStartIndexRef trở đi để KHÔNG BAO GIỜ bị cộng dồn với câu đã nói trước đó.
        // 2. Chịu được nhịp ngắt nghỉ tự nhiên (~700ms - 800ms) giữa các vế câu.
        // 3. Khi Staff dứt lời 1.0s, tự động chốt dứt khoát lượt nói và cập nhật turnStartIndexRef = results.length.
        if (role === 'staff') {
          let turnFinalText = '';
          let currentInterim = '';

          const startIdx = Math.min(turnStartIndexRef.current, event.results.length);
          for (let i = startIdx; i < event.results.length; ++i) {
            const res = event.results[i];
            const transcript = (res[0] ? res[0].transcript : '').trim();
            if (!transcript) continue;

            if (res.isFinal) {
              turnFinalText += (turnFinalText ? ' ' : '') + transcript;
            } else {
              currentInterim += (currentInterim ? ' ' : '') + transcript;
            }
          }

          const carry = turnCarryoverRef.current;
          const combinedFinal = [carry, turnFinalText].filter(Boolean).join(' ').trim();
          const combinedPreview = [combinedFinal, currentInterim].filter(Boolean).join(' ').trim();
          if (!combinedPreview) return;

          lastWebSpeechResultAtRef.current = Date.now();

          if (isAiSpeakingRef.current) {
            console.log(`[VideoCall Flow] [staff] step=STT_SKIPPED reason=ECHO_AI_SPEAKING engine=web_speech len=${combinedPreview.length}`);
            return;
          }

          pendingTranscriptRef.current = combinedPreview;
          setInterimText(combinedPreview);

          const nowTs = Date.now();
          if (nowTs - lastInterimSentAtRef.current >= 450 && wsRef.current?.readyState === WebSocket.OPEN) {
            lastInterimSentAtRef.current = nowTs;
            wsRef.current.send(
              JSON.stringify({
                type: 'live_interim',
                senderRole: role,
                speaker: 'Staff',
                text: combinedPreview,
              })
            );
          }

          console.log(
            `[VideoCall Flow] [staff] step=STT_RESULT engine=web_speech startIdx=${startIdx} carryLen=${carry.length} finalLen=${turnFinalText.length} interimLen=${currentInterim.length} totalLen=${combinedPreview.length}`
          );

          if (staffTurnTimerRef.current) {
            clearTimeout(staffTurnTimerRef.current);
            staffTurnTimerRef.current = null;
          }

          const currentResultsLen = event.results.length;
          if (combinedFinal && !currentInterim && combinedFinal.length > 1) {
            turnStartIndexRef.current = currentResultsLen;
            turnCarryoverRef.current = '';
            pendingTranscriptRef.current = '';
            setInterimText('');
            commitSpokenText(combinedFinal, {
              engine: 'web_speech',
              detectedLang: 'vi',
            });
            return;
          }

          const currentEpoch = staffTurnEpochRef.current;

          staffTurnTimerRef.current = setTimeout(() => {
            staffTurnTimerRef.current = null;
            if (
              currentEpoch !== staffTurnEpochRef.current ||
              isMicMutedRef.current ||
              isEndingRef.current ||
              callStatusRef.current !== 'connected'
            ) {
              return;
            }

            const sentenceToCommit = (pendingTranscriptRef.current || combinedPreview).trim();
            if (sentenceToCommit.length > 1) {
              // Chốt dứt khoát lượt nói này:
              // Đẩy turnStartIndex lên vị trí kết quả hiện tại để các câu tiếp theo KHÔNG bị cộng dồn!
              turnStartIndexRef.current = currentResultsLen;
              turnCarryoverRef.current = '';
              pendingTranscriptRef.current = '';
              setInterimText('');

              commitSpokenText(sentenceToCommit, {
                engine: 'web_speech',
                detectedLang: 'vi',
              });
            }
          }, STAFF_CONVERSATIONAL_SILENCE_MS);
          return;
        }

        // --- NHÁNH DÀNH CHO GUEST / ROBOT (GIỮ NGUYÊN HOÀN TOÀN) ---
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

        const candidate = (finalChunk ? finalChunk + ' ' : '') + interim;
        const cleanCandidate = candidate.trim();
        if (!cleanCandidate) return;

        // Kiểm tra nếu đang bị chặn bởi loa AI đang phát thì ghi log tường minh thay vì return im lặng
        if (isAiSpeakingRef.current) {
          console.log(`[VideoCall Flow] [${role}] step=STT_SKIPPED reason=ECHO_AI_SPEAKING engine=web_speech len=${cleanCandidate.length}`);
          return;
        }

        pendingTranscriptRef.current = cleanCandidate;
        setInterimText(cleanCandidate);
        if (interim.trim() && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const now = Date.now();
          if (now - lastInterimSentAtRef.current >= 450) {
            lastInterimSentAtRef.current = now;
            try {
              wsRef.current.send(JSON.stringify({
                type: 'live_interim',
                senderRole: role,
                text: cleanCandidate,
              }));
            } catch {}
          }
        }
        console.log(
          `[VideoCall Flow] [${role}] step=STT_RESULT engine=web_speech final=${Boolean(finalChunk)} interimLen=${interim.length} totalLen=${cleanCandidate.length}`
        );

        // Chỉ chốt ngay nếu finalChunk đã có VÀ người dùng đã thực sự dừng lời (interim trống).
        // Nếu người dùng vẫn đang nói (interim còn chữ), KHÔNG ngắt câu sớm để tránh cắt cụt câu nói dài!
        if (finalChunk.trim() && !interim.trim()) {
          if (sttSilenceTimerRef.current) {
            clearTimeout(sttSilenceTimerRef.current);
            sttSilenceTimerRef.current = null;
          }
          dispatchWebSpeechTranscript(finalChunk.trim());
          return;
        }

        // Khi người dùng đang nói hoặc vừa có finalChunk nhưng interim đang tiếp nối,
        // duy trì timer 900ms để bắt trọn câu nói tự nhiên
        if (sttSilenceTimerRef.current) {
          clearTimeout(sttSilenceTimerRef.current);
        }
        sttSilenceTimerRef.current = setTimeout(() => {
          sttSilenceTimerRef.current = null;
          if (pendingTranscriptRef.current && pendingTranscriptRef.current.trim().length > 1) {
            dispatchWebSpeechTranscript(pendingTranscriptRef.current);
          }
        }, 900);
      };

      recognition.onerror = (err) => {
        if (err.error === 'not-allowed' || err.error === 'service-not-allowed') {
          recognition._hasPermError = true;
          console.warn(`[VideoCall Flow] [${role}] step=STT_ERROR reason=${err.error} engine=web_speech`);
        } else if (err.error !== 'no-speech' && err.error !== 'aborted') {
          console.warn(`[VideoCall Flow] [${role}] step=STT_ERROR reason=${err.error} engine=web_speech`);
        }
      };

      recognition.onend = () => {
        if (recognition._isManualStop) {
          return;
        }

        // Phía Guest: bàn giao pending transcript nếu có
        if (role !== 'staff') {
          if (pendingTranscriptRef.current && pendingTranscriptRef.current.trim().length > 1) {
            dispatchWebSpeechTranscript(pendingTranscriptRef.current);
          }
        } else {
          // Phía Staff: nếu đang có câu dở dang trong lượt nói khi browser tự ngắt onend,
          // lưu vào carryover để khi browser start lại session mới (results reset về 0)
          // câu nói tiếp theo vẫn được nối liền tự nhiên.
          if (pendingTranscriptRef.current && pendingTranscriptRef.current.trim()) {
            turnCarryoverRef.current = pendingTranscriptRef.current.trim();
          }
        }

        if (!isEndingRef.current && !isMicMutedRef.current && callStatusRef.current === 'connected' && !recognition._hasPermError) {
          setTimeout(() => {
            if (!recognition._isManualStop && !isEndingRef.current && !isMicMutedRef.current && callStatusRef.current === 'connected' && !recognition._hasPermError) {
              try {
                recognition.start();
              } catch (e) {
                setTimeout(() => {
                  if (!isEndingRef.current && !isMicMutedRef.current && callStatusRef.current === 'connected' && !recognition._hasPermError) {
                    startSpeechRecognition();
                  }
                }, 600);
              }
            }
          }, 200);
        }
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
    } catch (e) {
      console.warn(`[VideoCall STT] [${role}] Web Speech init fallback to Audio Stream STT:`, e);
    }
  }, [role, translateMode, inputLangMode, commitSpokenText]);

  // Kích hoạt cả Web Speech API và Audio Stream STT Adapter khi cuộc gọi đã kết nối thành công
  useEffect(() => {
    if (callStatus === 'connected' && !isMicMuted) {
      startCallAudioSttAdapter();
      startSpeechRecognition();
    } else {
      stopCallAudioSttAdapter();
    }
    return () => {
      if (sttSilenceTimerRef.current) {
        clearTimeout(sttSilenceTimerRef.current);
        sttSilenceTimerRef.current = null;
      }
      if (staffTurnTimerRef.current) {
        clearTimeout(staffTurnTimerRef.current);
        staffTurnTimerRef.current = null;
      }
      turnStartIndexRef.current = 0;
      turnCarryoverRef.current = '';
      stopCallAudioSttAdapter();
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current._isManualStop = true;
          speechRecognitionRef.current.abort();
        } catch (e) {}
        speechRecognitionRef.current = null;
      }
    };
  }, [callStatus, isMicMuted, startSpeechRecognition, startCallAudioSttAdapter, stopCallAudioSttAdapter]);

  // Xử lý dịch và phát tán phụ đề & âm thanh hai chiều (Staff ⇄ Robot)
  // Tách biệt hoàn toàn Ngôn ngữ câu nói (sourceLang) và Ngôn ngữ đích của phía nhận (targetLang)
  const handleProcessSpokenText = useCallback(async (spokenText, meta = {}) => {
    if (!spokenText || !spokenText.trim()) return;

    try {
      const curMode = translateModeRef.current;
      const cleanText = spokenText.trim();
      const targetConfig = resolveTranslationTarget(role, curMode, activeGuestLanguageRef.current);
      const { peerRole, targetLang, ttsLangCode, ttsVoice, isBypassMode } = targetConfig;

      // 1. CHẾ ĐỘ THUẦN VIỆT (BYPASS): Không dịch nếu cả 2 nói Tiếng Việt;
      // nhưng hễ phát hiện câu nói Tiếng Anh -> tự động bật dịch Việt ⇄ Anh ngay câu đó
      const hasVietnameseDiacritics = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(cleanText);
      const detectedEnFromMeta = normalizeLanguageCode(meta.detectedLang) === 'en';
      const looksLikeEnglishSentence =
        !hasVietnameseDiacritics &&
        (detectedEnFromMeta ||
          /\b(hello|hi|hey|please|thank|thanks|help|room|water|towel|food|menu|order|check|where|what|when|how|can|could|would|need|want|need|sorry|excuse|morning|evening|night|hotel|reception|staff|pool|spa|gym|bar|coffee|breakfast|wifi|password|taxi|airport|luggage|broken|clean)\b/i.test(cleanText));

      if (isBypassMode && looksLikeEnglishSentence && !isManualLockedRef.current) {
        setTranslateMode('auto');
        translateModeRef.current = 'auto';
        setActiveGuestLanguage('English');
        activeGuestLanguageRef.current = 'English';
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'translate_mode_sync',
            mode: 'auto',
            manualLocked: false,
          }));
        }
      } else if (isBypassMode) {
        const payload = {
          type: 'live_subtitle',
          senderRole: role,
          originalText: cleanText,
          translatedText: cleanText,
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

      const activeTargetConfig = isBypassMode
        ? resolveTranslationTarget(role, 'auto', 'English')
        : targetConfig;
      const effectivePeerRole = activeTargetConfig.peerRole;
      const effectiveTargetLang = activeTargetConfig.targetLang;

      // 2. XÁC ĐỊNH NGÔN NGỮ NGUỒN CỦA CÂU NÓI (CHUẨN HÓA DUY NHẤT 'vi' HOẶC 'en')
      const normalizedMetaLang = normalizeLanguageCode(meta.detectedLang);
      const normalizedInputMode = normalizeLanguageCode(inputLangModeRef.current);
      const hintLang = normalizedMetaLang || normalizedInputMode || 'auto';

      const utteranceId = `utt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const seqRef = role === 'staff' ? staffTtsSeqRef : guestTtsSeqRef;
      const currentSeq = ++seqRef.current;

      console.log(
        `[VideoCall Flow] [${role} -> ${effectivePeerRole}] utteranceId=${utteranceId} seq=${currentSeq} mode=${translateModeRef.current} step=TRANSLATE_REQUEST srcHint=${hintLang} tgt=${effectiveTargetLang} len=${cleanText.length}`
      );

      // Gửi ngay bản text gốc qua live_interim để đối phương thấy tức thì trong lúc chờ API dịch
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'live_interim',
            senderRole: role,
            speaker: role === 'staff' ? 'Staff' : 'Guest',
            text: cleanText,
          })
        );
      }

      const recentContext = (callTranscriptsRef.current || [])
        .slice(-2)
        .map((t) => `${t.speaker}: ${t.raw_transcript}`)
        .filter(Boolean);

      const res = await quickTranslateText({
        text: cleanText,
        sourceLang: hintLang,
        targetLang: effectiveTargetLang,
        sessionId,
        senderRole: role,
        withAudio: false,
        context: recentContext,
      });

      const normalizedResSource = normalizeLanguageCode(res.source_lang);
      const resolvedSourceLang = normalizedResSource || (hintLang !== 'auto' ? hintLang : (role === 'staff' ? 'vi' : 'en'));
      const needsTranslation = Boolean(res.needs_translation) && resolvedSourceLang !== effectiveTargetLang;
      const finalTranslatedText = needsTranslation ? (res.translated_text || cleanText) : cleanText;

      console.log(
        `[VideoCall Flow] [${role} -> ${effectivePeerRole}] utteranceId=${utteranceId} seq=${currentSeq} mode=${translateModeRef.current} step=TRANSLATED src=${resolvedSourceLang} tgt=${effectiveTargetLang} needsTrans=${needsTranslation}`
      );

      const payload = {
        type: 'live_subtitle',
        senderRole: role,
        utteranceId,
        seq: currentSeq,
        originalText: cleanText,
        translatedText: finalTranslatedText,
        needsTranslation,
        sourceLang: resolvedSourceLang,
        targetLang: effectiveTargetLang,
        audioBase64: null,
        timestamp: Date.now(),
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
        console.log(
          `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} step=SUBTITLE_SENT needsTrans=${needsTranslation}`
        );
      }
      displaySubtitleLocally(payload);

      // Chỉ hiển thị phụ đề dịch trực tiếp Việt ⇄ Anh cho cả 2 bên, không phát giọng TTS robot đè lên cuộc gọi
      return;
    } catch (err) {
      console.warn('[VideoCall Flow] Subtitle/Translation process error:', err);
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

  // Giả lập câu nói của Khách (English hoặc Tiếng Việt) để kiểm tra âm thanh TTS & phụ đề
  const handleSimulateGuestSpeech = async (text) => {
    if (!text || !text.trim() || isTestTranslating) return;
    try {
      setIsTestTranslating(true);
      setInterimText('');
      const clean = text.trim();
      const res = await quickTranslateText({
        text: clean,
        sourceLang: 'auto',
        targetLang: 'vi',
        sessionId: sessionId,
        senderRole: 'guest',
        withAudio: true,
      });

      const utteranceId = `sim_guest_${Date.now()}`;
      const payload = {
        type: 'live_subtitle',
        senderRole: 'guest',
        utteranceId,
        seq: ++guestTtsSeqRef.current,
        originalText: clean,
        translatedText: res.translated_text || clean,
        needsTranslation: Boolean(res.needs_translation),
        sourceLang: res.source_lang || 'en',
        targetLang: 'vi',
        audioBase64: res.audio_base64 || null,
        timestamp: Date.now(),
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }
      displaySubtitleLocally(payload);

      if (payload.needsTranslation && payload.audioBase64 && playInterpreterAudioRef.current) {
        playInterpreterAudioRef.current(payload.audioBase64, payload.translatedText, { utteranceId });
      }
    } catch (err) {
      console.warn('[VideoCall Flow] Simulate guest speech error:', err);
    } finally {
      setIsTestTranslating(false);
    }
  };

  // Giả lập câu nói của Nhân viên (Tiếng Việt -> Dịch sang Tiếng Anh cho Khách) để kiểm tra giọng đọc Jenny
  const handleSimulateStaffSpeech = async (text) => {
    if (!text || !text.trim() || isTestTranslating) return;
    try {
      setIsTestTranslating(true);
      setInterimText('');
      const clean = text.trim();
      const res = await quickTranslateText({
        text: clean,
        sourceLang: 'auto',
        targetLang: 'en',
        sessionId: sessionId,
        senderRole: 'staff',
        withAudio: true,
      });

      const utteranceId = `sim_staff_${Date.now()}`;
      const payload = {
        type: 'live_subtitle',
        senderRole: 'staff',
        utteranceId,
        seq: ++staffTtsSeqRef.current,
        originalText: clean,
        translatedText: res.translated_text || clean,
        needsTranslation: Boolean(res.needs_translation),
        sourceLang: res.source_lang || 'vi',
        targetLang: 'en',
        audioBase64: res.audio_base64 || null,
        timestamp: Date.now(),
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }
      displaySubtitleLocally(payload);

      if (payload.needsTranslation && payload.audioBase64 && playInterpreterAudioRef.current) {
        playInterpreterAudioRef.current(payload.audioBase64, payload.translatedText, { utteranceId });
      }
    } catch (err) {
      console.warn('[VideoCall Flow] Simulate staff speech error:', err);
    } finally {
      setIsTestTranslating(false);
    }
  };

  const displaySubtitleLocally = (payload) => {
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

    if (payload.needsTranslation || translateModeRef.current !== 'bypass') {
      setActiveSubtitle(payload);
      if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
      subtitleTimeoutRef.current = setTimeout(() => {
        setActiveSubtitle(null);
      }, 6000);
    } else {
      setActiveSubtitle(null);
    }
  };

  // Thay đổi chế độ dịch và đồng bộ cho peer đối diện
  const handleToggleTranslateMode = (newMode, newLang = null) => {
    isManualLockedRef.current = true;
    setTranslateMode(newMode);
    translateModeRef.current = newMode;
    const targetLang = newLang || (newMode === 'auto' ? 'English' : 'Tiếng Việt');
    setActiveGuestLanguage(targetLang);
    activeGuestLanguageRef.current = targetLang;
    setShowTranslateSettings(false);

    if (newMode === 'bypass') {
      audioQueueRef.current = [];
      if (activeAudioSourceRef.current) {
        try { activeAudioSourceRef.current.stop(); } catch (e) {}
        activeAudioSourceRef.current = null;
      }
      if (persistentAudioRef.current) {
        try { persistentAudioRef.current.pause(); } catch (e) {}
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.volume = 1.0;
      }
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      isPlayingAudioRef.current = false;
      ttsActiveUntilRef.current = 0;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'translate_mode_change',
        mode: newMode,
        guestLang: targetLang,
        manualLocked: true,
      }));
    }
  };

  // Chuyển đổi chế độ ngôn ngữ đầu vào của Micro: 'auto' (Đa ngữ EN/VI) -> 'en' -> 'vi'
  const cycleInputLangMode = () => {
    const order = ['auto', 'en', 'vi'];
    const nextIdx = (order.indexOf(inputLangMode) + 1) % order.length;
    const nextMode = order[nextIdx];
    setInputLangMode(nextMode);
    inputLangModeRef.current = nextMode;
  };

  // Kết thúc cuộc gọi
  const handleEndCall = (notifyPeer = true) => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    if (notifyPeer && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'call_end' }));
      } catch (e) {}
    }

    setCallStatus('ended');
    callStatusRef.current = 'ended';

    // 1. Kích hoạt thu chunk cuối và gửi lưu ngầm
    stopRecordingAndUpload();

    // 2. Giải phóng MediaStream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // 3. Đóng giao diện tức thì (không bắt người dùng phải đợi upload Cloudinary)
    cleanUpResources();
    onClose();
  };

  // Bật/tắt Loa (Chỉ tắt tiếng video đầu xa & âm thanh AI TTS, tuyệt đối không làm ngắt kết nối WebRTC/WS)
  const toggleSpeaker = (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    const next = !isSpeakerMutedRef.current;
    isSpeakerMutedRef.current = next;
    setIsSpeakerMuted(next);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = next;
    }
    if (next) {
      audioQueueRef.current = [];
      if (activeAudioSourceRef.current) {
        try {
          activeAudioSourceRef.current.stop();
        } catch (err) {}
        activeAudioSourceRef.current = null;
      }
      if (persistentAudioRef.current) {
        try {
          persistentAudioRef.current.pause();
        } catch (err) {}
      }
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      isPlayingAudioRef.current = false;
      ttsActiveUntilRef.current = 0;
    }
  };

  // Bật/tắt Mic
  const toggleMic = () => {
    const nextMuted = !isMicMuted;
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    setIsMicMuted(nextMuted);
    isMicMutedRef.current = nextMuted;

    if (nextMuted) {
      staffTurnEpochRef.current += 1;
      if (staffTurnTimerRef.current) {
        clearTimeout(staffTurnTimerRef.current);
        staffTurnTimerRef.current = null;
      }
      turnStartIndexRef.current = 0;
      turnCarryoverRef.current = '';
      setInterimText('');
      pendingTranscriptRef.current = '';
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

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const micLangBadgeLabel = translateMode === 'bypass'
    ? 'VI'
    : (inputLangMode === 'auto' ? 'AUTO EN/VI' : inputLangMode.toUpperCase());

  return (
    <div
      ref={modalContainerRef}
      onClick={primeAudioContext}
      onTouchStart={primeAudioContext}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#141413]/85 backdrop-blur-sm transition-all duration-300 p-0 lg:p-6"
    >
      {/* Thẻ audio cố định để giải phóng autoplay trên iOS Safari / Chrome */}
      <audio ref={persistentAudioRef} playsInline autoPlay={false} style={{ display: 'none' }} />

      {/* Video Call Modal Window */}
      <div className="relative w-full h-full lg:h-[620px] lg:max-w-4xl bg-[#1A1A1A] rounded-none lg:rounded-3xl overflow-hidden shadow-2xl border-0 lg:border lg:border-stone-800 flex flex-col">
        {/* TOP BAR (GOOGLE MEET MINIMALIST HEADER - LANDSCAPE FRIENDLY) */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 sm:px-5 py-1.5 sm:py-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/75 via-black/30 to-transparent robot-safe-x">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            {roomNumber && (
              <span className="text-[11px] text-white bg-[#141413]/90 border border-white/20 px-2.5 py-0.5 rounded-full font-medium">
                {roomNumber}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {callStatus === 'connected' && (
              <div
                className="flex items-center gap-1 p-0.5 rounded-full bg-[#141413] border border-white/20"
                role="group"
                aria-label="Chọn ngôn ngữ giao tiếp"
              >
                <Languages className="w-3.5 h-3.5 text-stone-300 ml-2 mr-0.5 shrink-0" />
                <button
                  type="button"
                  onClick={() => handleToggleTranslateMode('bypass', 'Tiếng Việt')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide transition-all cursor-pointer ${
                    translateMode === 'bypass'
                      ? 'bg-emerald-500 text-stone-950 shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-[#262523]'
                  }`}
                  title="Tiếng Việt (không dịch)"
                  aria-label="Chọn Tiếng Việt"
                >
                  VI
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleTranslateMode('auto', 'English')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide transition-all cursor-pointer ${
                    translateMode === 'auto'
                      ? 'bg-amber-400 text-stone-950 shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-[#262523]'
                  }`}
                  title="Tiếng Anh (tự động dịch Việt - Anh)"
                  aria-label="Chọn Tiếng Anh"
                >
                  EN
                </button>
              </div>
            )}

            {/* CALL DURATION BADGE */}
            {callStatus === 'connected' && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-mono font-medium bg-[#202124]/90 border border-white/10 text-stone-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span>
                  {role === 'staff'
                    ? `REC ${formatTime(recordingDuration)}`
                    : formatTime(recordingDuration)}
                </span>
              </div>
            )}

            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-full bg-[#141413] hover:bg-[#262523] text-white border border-white/20 flex items-center justify-center transition-colors cursor-pointer"
              title="Toàn màn hình"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />}
            </button>
          </div>
        </div>

        {/* STT Status Warning Notification */}
        {sttStatusMessage && (
          <div className="absolute top-14 left-3 right-3 sm:left-4 sm:right-4 z-25 bg-[#202124]/95 border border-amber-500/50 text-amber-200 text-xs px-3.5 py-2 rounded-2xl flex items-center justify-between shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{sttStatusMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSttStatusMessage('')}
              className="text-amber-400 hover:text-amber-200 ml-2 px-1 text-sm font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* AUTOPLAY RESCUE BUTTON */}
        {isAudioBlocked && (
          <div className="absolute top-14 left-3 right-3 sm:left-auto sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-35 animate-bounce">
            <button
              type="button"
              onClick={() => {
                primeAudioContext();
                setIsAudioBlocked(false);
                processAudioQueue();
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs sm:text-sm shadow-2xl border border-amber-300 cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-stone-950" />
              <span>Nhấn để bật tiếng loa phiên dịch (Autoplay Unlock)</span>
            </button>
          </div>
        )}

        {/* INTERACTIVE LIVE TRANSLATION & TTS TEST BAR */}
        {callStatus === 'connected' && showTestPanel && (
          <div className="absolute top-14 sm:top-16 left-3 right-3 sm:left-6 sm:right-6 z-30 bg-[#202124]/95 backdrop-blur-md border border-white/10 rounded-2xl p-3 sm:p-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Bảng Thử Nghiệm Nhanh Phiên Dịch AI & Giọng Đọc TTS Loa Kiosk</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTestPanel(false)}
                className="text-[11px] text-stone-400 hover:text-stone-200 px-2 py-0.5 rounded-full hover:bg-white/10 cursor-pointer"
              >
                ✕ Đóng
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2.5">
              <button
                type="button"
                disabled={isTestTranslating}
                onClick={() => handleSimulateGuestSpeech("Where is the swimming pool?")}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#3c4043] hover:bg-[#474a4d] text-stone-200 border border-white/10 text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span>Khách: "Where is the swimming pool?"</span>
              </button>

              <button
                type="button"
                disabled={isTestTranslating}
                onClick={() => handleSimulateStaffSpeech("Bể bơi nằm ở tầng 3 thưa quý khách")}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#3c4043] hover:bg-[#474a4d] text-stone-200 border border-white/10 text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span>Staff: "Bể bơi nằm ở tầng 3 thưa quý khách"</span>
              </button>

              <button
                type="button"
                disabled={isTestTranslating}
                onClick={() => handleSimulateGuestSpeech("Cho tôi hỏi nhà hàng mở cửa lúc mấy giờ?")}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#3c4043] hover:bg-[#474a4d] text-stone-200 border border-white/10 text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span>Khách: "Nhà hàng mở cửa lúc mấy giờ?"</span>
              </button>
            </div>

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
                className="flex-1 bg-[#141414] border border-white/15 rounded-full px-4 py-1.5 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                disabled={!testCustomText.trim() || isTestTranslating}
                onClick={() => handleSimulateGuestSpeech(testCustomText.trim())}
                className="px-3.5 py-1.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
              >
                <span>Khách nói</span>
              </button>
              <button
                type="button"
                disabled={!testCustomText.trim() || isTestTranslating}
                onClick={() => handleSimulateStaffSpeech(testCustomText.trim())}
                className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
              >
                <span>Staff nói</span>
              </button>
            </div>
          </div>
        )}

        {/* MAIN VIDEO SCREEN */}
        <div className="relative flex-1 bg-[#121212] flex items-center justify-center overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            webkit-playsinline="true"
            muted={isSpeakerMuted}
            onLoadedData={markRemoteWebRtcReadyIfConnected}
            onPlaying={markRemoteWebRtcReadyIfConnected}
            className={`w-full h-full object-cover transition-opacity duration-500 ${
              callStatus === 'connected' && (hasRemoteVideoFrame || !remoteFallbackFrame) ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {callStatus === 'connected' && !hasRemoteVideoFrame && remoteFallbackFrame && (
            <img
              src={remoteFallbackFrame}
              alt="Remote video"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {callStatus !== 'connected' && callStatus !== 'ended' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 text-center z-10 bg-[#121212]/95">
              <div className="relative mb-3 sm:mb-5">
                <div className="w-12 h-12 rounded-full border-3 border-stone-700 border-t-emerald-400 animate-spin" />
              </div>

              <h2 className="text-white text-sm sm:text-base font-medium">
                Đang kết nối với nhân viên...
              </h2>

              {errorMessage && (
                <div className="mt-3 flex items-center gap-2 text-xs text-rose-300 bg-rose-950/70 border border-rose-500/50 px-3.5 py-2 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {callStatus === 'ended' && (
            <div className="absolute inset-0 z-30 bg-[#121212]/95 flex flex-col items-center justify-center p-4 sm:p-6 text-center animate-fadeIn">
              <div className="w-12 h-12 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-300 mb-3 shadow-lg">
                <PhoneOff className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-white text-sm sm:text-base font-semibold">Cuộc gọi đã kết thúc</h3>
            </div>
          )}

          {/* FLOATING LIVE CAPTIONS FEED (TRANSPARENT OVERLAY FOR LANDSCAPE & DESKTOP) */}
          {(callTranscripts.length > 0 || activeSubtitle || peerInterim || (interimText && translateMode !== 'bypass')) && (
            <div className="absolute bottom-16 sm:bottom-20 left-3 right-32 sm:left-6 sm:right-44 lg:right-52 z-25 flex justify-start pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="bg-transparent max-w-xl w-full text-left space-y-1.5 [text-shadow:0_2px_6px_rgba(0,0,0,0.95)]">
                {callTranscripts
                  .filter((item) => (role === 'staff' ? item.speaker === 'Guest' : item.speaker === 'Staff'))
                  .slice(-2)
                  .map((item, idx, arr) => {
                  const isStaffSpeaker = item.speaker === 'Staff';
                  const isLatest = idx === arr.length - 1 && !peerInterim;
                  return (
                    <div
                      key={`${item.timestamp}-${idx}`}
                      className={`border-l-2 pl-2.5 transition-opacity ${
                        isStaffSpeaker ? 'border-emerald-400' : 'border-amber-400'
                      } ${isLatest ? 'opacity-100' : 'opacity-80'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${
                          isStaffSpeaker ? 'text-emerald-300' : 'text-amber-300'
                        }`}>
                          {isStaffSpeaker
                            ? (role === 'guest' && translateMode === 'auto' ? 'Support Staff' : calleeName)
                            : callerName}
                        </span>
                        {item.needs_translation && (
                          <span className="text-[9px] text-stone-200/90">
                            {(item.source_lang || 'en').toUpperCase()} ➔ {(item.target_lang || 'vi').toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className={`text-white font-bold leading-snug ${isLatest ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>
                        {item.translated_text || item.raw_transcript}
                      </p>
                      {item.needs_translation && item.raw_transcript !== item.translated_text && (
                        <p className="text-stone-200/85 text-[11px] italic leading-tight">
                          "{item.raw_transcript}"
                        </p>
                      )}
                    </div>
                  );
                })}

                {peerInterim && (
                  <div className="border-l-2 border-sky-400 pl-2.5 opacity-95">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-sky-300">
                      {peerInterim.senderRole === 'staff'
                        ? (role === 'guest' && translateMode === 'auto' ? 'Support Staff' : calleeName)
                        : callerName}{' '}
                      {role === 'guest' && translateMode === 'auto' ? '(speaking...)' : '(đang nói...)'}
                    </span>
                    <p className="text-white text-xs sm:text-sm italic">
                      "{peerInterim.text}..."
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PICTURE-IN-PICTURE: LOCAL SELF VIDEO (LANDSCAPE-OPTIMIZED) */}
          <div className="absolute bottom-16 sm:bottom-20 right-3 sm:right-4 w-28 h-20 sm:w-36 sm:h-24 lg:w-44 lg:h-32 rounded-2xl overflow-hidden bg-[#141413] border border-white/20 shadow-2xl z-20 transition-all">
            {hasNoCamera ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#202124] to-[#141414] p-2 text-center select-none">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#3c4043] flex items-center justify-center mb-1.5 shadow-inner">
                  <Mic className={`w-5 h-5 ${isMicMuted ? 'text-red-400' : 'text-emerald-400 animate-pulse'}`} />
                </div>
                <span className="text-[10px] sm:text-[11px] font-semibold text-white">
                  {role === 'guest' ? 'Robot Kiosk' : 'Nhân viên'}
                </span>
                <span className="text-[9px] text-stone-400 leading-tight">
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
                  <div className="w-full h-full flex items-center justify-center bg-[#141413]">
                    <VideoOff className="w-5 h-5 text-white" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* BOTTOM ACTION CONTROLS BAR (AURORA BLACK/WHITE DOCK - LANDSCAPE COMPACT) */}
        <div className="p-2 sm:p-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/80 via-black/35 to-transparent flex items-center justify-center z-30 shrink-0 robot-safe-x">
          <div className="flex items-center gap-2 sm:gap-2.5 bg-[#141413]/90 backdrop-blur-md px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white/20 shadow-2xl">
            {/* 1. MUTE MIC BUTTON */}
            <button
              type="button"
              onClick={toggleMic}
              title={isMicMuted ? 'Bật mic' : 'Tắt mic'}
              aria-label={isMicMuted ? 'Bật micro' : 'Tắt micro'}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 border ${
                isMicMuted
                  ? 'bg-[#141413] border-red-500 text-red-400'
                  : 'bg-[#141413] hover:bg-[#262523] border-white/25 text-white'
              }`}
            >
              {isMicMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
            </button>

            {/* 2. CAMERA TOGGLE (STAFF ONLY) */}
            {role === 'staff' && (
              <button
                type="button"
                onClick={toggleVideo}
                title={isVideoDisabled ? 'Bật máy ảnh' : 'Tắt máy ảnh'}
                aria-label={isVideoDisabled ? 'Bật camera' : 'Tắt camera'}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 border ${
                  isVideoDisabled
                    ? 'bg-[#141413] border-red-500 text-red-400'
                    : 'bg-[#141413] hover:bg-[#262523] border-white/25 text-white'
                }`}
              >
                {isVideoDisabled ? <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Video className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
              </button>
            )}

            {/* 3. SPEAKER / AUDIO TOGGLE */}
            <button
              type="button"
              onClick={toggleSpeaker}
              title={isSpeakerMuted ? 'Bật loa' : 'Tắt loa'}
              aria-label={isSpeakerMuted ? 'Bật loa' : 'Tắt loa'}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 border ${
                isSpeakerMuted
                  ? 'bg-[#141413] border-red-500 text-red-400'
                  : 'bg-[#141413] hover:bg-[#262523] border-white/25 text-white'
              }`}
            >
              {isSpeakerMuted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
            </button>

            {/* DIVIDER */}
            <div className="w-px h-5 bg-white/20 mx-0.5 hidden sm:block" />

            {/* 4. END CALL BUTTON (ICON ONLY) */}
            <button
              type="button"
              onClick={() => handleEndCall(true)}
              title="Rời khỏi cuộc gọi"
              aria-label="Rời khỏi cuộc gọi"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-all cursor-pointer active:scale-95"
            >
              <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
