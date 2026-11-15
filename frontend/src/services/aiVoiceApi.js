const API_BASE_URL = '/api/v1/ai';

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
    const data = await res.json();
    if (typeof window !== 'undefined' && data) {
      if (data.speech_rate !== undefined) localStorage.setItem('rora_speech_rate', data.speech_rate.toString());
      if (data.vi_voice) localStorage.setItem('rora_vi_voice', data.vi_voice);
      if (data.en_voice) localStorage.setItem('rora_en_voice', data.en_voice);
    }
    return data;
  } catch (err) {
    console.warn('[AIApi] getVoiceSettings error:', err.message);
    const savedRate = typeof window !== 'undefined' ? localStorage.getItem('rora_speech_rate') : null;
    const savedViVoice = typeof window !== 'undefined' ? localStorage.getItem('rora_vi_voice') : null;
    const savedEnVoice = typeof window !== 'undefined' ? localStorage.getItem('rora_en_voice') : null;
    return {
      speech_rate: savedRate ? parseFloat(savedRate) : 1.0,
      rate_percentage: '+0%',
      vi_voice: savedViVoice || 'vi-VN-HoaiMyNeural',
      en_voice: savedEnVoice || 'en-US-JennyNeural',
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
      if (data?.speech_rate !== undefined) localStorage.setItem('rora_speech_rate', data.speech_rate.toString());
      if (data?.vi_voice) localStorage.setItem('rora_vi_voice', data.vi_voice);
      if (data?.en_voice) localStorage.setItem('rora_en_voice', data.en_voice);
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
      if (speech_rate !== undefined) localStorage.setItem('rora_speech_rate', speech_rate.toString());
      if (vi_voice) localStorage.setItem('rora_vi_voice', vi_voice);
      if (en_voice) localStorage.setItem('rora_en_voice', en_voice);
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
 * Lấy cấu hình Persona & Văn phong nói chuyện của Robot
 */
export const getPersonaSettings = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/persona-settings`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[AIApi] getPersonaSettings error:', err.message);
    return {
      bot_name: 'Rora',
      hotel_name: 'Aurora Grand Hotel',
      star_rating: 5,
      tone_style: 'luxury',
      pronoun_bot_vi: 'em hoặc Rora',
      pronoun_guest_vi: 'quý khách hoặc anh/chị',
      qr_cta_vi: 'Ngoài ra, Quý khách có thể quét mã QR trên màn hình để ghi nhớ chỉ dẫn nhé ạ.',
      qr_cta_en: 'In addition, you can scan the QR code on the screen to save the directions!',
      unhappy_empathy_vi: 'Khách đang có biểu cảm khó chịu hoặc chưa hài lòng, hãy phản hồi với thái độ xin lỗi chân thành, xoa dịu ân cần và cho biết nhân viên Concierge tại sảnh sẽ hỗ trợ ngay.',
      unhappy_empathy_en: 'The guest appears annoyed or dissatisfied. Respond with a sincere, caring apology and assure them that Concierge staff will assist right away.',
      out_of_scope_vi: 'Dạ Rora là trợ lý robot phục vụ tại khách sạn Aurora Grand Hotel và chỉ có thể hỗ trợ các thông tin, dịch vụ liên quan đến kỳ nghỉ của quý khách thôi ạ.',
      out_of_scope_en: 'I am Rora, your AI Concierge at Aurora Grand Hotel. I can only assist you with hotel amenities, services, and inquiries regarding your stay.',
    };
  }
};

/**
 * Admin cập nhật cấu hình Persona & Văn phong
 */
export const updatePersonaSettings = async (data) => {
  try {
    const res = await fetch(`${API_BASE_URL}/persona-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[AIApi] updatePersonaSettings error:', err.message);
    return data;
  }
};

/**
 * Khôi phục Persona mặc định
 */
export const resetPersonaSettings = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/persona-settings/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[AIApi] resetPersonaSettings error:', err.message);
    return null;
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
