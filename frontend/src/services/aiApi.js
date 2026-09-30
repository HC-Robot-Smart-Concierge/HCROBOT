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
  const { onTextChunk, onStreamDone, onError } = callbacks;

  if (onTextChunk) pipecatClient.onTextChunkCallback = onTextChunk;
  if (onStreamDone) pipecatClient.onStreamDoneCallback = onStreamDone;
  if (onError) pipecatClient.onErrorCallback = onError;

  pipecatClient.sendSpeechStream(text, roomNumber, language);
};

export const sendChatPrompt = async (
  prompt,
  ragContext = null,
  language = 'auto',
  emotion = 'neutral',
  sessionId = 'default_session',
  roomNumber = null
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

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

export const synthesizeSpeech = async (text, provider = 'edge', voice = null, language = 'vi-VN') => {
  try {
    const response = await fetch(`${API_BASE_URL}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        provider,
        voice,
        language,
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS Server returned status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    return {
      audio_base64: '',
      mime_type: 'audio/mp3',
      provider_used: 'browser',
      error: error.message,
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


