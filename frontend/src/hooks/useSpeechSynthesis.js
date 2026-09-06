import { useState, useEffect, useRef } from 'react';
import { synthesizeSpeech } from '../services/aiApi';

export const useSpeechSynthesis = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const audioRef = useRef(null);

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

  // Unlock TTS Audio Engine on Mobile User Touch Gesture (iOS Safari / Android Chrome)
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

  const speakWebSpeech = (text, language = 'vi-VN', onEndCallback = null, onStartCallback = null) => {
    if (!('speechSynthesis' in window)) {
      if (onStartCallback) onStartCallback();
      if (onEndCallback) onEndCallback();
      return;
    }

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const hasVietnameseDiacritics = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(text);
      const hasVietnameseKeywords = /\b(dạ|em|anh|chị|quý khách|khách sạn|phòng|đã|rồi|ạ|hỗ trợ|yêu cầu|dịch vụ|không|có|tại|tầng|hồ bơi|cảm ơn|bảo trì|lễ tân|nhân viên|vận chuyển|hành lý)\b/i.test(text);
      const isVietnameseText = hasVietnameseDiacritics || hasVietnameseKeywords;

      let langTag = 'vi-VN';
      if (isVietnameseText) {
        langTag = 'vi-VN';
      } else if (typeof language === 'string' && (language.toLowerCase().includes('en') || language.toLowerCase().includes('english'))) {
        langTag = 'en-US';
      } else {
        langTag = 'vi-VN';
      }

      utterance.lang = langTag;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const availableVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
      
      if (langTag.startsWith('vi')) {
        const viVoice = availableVoices.find(
          (v) =>
            v.lang.toLowerCase().startsWith('vi') ||
            v.name.toLowerCase().includes('vietnamese') ||
            v.name.toLowerCase().includes('hoaimy') ||
            v.name.toLowerCase().includes('namminh') ||
            v.name.toLowerCase().includes('google tiếng việt') ||
            v.name.toLowerCase().includes('tiếng việt')
        );
        if (viVoice) {
          utterance.voice = viVoice;
        }
      } else if (langTag.startsWith('en')) {
        const enVoice = availableVoices.find(
          (v) =>
            v.lang.toLowerCase().startsWith('en') ||
            v.name.toLowerCase().includes('english') ||
            v.name.toLowerCase().includes('zira') ||
            v.name.toLowerCase().includes('david')
        );
        if (enVoice) {
          utterance.voice = enVoice;
        }
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        if (onStartCallback) onStartCallback();
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        if (onEndCallback) onEndCallback();
      };

      utterance.onerror = (err) => {
        console.warn("SpeechSynthesis error:", err);
        setIsSpeaking(false);
        if (onStartCallback) onStartCallback();
        if (onEndCallback) onEndCallback();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("TTS Error:", err);
      setIsSpeaking(false);
      if (onStartCallback) onStartCallback();
      if (onEndCallback) onEndCallback();
    }
  };

  const speak = async (text, language = 'vi-VN', onEndCallback = null, onStartCallback = null) => {
    cancel();

    if (!text || !text.trim()) {
      if (onStartCallback) onStartCallback();
      if (onEndCallback) onEndCallback();
      return;
    }

    try {
      // 1. Gọi tới Backend TTS Engine (EdgeTTS / ElevenLabs / OpenAI)
      const res = await synthesizeSpeech(text, 'edge', null, language);
      if (res && res.audio_base64 && res.audio_base64.length > 100) {
        const audioSrc = `data:${res.mime_type || 'audio/mp3'};base64,${res.audio_base64}`;
        const audio = new Audio(audioSrc);
        audioRef.current = audio;

        audio.onplay = () => {
          setIsSpeaking(true);
          if (onStartCallback) onStartCallback();
        };

        audio.onended = () => {
          setIsSpeaking(false);
          if (onEndCallback) onEndCallback();
        };

        audio.onerror = () => {
          setIsSpeaking(false);
          speakWebSpeech(text, language, onEndCallback, onStartCallback);
        };

        await audio.play();
        return;
      }
    } catch (err) {
      console.info("Backend TTS Stream unavailable, using Web Speech API fallback:", err);
    }

    // 2. Fallback sang Web Speech API trình duyệt
    speakWebSpeech(text, language, onEndCallback, onStartCallback);
  };

  const cancel = () => {
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
  };
};

