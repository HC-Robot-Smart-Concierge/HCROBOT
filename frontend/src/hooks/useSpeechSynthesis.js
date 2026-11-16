import { useState, useEffect, useRef, useCallback } from 'react';
import { synthesizeSpeech } from '../services/aiApi';

export const useSpeechSynthesis = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const audioRef = useRef(null);
  const persistentAudioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const activeSourceNodeRef = useRef(null);
  const activeUtteranceRef = useRef(null);
  const safetyTimerRef = useRef(null);

  // Epoch ID cho TTS: Ngăn chặn race condition khi câu trước load chậm không được phát lồng vào câu sau
  const activeSpeechIdRef = useRef(0);
  const abortControllerRef = useRef(null);

  // Khởi tạo hoặc lấy đối tượng Web Audio Context (Chuẩn tối ưu nhất cho iOS Safari Web Audio)
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

  // Khởi tạo hoặc lấy đối tượng Audio Player duy nhất đã được unlock cho iOS
  const getAudioPlayer = useCallback(() => {
    if (!persistentAudioRef.current && typeof window !== 'undefined') {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      persistentAudioRef.current = audio;
      if (typeof window !== 'undefined') {
        window._activeAudioPlayer = audio;
      }
    }
    return persistentAudioRef.current;
  }, []);

  // Helper dừng và giải phóng đối tượng Audio hiện tại
  const stopCurrentAudio = useCallback(() => {
    if (activeSourceNodeRef.current) {
      try {
        activeSourceNodeRef.current.stop();
        activeSourceNodeRef.current.disconnect();
      } catch (e) {}
      activeSourceNodeRef.current = null;
    }
    const audio = persistentAudioRef.current || audioRef.current;
    if (audio) {
      try {
        if (audio._blobUrl) {
          URL.revokeObjectURL(audio._blobUrl);
          audio._blobUrl = null;
        }
        audio.onplay = null;
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.currentTime = 0;
      } catch (e) {}
    }
    if (audioRef.current && audioRef.current !== persistentAudioRef.current) {
      try { audioRef.current.src = ''; } catch (e) {}
      audioRef.current = null;
    }
    if (typeof window !== 'undefined') {
      window._activeAudioPlayer = null;
    }
  }, []);

  // Helper giải mã và phát trực tiếp audio base64 qua Web Audio API (AudioContext)
  // Bỏ qua hoàn toàn rào cản Autoplay Policy / User Gesture Restriction trên iOS Safari (iPhone XR / iPad)
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

  // Persistent Speech Rate State (0.5x - 2.0x, default 1.05x)
  const [speechRate, setSpeechRateState] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('rora_speech_rate') : null;
      return saved ? parseFloat(saved) : 1.05;
    } catch {
      return 1.05;
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

  // Load available TTS voices from browser
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, []);

  // Sync speech rate & voices from BroadcastChannel across tabs (Admin -> Robot Screen)
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

  // Unlock TTS Audio Engine on Mobile / Kiosk Gesture
  const prime = () => {
    // 0. Unlock Web Audio Context
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (e) {}

    // 1. Unlock Web Speech Synthesis
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
        const silentUtterance = new SpeechSynthesisUtterance('');
        silentUtterance.volume = 0.01;
        silentUtterance.lang = 'vi-VN';
        window.speechSynthesis.speak(silentUtterance);
      } catch (e) {
        // Ignore mobile unlock warnings
      }
    }

    // 2. Unlock HTML5 Audio cho EdgeTTS playback trên iOS
    try {
      const audio = getAudioPlayer();
      if (audio) {
        audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        audio.volume = 0.01;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              audio.pause();
              audio.currentTime = 0;
              audio.volume = 1.0;
            })
            .catch(() => {});
        }
      }
    } catch (e) {}
  };

  // Streaming Speech Queue State
  const queueRef = useRef([]);
  const isPlayingQueueRef = useRef(false);
  const streamEndedRef = useRef(false);
  const onQueueEndCallbackRef = useRef(null);
  const onQueueStartCallbackRef = useRef(null);
  const streamLangRef = useRef('vi-VN');

  const speakWebSpeech = (text, language = 'vi-VN', onEndCallback = null, onStartCallback = null, shouldCancel = true, rate = null, targetSpeechId = null, targetSignal = null, options = {}) => {
    const speechId = targetSpeechId ?? ++activeSpeechIdRef.current;
    const signal = targetSignal ?? abortControllerRef.current?.signal;

    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }

    if (speechId !== activeSpeechIdRef.current) {
      return;
    }

    // Chuẩn hóa văn bản: loại bỏ ký tự rác, markdown, định dạng danh sách và chuẩn hóa dấu câu
    // để mô hình TTS đọc liền mạch, êm ái, KHÔNG bị giật hay ngắt quãng đột ngột.
    const effectiveRate = Math.max(0.5, Math.min(2.0, rate ?? speechRate ?? 1.0));

    const cleanText = (text || '')
      .replace(/[*#_`\[\]()]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/^[\s*•\-–—]+\s*/gm, '') // Xóa gạch đầu dòng danh sách
      .replace(/\.{2,}/g, '.') // ... -> .
      .replace(/!{2,}/g, '!')
      .replace(/\?{2,}/g, '?')
      .replace(/:\s+/g, ', ') // Dấu hai chấm đổi thành dấu phẩy để hạ giọng êm, không ngắt cụt
      .replace(/\s*;\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      if (onStartCallback) onStartCallback();
      if (onEndCallback) onEndCallback();
      return;
    }

    const hasVietnameseDiacritics = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(cleanText);
    const hasVietnameseKeywords = /\b(dạ|em|anh|chị|quý khách|khách sạn|phòng|đã|rồi|ạ|hỗ trợ|yêu cầu|dịch vụ|không|có|tại|tầng|hồ bơi|cảm ơn|bảo trì|lễ tân|nhân viên|vận chuyển|hành lý)\b/i.test(cleanText);
    const isVietnameseText = hasVietnameseDiacritics || hasVietnameseKeywords;

    let langTag = 'vi-VN';
    if (isVietnameseText) {
      langTag = 'vi-VN';
    } else if (typeof language === 'string' && (language.toLowerCase().includes('en') || language.toLowerCase().includes('english'))) {
      langTag = 'en-US';
    } else {
      langTag = 'vi-VN';
    }

    const availableVoices = voices.length > 0 ? voices : (window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
    let targetVoice = null;

    const activeVoice = options?.voice || (langTag.startsWith('vi') ? (viVoiceRef.current || 'vi-VN-HoaiMyNeural') : (enVoiceRef.current || 'en-US-JennyNeural'));
    const isMaleVoice = activeVoice.toLowerCase().includes('namminh') || activeVoice.toLowerCase().includes('guy') || activeVoice.toLowerCase().includes('male');

    if (langTag.startsWith('vi')) {
      if (isMaleVoice) {
        targetVoice = availableVoices.find((v) => v.name.toLowerCase().includes('namminh') || v.name.toLowerCase().includes('nam minh')) ||
          availableVoices.find((v) => v.name.toLowerCase().includes('male') && v.lang.toLowerCase().startsWith('vi')) ||
          availableVoices.find((v) => v.name.toLowerCase().includes('natural') && v.lang.toLowerCase().startsWith('vi')) ||
          availableVoices.find((v) => v.lang.toLowerCase().startsWith('vi') || v.name.toLowerCase().includes('vietnamese'));
      } else {
        targetVoice = availableVoices.find((v) => v.name.toLowerCase().includes('hoaimy') || v.name.toLowerCase().includes('hoài my')) ||
          availableVoices.find((v) => v.name.toLowerCase().includes('female') && v.lang.toLowerCase().startsWith('vi')) ||
          availableVoices.find((v) => v.name.toLowerCase().includes('natural') && v.lang.toLowerCase().startsWith('vi')) ||
          availableVoices.find((v) => v.name.toLowerCase().includes('google') && v.lang.toLowerCase().startsWith('vi')) ||
          availableVoices.find((v) => v.lang.toLowerCase().startsWith('vi') || v.name.toLowerCase().includes('vietnamese'));
      }
    } else if (langTag.startsWith('en')) {
      if (isMaleVoice) {
        targetVoice = availableVoices.find((v) => v.name.toLowerCase().includes('guy') || v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('male')) ||
          availableVoices.find((v) => v.lang.toLowerCase().startsWith('en'));
      } else {
        targetVoice = availableVoices.find((v) => v.name.toLowerCase().includes('jenny') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('female')) ||
          availableVoices.find((v) => v.lang.toLowerCase().startsWith('en'));
      }
    }

    // 1. ƯU TIÊN GỌI Backend EdgeTTS Neural theo cấu hình giọng của Robot
    const isSupportedEdgeLang = (langTag.startsWith('vi') || langTag.startsWith('en')) && !options?.skipRemoteTts;
    if (isSupportedEdgeLang) {
      const edgeVoice = activeVoice;
      const edgeLang = langTag.startsWith('vi') ? 'vi-VN' : 'en-US';
      synthesizeSpeech(cleanText, { language: edgeLang, voice: edgeVoice, signal })
        .then((data) => {
          // Bỏ qua nếu câu nói này đã lỗi thời hoặc request đã bị abort
          if (speechId !== activeSpeechIdRef.current || data?.aborted) {
            return;
          }

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
              if (typeof window !== 'undefined') {
                window._activeAudioPlayer = null;
              }
              if (speechId === activeSpeechIdRef.current) {
                setIsSpeaking(false);
                audioRef.current = null;
                if (onEndCallback) onEndCallback();
              }
            };

            audio.onerror = async () => {
              if (typeof window !== 'undefined') {
                window._activeAudioPlayer = null;
              }
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
                // Thử giải mã và phát trực tiếp qua Web Audio API (vượt qua rào cản Safari Autoplay Policy trên iOS)
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
          // Fallback if backend returned empty
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

  const _speakWithBrowserUtterance = (cleanText, langTag, targetVoice, onEndCallback, onStartCallback, shouldCancel, rate = null, speechId = null) => {
    if (speechId && speechId !== activeSpeechIdRef.current) {
      return;
    }
    stopCurrentAudio();

    if (!('speechSynthesis' in window)) {
      if (onStartCallback) onStartCallback();
      if (onEndCallback) onEndCallback();
      return;
    }

    const effectiveRate = Math.max(0.5, Math.min(2.0, rate ?? speechRate ?? 1.0));

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      if (shouldCancel) {
        window.speechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = langTag;
      utterance.rate = Math.max(0.5, Math.min(2.0, rate || 1.0));
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      let selectedVoice = targetVoice;
      if (!selectedVoice && 'speechSynthesis' in window) {
        const availableVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
        const activeVoice = langTag.startsWith('vi') ? (viVoiceRef.current || 'vi-VN-HoaiMyNeural') : (enVoiceRef.current || 'en-US-JennyNeural');
        const isMale = activeVoice.toLowerCase().includes('namminh') || activeVoice.toLowerCase().includes('guy') || activeVoice.toLowerCase().includes('male');
        if (langTag.startsWith('vi')) {
          selectedVoice = isMale
            ? (availableVoices.find((v) => v.name.toLowerCase().includes('namminh') || v.name.toLowerCase().includes('nam minh')) ||
               availableVoices.find((v) => v.name.toLowerCase().includes('male') && v.lang.toLowerCase().startsWith('vi')) ||
               availableVoices.find((v) => v.lang.toLowerCase().startsWith('vi')))
            : (availableVoices.find((v) => v.name.toLowerCase().includes('hoaimy') || v.name.toLowerCase().includes('hoài my')) ||
               availableVoices.find((v) => v.name.toLowerCase().includes('female') && v.lang.toLowerCase().startsWith('vi')) ||
               availableVoices.find((v) => v.lang.toLowerCase().startsWith('vi')));
        } else {
          selectedVoice = isMale
            ? (availableVoices.find((v) => v.name.toLowerCase().includes('guy') || v.name.toLowerCase().includes('david')) ||
               availableVoices.find((v) => v.lang.toLowerCase().startsWith('en')))
            : (availableVoices.find((v) => v.name.toLowerCase().includes('jenny') || v.name.toLowerCase().includes('zira')) ||
               availableVoices.find((v) => v.lang.toLowerCase().startsWith('en')));
        }
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      // Ngăn Chromium Garbage Collector thu gom utterance giữa chừng gây đứng TTS
      activeUtteranceRef.current = utterance;
      if (typeof window !== 'undefined') {
        window._activeUtterance = utterance;
      }

      let hasFinished = false;
      const finishOnce = () => {
        if (hasFinished) return;
        hasFinished = true;
        if (safetyTimerRef.current) {
          clearTimeout(safetyTimerRef.current);
          safetyTimerRef.current = null;
        }
        activeUtteranceRef.current = null;
        if (typeof window !== 'undefined') {
          window._activeUtterance = null;
        }
        if (speechId && speechId !== activeSpeechIdRef.current) {
          return;
        }
        setIsSpeaking(false);
        if (onEndCallback) onEndCallback();
      };

      utterance.onstart = () => {
        if (speechId && speechId !== activeSpeechIdRef.current) {
          try {
            window.speechSynthesis.cancel();
          } catch (e) {}
          return;
        }
        setIsSpeaking(true);
        if (onStartCallback) onStartCallback();
      };

      utterance.onend = () => {
        finishOnce();
      };

      utterance.onerror = (err) => {
        console.warn("SpeechSynthesis error:", err);
        finishOnce();
      };

      // Safety timeout: đảm bảo onEndCallback luôn được kích hoạt kể cả khi browser nuốt mất onend
      // Tính theo tốc độ đọc rate để câu dài không bị timeout cắt ngang giữa chừng
      const wordCount = cleanText.split(/\s+/).length;
      const rateFactor = Math.max(0.5, rate || 1.0);
      const maxMs = Math.max((wordCount / rateFactor) * 700 + 4000, 8000);
      safetyTimerRef.current = setTimeout(() => {
        if (!speechId || speechId === activeSpeechIdRef.current) {
          finishOnce();
        }
      }, maxMs);

      // Auto-release dự phòng khi trình duyệt thiếu voice engine tiếng Việt (ví dụ Chrome trên Windows)
      if (!selectedVoice && langTag.startsWith('vi')) {
        setTimeout(() => {
          if (!hasFinished && (!speechId || speechId === activeSpeechIdRef.current)) {
            if (onStartCallback) onStartCallback();
          }
        }, 120);
        const fallbackReadMs = Math.min(Math.max(wordCount * 280, 2500), 5500);
        setTimeout(() => {
          if (!hasFinished && (!speechId || speechId === activeSpeechIdRef.current)) {
            finishOnce();
          }
        }, fallbackReadMs);
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("TTS Error:", err);
      setIsSpeaking(false);
      if (onStartCallback) onStartCallback();
      if (onEndCallback) onEndCallback();
    }
  };

  const playNextInQueue = async () => {
    if (queueRef.current.length === 0) {
      if (streamEndedRef.current) {
        isPlayingQueueRef.current = false;
        setIsSpeaking(false);
        if (onQueueEndCallbackRef.current) {
          const cb = onQueueEndCallbackRef.current;
          onQueueEndCallbackRef.current = null;
          cb();
        }
      } else {
        isPlayingQueueRef.current = false;
      }
      return;
    }

    isPlayingQueueRef.current = true;
    const nextItem = queueRef.current.shift();

    if (nextItem.speechId && nextItem.speechId !== activeSpeechIdRef.current) {
      playNextInQueue();
      return;
    }

    if (onQueueStartCallbackRef.current) {
      setIsSpeaking(true);
      onQueueStartCallbackRef.current();
      onQueueStartCallbackRef.current = null;
    }

    // 1. Kiểm tra nếu audio đã được tải trước sẵn trong RAM (0ms latency!)
    let audioObj = nextItem.getAudio ? nextItem.getAudio() : null;
    if (!audioObj && nextItem.audioPromise) {
      try {
        audioObj = await nextItem.audioPromise;
      } catch (e) {
        audioObj = null;
      }
    }

    if (nextItem.speechId && nextItem.speechId !== activeSpeechIdRef.current) {
      playNextInQueue();
      return;
    }

    if (audioObj) {
      stopCurrentAudio();
      audioRef.current = audioObj;
      audioObj.onplay = () => {
        if (nextItem.speechId && nextItem.speechId !== activeSpeechIdRef.current) {
          stopCurrentAudio();
          return;
        }
        setIsSpeaking(true);
      };
      audioObj.onended = () => {
        audioRef.current = null;
        if (!nextItem.speechId || nextItem.speechId === activeSpeechIdRef.current) {
          playNextInQueue();
        }
      };
      audioObj.onerror = () => {
        audioRef.current = null;
        if (!nextItem.speechId || nextItem.speechId === activeSpeechIdRef.current) {
          playNextInQueue();
        }
      };

      try {
        await audioObj.play();
        return;
      } catch (playErr) {
        console.warn('[Queue Audio Playback Error, fallback to WebSpeech]:', playErr);
      }
    }

    // 2. Fallback: Nếu chưa có audio, dùng speakWebSpeech thông thường
    speakWebSpeech(
      nextItem.text,
      nextItem.language || streamLangRef.current,
      () => {
        playNextInQueue();
      },
      () => {
        setIsSpeaking(true);
      },
      false,
      nextItem.rate ?? speechRate,
      nextItem.speechId
    );
  };

  const initStreamSpeech = (language = 'vi-VN', onStart = null, onEnd = null) => {
    cancel();
    queueRef.current = [];
    isPlayingQueueRef.current = false;
    streamEndedRef.current = false;
    onQueueStartCallbackRef.current = onStart;
    onQueueEndCallbackRef.current = onEnd;
    streamLangRef.current = language;
  };

  const enqueueStreamChunk = (chunkText, language = null, chunkRate = null) => {
    const rawText = (chunkText || '')
      .replace(/[*#_`\[\]()]/g, '')
      .replace(/^[\s*•\-–—]+\s*/gm, '')
      .trim();
    if (!rawText) return;

    const lang = language || streamLangRef.current || 'vi-VN';
    const speechId = activeSpeechIdRef.current;

    // PRE-FETCH AUDIO NGAY LẬP TỨC TRONG NỀN:
    let preloadedAudio = null;
    let audioPromise = null;

    const isSupportedEdgeLang = lang.startsWith('vi') || lang.startsWith('en');
    if (isSupportedEdgeLang) {
      const edgeVoice = lang.startsWith('vi') ? (viVoiceRef.current || 'vi-VN-HoaiMyNeural') : (enVoiceRef.current || 'en-US-JennyNeural');
      const edgeLang = lang.startsWith('vi') ? 'vi-VN' : 'en-US';
      audioPromise = synthesizeSpeech(rawText, { language: edgeLang, voice: edgeVoice })
        .then((data) => {
          if (speechId !== activeSpeechIdRef.current) return null;
          if (data?.audio_base64 && data.audio_base64.length > 50) {
            const audioSrc = `data:audio/mpeg;base64,${data.audio_base64}`;
            const audio = new Audio(audioSrc);
            audio.preload = 'auto';
            preloadedAudio = audio;
            return audio;
          }
          return null;
        })
        .catch(() => null);
    }

    const queueItem = {
      text: rawText,
      language: lang,
      audioPromise,
      getAudio: () => preloadedAudio,
      rate: chunkRate ?? speechRate,
      speechId,
    };

    queueRef.current.push(queueItem);
    if (!isPlayingQueueRef.current) {
      playNextInQueue();
    }
  };

  const endStreamSpeech = () => {
    streamEndedRef.current = true;
    if (!isPlayingQueueRef.current) {
      playNextInQueue();
    }
  };

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

    // 0. ƯU TIÊN PHÁT NGAY LẬP TỨC AUDIO PRELOADED TỪ /chat (0ms Network delay)
    if (preloadedAudioBase64 && preloadedAudioBase64.length > 100) {
      try {
        if (currentSpeechId !== activeSpeechIdRef.current) return;
        stopCurrentAudio();

        let audioSrc = '';
        let objectUrlToRevoke = null;
        try {
          const byteCharacters = atob(preloadedAudioBase64);
          const byteNumbers = new Uint8Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const blob = new Blob([byteNumbers], { type: 'audio/mpeg' });
          audioSrc = URL.createObjectURL(blob);
          objectUrlToRevoke = audioSrc;
        } catch {
          audioSrc = `data:audio/mpeg;base64,${preloadedAudioBase64}`;
        }

        const audio = getAudioPlayer();
        audio._blobUrl = objectUrlToRevoke;
        audio.src = audioSrc;
        audio.playbackRate = effectiveRate;
        audio.volume = 1.0;
        audioRef.current = audio;
        if (typeof window !== 'undefined') {
          window._activeAudioPlayer = audio;
        }

        audio.onplay = () => {
          if (currentSpeechId !== activeSpeechIdRef.current) {
            stopCurrentAudio();
            return;
          }
          hasStartedPlaying = true;
          recoveryHandled = true;
          // Tuyệt đối hủy Web Speech để tránh 2 giọng nói bị lồng vào nhau
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try { window.speechSynthesis.cancel(); } catch (e) {}
          }
          setIsSpeaking(true);
          if (actualOnStart) actualOnStart();
        };

        audio.onended = () => {
          if (typeof window !== 'undefined') {
            window._activeAudioPlayer = null;
          }
          if (currentSpeechId === activeSpeechIdRef.current) {
            setIsSpeaking(false);
            audioRef.current = null;
            if (actualOnEnd) actualOnEnd();
          }
        };

        audio.onerror = async () => {
          if (typeof window !== 'undefined') {
            window._activeAudioPlayer = null;
          }
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
        console.warn("[TTS Hook] Cannot play via HTML5 Audio, fallback to Web Audio API / WebSpeech:", playErr);
        if (currentSpeechId !== activeSpeechIdRef.current || hasStartedPlaying || recoveryHandled) return;
        stopCurrentAudio();

        // Thử giải mã và phát trực tiếp qua Web Audio API (vượt qua rào cản Safari User Gesture)
        try {
          const played = await playAudioBufferViaWebAudio(preloadedAudioBase64, effectiveRate, actualOnStart, actualOnEnd, currentSpeechId);
          if (played) {
            hasStartedPlaying = true;
            recoveryHandled = true;
            return;
          }
        } catch (ctxErr) {
          console.warn("[TTS Hook] Web Audio API fallback failed:", ctxErr);
        }

        if (!hasStartedPlaying && !recoveryHandled) {
          triggerSingleRecovery();
          return;
        }
      }
    }

    // 1. INSTANT WebSpeech / EdgeTTS fallback (khi không có preloadedAudio)
    if (currentSpeechId === activeSpeechIdRef.current) {
      if (skipRemoteTts) {
        // Backend đã thử tổng hợp TTS trước đó rồi, dùng ngay WebSpeech cục bộ để tránh gọi mạng 2 lần
        _speakWithBrowserUtterance(text, actualLang, null, actualOnEnd, actualOnStart, true, effectiveRate, currentSpeechId);
      } else {
        speakWebSpeech(text, actualLang, actualOnEnd, actualOnStart, true, effectiveRate, currentSpeechId, currentSignal, actualOptions);
      }
    }
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
    if (typeof window !== 'undefined') {
      window._activeUtterance = null;
    }
    stopCurrentAudio();
    if (typeof window !== 'undefined') {
      window._activeAudioPlayer = null;
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    setIsSpeaking(false);
  }, [stopCurrentAudio]);

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
