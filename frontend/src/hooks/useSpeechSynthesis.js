import { useCallback, useEffect, useRef, useState } from 'react';
import { synthesizeSpeech } from '../services/aiApi';

const VI_VOICE = 'vi-VN-HoaiMyNeural';
const EN_VOICE = 'en-US-JennyNeural';
const POLICY = 'fixed-female-v1';
const audioCache = new Map();
const clampRate = value => Math.max(0.5, Math.min(2, Number(value) || 1));
const canonicalLang = value => /^(en|english)/i.test(value || '') ? 'en-US' : 'vi-VN';
const ratePercent = rate => {
  const percent = Math.round((rate - 1) * 100);
  return `${percent >= 0 ? '+' : ''}${percent}%`;
};
const abortError = () => new DOMException('Speech cancelled', 'AbortError');

/** One speaker per language. Playback failures never select a browser voice. */
export const useSpeechSynthesis = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechPending, setIsSpeechPending] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const [speechRate, setRate] = useState(() => {
    try { return clampRate(localStorage.getItem('rora_speech_rate')); } catch { return 1; }
  });
  const rateRef = useRef(speechRate);
  const epochRef = useRef(0);
  const controllerRef = useRef(null);
  const playerRef = useRef(null);
  const contextRef = useRef(null);
  const streamRef = useRef(null);
  const activeRef = useRef(false);

  const getPlayer = () => {
    if (!playerRef.current) {
      playerRef.current = new Audio();
      playerRef.current.setAttribute('playsinline', 'true');
      playerRef.current.setAttribute('webkit-playsinline', 'true');
      playerRef.current.preload = 'auto';
    }
    return playerRef.current;
  };
  const getContext = () => {
    if (!contextRef.current || contextRef.current.state === 'closed') {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      contextRef.current = window._sharedAudioCtx?.state !== 'closed' && window._sharedAudioCtx
        ? window._sharedAudioCtx : new Context();
      window._sharedAudioCtx = contextRef.current;
    }
    return contextRef.current;
  };

  // Called synchronously on a tap, before fetching audio (required on iPhone Safari).
  const prime = () => {
    const ctx = getContext();
    if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
    if (activeRef.current) return;
    const player = getPlayer();
    player.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    const epoch = epochRef.current;
    player.play()?.then(() => {
      if (epoch === epochRef.current && !activeRef.current) player.pause();
    }).catch(() => {});
  };

  const cancel = useCallback(() => {
    epochRef.current += 1;
    streamRef.current = null;
    controllerRef.current?.abort();
    controllerRef.current = null;
    const player = playerRef.current;
    if (player) {
      player.pause();
      player.removeAttribute('src');
      player.load();
    }
    activeRef.current = false;
    setIsSpeaking(false);
    setIsSpeechPending(false);
  }, []);

  const updateSpeechRate = useCallback(value => {
    const next = clampRate(value);
    rateRef.current = next;
    setRate(next);
    try { localStorage.setItem('rora_speech_rate', String(next)); } catch { /* storage optional */ }
  }, []);
  const updateVoiceSettings = useCallback(settings => {
    if (settings?.speech_rate != null) updateSpeechRate(settings.speech_rate);
    // Ignore stale/male voice selections in storage and cross-tab messages.
    try {
      localStorage.setItem('rora_vi_voice', VI_VOICE);
      localStorage.setItem('rora_en_voice', EN_VOICE);
    } catch { /* storage optional */ }
  }, [updateSpeechRate]);

  useEffect(() => {
    updateVoiceSettings({});
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('hcrobot_voice_settings') : null;
    if (channel) channel.onmessage = event => updateVoiceSettings(event.data);
    return () => { channel?.close(); cancel(); };
  }, [cancel, updateVoiceSettings]);

  const checkCurrent = (epoch, signal) => {
    if (signal.aborted || epoch !== epochRef.current) throw abortError();
  };

  const getAudio = async (text, language, rate, signal, preloaded) => {
    const voice = language === 'en-US' ? EN_VOICE : VI_VOICE;
    const percentage = ratePercent(rate);
    const matchesPolicy = data => data?.audio_base64 && data.voice_policy === POLICY &&
      data.voice === voice && data.language === language && data.rate === percentage && data.text === text &&
      ['edge', 'edge_cached'].includes(data.provider_used);
    const key = JSON.stringify([POLICY, voice, percentage, text]);
    if (matchesPolicy(preloaded)) return preloaded;
    if (audioCache.has(key)) return audioCache.get(key);
    const data = await synthesizeSpeech(text, { provider: 'edge', language, voice, rate: percentage, signal, timeoutMs: 12000 });
    if (signal.aborted) throw abortError();
    if (!matchesPolicy(data)) {
      throw Object.assign(new Error(data?.error_detail || 'Speech audio is unavailable.'), { code: data?.error_code || 'TTS_VOICE_MISMATCH' });
    }
    if (audioCache.size >= 64) audioCache.delete(audioCache.keys().next().value);
    audioCache.set(key, data);
    return data;
  };

  const playAudio = async (data, epoch, signal, onStart) => {
    checkCurrent(epoch, signal);
    const bytes = Uint8Array.from(atob(data.audio_base64), c => c.charCodeAt(0));
    let began = false;
    const started = () => {
      checkCurrent(epoch, signal);
      if (began) return;
      began = true;
      setIsSpeechPending(false);
      setIsSpeaking(true);
      onStart?.();
    };
    const player = getPlayer();
    const url = URL.createObjectURL(new Blob([bytes], { type: data.mime_type || 'audio/mpeg' }));
    try {
      await new Promise((resolve, reject) => {
        let settled = false;
        const done = error => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener('abort', aborted);
          player.onplaying = player.onended = player.onerror = null;
          player.pause();
          error ? reject(error) : resolve();
        };
        const aborted = () => done(abortError());
        const timer = setTimeout(() => done(new Error('Audio playback timed out.')), 180000);
        signal.addEventListener('abort', aborted, { once: true });
        player.onplaying = started;
        player.onended = () => done();
        player.onerror = () => done(new Error('Audio playback failed.'));
        // Rate is applied once by the TTS engine, with neutral pitch.
        player.playbackRate = 1;
        player.preservesPitch = true;
        player.volume = 1;
        player.src = url;
        window._activeAudioPlayer = player;
        try { Promise.resolve(player.play()).catch(done); } catch (error) { done(error); }
      });
    } catch (error) {
      checkCurrent(epoch, signal);
      if (began) throw error; // Never restart a partially spoken answer.
      // iOS can reject HTML media after an async fetch. Play the SAME audio via the unlocked context.
      const ctx = getContext();
      if (!ctx || ctx.state !== 'running') throw error;
      const decoded = await ctx.decodeAudioData(bytes.buffer.slice(0));
      checkCurrent(epoch, signal);
      await new Promise((resolve, reject) => {
        const source = ctx.createBufferSource();
        source.buffer = decoded;
        source.playbackRate.value = 1;
        source.connect(ctx.destination);
        const cleanup = () => {
          clearTimeout(timer);
          signal.removeEventListener('abort', aborted);
          source.onended = null;
          try { source.stop(); } catch { /* already ended */ }
          source.disconnect();
        };
        const aborted = () => { cleanup(); reject(abortError()); };
        const timer = setTimeout(() => { cleanup(); reject(new Error('Audio playback timed out.')); }, (decoded.duration + 5) * 1000);
        signal.addEventListener('abort', aborted, { once: true });
        source.onended = () => { cleanup(); resolve(); };
        source.start();
        started();
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const failureMessage = (language, error) => {
    if (error.name === 'NotAllowedError') return language === 'en-US'
      ? 'Tap the screen to enable sound, then try again.' : 'Chạm màn hình để bật âm thanh rồi thử lại.';
    return language === 'en-US'
      ? 'Voice audio is unavailable. Please read the response or try again.'
      : 'Hiện chưa phát được giọng nói. Quý khách có thể đọc câu trả lời hoặc thử lại.';
  };

  const speak = async (text, language = 'vi-VN', onEnd = null, onStart = null, preloaded = null, rate = null, options = {}) => {
    if (language && typeof language === 'object') {
      options = { ...options, ...language };
      language = options.lang || options.language || 'vi-VN';
      onEnd = options.onEnd || onEnd;
      onStart = options.onStart || onStart;
      rate = options.rate ?? rate;
    }
    cancel();
    prime();
    const epoch = epochRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    const lang = canonicalLang(language);
    const clean = String(text || '').trim();
    if (!clean) { onEnd?.(); return; }
    activeRef.current = true;
    setSpeechError(null);
    setIsSpeechPending(true);
    let failure = null;
    try {
      const data = await getAudio(clean, lang, clampRate(rate ?? rateRef.current), controller.signal, preloaded);
      checkCurrent(epoch, controller.signal);
      await playAudio(data, epoch, controller.signal, onStart);
    } catch (error) {
      if (controller.signal.aborted || epoch !== epochRef.current) return;
      failure = error;
      setSpeechError(failureMessage(lang, error));
    } finally {
      if (epoch === epochRef.current) {
        activeRef.current = false;
        setIsSpeaking(false);
        setIsSpeechPending(false);
      }
    }
    if (epoch !== epochRef.current) return;
    if (failure && options.onError) options.onError(failure);
    else onEnd?.(failure);
  };

  // Legacy name retained for callers; it never uses SpeechSynthesisUtterance.
  const speakWebSpeech = (text, lang, onEnd, onStart, _shouldCancel, rate, _id, _signal, options) =>
    speak(text, lang, onEnd, onStart, null, rate, options);

  const drainStream = async stream => {
    if (stream.playing || stream !== streamRef.current) return;
    stream.playing = true;
    try {
      while (stream.items.length && stream === streamRef.current) {
        const item = stream.items.shift();
        setIsSpeechPending(true);
        const data = await getAudio(item.text, stream.language, stream.rate, stream.controller.signal, null);
        checkCurrent(stream.epoch, stream.controller.signal);
        await playAudio(data, stream.epoch, stream.controller.signal, () => {
          if (!stream.started) { stream.started = true; stream.onStart?.(); }
        });
      }
      if (stream === streamRef.current && stream.ended) {
        activeRef.current = false;
        setIsSpeaking(false);
        setIsSpeechPending(false);
        streamRef.current = null;
        stream.onEnd?.();
      }
    } catch (error) {
      if (stream === streamRef.current) {
        cancel();
        setSpeechError(failureMessage(stream.language, error));
        stream.onEnd?.(error);
      }
    } finally { stream.playing = false; }
  };
  const initStreamSpeech = (language = 'vi-VN', onStart = null, onEnd = null) => {
    cancel();
    prime();
    const controller = new AbortController();
    controllerRef.current = controller;
    activeRef.current = true;
    setSpeechError(null);
    setIsSpeechPending(true);
    streamRef.current = { language: canonicalLang(language), rate: rateRef.current, epoch: epochRef.current, controller, onStart, onEnd, items: [], playing: false, ended: false, started: false };
  };
  const enqueueStreamChunk = text => {
    const stream = streamRef.current;
    if (!stream || stream.ended || !text?.trim()) return;
    stream.items.push({ text: text.trim() });
    void drainStream(stream);
  };
  const endStreamSpeech = () => {
    if (!streamRef.current) return;
    streamRef.current.ended = true;
    void drainStream(streamRef.current);
  };

  return {
    speak, speakWebSpeech, prime, cancel, stop: cancel, isSpeaking, isSpeechPending,
    isSpeechActive: isSpeaking || isSpeechPending, speechError,
    voices: [{ name: VI_VOICE, lang: 'vi-VN' }, { name: EN_VOICE, lang: 'en-US' }],
    speechRate, setSpeechRate: updateSpeechRate, updateSpeechRate,
    viVoice: VI_VOICE, enVoice: EN_VOICE, updateVoiceSettings,
    initStreamSpeech, enqueueStreamChunk, endStreamSpeech,
  };
};
