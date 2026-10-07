import { useState, useEffect, useRef } from 'react';
import { synthesizeSpeech } from '../services/aiApi';

export const useSpeechSynthesis = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const audioRef = useRef(null);
  const activeUtteranceRef = useRef(null);
  const safetyTimerRef = useRef(null);

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

  // Unlock TTS Audio Engine on Mobile / Kiosk Gesture
  const prime = () => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.resume();
      const silentUtterance = new SpeechSynthesisUtterance('');
      silentUtterance.volume = 0.01;
      silentUtterance.lang = 'vi-VN';
      window.speechSynthesis.speak(silentUtterance);
    } catch (e) {
      // Ignore mobile unlock warnings
    }
  };

  // Streaming Speech Queue State
  const queueRef = useRef([]);
  const isPlayingQueueRef = useRef(false);
  const streamEndedRef = useRef(false);
  const onQueueEndCallbackRef = useRef(null);
  const onQueueStartCallbackRef = useRef(null);
  const streamLangRef = useRef('vi-VN');

  const speakWebSpeech = (text, language = 'vi-VN', onEndCallback = null, onStartCallback = null, shouldCancel = true) => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }

    const cleanText = (text || '')
      .replace(/[*#_`\[\]()]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
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

    if (langTag.startsWith('vi')) {
      targetVoice = availableVoices.find((v) => v.name.toLowerCase().includes('hoaimy') || v.name.toLowerCase().includes('hoài my')) ||
        availableVoices.find((v) => v.name.toLowerCase().includes('namminh') || v.name.toLowerCase().includes('nam minh')) ||
        availableVoices.find((v) => v.name.toLowerCase().includes('natural') && v.lang.toLowerCase().startsWith('vi')) ||
        availableVoices.find((v) => v.name.toLowerCase().includes('google') && v.lang.toLowerCase().startsWith('vi')) ||
        availableVoices.find((v) => v.lang.toLowerCase().startsWith('vi') || v.name.toLowerCase().includes('vietnamese'));
    } else if (langTag.startsWith('en')) {
      targetVoice = availableVoices.find(
        (v) =>
          v.lang.toLowerCase().startsWith('en') ||
          v.name.toLowerCase().includes('english') ||
          v.name.toLowerCase().includes('zira') ||
          v.name.toLowerCase().includes('david')
      );
    }

    // NẾU LÀ TIẾNG VIỆT VÀ TRÌNH DUYỆT KHÔNG CÓ GIỌNG TIẾNG VIỆT NÀO (ví dụ: Chrome trên Windows mặc định):
    // Tự động gọi backend EdgeTTS Neural vi-VN-HoaiMyNeural để phát giọng chuẩn 100% tự nhiên!
    if (langTag.startsWith('vi') && !targetVoice) {
      synthesizeSpeech(cleanText, { language: 'vi-VN', voice: 'vi-VN-HoaiMyNeural' })
        .then((data) => {
          if (data?.audio_base64 && data.audio_base64.length > 50) {
            const audioSrc = `data:audio/mp3;base64,${data.audio_base64}`;
            const audio = new Audio(audioSrc);
            audioRef.current = audio;

            audio.onplay = () => {
              setIsSpeaking(true);
              if (onStartCallback) onStartCallback();
            };

            audio.onended = () => {
              setIsSpeaking(false);
              audioRef.current = null;
              if (onEndCallback) onEndCallback();
            };

            audio.onerror = () => {
              setIsSpeaking(false);
              audioRef.current = null;
              if (onEndCallback) onEndCallback();
            };

            audio.play().catch(() => {
              setIsSpeaking(false);
              if (onEndCallback) onEndCallback();
            });
            return;
          }
          // Fallback if backend returned empty
          _speakWithBrowserUtterance(cleanText, langTag, null, onEndCallback, onStartCallback, shouldCancel);
        })
        .catch(() => {
          _speakWithBrowserUtterance(cleanText, langTag, null, onEndCallback, onStartCallback, shouldCancel);
        });
      return;
    }

    _speakWithBrowserUtterance(cleanText, langTag, targetVoice, onEndCallback, onStartCallback, shouldCancel);
  };

  const _speakWithBrowserUtterance = (cleanText, langTag, targetVoice, onEndCallback, onStartCallback, shouldCancel) => {
    if (!('speechSynthesis' in window)) {
      if (onStartCallback) onStartCallback();
      if (onEndCallback) onEndCallback();
      return;
    }

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      if (shouldCancel) {
        window.speechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = langTag;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      if (targetVoice) {
        utterance.voice = targetVoice;
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
        if (queueRef.current.length === 0 && streamEndedRef.current) {
          setIsSpeaking(false);
        }
        if (onEndCallback) onEndCallback();
      };

      utterance.onstart = () => {
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
      const wordCount = cleanText.split(/\s+/).length;
      const maxMs = Math.max(wordCount * 450 + 1500, 3000);
      safetyTimerRef.current = setTimeout(() => {
        finishOnce();
      }, maxMs);

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("TTS Error:", err);
      setIsSpeaking(false);
      if (onStartCallback) onStartCallback();
      if (onEndCallback) onEndCallback();
    }
  };

  const playNextInQueue = () => {
    if (!('speechSynthesis' in window)) {
      if (onQueueEndCallbackRef.current) onQueueEndCallbackRef.current();
      return;
    }

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

    speakWebSpeech(
      nextItem.text,
      nextItem.language || streamLangRef.current,
      () => {
        playNextInQueue();
      },
      () => {
        setIsSpeaking(true);
        if (onQueueStartCallbackRef.current) {
          onQueueStartCallbackRef.current();
          onQueueStartCallbackRef.current = null;
        }
      },
      false
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

  const enqueueStreamChunk = (chunkText, language = null) => {
    if (!chunkText || !chunkText.trim()) return;
    queueRef.current.push({
      text: chunkText.trim(),
      language: language || streamLangRef.current,
    });
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

  const speak = async (text, language = 'vi-VN', onEndCallback = null, onStartCallback = null, preloadedAudioBase64 = null) => {
    cancel();

    if (!text || !text.trim()) {
      if (onStartCallback) onStartCallback();
      if (onEndCallback) onEndCallback();
      return;
    }

    // 0. ƯU TIÊN PHÁT NGAY LẬP TỨC AUDIO PRELOADED TỪ /chat (0ms Network delay)
    if (preloadedAudioBase64 && preloadedAudioBase64.length > 100) {
      try {
        const audioSrc = `data:audio/mp3;base64,${preloadedAudioBase64}`;
        const audio = new Audio(audioSrc);
        audioRef.current = audio;

        audio.onplay = () => {
          setIsSpeaking(true);
          if (onStartCallback) onStartCallback();
        };

        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          if (onEndCallback) onEndCallback();
        };

        audio.onerror = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          speakWebSpeech(text, language, onEndCallback, onStartCallback);
        };

        await audio.play();
        return;
      } catch (playErr) {
        console.warn("[TTS Hook] Cannot play preloaded audio directly, fallback to speech:", playErr);
      }
    }

    // 1. INSTANT WebSpeech / EdgeTTS fallback
    speakWebSpeech(text, language, onEndCallback, onStartCallback);
  };

  const cancel = () => {
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
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) {}
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  return {
    speak,
    prime,
    cancel,
    isSpeaking,
    initStreamSpeech,
    enqueueStreamChunk,
    endStreamSpeech,
  };
};
