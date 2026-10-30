/**
 * Service tầng giao tiếp API kết nối tới FastAPI Backend AI Core.
 * Hỗ trợ cả 2 chế độ: Legacy (HTTP REST) và Streaming (WebSocket).
 */

const API_BASE_URL = '/api/v1/ai';

/**
 * Gửi prompt qua WebSocket Streaming Pipeline (TTFA < 1s).
 * Sử dụng PipecatAudioClient để stream text + audio chunks real-time.
 */
export const sendChatStreamViaWebSocket = (pipecatClient, text, callbacks = {}, roomNumber = null, language = 'auto') => {
  const { onToken, onTextChunk, onStreamDone, onAudioEnded, onError } = callbacks;

  if (onToken) pipecatClient.onTokenCallback = onToken;
  if (onTextChunk) pipecatClient.onTextChunkCallback = onTextChunk;
  if (onStreamDone) pipecatClient.onStreamDoneCallback = onStreamDone;
  if (onAudioEnded) pipecatClient.onAudioEndedCallback = onAudioEnded;
  if (onError) pipecatClient.onErrorCallback = onError;

  pipecatClient.sendSpeechStream(text, roomNumber, language);
};

/**
 * Gửi prompt qua HTTP Server-Sent Events (SSE) Streaming Endpoint.
 * Nhận từng token text thời gian thực (TTFT < 200ms).
 */
export const sendChatStreamSSE = async (
  prompt,
  onToken,
  onDone,
  onError,
  options = {}
) => {
  const {
    sessionId = 'default_session',
    ragContext = null,
    language = 'auto',
    emotion = 'neutral',
    roomNumber = null,
    onAck = null,
  } = options;

  try {
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        prompt: prompt,
        rag_context: ragContext,
        language: language,
        emotion: emotion,
        room_number: roomNumber,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Giữ lại phần chưa hoàn chỉnh

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.event === 'ack' && onAck) {
              onAck();
            } else if (data.event === 'token' && onToken) {
              onToken(data.token, data.lang_code);
            } else if (data.event === 'done' && onDone) {
              onDone(data.full_text, data.lang_code, data);
            } else if (data.event === 'error' && onError) {
              onError(new Error(data.message));
            }
          } catch (e) {
            // Ignore parse errors on keep-alive
          }
        }
      }
    }

    if (buffer && buffer.trim().startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.trim().slice(6));
        if (data.event === 'token' && onToken) {
          onToken(data.token, data.lang_code);
        } else if (data.event === 'done' && onDone) {
          onDone(data.full_text, data.lang_code, data);
        }
      } catch (e) {}
    }
  } catch (err) {
    if (onError) onError(err);
  }
};

export const sendChatPrompt = async (
  prompt,
  ragContext = null,
  language = 'auto',
  emotion = 'neutral',
  sessionId = 'default_session',
  roomNumber = null,
  externalSignal = null
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        session_id: sessionId,
        prompt: prompt,
        rag_context: ragContext,
        language: language,
        emotion: emotion,
        room_number: roomNumber,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error?.name === 'AbortError' || controller.signal.aborted) {
      return {
        aborted: true,
        response: '',
        error: 'Request aborted',
      };
    }
    return {
      response: 'Dạ, hiện tại có gián đoạn kết nối tới AI Server.',
      error: error.message,
    };
  }
};

export const extractIntent = async (userSpeech, sessionId = 'default_session', roomNumber = null) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_BASE_URL}/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        session_id: sessionId,
        user_speech: userSpeech,
        room_number: roomNumber,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      action: 'unknown',
      error: error.message,
    };
  }
};

