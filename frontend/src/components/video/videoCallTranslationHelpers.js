/**
 * Các hàm xử lý nghiệp vụ cốt lõi cho Phiên dịch Video Call 2 chiều (Staff ⇄ Robot):
 * - Phân tách Ngôn ngữ đầu vào (Input Language theo từng câu) và Ngôn ngữ đích của người nhận (Target Language).
 * - Kiểm tra chống vọng âm loa AI (Acoustic Echo) kèm mã lý do (reason) tường minh.
 * - Quản lý sequence hàng đợi phát âm thanh khi có câu lỗi TTS (tránh kẹt hàng đợi 1.2s).
 * - Đóng gói PCM Float32 16kHz Mono thành WAV Blob gửi tới Backend Bilingual STT.
 */

export const TTS_ERROR_CODES = {
  TTS_INPUT_EMPTY: 'TTS_INPUT_EMPTY',
  TTS_TIMEOUT: 'TTS_TIMEOUT',
  TTS_PROVIDER_ERROR: 'TTS_PROVIDER_ERROR',
  TTS_RESPONSE_INVALID: 'TTS_RESPONSE_INVALID',
  TTS_AUDIO_EMPTY: 'TTS_AUDIO_EMPTY',
  PLAYBACK_BLOCKED: 'PLAYBACK_BLOCKED',
  PLAYBACK_DECODE_ERROR: 'PLAYBACK_DECODE_ERROR',
};

export const STT_SKIP_REASONS = {
  EMPTY_TEXT: 'EMPTY_TEXT',
  MIC_MUTED: 'MIC_MUTED',
  CALL_NOT_CONNECTED: 'CALL_NOT_CONNECTED',
  ECHO_AI_SPEAKING: 'ECHO_AI_SPEAKING',
  ECHO_MATCHES_LAST_TTS: 'ECHO_MATCHES_LAST_TTS',
  ECHO_POST_TTS_TAIL: 'ECHO_POST_TTS_TAIL',
  DUPLICATE_UTTERANCE: 'DUPLICATE_UTTERANCE',
};

/**
 * Chuẩn hóa chuỗi để so sánh tương đồng (bỏ dấu câu, chữ thường, gộp khoảng trắng)
 */
