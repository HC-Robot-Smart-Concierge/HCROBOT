/**
 * Service tầng giao tiếp API kết nối tới Laptop FastAPI Backend.
 */

const API_BASE_URL = '/api/v1/ai';

export const sendChatPrompt = async (prompt, ragContext = null, language = 'auto', emotion = 'neutral') => {
  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        rag_context: ragContext,
        language: language,
        emotion: emotion,
      }),
    });



    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      response: 'Xin lỗi ông chủ, hiện tại hệ thống đang gặp gián đoạn kết nối tới AI Server.',
      error: error.message,
    };
  }
};

export const extractIntent = async (userSpeech) => {
  try {
    const response = await fetch(`${API_BASE_URL}/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_speech: userSpeech,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      action: 'unknown',
      error: error.message,
    };
  }
};
