import { useState, useEffect, useRef, useCallback } from 'react';
import { synthesizeSpeech } from '../services/aiApi';
import {
  cleanupAudioElements,
  createPreloadedAudioSource,
  primeSpeechEngines,
  sanitizeSpeechText,
  resolveSpeechVoiceAndLang,
  speakWithBrowserUtterance,
  createStreamingQueueController,
} from './speechSynthesisHelpers';

export const useSpeechSynthesis = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const audioRef = useRef(null);
  const persistentAudioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const activeSourceNodeRef = useRef(null);
  const activeUtteranceRef = useRef(null);
  const safetyTimerRef = useRef(null);

  const activeSpeechIdRef = useRef(0);
  const abortControllerRef = useRef(null);

  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
        window._sharedAudioCtx = audioCtxRef.current;
      }
    }
    return audioCtxRef.current;
  }, []);

  const getAudioPlayer = useCallback(() => {
    if (!persistentAudioRef.current && typeof window !== 'undefined') {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      persistentAudioRef.current = audio;
      window._activeAudioPlayer = audio;
    }
    return persistentAudioRef.current;
  }, []);

  const stopCurrentAudio = useCallback(() => {
    cleanupAudioElements({ activeSourceNodeRef, persistentAudioRef, audioRef });
  }, []);

  const playAudioBufferViaWebAudio = useCallback(async (base64Data, rate, onStartCallback, onEndCallback, speechId) => {
    try {
      if (!base64Data || base64Data.length < 50) return false;
      const ctx = getAudioContext();
      if (!ctx) return false;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const audioBuffer = await ctx.decodeAudioData(byteNumbers.buffer.slice(0));
      if (speechId && speechId !== activeSpeechIdRef.current) return false;

      stopCurrentAudio();
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = Math.max(0.5, Math.min(2.0, rate || 1.0));
      source.connect(ctx.destination);
      activeSourceNodeRef.current = source;

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
      }

      source.onended = () => {
        activeSourceNodeRef.current = null;
        if (!speechId || speechId === activeSpeechIdRef.current) {
          setIsSpeaking(false);
          if (onEndCallback) onEndCallback();
        }
      };

      setIsSpeaking(true);
      if (onStartCallback) onStartCallback();
      source.start(0);
      return true;
    } catch (err) {
      console.warn('[Web Audio Playback Failed]:', err);
      return false;
    }
  }, [getAudioContext, stopCurrentAudio]);

  const [speechRate, setSpeechRateState] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('rora_speech_rate') : null;
      return saved ? parseFloat(saved) : 1.0;
    } catch {
      return 1.0;
    }
  });

  const [viVoice, setViVoiceState] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('rora_vi_voice') : null;
      return saved || 'vi-VN-HoaiMyNeural';
    } catch {
      return 'vi-VN-HoaiMyNeural';
    }
  });

  const [enVoice, setEnVoiceState] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('rora_en_voice') : null;
      return saved || 'en-US-JennyNeural';
    } catch {
      return 'en-US-JennyNeural';
    }
  });

  const viVoiceRef = useRef(viVoice);
  const enVoiceRef = useRef(enVoice);

  useEffect(() => {
    viVoiceRef.current = viVoice;
  }, [viVoice]);

  useEffect(() => {
    enVoiceRef.current = enVoice;
  }, [enVoice]);

  const updateSpeechRate = useCallback((newRate) => {
    const parsed = parseFloat(newRate);
    const clamped = Math.max(0.5, Math.min(2.0, isNaN(parsed) ? 1.0 : parsed));
    setSpeechRateState(clamped);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('rora_speech_rate', clamped.toString());
      }
    } catch {}
    return clamped;
  }, []);

  const updateVoiceSettings = useCallback(({ speech_rate, vi_voice, en_voice }) => {
    if (speech_rate !== undefined && speech_rate !== null) {
      updateSpeechRate(speech_rate);
    }
    if (vi_voice) {
      setViVoiceState(vi_voice);
      viVoiceRef.current = vi_voice;
      try {
        if (typeof window !== 'undefined') localStorage.setItem('rora_vi_voice', vi_voice);
      } catch {}
    }
    if (en_voice) {
      setEnVoiceState(en_voice);
      enVoiceRef.current = en_voice;
      try {
        if (typeof window !== 'undefined') localStorage.setItem('rora_en_voice', en_voice);
      } catch {}
    }
  }, [updateSpeechRate]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const updateVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, []);

  useEffect(() => {
    let bc;
    try {
      bc = new BroadcastChannel('hcrobot_voice_settings');
      bc.onmessage = (event) => {
        if (event.data?.type === 'VOICE_SETTINGS_UPDATED') {
          if (event.data.speech_rate !== undefined && event.data.speech_rate !== null) {
            const clamped = Math.max(0.5, Math.min(2.0, parseFloat(event.data.speech_rate) || 1.0));
            setSpeechRateState(clamped);
            try {
              if (typeof window !== 'undefined') localStorage.setItem('rora_speech_rate', clamped.toString());
            } catch {}
          }
          if (event.data.vi_voice) {
            setViVoiceState(event.data.vi_voice);
            viVoiceRef.current = event.data.vi_voice;
            try {
              if (typeof window !== 'undefined') localStorage.setItem('rora_vi_voice', event.data.vi_voice);
            } catch {}
          }
          if (event.data.en_voice) {
            setEnVoiceState(event.data.en_voice);
            enVoiceRef.current = event.data.en_voice;
            try {
              if (typeof window !== 'undefined') localStorage.setItem('rora_en_voice', event.data.en_voice);
            } catch {}
          }
        }
      };
    } catch {}
    return () => {
      if (bc) bc.close();
    };
  }, []);

  const prime = () => {
    primeSpeechEngines({ getAudioContext, getAudioPlayer });
  };

  const queueRef = useRef([]);
  const isPlayingQueueRef = useRef(false);
  const streamEndedRef = useRef(false);
  const onQueueEndCallbackRef = useRef(null);
  const onQueueStartCallbackRef = useRef(null);
  const streamLangRef = useRef('vi-VN');

  const _speakWithBrowserUtterance = (cleanText, langTag, targetVoice, onEndCallback, onStartCallback, shouldCancel, rate = null, speechId = null) => {
    speakWithBrowserUtterance({
      cleanText,
      langTag,
      targetVoice,
      onEndCallback,
      onStartCallback,
      shouldCancel,
      rate,
      speechRate,
      speechId,
      activeSpeechIdRef,
      stopCurrentAudio,
      activeUtteranceRef,
      safetyTimerRef,
      setIsSpeaking,
      voices,
      viVoice: viVoiceRef.current,
      enVoice: enVoiceRef.current,
    });
  };

  const speakWebSpeech = (text, language = 'vi-VN', onEndCallback = null, onStartCallback = null, shouldCancel = true, rate = null, targetSpeechId = null, targetSignal = null, options = {}) => {
    const speechId = targetSpeechId ?? ++activeSpeechIdRef.current;
    const signal = targetSignal ?? abortControllerRef.current?.signal;

    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }

    if (speechId !== activeSpeechIdRef.current) return;

    const effectiveRate = Math.max(0.5, Math.min(2.0, rate ?? speechRate ?? 1.0));
    const cleanText = sanitizeSpeechText(text);

    if (!cleanText) {
      if (onStartCallback) onStartCallback();
      if (onEndCallback) onEndCallback();
      return;
    }

    const { langTag, targetVoice } = resolveSpeechVoiceAndLang(cleanText, language, voices, {
      voice: options?.voice,
      viVoice: viVoiceRef.current,
      enVoice: enVoiceRef.current,
    });
    const activeVoice = options?.voice || (langTag.startsWith('vi') ? (viVoiceRef.current || 'vi-VN-HoaiMyNeural') : (enVoiceRef.current || 'en-US-JennyNeural'));
    const isMaleVoice = activeVoice.toLowerCase().includes('namminh') || activeVoice.toLowerCase().includes('guy') || activeVoice.toLowerCase().includes('male');

    const isSupportedEdgeLang = (langTag.startsWith('vi') || langTag.startsWith('en')) && !options?.skipRemoteTts;
    if (isSupportedEdgeLang) {
      const edgeVoice = activeVoice;
      const edgeLang = langTag.startsWith('vi') ? 'vi-VN' : 'en-US';
      synthesizeSpeech(cleanText, { language: edgeLang, voice: edgeVoice, signal })
        .then((data) => {
          if (speechId !== activeSpeechIdRef.current || data?.aborted) return;

          if (data?.audio_base64 && data.audio_base64.length > 50) {
            stopCurrentAudio();
            if (speechId !== activeSpeechIdRef.current) return;

            const audioSrc = `data:audio/mpeg;base64,${data.audio_base64}`;
            const audio = getAudioPlayer();
            audio.src = audioSrc;
            audio.playbackRate = effectiveRate;
            audio.volume = 1.0;
            audioRef.current = audio;
            if (typeof window !== 'undefined') {
              window._activeAudioPlayer = audio;
            }

            let hasPlayed = false;
            let recovered = false;
            const recoverWebSpeech = () => {
              if (recovered || hasPlayed) return;
              recovered = true;
              if (speechId === activeSpeechIdRef.current) {
                _speakWithBrowserUtterance(cleanText, langTag, targetVoice, onEndCallback, onStartCallback, shouldCancel, effectiveRate, speechId);
              }
            };

            audio.onplay = () => {
              if (speechId !== activeSpeechIdRef.current) {
                stopCurrentAudio();
                return;
              }
              hasPlayed = true;
              recovered = true;
              setIsSpeaking(true);
              if (onStartCallback) onStartCallback();
            };

            audio.onended = () => {
              if (typeof window !== 'undefined') window._activeAudioPlayer = null;
              if (speechId === activeSpeechIdRef.current) {
                setIsSpeaking(false);
                audioRef.current = null;
                if (onEndCallback) onEndCallback();
              }
            };

            audio.onerror = async () => {
              if (typeof window !== 'undefined') window._activeAudioPlayer = null;
              if (speechId === activeSpeechIdRef.current) {
                audioRef.current = null;
                if (!hasPlayed && !recovered) {
                  const played = await playAudioBufferViaWebAudio(data.audio_base64, effectiveRate, onStartCallback, onEndCallback, speechId);
                  if (played) {
                    hasPlayed = true;
                    recovered = true;
                    return;
                  }
                  stopCurrentAudio();
                  recoverWebSpeech();
                } else {
                  setIsSpeaking(false);
                  if (onEndCallback) onEndCallback();
                }
              }
            };

            audio.play().catch(async (playErr) => {
              console.warn('[TTS Audio Play Error]:', playErr);
              if (!hasPlayed && !recovered) {
                const played = await playAudioBufferViaWebAudio(data.audio_base64, effectiveRate, onStartCallback, onEndCallback, speechId);
                if (played) {
                  hasPlayed = true;
                  recovered = true;
                  return;
                }
                stopCurrentAudio();
                recoverWebSpeech();
              }
            });
            return;
          }
          if (speechId === activeSpeechIdRef.current) {
            _speakWithBrowserUtterance(cleanText, langTag, targetVoice, onEndCallback, onStartCallback, shouldCancel, effectiveRate, speechId);
          }
        })
        .catch(() => {
          if (speechId === activeSpeechIdRef.current) {
            _speakWithBrowserUtterance(cleanText, langTag, targetVoice, onEndCallback, onStartCallback, shouldCancel, effectiveRate, speechId);
          }
        });
      return;
    }

    _speakWithBrowserUtterance(cleanText, langTag, targetVoice, onEndCallback, onStartCallback, shouldCancel, effectiveRate, speechId);
  };

  const cancel = useCallback(() => {
    activeSpeechIdRef.current += 1;
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (e) {}
      abortControllerRef.current = null;
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    queueRef.current = [];
    isPlayingQueueRef.current = false;
    streamEndedRef.current = false;
    onQueueEndCallbackRef.current = null;
    onQueueStartCallbackRef.current = null;
    activeUtteranceRef.current = null;
    if (typeof window !== 'undefined') window._activeUtterance = null;
    stopCurrentAudio();
    if (typeof window !== 'undefined') window._activeAudioPlayer = null;
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    setIsSpeaking(false);
  }, [stopCurrentAudio]);

  const { initStreamSpeech, enqueueStreamChunk, endStreamSpeech } = createStreamingQueueController({
    queueRef,
    isPlayingQueueRef,
    streamEndedRef,
    onQueueEndCallbackRef,
    onQueueStartCallbackRef,
    streamLangRef,
    activeSpeechIdRef,
    audioRef,
    setIsSpeaking,
    stopCurrentAudio,
    speakWebSpeech,
    speechRate,
    cancel,
    viVoiceRef,
    enVoiceRef,
  });

  const speak = async (text, language = 'vi-VN', onEndCallback = null, onStartCallback = null, rawPreloadedAudioBase64 = null, rate = null, options = {}) => {
    cancel();

    // Ho tro ca positional parameters va object options: speak(text, { rate, lang, voice, onEnd, onStart })
    let actualLang = language;
    let actualOnEnd = onEndCallback;
    let actualOnStart = onStartCallback;
    let preloadedAudioBase64 = rawPreloadedAudioBase64;
    let actualRate = rate;
    let actualOptions = options || {};

    if (language && typeof language === 'object' && !Array.isArray(language)) {
      actualOptions = language;
      actualLang = actualOptions.lang || actualOptions.language || 'vi-VN';
      actualOnEnd = actualOptions.onEnd || actualOptions.onEndCallback || null;
      actualOnStart = actualOptions.onStart || actualOptions.onStartCallback || null;
      preloadedAudioBase64 = actualOptions.preloadedAudioBase64 || null;
      actualRate = actualOptions.rate ?? null;
    }

    if (!text || !text.trim()) {
      if (actualOnStart) actualOnStart();
      if (actualOnEnd) actualOnEnd();
      return;
    }

    const currentSpeechId = ++activeSpeechIdRef.current;
    abortControllerRef.current = new AbortController();
    const currentSignal = abortControllerRef.current.signal;

    const effectiveRate = Math.max(0.5, Math.min(2.0, actualRate ?? speechRate ?? 1.0));
    const skipRemoteTts = Boolean(actualOptions?.skipRemoteTts);

    let recoveryHandled = false;
    let hasStartedPlaying = false;

    const triggerSingleRecovery = () => {
      if (recoveryHandled || hasStartedPlaying) return;
      recoveryHandled = true;
      if (currentSpeechId !== activeSpeechIdRef.current) return;
      stopCurrentAudio();
      _speakWithBrowserUtterance(text, actualLang, null, actualOnEnd, actualOnStart, true, effectiveRate, currentSpeechId);
    };

    if (preloadedAudioBase64 && preloadedAudioBase64.length > 100) {
      try {
        if (currentSpeechId !== activeSpeechIdRef.current) return;
        stopCurrentAudio();

        const { audioSrc, objectUrlToRevoke } = createPreloadedAudioSource(preloadedAudioBase64);
        const audio = getAudioPlayer();
        audio._blobUrl = objectUrlToRevoke;
        audio.src = audioSrc;
        audio.playbackRate = effectiveRate;
        audio.volume = 1.0;
        audioRef.current = audio;
        if (typeof window !== 'undefined') window._activeAudioPlayer = audio;

        audio.onplay = () => {
          if (currentSpeechId !== activeSpeechIdRef.current) {
            stopCurrentAudio();
            return;
          }
          hasStartedPlaying = true;
          recoveryHandled = true;
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try { window.speechSynthesis.cancel(); } catch (e) {}
          }
          setIsSpeaking(true);
          if (actualOnStart) actualOnStart();
        };

        audio.onended = () => {
          if (typeof window !== 'undefined') window._activeAudioPlayer = null;
          if (currentSpeechId === activeSpeechIdRef.current) {
            setIsSpeaking(false);
            audioRef.current = null;
            if (actualOnEnd) actualOnEnd();
          }
        };

        audio.onerror = async () => {
          if (typeof window !== 'undefined') window._activeAudioPlayer = null;
          if (currentSpeechId === activeSpeechIdRef.current) {
            audioRef.current = null;
            if (!hasStartedPlaying && !recoveryHandled) {
              const played = await playAudioBufferViaWebAudio(preloadedAudioBase64, effectiveRate, actualOnStart, actualOnEnd, currentSpeechId);
              if (played) {
                hasStartedPlaying = true;
                recoveryHandled = true;
                return;
              }
              triggerSingleRecovery();
            } else {
              setIsSpeaking(false);
              if (actualOnEnd) actualOnEnd();
            }
          }
        };

        await audio.play();
        return;
      } catch (playErr) {
        console.warn('[TTS Hook] Cannot play via HTML5 Audio, fallback to Web Audio API / WebSpeech:', playErr);
        if (currentSpeechId !== activeSpeechIdRef.current || hasStartedPlaying || recoveryHandled) return;
        stopCurrentAudio();

        try {
          const played = await playAudioBufferViaWebAudio(preloadedAudioBase64, effectiveRate, actualOnStart, actualOnEnd, currentSpeechId);
          if (played) {
            hasStartedPlaying = true;
            recoveryHandled = true;
            return;
          }
        } catch (ctxErr) {
          console.warn('[TTS Hook] Web Audio API fallback failed:', ctxErr);
        }

        if (!hasStartedPlaying && !recoveryHandled) {
          triggerSingleRecovery();
          return;
        }
      }
    }

    if (currentSpeechId === activeSpeechIdRef.current) {
      if (skipRemoteTts) {
        _speakWithBrowserUtterance(text, actualLang, null, actualOnEnd, actualOnStart, true, effectiveRate, currentSpeechId);
      } else {
        speakWebSpeech(text, actualLang, actualOnEnd, actualOnStart, true, effectiveRate, currentSpeechId, currentSignal, actualOptions);
      }
    }
  };

  return {
    speak,
    speakWebSpeech,
    prime,
    cancel,
    stop: cancel,
    isSpeaking,
    voices,
    speechRate,
    setSpeechRate: updateSpeechRate,
    updateSpeechRate,
    viVoice,
    enVoice,
    updateVoiceSettings,
    initStreamSpeech,
    enqueueStreamChunk,
    endStreamSpeech,
  };
};