export function normalizeForComparison(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[.,!?;:"'()[\]{}\-–—…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Kiểm tra xem văn bản vừa thu được có trùng hoặc nằm trong câu TTS vừa phát ra loa hay không
 */
export function isTextMatchingLastTts(spokenText, lastPlayedTtsText) {
  const normSpoken = normalizeForComparison(spokenText);
  const normTts = normalizeForComparison(lastPlayedTtsText);
  if (!normSpoken || !normTts) return false;
  if (normSpoken === normTts) return true;
  // Nếu câu thu được ngắn hơn hoặc bằng câu TTS và là chuỗi con dài (>= 6 ký tự) của câu TTS vừa phát
  if (normSpoken.length >= 6 && normTts.includes(normSpoken)) {
    return true;
  }
  return false;
}

/**
 * Đánh giá điều kiện nhận câu nói từ STT.
 * Trả về { allowed: boolean, reason: string | null }
 * Đảm bảo mọi trường hợp bỏ qua câu nói đều có reason cụ thể để log chẩn đoán.
 */
export function evaluateSpokenTextCommit({
  text,
  isMicMuted = false,
  callStatus = 'connected',
  isAiSpeaking = false,
  now = Date.now(),
  ttsActiveUntil = 0,
  lastPlayedTtsText = '',
  lastProcessedText = '',
  lastProcessedTime = 0,
  duplicateWindowMs = 2200,
}) {
  const cleanText = typeof text === 'string' ? text.trim() : '';
  if (!cleanText) {
    return { allowed: false, reason: STT_SKIP_REASONS.EMPTY_TEXT, cleanText: '' };
  }

  if (isMicMuted) {
    return { allowed: false, reason: STT_SKIP_REASONS.MIC_MUTED, cleanText };
  }

  if (callStatus !== 'connected') {
    return { allowed: false, reason: STT_SKIP_REASONS.CALL_NOT_CONNECTED, cleanText };
  }

  // 1. Khi loa AI đang thực sự phát âm thanh ra ngoài -> chặn thu âm phản xạ
  if (isAiSpeaking) {
    return { allowed: false, reason: STT_SKIP_REASONS.ECHO_AI_SPEAKING, cleanText };
  }

  // 2. Nếu nội dung khớp với câu TTS vừa phát (trong khoảng 4 giây gần nhất) -> chặn echo
  const matchesTts = isTextMatchingLastTts(cleanText, lastPlayedTtsText);
  if (matchesTts && now < ttsActiveUntil + 3500) {
    return { allowed: false, reason: STT_SKIP_REASONS.ECHO_MATCHES_LAST_TTS, cleanText };
  }

  // 3. Trong khoảng đuôi âm học ngắn sau khi TTS kết thúc (ttsActiveUntil),
  // chỉ chặn nếu nội dung giống TTS hoặc rất ngắn (<= 2 từ dễ bị dội âm cuối câu).
  // Nếu người dùng lập tức nói một câu mới hoàn toàn (>= 3 từ, không trùng TTS), CHO PHÉP đi qua!
  if (now < ttsActiveUntil) {
    const wordCount = cleanText.split(/\s+/).length;
    if (matchesTts || wordCount <= 2) {
      return { allowed: false, reason: STT_SKIP_REASONS.ECHO_POST_TTS_TAIL, cleanText };
    }
  }

  // 4. Chống chốt trùng lặp cùng một câu nói từ 2 nguồn (Web Speech API & Audio Stream STT Adapter)
  if (
    lastProcessedText &&
    normalizeForComparison(cleanText) === normalizeForComparison(lastProcessedText) &&
    now - lastProcessedTime < duplicateWindowMs
  ) {
    return { allowed: false, reason: STT_SKIP_REASONS.DUPLICATE_UTTERANCE, cleanText };
  }

  return { allowed: true, reason: null, cleanText };
}

/**
 * Xác định ngôn ngữ đích của phía nhận (targetLang) và giọng đọc TTS tương ứng.
 * Tách biệt hoàn toàn khỏi ngôn ngữ đầu vào (sourceLang):
 * - Khi role === 'guest' nói -> người nhận là Staff -> targetLang = 'vi', voice = 'vi-VN-HoaiMyNeural'
 * - Khi role === 'staff' nói -> người nhận là Guest -> targetLang = 'en' (khi mode === 'auto'), voice = 'en-US-JennyNeural'
 * - Khi mode === 'bypass' (Thuần Việt do người dùng chọn) -> targetLang = 'vi', không gọi TTS
 */
export function resolveTranslationTarget(senderRole, translateMode = 'auto') {
  if (translateMode === 'bypass') {
    return {
      peerRole: senderRole === 'staff' ? 'robot' : 'staff',
      targetLang: 'vi',
      ttsLangCode: 'vi-VN',
      ttsVoice: 'vi-VN-HoaiMyNeural',
      isBypassMode: true,
    };
  }

  if (senderRole === 'staff') {
    return {
      peerRole: 'robot',
      targetLang: 'en',
      ttsLangCode: 'en-US',
      ttsVoice: 'en-US-JennyNeural',
      isBypassMode: false,
    };
  }

  return {
    peerRole: 'staff',
    targetLang: 'vi',
    ttsLangCode: 'vi-VN',
    ttsVoice: 'vi-VN-HoaiMyNeural',
    isBypassMode: false,
  };
}

/**
 * Cập nhật expectedPlaySeq khi nhận được thông báo một sequence bị lỗi TTS ở phía gửi,
 * giúp hàng đợi âm thanh không phải chờ 1.2s cho một gói âm thanh không bao giờ tới.
 */
export function advanceExpectedSeqOnFailure(currentExpectedSeq, failedSeq, failedSeqSet) {
  if (typeof failedSeq === 'number' && failedSeq > 0 && failedSeqSet) {
    failedSeqSet.add(failedSeq);
  }
  let nextExpected = currentExpectedSeq || 1;
  if (typeof failedSeq === 'number' && failedSeq === nextExpected) {
    nextExpected = failedSeq + 1;
  }
  while (failedSeqSet && failedSeqSet.has(nextExpected)) {
    nextExpected += 1;
  }
  return nextExpected;
}

/**
 * Tính năng lượng âm thanh RMS của một khung PCM Float32
 */
export function calculateFrameRms(float32Array) {
  if (!float32Array || float32Array.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < float32Array.length; i++) {
    const sample = float32Array[i];
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / float32Array.length);
}

/**
 * Đóng gói danh sách các khung Float32Array thành file WAV 16-bit PCM Mono chuẩn.
 */
export function encodeWavBlobFromFloat32(chunks, sampleRate = 16000) {
  if (!chunks || chunks.length === 0) return null;
  let totalSamples = 0;
  for (const c of chunks) {
    totalSamples += c.length;
  }
  if (totalSamples === 0) return null;

  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true);  // NumChannels (1 = mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true);  // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const s = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