export const resetSession = async (sessionId = 'default_session') => {
  try {
    const response = await fetch(`${API_BASE_URL}/session/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
      }),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const flushSession = async (sessionId = 'default_session') => {
  try {
    const response = await fetch(`${API_BASE_URL}/session/flush`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
      }),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const synthesizeSpeech = async (text, optionsOrProvider = 'edge', voice = null, language = 'vi-VN', optionalSignal = null) => {
  let provider = 'edge';
  let targetVoice = voice;
  let targetLang = language;
  let externalSignal = optionalSignal;
  let timeoutMs = 7000;

  if (typeof optionsOrProvider === 'object' && optionsOrProvider !== null) {
    provider = optionsOrProvider.provider || 'edge';
    targetVoice = optionsOrProvider.voice || voice;
    targetLang = optionsOrProvider.language || language;
    externalSignal = optionsOrProvider.signal || optionalSignal || null;
    if (typeof optionsOrProvider.timeoutMs === 'number' && optionsOrProvider.timeoutMs > 0) {
      timeoutMs = optionsOrProvider.timeoutMs;
    }
  } else if (typeof optionsOrProvider === 'string') {
    provider = optionsOrProvider;
  }

  const cleanText = typeof text === 'string' ? text.trim() : '';
  if (!cleanText) {
    return {
      audio_base64: '',
      mime_type: 'audio/mp3',
      provider_used: 'none',
      error_code: 'TTS_INPUT_EMPTY',
      error_detail: 'Input text is empty before calling /tts',
      error: 'TTS_INPUT_EMPTY: Input text is empty before calling /tts',
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        text: cleanText,
        provider,
        voice: targetVoice,
        language: targetLang,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const statusDetail = `TTS Server returned HTTP ${response.status}`;
      return {
        audio_base64: '',
        mime_type: 'audio/mp3',
        provider_used: 'none',
        error_code: 'TTS_PROVIDER_ERROR',
        error_detail: statusDetail,
        error: `TTS_PROVIDER_ERROR: ${statusDetail}`,
      };
    }

    let data = null;
    try {
      data = await response.json();
    } catch (parseErr) {
      return {
        audio_base64: '',
        mime_type: 'audio/mp3',
        provider_used: 'none',
        error_code: 'TTS_RESPONSE_INVALID',
        error_detail: `Invalid JSON from /tts: ${parseErr.message}`,
        error: `TTS_RESPONSE_INVALID: ${parseErr.message}`,
      };
    }

    if (!data || typeof data !== 'object' || typeof data.audio_base64 !== 'string') {
      return {
        audio_base64: '',
        mime_type: 'audio/mp3',
        provider_used: 'none',
        error_code: 'TTS_RESPONSE_INVALID',
        error_detail: 'Missing audio_base64 field in /tts response',
        error: 'TTS_RESPONSE_INVALID: Missing audio_base64 field in /tts response',
      };
    }

    if (!data.audio_base64.trim()) {
      const errCode = data.error_code || 'TTS_AUDIO_EMPTY';
      const errDetail = data.error_detail || `Provider ${data.provider_used || provider} returned empty audio_base64`;
      return {
        ...data,
        audio_base64: '',
        error_code: errCode,
        error_detail: errDetail,
        error: `${errCode}: ${errDetail}`,
      };
    }

    return {
      ...data,
      error_code: null,
      error_detail: null,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error?.name === 'AbortError' || controller.signal.aborted) {
      const code = timedOut ? 'TTS_TIMEOUT' : 'TTS_ABORTED';
      const detail = timedOut ? `TTS request timed out after ${timeoutMs}ms` : 'TTS request aborted by caller';
      return {
        aborted: !timedOut,
        audio_base64: '',
        mime_type: 'audio/mp3',
        provider_used: 'none',
        error_code: code,
        error_detail: detail,
        error: `${code}: ${detail}`,
      };
    }
    return {
      audio_base64: '',
      mime_type: 'audio/mp3',
      provider_used: 'none',
      error_code: 'TTS_PROVIDER_ERROR',
      error_detail: error.message || 'Network error calling /tts',
      error: `TTS_PROVIDER_ERROR: ${error.message || 'Network error calling /tts'}`,
    };
  }
};

/**
 * Lay danh sach tat ca phien hoi thoai (Chat Sessions)
 */
export const fetchChatSessions = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('[AIApi] fetchChatSessions fallback:', error.message);
    return [];
  }
};

/**
 * Lay chi tiet cac luot tin nhan trong mot phien
 */
export const fetchSessionMessages = async (sessionId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/messages`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`[AIApi] fetchSessionMessages fallback for ${sessionId}:`, error.message);
    return [];
  }
};

/**
 * Gui danh gia va nhan xet cua khach hang (1 - 5 sao)
 */
export const submitFeedback = async (feedbackData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(feedbackData),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('[AIApi] submitFeedback fallback:', error.message);
    return {
      id: `fb_${Date.now()}`,
      ...feedbackData,
    };
  }
};

/**
 * Xem danh sach tat ca danh gia phan hoi cua khach hang
 */
