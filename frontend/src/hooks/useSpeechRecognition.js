import { useState, useEffect, useRef, useCallback } from 'react';
import {
  normalizeHotelSpeechTranscript,
  buildSemanticSilenceDebounce,
  runBackendSTT,
  initializeHardwareMicAnalyser,
  teardownHardwareAudioAnalyser,
} from './speechRecognitionAudioUtils';

// ============================================================
// Timing Configuration: Thoi gian cho im lang (Silence / Pause Duration)
// ============================================================
export const SPEECH_FINAL_SILENCE_MS = 1800; // Khi trinh duyet bao isFinal: van cho 1.8s xem khach co noi tiep ve sau khong
export const INTERIM_FINALIZE_DEBOUNCE_MS = 2200; // Khi chi co interim transcript (iOS/Safari): cho 2.2s im lang
export const HARDWARE_VAD_SILENCE_MS = 2000; // Khi thu am truc tiep qua Micro (VAD/Whisper): cho 2.0s im lang
export const EXTENDED_INCOMPLETE_SILENCE_MS = 2800; // Khi cau con do dang / tu noi / ngap ngung: cho 2.8s de lay hoi suy nghi

export { normalizeHotelSpeechTranscript };

export const getSemanticSilenceDebounce = buildSemanticSilenceDebounce(
  SPEECH_FINAL_SILENCE_MS,
  INTERIM_FINALIZE_DEBOUNCE_MS,
  EXTENDED_INCOMPLETE_SILENCE_MS
);

