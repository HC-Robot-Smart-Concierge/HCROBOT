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
} from './videoCallTranslationHelpers';

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
  const [uploadStatus, setUploadStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasNoCamera, setHasNoCamera] = useState(false);

  // Live Subtitle & Auto-Translation State (EN ⇄ VI)
  // Mode: 'auto' (Tự động dịch thông minh 2 chiều) | 'bypass' (Thuần Việt - Không dịch)
  const [translateMode, setTranslateMode] = useState('auto');
  // Chế độ nhận diện ngôn ngữ đầu vào của Micro: 'auto' (Đa ngữ EN/VI theo âm thanh) | 'en' | 'vi'
  const [inputLangMode, setInputLangMode] = useState('auto');
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

  // Speech Recognition, Audio Stream STT Adapter & Subtitle Refs
  const speechRecognitionRef = useRef(null);
  const audioSttAdapterRef = useRef(null);
  const lastAudioVadSpeechAtRef = useRef(0);
  const pendingWebSpeechFallbackTimerRef = useRef(null);
  const subtitleTimeoutRef = useRef(null);
  const callTranscriptsRef = useRef([]);
  const isMicMutedRef = useRef(false);
  const checkPeerIntervalRef = useRef(null);
  const serverLanIpRef = useRef(null);
  const interpreterAudioRef = useRef(null);
  const playInterpreterAudioRef = useRef(null);
  const activeGuestLanguageRef = useRef('English');
  const translateModeRef = useRef('auto');
  const inputLangModeRef = useRef('auto');

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

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn('[VideoCall] Lỗi khởi tạo MediaRecorder (bỏ qua ghi hình):', err);
    }
  };

  // 4. Dừng ghi hình và tự động lưu trong nền
  const stopRecordingAndUpload = async () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    if (recordedChunksRef.current.length > 0) {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const durationSec = recordingDuration;
      const startedAt = callStartTimeRef.current;
      const endedAt = new Date().toISOString();

      uploadCallRecording(sessionId, blob, durationSec, startedAt, endedAt, callTranscriptsRef.current)
        .then((uploadRes) => {
          onCallEnded(uploadRes);
        })
        .catch((upErr) => {
          console.warn('[VideoCall] Background upload notice:', upErr);
        });
    }
  };

  // Khởi tạo AudioContext cho Web Audio API
  const getOrCreateAudioContext = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
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
    if (persistentAudioRef.current) {
      try {
        persistentAudioRef.current.play().then(() => {
          persistentAudioRef.current.pause();
          setIsAudioBlocked(false);
        }).catch(() => {});
      } catch (e) {}
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = isSpeakerMuted;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [getOrCreateAudioContext, isSpeakerMuted]);

  // Hàng đợi phát âm thanh thông dịch AI tuần tự cho cả hai bên (Robot Kiosk & Staff)
  // Bảo vệ chống treo cờ isPlayingAudioRef / isAiSpeakingRef khi AudioContext.resume() bị treo hoặc lỗi
  const processAudioQueue = useCallback(async () => {
    if (isPlayingAudioRef.current) return;
    if (audioQueueRef.current.length === 0) return;
    if (isEndingRef.current || callStatusRef.current !== 'connected') {
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
        remoteVideoRef.current.volume = previousWebRtcVolumeRef.current;
      }

      const wasSpeaking = isAiSpeakingRef.current;
      isAiSpeakingRef.current = false;
      setIsAiSpeaking(false);
      // Nếu phát âm thanh thực sự diễn ra, đặt đuôi âm học ngắn 280ms; nếu bị chặn/lỗi thì mở khóa ngay (0ms)
      ttsActiveUntilRef.current = wasSpeaking && endReason === 'PLAY_ENDED' ? Date.now() + 280 : 0;
      activeAudioSourceRef.current = null;
      isPlayingAudioRef.current = false;

      console.log(
        `[VideoCall Flow] [${role}] utteranceId=${currentItem.utteranceId || 'unknown'} seq=${currentItem.seq || 0} step=${endReason} restoredVolume=${previousWebRtcVolumeRef.current}`
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
        previousWebRtcVolumeRef.current = remoteVideoRef.current.volume || 1.0;
        remoteVideoRef.current.volume = 0.15;
      }

      if (playbackWatchdogRef.current) {
        clearTimeout(playbackWatchdogRef.current);
      }
      playbackWatchdogRef.current = setTimeout(() => {
        handleAudioFinished('PLAY_WATCHDOG_TIMEOUT');
      }, boundedMs + 900);

      console.log(
        `[VideoCall Flow] [${role}] utteranceId=${currentItem.utteranceId || 'unknown'} seq=${currentItem.seq || 0} step=PLAY_STARTED engine=${engine} ducking=0.15 len=${(currentItem.spokenText || '').length}`
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

    setIsAudioBlocked(true);
    handleAudioFinished(TTS_ERROR_CODES.PLAYBACK_BLOCKED);
  }, [getOrCreateAudioContext, role]);

  const enqueueInterpreterAudio = useCallback((item) => {
    if (!item?.audioBase64 || isSpeakerMuted) return;

    if (item.utteranceId && playedUtteranceIdsRef.current.has(item.utteranceId)) {
      console.log(`[VideoCall Queue] Skip already played utteranceId=${item.utteranceId}`);
      return;
    }

    if (item.timestamp && Date.now() - item.timestamp > 15000) {
      console.warn(`[VideoCall Queue] Skip stale audio (>15s) utteranceId=${item.utteranceId || item.seq}`);
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
  }, [isSpeakerMuted, processAudioQueue, role]);

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

        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }

        event.track.enabled = true;

        if (!remoteStreamRef.current.getTracks().some((t) => t.id === event.track.id)) {
          remoteStreamRef.current.addTrack(event.track);
        }

        event.track.onunmute = () => {
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
              if (e.name !== 'AbortError' && e.name === 'NotAllowedError' && remoteVideoRef.current) {
                remoteVideoRef.current.muted = true;
                remoteVideoRef.current.play().catch(() => {});
              }
            });
          }
        }
        setCallStatus('connected');
        if (!mediaRecorderRef.current && remoteStreamRef.current) {
          startRecording(remoteStreamRef.current);
        }
      };

      pc.onconnectionstatechange = async () => {
        console.log('[VideoCall] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setCallStatus('connected');
          if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(() => {});
          }
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
          if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(() => {});
          }
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
            const lanIp = serverLanIpRef.current;
            if (candStr && candStr.includes('.local') && lanIp && lanIp !== '127.0.0.1') {
              const unmDnsStr = candStr.replace(/[a-zA-Z0-9_\-]+\.local/g, lanIp);
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
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'translate_mode_sync',
            mode: translateModeRef.current,
            manualLocked: isManualLockedRef.current,
          }));
        }
      };

      ws.onmessage = async (evt) => {
        try {
          const data = JSON.parse(evt.data);

          if (data.type === 'server_info' && data.lan_ip) {
            serverLanIpRef.current = data.lan_ip;
          } else if (data.type === 'peer_joined') {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'translate_mode_sync',
                mode: translateModeRef.current,
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
          } else if (data.type === 'call_end' || data.type === 'peer_disconnected') {
            handleEndCall(false);
          } else if (data.type === 'live_subtitle') {
            if (data.senderRole !== role) {
              console.log(
                `[VideoCall Flow] [${data.senderRole} -> ${role}] utteranceId=${data.utteranceId || 'unknown'} seq=${data.seq || 0} mode=${translateModeRef.current} step=SUBTITLE_RECEIVED src=${data.sourceLang || 'auto'} tgt=${data.targetLang || 'auto'} needsTrans=${data.needsTranslation}`
              );
              // Nếu câu này không cần dịch (sourceLang === targetLang), tiến ngay expectedPlaySeqRef để không chờ live_audio
              if (!data.needsTranslation && typeof data.seq === 'number' && data.seq > 0) {
                expectedPlaySeqRef.current = advanceExpectedSeqOnFailure(
                  expectedPlaySeqRef.current,
                  data.seq,
                  failedSeqsRef.current
                );
              }

              // Hiển thị phụ đề cho người nhận (kể cả khi giữ nguyên câu gốc cùng ngôn ngữ khi đang ở chế độ dịch)
              if (data.needsTranslation || translateModeRef.current !== 'bypass') {
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

              if (data.needsTranslation && data.audioBase64 && playInterpreterAudioRef.current) {
                playInterpreterAudioRef.current(data.audioBase64, data.translatedText, {
                  utteranceId: data.utteranceId,
                  seq: data.seq,
                  timestamp: data.timestamp,
                });
              }
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
          } else if (data.type === 'translate_mode_change' || data.type === 'translate_mode_sync') {
            if (data.mode) {
              setTranslateMode(data.mode);
              translateModeRef.current = data.mode;
            }
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
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (sttSilenceTimerRef.current) {
      clearTimeout(sttSilenceTimerRef.current);
      sttSilenceTimerRef.current = null;
    }

    if (playbackWatchdogRef.current) {
      clearTimeout(playbackWatchdogRef.current);
      playbackWatchdogRef.current = null;
    }

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
      const ctx = new AudioCtx({ sampleRate: 16000 });
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
        preRollChunk: null,
        silenceFrames: 0,
        speechFrames: 0,
        inflight: false,
      };
      audioSttAdapterRef.current = state;

      const SPEECH_RMS_THRESHOLD = 0.013;
      const SILENCE_RMS_THRESHOLD = 0.009;
      // 1 frame = 4096 / 16000 = ~256ms. 3 frames silence = ~768ms; 28 frames max = ~7.1s
      const SILENCE_FRAMES_TO_FLUSH = 3;
      const MIN_SPEECH_FRAMES = 2;
      const MAX_SPEECH_FRAMES = 28;

      const flushAudioSegment = async (chunksToFlush) => {
        if (!chunksToFlush || chunksToFlush.length < MIN_SPEECH_FRAMES || state.stopped) return;
        const wavBlob = encodeWavBlobFromFloat32(chunksToFlush, ctx.sampleRate || 16000);
        if (!wavBlob || wavBlob.size < 2500) return;

        const curInputMode = translateModeRef.current === 'bypass' ? 'vi' : inputLangModeRef.current;
        const preferredLang = role === 'staff' ? 'vi' : 'en';

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
        if (state.stopped || isEndingRef.current || isMicMutedRef.current || callStatusRef.current !== 'connected') {
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
            state.speechChunks = state.preRollChunk ? [state.preRollChunk] : [];
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
          state.preRollChunk = frameCopy;
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      console.log(`[VideoCall Flow] [${role}] step=STT_STARTED engine=audio_stream_adapter inputMode=${inputLangModeRef.current}`);
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
      if (translateMode === 'bypass' || inputLangMode === 'vi') {
        listenLang = 'vi-VN';
      } else if (inputLangMode === 'en') {
        listenLang = 'en-US';
      } else {
        listenLang = role === 'staff' ? 'vi-VN' : 'en-US';
      }
      recognition.lang = listenLang;

      recognition.onstart = () => {
        console.log(
          `[VideoCall Flow] [${role}] step=STT_STARTED engine=web_speech lang=${listenLang} inputMode=${inputLangMode} mode=${translateMode}`
        );
        setSttStatusMessage('');
      };

      const dispatchWebSpeechTranscript = (transcriptText) => {
        const clean = (transcriptText || '').trim();
        if (!clean) return;
        const fixedHint = listenLang.startsWith('vi') ? 'vi' : 'en';

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
        if (!candidate) return;

        // Kiểm tra nếu đang bị chặn bởi loa AI đang phát thì ghi log tường minh thay vì return im lặng
        if (isAiSpeakingRef.current) {
          console.log(`[VideoCall Flow] [${role}] step=STT_SKIPPED reason=ECHO_AI_SPEAKING engine=web_speech len=${candidate.length}`);
          return;
        }

        pendingTranscriptRef.current = candidate;
        setInterimText(candidate);
        console.log(
          `[VideoCall Flow] [${role}] step=STT_RESULT engine=web_speech final=${Boolean(finalChunk)} len=${candidate.length}`
        );

        if (finalChunk.trim()) {
          if (sttSilenceTimerRef.current) {
            clearTimeout(sttSilenceTimerRef.current);
            sttSilenceTimerRef.current = null;
          }
          dispatchWebSpeechTranscript(finalChunk.trim());
          return;
        }

        if (sttSilenceTimerRef.current) {
          clearTimeout(sttSilenceTimerRef.current);
        }
        sttSilenceTimerRef.current = setTimeout(() => {
          sttSilenceTimerRef.current = null;
          if (pendingTranscriptRef.current && pendingTranscriptRef.current.trim().length > 1) {
            dispatchWebSpeechTranscript(pendingTranscriptRef.current);
          }
        }, 850);
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

        if (pendingTranscriptRef.current && pendingTranscriptRef.current.trim().length > 1) {
          dispatchWebSpeechTranscript(pendingTranscriptRef.current);
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
      const targetConfig = resolveTranslationTarget(role, curMode);
      const { peerRole, targetLang, ttsLangCode, ttsVoice, isBypassMode } = targetConfig;

      // 1. CHẾ ĐỘ THUẦN VIỆT (BYPASS DO NGƯỜI DÙNG CHỌN): Không dịch, không phát TTS
      if (isBypassMode) {
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

      // 2. XÁC ĐỊNH NGÔN NGỮ NGUỒN CỦA CÂU NÓI (THEO TỪNG CÂU, KHÔNG KHÓA CỨNG THEO VAI TRÒ)
      const hintLang = meta.detectedLang && meta.detectedLang !== 'auto'
        ? meta.detectedLang
        : (inputLangModeRef.current !== 'auto' ? inputLangModeRef.current : 'auto');

      const utteranceId = `utt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const seqRef = role === 'staff' ? staffTtsSeqRef : guestTtsSeqRef;
      const currentSeq = ++seqRef.current;

      console.log(
        `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} mode=${curMode} step=TRANSLATE_REQUEST srcHint=${hintLang} tgt=${targetLang} len=${cleanText.length}`
      );

      const res = await quickTranslateText({
        text: cleanText,
        sourceLang: hintLang,
        targetLang,
        sessionId,
        senderRole: role,
        withAudio: false,
      });

      const resolvedSourceLang = res.source_lang || (hintLang !== 'auto' ? hintLang : (role === 'staff' ? 'vi' : 'en'));
      const needsTranslation = Boolean(res.needs_translation) && resolvedSourceLang !== targetLang;
      const finalTranslatedText = needsTranslation ? (res.translated_text || cleanText) : cleanText;

      console.log(
        `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} mode=${curMode} step=TRANSLATED src=${resolvedSourceLang} tgt=${targetLang} needsTrans=${needsTranslation}`
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
        targetLang,
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

      // 3. Nếu câu nói đã cùng ngôn ngữ với đích nhận (vd: Khách nói tiếng Việt gửi cho Staff target='vi',
      // hoặc Staff nói tiếng Anh gửi cho Khách target='en'):
      // Giữ nguyên câu gốc, KHÔNG dịch vòng, KHÔNG gọi TTS thừa, và KHÔNG tự chuyển mode sang Thuần Việt!
      if (!needsTranslation || !finalTranslatedText.trim()) {
        return;
      }

      // 4. Tổng hợp giọng đọc TTS cho bản dịch (có 1 lần retry nhanh nếu timeout/provider lỗi tạm thời)
      const currentEpoch = callEpochRef.current;
      setTtsStatus({ utteranceId, status: 'generating', message: 'Đang tạo âm thanh bản dịch...' });

      console.log(
        `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} step=TTS_REQUEST lang=${ttsLangCode} voice=${ttsVoice} len=${finalTranslatedText.length}`
      );

      const requestTtsWithRetry = async () => {
        const firstAttempt = await synthesizeSpeech(finalTranslatedText, {
          language: ttsLangCode,
          voice: ttsVoice,
          timeoutMs: 6500,
        });
        if (firstAttempt?.audio_base64) {
          return firstAttempt;
        }
        const retryableCodes = [TTS_ERROR_CODES.TTS_TIMEOUT, TTS_ERROR_CODES.TTS_PROVIDER_ERROR];
        if (retryableCodes.includes(firstAttempt?.error_code)) {
          console.log(
            `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} step=TTS_RETRY reason=${firstAttempt.error_code}`
          );
          return await synthesizeSpeech(finalTranslatedText, {
            language: ttsLangCode,
            voice: ttsVoice,
            timeoutMs: 4500,
          });
        }
        return firstAttempt;
      };

      requestTtsWithRetry()
        .then((audioData) => {
          if (
            isEndingRef.current ||
            callStatusRef.current !== 'connected' ||
            translateModeRef.current === 'bypass' ||
            currentEpoch !== callEpochRef.current
          ) {
            return;
          }
          if (audioData?.audio_base64 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            setTtsStatus(null);
            console.log(
              `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} step=TTS_READY provider=${audioData.provider_used || 'edge'} bytes=${audioData.audio_base64.length}`
            );
            wsRef.current.send(JSON.stringify({
              type: 'live_audio',
              callId: sessionId,
              utteranceId,
              seq: currentSeq,
              senderRole: role,
              audioBase64: audioData.audio_base64,
              translatedText: finalTranslatedText,
              targetLang,
              timestamp: Date.now(),
            }));
            console.log(
              `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} step=TTS_SENT bytes=${audioData.audio_base64.length}`
            );
          } else {
            const errCode = audioData?.error_code || TTS_ERROR_CODES.TTS_AUDIO_EMPTY;
            const errDetail = audioData?.error_detail || audioData?.error || 'TTS returned empty audio';
            console.warn(
              `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} step=TTS_EMPTY code=${errCode} detail="${errDetail}"`
            );
            setTtsStatus({
              utteranceId,
              status: 'failed',
              code: errCode,
              message: `Không thể tạo âm thanh (${errCode})`,
            });
            setTimeout(() => setTtsStatus(null), 3500);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'live_audio_status',
                callId: sessionId,
                utteranceId,
                seq: currentSeq,
                senderRole: role,
                status: 'failed',
                errorCode: errCode,
                error: errDetail,
                timestamp: Date.now(),
              }));
            }
          }
        })
        .catch((err) => {
          const errCode = TTS_ERROR_CODES.TTS_PROVIDER_ERROR;
          const errDetail = err?.message || String(err);
          console.warn(
            `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} step=TTS_EMPTY code=${errCode} detail="${errDetail}"`
          );
          setTtsStatus({
            utteranceId,
            status: 'failed',
            code: errCode,
            message: `Lỗi tạo âm thanh (${errCode})`,
          });
          setTimeout(() => setTtsStatus(null), 3500);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'live_audio_status',
              callId: sessionId,
              utteranceId,
              seq: currentSeq,
              senderRole: role,
              status: 'failed',
              errorCode: errCode,
              error: errDetail,
              timestamp: Date.now(),
            }));
          }
        });
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

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    stopRecordingAndUpload();

    setTimeout(() => {
      cleanUpResources();
      onClose();
    }, 1200);
  };

  // Bật/tắt Loa
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
      stopCallAudioSttAdapter();
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current._isManualStop = true;
          speechRecognitionRef.current.abort();
        } catch (e) {}
      }
      setInterimText('');
      pendingTranscriptRef.current = '';
    } else if (callStatus === 'connected') {
      startCallAudioSttAdapter();
      startSpeechRecognition();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-xs transition-all duration-300 p-0 lg:p-6"
    >
      {/* Thẻ audio cố định để giải phóng autoplay trên iOS Safari / Chrome */}
      <audio ref={persistentAudioRef} playsInline autoPlay={false} style={{ display: 'none' }} />

      {/* Video Call Modal Window */}
      <div className="relative w-full h-full lg:h-[620px] lg:max-w-4xl bg-[#1E1E1E] rounded-none lg:rounded-2xl overflow-hidden shadow-2xl border-0 lg:border lg:border-stone-700/80 flex flex-col">
        {/* TOP BAR */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 lg:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] bg-gradient-to-b from-stone-900/95 via-stone-900/60 to-transparent robot-safe-x">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="text-stone-200 text-xs sm:text-sm font-semibold tracking-wide truncate max-w-[110px] sm:max-w-[160px] md:max-w-xs">
              {role === 'guest' ? (calleeName || 'Nhân viên hỗ trợ') : (callerName || 'Khách hàng')}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {callStatus === 'connected' && (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <div className="flex items-center bg-stone-900/90 p-0.5 rounded-lg border border-stone-700/80 shadow-inner">
                  {/* 1. NÚT THÔNG DỊCH AI (EN ⇄ VI) */}
                  <button
                    type="button"
                    onClick={() => handleToggleTranslateMode('auto')}
                    className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
                      translateMode === 'auto'
                        ? 'bg-amber-500/30 text-amber-300 border border-amber-500/60 shadow-sm'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                    }`}
                    title="Bật chế độ Thông dịch AI: Khách nói tiếng Anh ➔ Dịch tiếng Việt (phát âm Hoài My); Nhân viên nói tiếng Việt ➔ Dịch tiếng Anh (phát âm Jenny); Tự động giữ nguyên nếu cùng ngôn ngữ"
                  >
                    <Languages className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
                    <span>EN ⇄ VI</span>
                  </button>

                  {/* 2. NÚT THUẦN VIỆT (KHÔNG DỊCH) */}
                  <button
                    type="button"
                    onClick={() => handleToggleTranslateMode('bypass')}
                    className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${
                      translateMode === 'bypass'
                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 shadow-sm'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                    }`}
                    title="Bật chế độ Thuần Việt: Cả 2 bên nói tiếng Việt trực tiếp, không dịch, không phát âm AI"
                  >
                    <span>Thuần Việt</span>
                  </button>

                  {/* 3. NÚT CHỌN NGÔN NGỮ ĐẦU VÀO MICRO (AUTO EN/VI | EN | VI) */}
                  {translateMode === 'auto' && (
                    <button
                      type="button"
                      onClick={cycleInputLangMode}
                      className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold text-sky-300 hover:bg-stone-800 transition-all cursor-pointer"
                      title="Chuyển chế độ nhận diện ngôn ngữ đầu vào của Micro: Đa ngữ tự động (AUTO EN/VI) / Cố định EN / Cố định VI"
                    >
                      <span>Nghe: {inputLangMode === 'auto' ? 'Đa ngữ' : inputLangMode.toUpperCase()}</span>
                    </button>
                  )}

                  {/* 4. NÚT TEST NHANH GIỌNG ĐỌC AI & PHỤ ĐỀ */}
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

                {ttsStatus?.status === 'generating' && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-950/80 px-1.5 sm:px-2 py-1 rounded-md border border-amber-500/50 animate-pulse font-medium">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                    <span className="hidden sm:inline">Đang tạo giọng...</span>
                  </span>
                )}

                {ttsStatus?.status === 'failed' && (
                  <span
                    className="flex items-center gap-1 text-[10px] text-rose-300 bg-rose-950/80 px-1.5 sm:px-2 py-1 rounded-md border border-rose-500/50 font-medium"
                    title={ttsStatus.message}
                  >
                    <AlertCircle className="w-3 h-3 text-rose-400" />
                    <span className="hidden sm:inline">{ttsStatus.code || 'Lỗi TTS'}</span>
                  </span>
                )}
              </div>
            )}

            {/* LIVE STT LISTENING BADGE / 1-CLICK TOGGLE MIC */}
            {callStatus === 'connected' && (
              <button
                type="button"
                onClick={toggleMic}
                className={`flex items-center gap-1 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-mono font-medium border cursor-pointer transition-all active:scale-95 ${
                  isMicMuted
                    ? 'bg-red-950/80 text-red-300 border-red-500/70 shadow-sm animate-pulse'
                    : 'bg-stone-800 hover:bg-stone-700/80 border-stone-700 text-stone-300'
                }`}
                title={
                  isMicMuted
                    ? 'Micro đang TẮT - Nhấn để BẬT lại micro'
                    : `Micro đang BẬT (${micLangBadgeLabel}) - Nhấn để TẮT tạm thời`
                }
              >
                {isMicMuted ? (
                  <>
                    <MicOff className="w-2.5 h-2.5 text-red-400" />
                    <span className="font-bold text-red-300">Mic: TẮT</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                    <span className="hidden sm:inline">Mic:</span>
                    <span className="text-emerald-300 font-semibold">
                      {micLangBadgeLabel}
                    </span>
                  </>
                )}
              </button>
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
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs sm:text-sm shadow-2xl border border-amber-300 cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-stone-950" />
              <span>Nhấn để bật tiếng loa phiên dịch (Autoplay Unlock)</span>
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

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
              <button
                type="button"
                disabled={isTestTranslating}
                onClick={() => handleSimulateGuestSpeech("Where is the swimming pool?")}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span>🇺🇸 Khách: "Where is the swimming pool?"</span>
              </button>

              <button
                type="button"
                disabled={isTestTranslating}
                onClick={() => handleSimulateStaffSpeech("Bể bơi nằm ở tầng 3 thưa quý khách")}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span>🇻🇳 Staff: "Bể bơi nằm ở tầng 3 thưa quý khách"</span>
              </button>

              <button
                type="button"
                disabled={isTestTranslating}
                onClick={() => handleSimulateGuestSpeech("Cho tôi hỏi nhà hàng mở cửa lúc mấy giờ?")}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 text-[11px] font-medium transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <span>🇻🇳 Khách: "Nhà hàng mở cửa lúc mấy giờ?"</span>
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
                className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                disabled={!testCustomText.trim() || isTestTranslating}
                onClick={() => handleSimulateGuestSpeech(testCustomText.trim())}
                className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
              >
                <span>Khách nói</span>
              </button>
              <button
                type="button"
                disabled={!testCustomText.trim() || isTestTranslating}
                onClick={() => handleSimulateStaffSpeech(testCustomText.trim())}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
              >
                <span>Staff nói</span>
              </button>
            </div>
          </div>
        )}

        {/* MAIN VIDEO SCREEN */}
        <div className="relative flex-1 bg-[#181818] flex items-center justify-center overflow-hidden">
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

          {callStatus === 'ended' && (
            <div className="absolute inset-0 z-30 bg-[#181818]/95 flex flex-col items-center justify-center p-4 sm:p-6 text-center animate-fadeIn">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-300 mb-2.5 shadow-lg">
                <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-stone-100 text-xs sm:text-sm font-semibold">Cuộc gọi đã kết thúc</h3>
            </div>
          )}

          {/* FLOATING CINEMA SUBTITLE BAR */}
          {(activeSubtitle || (interimText && translateMode !== 'bypass')) && (
            <div className="absolute bottom-4 sm:bottom-6 lg:bottom-8 left-3 right-3 sm:left-6 sm:right-6 z-25 flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-[#141414]/90 backdrop-blur-md border border-stone-700/80 rounded-2xl px-4 py-2 sm:px-6 sm:py-3 max-w-2xl text-center shadow-2xl space-y-1 pointer-events-auto">
                {interimText && !activeSubtitle && (
                  <p className="text-stone-300 text-xs sm:text-sm italic font-mono animate-pulse">
                    "{interimText}..."
                  </p>
                )}

                {activeSubtitle && (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-0.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                        {activeSubtitle.senderRole === role
                          ? 'Bạn'
                          : (activeSubtitle.senderRole === 'staff' ? calleeName : callerName)}
                      </span>
                      <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-1">
                        <Languages className="w-3 h-3" />
                        <span>
                          {activeSubtitle.needsTranslation
                            ? `${(activeSubtitle.sourceLang || 'en').toUpperCase()} ➔ ${(activeSubtitle.targetLang || 'vi').toUpperCase()}`
                            : `${(activeSubtitle.sourceLang || 'vi').toUpperCase()} (Gốc)`}
                        </span>
                      </span>
                      {activeSubtitle.needsTranslation && (
                        <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                          <Volume2 className={`w-2.5 h-2.5 ${isAiSpeaking ? 'animate-bounce text-emerald-300' : ''}`} />
                          <span>AI Voice</span>
                        </span>
                      )}
                    </div>

                    {activeSubtitle.needsTranslation && activeSubtitle.originalText !== activeSubtitle.translatedText && (
                      <p className="text-stone-400 text-[11px] sm:text-xs italic leading-tight">
                        "{activeSubtitle.originalText}"
                      </p>
                    )}

                    <p className="text-stone-100 text-xs sm:text-sm md:text-base font-semibold leading-relaxed tracking-wide">
                      {activeSubtitle.translatedText || activeSubtitle.originalText}
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
          {/* MUTE MIC BUTTON */}
          <button
            type="button"
            onClick={toggleMic}
            className="flex flex-col items-center gap-1 focus:outline-none cursor-pointer group min-w-[44px] min-h-[44px]"
          >
            <div
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all ${
                isMicMuted
                  ? 'bg-red-950/80 text-red-400 border border-red-500/70 shadow-lg animate-pulse'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
              }`}
            >
              {isMicMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4" />}
            </div>
            <span className={`text-[10px] font-medium ${isMicMuted ? 'text-red-400 font-bold' : 'text-stone-400'}`}>
              {isMicMuted ? 'Bật Mic' : 'Tắt Mic'}
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

          {/* STAFF ONLY CONTROLS */}
          {role === 'staff' && (
            <>
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
