import { synthesizeSpeech } from '../services/aiApi';

export function cleanupAudioElements({ activeSourceNodeRef, persistentAudioRef, audioRef }) {
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
}

export function createPreloadedAudioSource(preloadedAudioBase64) {
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
  return { audioSrc, objectUrlToRevoke };
}

export function primeSpeechEngines({ getAudioContext, getAudioPlayer }) {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } catch (e) {}

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.resume();
      const silentUtterance = new SpeechSynthesisUtterance('');
      silentUtterance.volume = 0.01;
      silentUtterance.lang = 'vi-VN';
      window.speechSynthesis.speak(silentUtterance);
    } catch (e) {}
  }

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
}

export function sanitizeSpeechText(text) {
  return (text || '')
    .replace(/[*#_`\[\]()]/g, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/^[\s*•\-–—]+\s*/gm, '')
    .replace(/\.{2,}/g, '.')
    .replace(/!{2,}/g, '!')
    .replace(/\?{2,}/g, '?')
    .replace(/:\s+/g, ', ')
    .replace(/\s*;\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveSpeechVoiceAndLang(cleanText, language, voices) {
  const hasVietnameseDiacritics = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(cleanText);
  const hasVietnameseKeywords = /\b(dạ|em|anh|chị|quý khách|khách sạn|phòng|đã|rồi|ạ|hỗ trợ|yêu cầu|dịch vụ|không|có|tại|tầng|hồ bơi|cảm ơn|bảo trì|lễ tân|nhân viên|vận chuyển|hành lý)\b/i.test(cleanText);
  const isVietnameseText = hasVietnameseDiacritics || hasVietnameseKeywords;

  let langTag = 'vi-VN';
  if (!isVietnameseText && typeof language === 'string' && (language.toLowerCase().includes('en') || language.toLowerCase().includes('english'))) {
    langTag = 'en-US';
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

  return { langTag, targetVoice };
}

export function speakWithBrowserUtterance({
  cleanText,
  langTag,
  targetVoice,
  onEndCallback,
  onStartCallback,
  shouldCancel,
  rate = null,
  speechRate,
  speechId = null,
  activeSpeechIdRef,
  stopCurrentAudio,
  activeUtteranceRef,
  safetyTimerRef,
  setIsSpeaking,
}) {
  if (speechId && speechId !== activeSpeechIdRef.current) {
    return;
  }
  stopCurrentAudio();

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

    const effectiveRate = Math.max(0.5, Math.min(2.0, rate ?? speechRate ?? 1.0));
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = langTag;
    utterance.rate = Math.max(0.5, Math.min(2.0, rate || 1.0));
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    if (targetVoice) {
      utterance.voice = targetVoice;
    }

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
      console.warn('SpeechSynthesis error:', err);
      finishOnce();
    };

    const wordCount = cleanText.split(/\s+/).length;
    const rateFactor = Math.max(0.5, effectiveRate || 1.0);
    const maxMs = Math.max((wordCount / rateFactor) * 700 + 4000, 8000);
    safetyTimerRef.current = setTimeout(() => {
      if (!speechId || speechId === activeSpeechIdRef.current) {
        finishOnce();
      }
    }, maxMs);

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('TTS Error:', err);
    setIsSpeaking(false);
    if (onStartCallback) onStartCallback();
    if (onEndCallback) onEndCallback();
  }
}

export function createStreamingQueueController({
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
}) {
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

    let preloadedAudio = null;
    let audioPromise = null;

    const isSupportedEdgeLang = lang.startsWith('vi') || lang.startsWith('en');
    if (isSupportedEdgeLang) {
      const edgeVoice = lang.startsWith('vi') ? 'vi-VN-HoaiMyNeural' : 'en-US-JennyNeural';
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

  return { initStreamSpeech, enqueueStreamChunk, endStreamSpeech };
}