export const fetchFeedbacks = async (category = null, limit = 50) => {
  try {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (limit) params.append('limit', limit);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/feedback${qs}`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('[AIApi] fetchFeedbacks fallback:', error.message);
    return [];
  }
};

/**
 * Chuyển đổi file âm thanh WAV thành văn bản thông qua Backend STT Engine
 * (Hỗ trợ nhận diện đa ngữ EN/VI trực tiếp từ tín hiệu âm thanh).
 */
export const transcribeCallAudio = async (
  audioBlob,
  { language = 'auto', preferredLang = 'en', signal = null } = {}
) => {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'call_speech.wav');
    formData.append('language', language);
    formData.append('preferred_lang', preferredLang);

    const response = await fetch(`${API_BASE_URL}/stt/transcribe`, {
      method: 'POST',
      body: formData,
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    return {
      success: Boolean(data?.success),
      text: (data?.text || '').trim(),
      detected_language: data?.detected_language || preferredLang,
      confidence: typeof data?.confidence === 'number' ? data.confidence : 0,
      provider: data?.provider || 'backend_stt',
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      detected_language: preferredLang,
      confidence: 0,
      provider: 'none',
      error: error.message,
    };
  }
};

/**
 * Chuyển đổi file âm thanh WAV thành văn bản thông qua Backend STT Engine (tương thích ngược)
 */
export const transcribeAudio = async (audioBlob, language = 'vi') => {
  const res = await transcribeCallAudio(audioBlob, {
    language,
    preferredLang: language === 'en' ? 'en' : 'vi',
  });
  return res.text || '';
};

/**
 * Lấy cấu hình tốc độ phát và giọng nói hiện tại từ Backend
 */
export const getVoiceSettings = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/voice-settings`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[AIApi] getVoiceSettings error:', err.message);
    const saved = typeof window !== 'undefined' ? localStorage.getItem('rora_speech_rate') : null;
    return {
      speech_rate: saved ? parseFloat(saved) : 1.0,
      rate_percentage: '+0%',
      vi_voice: 'vi-VN-HoaiMyNeural',
      en_voice: 'en-US-JennyNeural',
    };
  }
};

/**
 * Admin cập nhật cấu hình tốc độ phát và giọng nói toàn hệ thống
 */
export const updateVoiceSettings = async ({ speech_rate, vi_voice, en_voice }) => {
  try {
    const res = await fetch(`${API_BASE_URL}/voice-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speech_rate, vi_voice, en_voice }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (typeof window !== 'undefined') {
      localStorage.setItem('rora_speech_rate', data.speech_rate.toString());
      try {
        const bc = new BroadcastChannel('hcrobot_voice_settings');
        bc.postMessage({ type: 'VOICE_SETTINGS_UPDATED', ...data });
        bc.close();
      } catch {}
    }
    return data;
  } catch (err) {
    console.warn('[AIApi] updateVoiceSettings error:', err.message);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rora_speech_rate', speech_rate.toString());
    }
    return {
      speech_rate,
      rate_percentage: '+0%',
      vi_voice: vi_voice || 'vi-VN-HoaiMyNeural',
      en_voice: en_voice || 'en-US-JennyNeural',
    };
  }
};

/**
 * Phiên dịch nhanh câu nói trực tiếp trong cuộc gọi Video Call (Anh ⇄ Việt)
 * Tự động nhận diện ngôn ngữ và bỏ qua dịch nếu cùng ngôn ngữ đích
 */
export const quickTranslateText = async ({
  text,
  sourceLang = 'auto',
  targetLang = 'vi',
  sessionId = null,
  senderRole = 'guest',
  withAudio = true,
}) => {
  if (!text || !text.trim()) {
    return {
      original_text: '',
      translated_text: '',
      source_lang: 'vi',
      target_lang: targetLang,
      needs_translation: false,
      audio_base64: null,
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(),
        source_lang: sourceLang,
        target_lang: targetLang,
        session_id: sessionId,
        sender_role: senderRole,
        with_audio: withAudio,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[AIApi] quickTranslateText fallback:', err.message);
    return {
      original_text: text,
      translated_text: text,
      source_lang: sourceLang === 'auto' ? 'vi' : sourceLang,
      target_lang: targetLang,
      needs_translation: false,
      error: err.message,
    };
  }
};