// ============================================================
// Main Hook: useSpeechRecognition (Dual-Engine: Browser + Backend STT)
// ============================================================
export const useSpeechRecognition = (callbacks = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [micLive, setMicLive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [hasMicPermission, setHasMicPermission] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const liveRef = useRef(false);
  const restartTimerRef = useRef(null);
  const callbacksRef = useRef(callbacks);
  const inlineCallbacksRef = useRef({});
  const destroyedRef = useRef(false);
  const currentLanguageRef = useRef('vi-VN');
  const networkErrorCountRef = useRef(0);

  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const analyserRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const animFrameRef = useRef(null);

  const audioChunksRef = useRef([]);
  const hasDetectedVoiceRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const lastFinalTranscriptRef = useRef('');
  const speechFinalizeTimerRef = useRef(null);
  const listenEpochRef = useRef(0);
  const utteranceCommittedRef = useRef(false);
  const lastCommittedTextRef = useRef('');
  const analyserInitPromiseRef = useRef(null);
  const isTranscribingRef = useRef(false);
  const webSpeechBlockedRef = useRef(false);
  const noiseFloorRef = useRef(0.012);
  const resultOffsetRef = useRef(0);
  const latestResultsLengthRef = useRef(0);

  const clearSpeechFinalizeTimer = useCallback(() => {
    if (speechFinalizeTimerRef.current) {
      clearTimeout(speechFinalizeTimerRef.current);
      speechFinalizeTimerRef.current = null;
    }
  }, []);

  const commitFinalTranscript = useCallback((text) => {
    const clean = (text || '').trim();
    if (!clean) return;
    if (utteranceCommittedRef.current && clean === lastCommittedTextRef.current) return;
    utteranceCommittedRef.current = true;
    lastCommittedTextRef.current = clean;
    clearSpeechFinalizeTimer();
    const cbFinal = inlineCallbacksRef.current?.onFinal || callbacksRef.current?.onFinal;
    if (cbFinal) {
      cbFinal(clean);
    }
  }, [clearSpeechFinalizeTimer]);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const stopAudioAnalyser = useCallback((permanent = false) => {
    teardownHardwareAudioAnalyser({
      permanent,
      animFrameRef,
      silenceTimerRef,
      clearSpeechFinalizeTimer,
      scriptProcessorRef,
      mediaStreamRef,
      audioContextRef,
      audioChunksRef,
      hasDetectedVoiceRef,
      setVolumeLevel,
    });
  }, [clearSpeechFinalizeTimer]);

  const processBackendSTT = useCallback(async (force = false) => {
    return runBackendSTT({
      force,
      isTranscribingRef,
      utteranceCommittedRef,
      shouldListenRef,
      audioChunksRef,
      hasDetectedVoiceRef,
      liveRef,
      lastFinalTranscriptRef,
      listenEpochRef,
      audioContextRef,
      currentLanguageRef,
      inlineCallbacksRef,
      callbacksRef,
      setIsTranscribing,
      setTranscript,
      commitFinalTranscript,
    });
  }, [commitFinalTranscript]);

  const startAudioAnalyser = useCallback(async () => {
    if (analyserInitPromiseRef.current) {
      return analyserInitPromiseRef.current;
    }
    const initTask = initializeHardwareMicAnalyser({
      destroyedRef,
      mediaStreamRef,
      audioContextRef,
      analyserRef,
      scriptProcessorRef,
      shouldListenRef,
      audioChunksRef,
      callbacksRef,
      hasDetectedVoiceRef,
      silenceTimerRef,
      noiseFloorRef,
      lastFinalTranscriptRef,
      clearSpeechFinalizeTimer,
      processBackendSTT,
      setError,
      setHasMicPermission,
      setVolumeLevel,
      hardwareVadSilenceMs: HARDWARE_VAD_SILENCE_MS,
    }).finally(() => {
      analyserInitPromiseRef.current = null;
    });
    analyserInitPromiseRef.current = initTask;
    return initTask;
  }, [clearSpeechFinalizeTimer, processBackendSTT]);

  const clearRestartTimer = () => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const startRecognition = useCallback(() => {
    destroyedRef.current = false;
    if (!recognitionRef.current) return;
    if (liveRef.current) return;

    try {
      recognitionRef.current.start();
    } catch (err) {
      if (err.name === 'InvalidStateError') {
        liveRef.current = true;
        setIsListening(true);
      } else {
        console.warn('[SpeechRecognition] startRecognition error, fallback to hardware recorder:', err);
        setIsListening(true);
        setMicLive(true);
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          if (shouldListenRef.current && !liveRef.current && !destroyedRef.current) {
            startRecognition();
          }
        }, 800);
      }
    }
  }, []);

  useEffect(() => {
    destroyedRef.current = false;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        liveRef.current = true;
        resultOffsetRef.current = 0;
        latestResultsLengthRef.current = 0;
        setIsListening(true);
        setMicLive(true);
        setError(null);
      };

      recognition.onresult = (event) => {
        if (!shouldListenRef.current) return;
        latestResultsLengthRef.current = event.results.length;
        const startIdx = Math.min(resultOffsetRef.current, event.results.length);
        let fullTranscript = '';
        for (let i = startIdx; i < event.results.length; i++) {
          const piece = event.results[i][0]?.transcript || '';
          if (piece.trim()) {
            fullTranscript += (fullTranscript ? ' ' : '') + piece.trim();
          }
        }
        const rawTrimmed = fullTranscript.trim();
        const trimmed = normalizeHotelSpeechTranscript(rawTrimmed);
        if (trimmed) {
          setTranscript(trimmed);
          lastFinalTranscriptRef.current = trimmed;

          const isCurrentFinal = event.results.length > 0
            ? event.results[event.results.length - 1].isFinal
            : false;

          const cbTranscript = inlineCallbacksRef.current?.onTranscriptChange || callbacksRef.current?.onTranscriptChange;
          const cbInterim = inlineCallbacksRef.current?.onInterim || callbacksRef.current?.onInterim;

          if (cbTranscript) {
            cbTranscript(trimmed, isCurrentFinal);
          }

          if (trimmed !== lastCommittedTextRef.current) {
            utteranceCommittedRef.current = false;
          }

          if (!isCurrentFinal && cbInterim) {
            cbInterim(trimmed);
          }

          clearSpeechFinalizeTimer();
          const effectiveDebounceMs = getSemanticSilenceDebounce(trimmed, isCurrentFinal);
          speechFinalizeTimerRef.current = setTimeout(() => {
            speechFinalizeTimerRef.current = null;
            if (shouldListenRef.current && lastFinalTranscriptRef.current?.trim()) {
              commitFinalTranscript(lastFinalTranscriptRef.current.trim());
            }
          }, effectiveDebounceMs);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }
        console.warn('[SpeechRecognition Error]:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          console.log('[SpeechRecognition] WebSpeech blocked by browser gesture policy (iOS/Mobile). Seamlessly switching to Hardware Whisper STT.');
          webSpeechBlockedRef.current = true;
          liveRef.current = false;
          setIsListening(true);
          setMicLive(true);
          setError(null);

          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(() => {});
          }

          startAudioAnalyser().catch(() => {});
          return;
        } else if (event.error === 'network') {
          networkErrorCountRef.current += 1;
          console.warn(`[SpeechRecognition] Lỗi mạng Google Speech (${networkErrorCountRef.current}). Hệ thống tự động kích hoạt Backend STT Fallback.`);
          if (shouldListenRef.current) {
            setIsListening(true);
            setMicLive(true);
          }
        } else if (event.error === 'audio-capture') {
          setError('Không tìm thấy Microphone hoặc Micro đang bị ứng dụng khác chiếm dụng.');
        }
      };

      recognition.onend = () => {
        liveRef.current = false;
        if (webSpeechBlockedRef.current) {
          if (shouldListenRef.current && !destroyedRef.current) {
            setIsListening(true);
            setMicLive(true);
            clearRestartTimer();
            restartTimerRef.current = setTimeout(() => {
              if (shouldListenRef.current && !liveRef.current && !destroyedRef.current) {
                webSpeechBlockedRef.current = false;
                startRecognition();
              }
            }, 1200);
          }
          return;
        }
        if (shouldListenRef.current && !destroyedRef.current) {
          if (networkErrorCountRef.current >= 2) {
            setMicLive(true);
            setIsListening(true);
            clearRestartTimer();
            restartTimerRef.current = setTimeout(() => {
              if (shouldListenRef.current && !liveRef.current && !destroyedRef.current) {
                networkErrorCountRef.current = 0;
                startRecognition();
              }
            }, 3500);
            return;
          }
          clearRestartTimer();
          restartTimerRef.current = setTimeout(() => {
            if (shouldListenRef.current && !liveRef.current && !destroyedRef.current) {
              startRecognition();
            }
          }, 150);
        } else {
          setIsListening(false);
          setMicLive(false);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      destroyedRef.current = true;
      shouldListenRef.current = false;
      clearRestartTimer();
      stopAudioAnalyser(true);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, [startRecognition, stopAudioAnalyser, clearSpeechFinalizeTimer, commitFinalTranscript, startAudioAnalyser]);

  useEffect(() => {
    const unlockAudio = () => {
      webSpeechBlockedRef.current = false;
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('pointerdown', unlockAudio);
    };
  }, []);

  const requestMicrophonePermission = useCallback(async () => {
    destroyedRef.current = false;
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (e) {}
    }
    return await startAudioAnalyser();
  }, [startAudioAnalyser]);

  const startListening = async (language = 'vi-VN', inlineCallbacks = null) => {
    destroyedRef.current = false;
    webSpeechBlockedRef.current = false;
    listenEpochRef.current += 1;
    utteranceCommittedRef.current = false;
    lastCommittedTextRef.current = '';
    currentLanguageRef.current = language;
    networkErrorCountRef.current = 0;
    lastFinalTranscriptRef.current = '';
    audioChunksRef.current = [];
    hasDetectedVoiceRef.current = false;
    resultOffsetRef.current = latestResultsLengthRef.current;

    if (inlineCallbacks && typeof inlineCallbacks === 'object') {
      inlineCallbacksRef.current = inlineCallbacks;
      callbacksRef.current = { ...callbacksRef.current, ...inlineCallbacks };
    }
    shouldListenRef.current = true;

    const isStreamActive =
      mediaStreamRef.current &&
      mediaStreamRef.current.active &&
      mediaStreamRef.current.getAudioTracks().some((t) => t.readyState === 'live');
    if (!isStreamActive) {
      await startAudioAnalyser();
    } else if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (e) {}
    }

    if (recognitionRef.current) {
      setError(null);
      setTranscript('');
      const isEn = typeof language === 'string' && (language.toLowerCase().includes('en') || language.toLowerCase() === 'english');
      const targetLang = isEn ? 'en-US' : 'vi-VN';
      const langChanged = recognitionRef.current.lang !== targetLang;
      try {
        recognitionRef.current.lang = targetLang;
      } catch (e) {}

      if (liveRef.current && langChanged) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
        liveRef.current = false;
      }

      if (!liveRef.current) {
        startRecognition();
      }
      setIsListening(true);
      setMicLive(true);
    } else {
      setIsListening(true);
      setMicLive(true);
    }
  };

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    clearRestartTimer();
    liveRef.current = false;
    inlineCallbacksRef.current = {};
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (err) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    }
    setIsListening(false);
    setMicLive(false);
    clearSpeechFinalizeTimer();
    stopAudioAnalyser(false);
  }, [stopAudioAnalyser, clearSpeechFinalizeTimer]);

  const resetTranscript = useCallback(() => {
    clearSpeechFinalizeTimer();
    setTranscript('');
    lastFinalTranscriptRef.current = '';
    lastCommittedTextRef.current = '';
    audioChunksRef.current = [];
    hasDetectedVoiceRef.current = false;
    utteranceCommittedRef.current = false;
    resultOffsetRef.current = latestResultsLengthRef.current;
  }, [clearSpeechFinalizeTimer]);

  const finishVoiceCapture = useCallback(async () => {
    clearSpeechFinalizeTimer();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (lastFinalTranscriptRef.current?.trim()) {
      commitFinalTranscript(lastFinalTranscriptRef.current.trim());
    } else {
      await processBackendSTT(true);
    }
  }, [clearSpeechFinalizeTimer, commitFinalTranscript, processBackendSTT]);

  return {
    isListening,
    micLive,
    transcript,
    error,
    volumeLevel,
    hasMicPermission,
    isTranscribing,
    requestMicrophonePermission,
    startListening,
    stopListening,
    resetTranscript,
    finishVoiceCapture,
    hasSupport: !!(window.SpeechRecognition || window.webkitSpeechRecognition || navigator.mediaDevices?.getUserMedia),
  };
};
