/**
 * Service tầng giao tiếp API kết nối tới FastAPI Backend AI Core.
 */

const API_BASE_URL = '/api/v1/ai';

export const sendChatPrompt = async (
  prompt,
  ragContext = null,
  language = 'auto',
  emotion = 'neutral',
  sessionId = 'default_session',
  roomNumber = null
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

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
  const timeoutId = setTimeout(() => controller.abort(), 3000);

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

