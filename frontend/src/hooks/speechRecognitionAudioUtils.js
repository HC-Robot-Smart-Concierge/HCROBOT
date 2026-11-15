import { transcribeAudio } from '../services/aiApi';

// ============================================================
// Helper: WAV PCM 16-Bit Mono Encoder & Downsampler
// ============================================================
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function downsampleBuffer(buffer, inputSampleRate, outputSampleRate = 16000) {
  if (inputSampleRate === outputSampleRate) return buffer;
  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

export function encodeWAV(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

export function normalizeHotelSpeechTranscript(rawText) {
  if (!rawText) return '';
  let clean = rawText;
  // Sửa lỗi âm học tiếng Việt nhận diện "bar" thành "ba"
  clean = clean.replace(/\b(?:quầy|quay|quán|quan|sky|rooftop)\s+ba\b/gi, 'quầy bar');
  clean = clean.replace(/\b(?:lên|ra|đi|vào|uống ở)\s+ba\b/gi, 'lên bar');
  clean = clean.replace(/\bba\s+(ở đâu|o dau|chỗ nào|cho nao|tầng mấy|tang may|hướng nào|huong nao|lối nào|loi nao)\b/gi, 'quầy bar $1');
  clean = clean.replace(/^(?:cho tôi hỏi\s+)?ba\s+(?:ở đâu|o dau)\b/gi, 'quầy bar ở đâu');
  return clean;
}

export function buildSemanticSilenceDebounce(speechFinalMs, interimMs, extendedMs) {
  return function getSemanticSilenceDebounce(text, isCurrentFinal = true) {
    if (!text || !text.trim()) {
      return isCurrentFinal ? speechFinalMs : interimMs;
    }

    const clean = text.trim().toLowerCase();
    const words = clean.split(/\s+/).filter(Boolean);

    const endsWithIncompleteWord = /(?:\b(?:cho\s+(?:tôi|toi|em|anh|chị|chi|mình|minh)?\s*(?:hỏi|hoi|xin hỏi|xin hoi)|em ơi|em oi|tôi muốn|toi muon|tôi cần|toi can|cho tôi|cho toi|làm sao|lam sao|và|va|hoặc|hoac|thì|thi|là|la|ở|o|tại|tai|trong|về|ve|với|voi|nhưng|nhung|mà|ma|ạ|a|ơi|oi|nha|nhé|nhe|à|ừm|ờ|hả|ha|muốn|muon|cần|can|giúp|giup|hỏi|hoi|xem|để|de)\b|[,\.\.\.\-])$/i.test(clean);

    const isShortIncompleteUtterance =
      words.length < 4 &&
      !/(\b(?:ở đâu|o dau|mấy giờ|may gio|bao nhiêu|bao nhieu|không|khong|chưa|chua|thế nào|the nao)\b|\?$)/i.test(clean);

    if (endsWithIncompleteWord || isShortIncompleteUtterance) {
      return extendedMs;
    }

    return isCurrentFinal ? speechFinalMs : interimMs;
  };
}

export async function runBackendSTT({
  force = false,
  isTranscribingRef,
  utteranceCommittedRef,
  shouldListenRef,
  audioChunksRef,
  hasDetectedVoiceRef,
  liveRef,
  lastFinalTranscriptRef,
  listenEpochRef,
  audioContextRef,
  currentLanguageRef,
  inlineCallbacksRef,
  callbacksRef,
  setIsTranscribing,
  setTranscript,
  commitFinalTranscript,
}) {
  if (isTranscribingRef.current || (!force && (utteranceCommittedRef.current || !shouldListenRef.current))) {
    audioChunksRef.current = [];
    hasDetectedVoiceRef.current = false;
    return;
  }

  if (!force && (audioChunksRef.current.length < 8 || !hasDetectedVoiceRef.current)) {
    audioChunksRef.current = [];
    hasDetectedVoiceRef.current = false;
    return;
  }
  if (force && audioChunksRef.current.length < 2) {
    audioChunksRef.current = [];
    hasDetectedVoiceRef.current = false;
    return;
  }

  if (liveRef.current && lastFinalTranscriptRef.current && lastFinalTranscriptRef.current.trim().length > 1) {
    audioChunksRef.current = [];
    hasDetectedVoiceRef.current = false;
    return;
  }

  const epochAtStart = listenEpochRef.current;

  try {
    isTranscribingRef.current = true;
    setIsTranscribing(true);
    const audioCtx = audioContextRef.current;
    const inputSampleRate = audioCtx ? audioCtx.sampleRate : 44100;

    let totalLength = 0;
    for (const chunk of audioChunksRef.current) {
      totalLength += chunk.length;
    }
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunksRef.current) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    audioChunksRef.current = [];
    hasDetectedVoiceRef.current = false;

    const downsampled = downsampleBuffer(merged, inputSampleRate, 16000);
    const wavBlob = encodeWAV(downsampled, 16000);

    const langParam = currentLanguageRef.current.toLowerCase().startsWith('en') ? 'en' : 'auto';
    console.log(`[STT Engine] Fallback Backend STT (Whisper): gửi file ${wavBlob.size} bytes (${(totalLength / inputSampleRate).toFixed(1)}s)...`);
    const recognizedText = await transcribeAudio(wavBlob, langParam);

    if (
      epochAtStart !== listenEpochRef.current ||
      !shouldListenRef.current ||
      utteranceCommittedRef.current
    ) {
      return;
    }

    if (recognizedText && recognizedText.trim()) {
      const clean = recognizedText.trim();
      console.log('[STT Engine] Backend Whisper nhận diện thành công:', clean);
      setTranscript(clean);
      lastFinalTranscriptRef.current = clean;

      const cbTranscript = inlineCallbacksRef.current?.onTranscriptChange || callbacksRef.current?.onTranscriptChange;
      if (cbTranscript) cbTranscript(clean, true);
      commitFinalTranscript(clean);
    }
  } catch (err) {
    console.warn('[STT Engine] Lỗi khi xử lý Backend STT:', err);
  } finally {
    isTranscribingRef.current = false;
    setIsTranscribing(false);
  }
}

export async function initializeHardwareMicAnalyser({
  destroyedRef,
  mediaStreamRef,
  audioContextRef,
  analyserRef,
  scriptProcessorRef,
  shouldListenRef,
  audioChunksRef,
  callbacksRef,
  hasDetectedVoiceRef,
  silenceTimerRef,
  noiseFloorRef,
  lastFinalTranscriptRef,
  clearSpeechFinalizeTimer,
  processBackendSTT,
  setError,
  setHasMicPermission,
  setVolumeLevel,
  hardwareVadSilenceMs,
}) {
  destroyedRef.current = false;
  try {
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
      setError('Trình duyệt di động yêu cầu kết nối HTTPS để mở Micro. Vui lòng truy cập qua HTTPS hoặc Cloudflare Tunnel.');
      return false;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Không tìm thấy API Microphone (trình duyệt di động yêu cầu HTTPS hoặc quyền truy cập trong Cài đặt).');
      return false;
    }

    if (
      mediaStreamRef.current &&
      mediaStreamRef.current.active &&
      mediaStreamRef.current.getAudioTracks().some((t) => t.readyState === 'live')
    ) {
      setHasMicPermission(true);
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume().catch(() => {});
      }
      return true;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    if (destroyedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return false;
    }

    mediaStreamRef.current = stream;
    setHasMicPermission(true);

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      let audioCtx = audioContextRef.current;
      if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
      }
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferSize = 4096;
      const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      scriptProcessorRef.current = processor;

      let consecutiveVoiceFrames = 0;

      processor.onaudioprocess = (e) => {
        if (!shouldListenRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(inputData.length);
        copy.set(inputData);
        audioChunksRef.current.push(copy);

        const maxChunks = Math.ceil((audioCtx.sampleRate * 10) / bufferSize);
        if (audioChunksRef.current.length > maxChunks) {
          audioChunksRef.current.shift();
        }

        let sumSquares = 0;
        for (let i = 0; i < inputData.length; i++) {
          sumSquares += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sumSquares / inputData.length);
        const realVol = Math.min(100, Math.round(rms * 400));
        setVolumeLevel(realVol);

        if (callbacksRef.current?.isSpeaking) {
          consecutiveVoiceFrames = 0;
          hasDetectedVoiceRef.current = false;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          clearSpeechFinalizeTimer();
          setVolumeLevel(0);
          return;
        }

        if (rms < 0.035) {
          noiseFloorRef.current = Math.max(0.006, Math.min(0.040, noiseFloorRef.current * 0.96 + rms * 0.04));
        }

        const adaptiveThreshold = Math.max(0.018, noiseFloorRef.current * 2.2);
        const isHumanSpeaking = rms > adaptiveThreshold && realVol >= 6;

        if (isHumanSpeaking) {
          consecutiveVoiceFrames++;
          if (consecutiveVoiceFrames >= 3) {
            hasDetectedVoiceRef.current = true;
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          }
        } else {
          consecutiveVoiceFrames = 0;
          if (hasDetectedVoiceRef.current && !silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              silenceTimerRef.current = null;
              if (!lastFinalTranscriptRef.current || lastFinalTranscriptRef.current.trim().length === 0) {
                processBackendSTT();
              }
            }, hardwareVadSilenceMs);
          }
        }
      };

      source.connect(processor);
      const muteGain = audioCtx.createGain();
      muteGain.gain.value = 0;
      processor.connect(muteGain);
      muteGain.connect(audioCtx.destination);
    }
    return true;
  } catch (err) {
    console.warn('[Microphone] Không thể truy cập Micro phần cứng:', err);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      setHasMicPermission(false);
      setError('Trình duyệt chưa được cấp quyền Micro! Vui lòng bấm vào biểu tượng khóa trên thanh địa chỉ và chọn "Cho phép" (Allow).');
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      setError('Không tìm thấy thiết bị Microphone trên máy tính! Vui lòng kiểm tra lại mic cắm ngoài hoặc driver âm thanh.');
    }
    return false;
  }
}

export function teardownHardwareAudioAnalyser({
  permanent,
  animFrameRef,
  silenceTimerRef,
  clearSpeechFinalizeTimer,
  scriptProcessorRef,
  mediaStreamRef,
  audioContextRef,
  audioChunksRef,
  hasDetectedVoiceRef,
  setVolumeLevel,
}) {
  if (animFrameRef.current) {
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
  }
  if (silenceTimerRef.current) {
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
  }
  clearSpeechFinalizeTimer();

  if (permanent) {
    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch (e) {}
      scriptProcessorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }

  audioChunksRef.current = [];
  hasDetectedVoiceRef.current = false;
  setVolumeLevel(0);
}
