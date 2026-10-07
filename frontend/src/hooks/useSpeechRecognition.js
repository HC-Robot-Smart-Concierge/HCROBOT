import { useState, useEffect, useRef, useCallback } from 'react';
import { transcribeAudio } from '../services/aiApi';

// ============================================================
// Helper: WAV PCM 16-Bit Mono Encoder & Downsampler
// ============================================================
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function downsampleBuffer(buffer, inputSampleRate, outputSampleRate = 16000) {
  if (inputSampleRate === outputSampleRate) return buffer;
  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0, count = 0;
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

function encodeWAV(samples, sampleRate = 16000) {
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

// ============================================================
// Main Hook: useSpeechRecognition (Dual-Engine: Browser + Backend STT)
// ============================================================
export const useSpeechRecognition = (callbacks = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [micLive, setMicLive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [volumeLevel, setVolumeLevel] = useState(0); // 0 đến 100: Mức âm lượng thực từ Micro
  const [hasMicPermission, setHasMicPermission] = useState(null); // null: chưa hỏi, true: đã cấp, false: bị chặn
  const [isTranscribing, setIsTranscribing] = useState(false); // Trạng thái đang gửi âm thanh cho AI STT

  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const liveRef = useRef(false);
  const restartTimerRef = useRef(null);
  const callbacksRef = useRef(callbacks);
  const inlineCallbacksRef = useRef({});
  const destroyedRef = useRef(false);
  const currentLanguageRef = useRef('vi-VN');

  // Audio Context & Hardware Stream References
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const analyserRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const animFrameRef = useRef(null);

  // PCM Audio Buffers for Backend STT Fallback
  const audioChunksRef = useRef([]);
  const hasDetectedVoiceRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const lastFinalTranscriptRef = useRef('');

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  // Giải phóng stream micro và AudioContext
  const stopAudioAnalyser = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
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
    audioChunksRef.current = [];
    hasDetectedVoiceRef.current = false;
    setVolumeLevel(0);
  }, []);

  // Hàm gửi Audio Buffer lên Backend STT khi browser không nhận diện được chữ
  const processBackendSTT = useCallback(async () => {
    if (audioChunksRef.current.length === 0 || !hasDetectedVoiceRef.current) {
      return;
    }

    // Nếu Web Speech API đã có kết quả gần đây, không cần gửi lại
    if (lastFinalTranscriptRef.current && lastFinalTranscriptRef.current.trim().length > 1) {
      audioChunksRef.current = [];
      hasDetectedVoiceRef.current = false;
      return;
    }

    try {
      setIsTranscribing(true);
      const audioCtx = audioContextRef.current;
      const inputSampleRate = audioCtx ? audioCtx.sampleRate : 44100;

      // Gom toàn bộ Float32 chunks
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

      // Xóa buffer sau khi đã lấy
      audioChunksRef.current = [];
      hasDetectedVoiceRef.current = false;

      // Downsample về 16kHz chuẩn và encode WAV
      const downsampled = downsampleBuffer(merged, inputSampleRate, 16000);
      const wavBlob = encodeWAV(downsampled, 16000);

      const langParam = currentLanguageRef.current.startsWith('en') ? 'en' : 'vi';
      console.log('[STT Engine] Đang gửi WAV audio lên Backend STT (kích thước:', wavBlob.size, 'bytes)...');
      const recognizedText = await transcribeAudio(wavBlob, langParam);

      if (recognizedText && recognizedText.trim()) {
        const clean = recognizedText.trim();
        console.log('[STT Engine] Backend STT nhận diện thành công:', clean);
        setTranscript(clean);
        lastFinalTranscriptRef.current = clean;

        const cbTranscript = inlineCallbacksRef.current?.onTranscriptChange || callbacksRef.current?.onTranscriptChange;
        const cbFinal = inlineCallbacksRef.current?.onFinal || callbacksRef.current?.onFinal;

        if (cbTranscript) cbTranscript(clean, true);
        if (cbFinal) cbFinal(clean);
      }
    } catch (err) {
      console.warn('[STT Engine] Lỗi khi xử lý Backend STT:', err);
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  // Khởi động đo âm lượng thực tế & Recording Buffer từ Hardware Microphone
  const startAudioAnalyser = useCallback(async () => {
    destroyedRef.current = false;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
      }

      // Kiểm tra stream hiện có nếu còn hoạt động thì tái sử dụng
      if (
        mediaStreamRef.current &&
        mediaStreamRef.current.active &&
        mediaStreamRef.current.getAudioTracks().some((t) => t.readyState === 'live')
      ) {
        setHasMicPermission(true);
        return true;
      }

      // Xin quyền và lấy stream micro thực
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
          await audioCtx.resume();
        }

        // Analyser đo volume
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        // ScriptProcessorNode thu âm PCM samples song song
        const bufferSize = 4096;
        const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
        scriptProcessorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (!shouldListenRef.current) return;
          const inputData = e.inputBuffer.getChannelData(0);
          // Sao chép mẫu âm thanh vào audio buffer
          const copy = new Float32Array(inputData.length);
          copy.set(inputData);
          audioChunksRef.current.push(copy);

          // Giới hạn buffer tối đa ~10 giây (tránh tràn RAM)
          const maxChunks = Math.ceil((audioCtx.sampleRate * 10) / bufferSize);
          if (audioChunksRef.current.length > maxChunks) {
            audioChunksRef.current.shift();
          }
        };

        source.connect(processor);
        // Nối qua GainNode = 0 để tránh âm thanh mic vòng lặp ra loa gây tiếng rít/vọng
        const muteGain = audioCtx.createGain();
        muteGain.gain.value = 0;
        processor.connect(muteGain);
        muteGain.connect(audioCtx.destination);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateVolume = () => {
          if (destroyedRef.current || !analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const currentVol = Math.min(100, Math.round((avg / 64) * 100));
          setVolumeLevel(currentVol);

          // Voice Activity Detection (VAD)
          if (currentVol > 6) {
            hasDetectedVoiceRef.current = true;
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          } else if (hasDetectedVoiceRef.current) {
            // Đã từng nói và giờ đang im lặng: hẹn 700ms để chốt âm thanh
            if (!silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                silenceTimerRef.current = null;
                // Nếu Web Speech API chưa ra chữ gì thì kích hoạt ngay Backend STT
                processBackendSTT();
              }, 700);
            }
          }

          animFrameRef.current = requestAnimationFrame(updateVolume);
        };

        updateVolume();
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
  }, [processBackendSTT]);

  const clearRestartTimer = () => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const startRecognition = useCallback(() => {
    destroyedRef.current = false;
    if (!recognitionRef.current) return;
    if (liveRef.current) return;

    try {
      recognitionRef.current.start();
    } catch (err) {
      if (err.name === 'InvalidStateError') {
        liveRef.current = true;
        setIsListening(true);
      } else {
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          if (shouldListenRef.current && !liveRef.current && !destroyedRef.current) {
            startRecognition();
          }
        }, 500);
      }
    }
  }, []);

  useEffect(() => {
    destroyedRef.current = false;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        liveRef.current = true;
        setIsListening(true);
        setMicLive(true);
        setError(null);
      };

      recognition.onresult = (event) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          const piece = event.results[i][0]?.transcript || '';
          if (piece.trim()) {
            fullTranscript += (fullTranscript ? ' ' : '') + piece.trim();
          }
        }
        const trimmed = fullTranscript.trim();
        if (trimmed) {
          setTranscript(trimmed);
          lastFinalTranscriptRef.current = trimmed;

          const isCurrentFinal = event.results.length > 0
            ? event.results[event.results.length - 1].isFinal
            : false;

          const cbTranscript = inlineCallbacksRef.current?.onTranscriptChange || callbacksRef.current?.onTranscriptChange;
          const cbFinal = inlineCallbacksRef.current?.onFinal || callbacksRef.current?.onFinal;
          const cbInterim = inlineCallbacksRef.current?.onInterim || callbacksRef.current?.onInterim;

          if (cbTranscript) {
            cbTranscript(trimmed, isCurrentFinal);
          }

          if (isCurrentFinal) {
            if (cbFinal) cbFinal(trimmed);
          } else {
            if (cbInterim) cbInterim(trimmed);
          }
        }
      };

      recognition.onerror = (event) => {
        console.warn('[SpeechRecognition Error]:', event.error);
        if (event.error === 'no-speech') {
          // Bình thường khi không có ai nói trong khoảng 3-5 giây, không coi là lỗi
          return;
        }
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          shouldListenRef.current = false;
          clearRestartTimer();
          liveRef.current = false;
          setIsListening(false);
          setMicLive(false);
          setHasMicPermission(false);
          setError('Trình duyệt chưa được cấp quyền Micro! Vui lòng bấm vào biểu tượng khóa trên thanh URL để Cấp quyền Micro.');
        } else if (event.error === 'network') {
          console.warn('[SpeechRecognition] Lỗi mạng Google Speech. Hệ thống sẽ tự động dùng Backend STT Fallback.');
        } else if (event.error === 'audio-capture') {
          setError('Không tìm thấy Microphone hoặc Micro đang bị ứng dụng khác chiếm dụng.');
        }
      };

      recognition.onend = () => {
        liveRef.current = false;
        setMicLive(false);
        // KHÔNG set isListening = false ở đây để tránh giao diện bị nhấp nháy bật/tắt liên tục!
        if (shouldListenRef.current && !destroyedRef.current) {
          clearRestartTimer();
          restartTimerRef.current = setTimeout(() => {
            if (shouldListenRef.current && !liveRef.current && !destroyedRef.current) {
              startRecognition();
            }
          }, 150);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      destroyedRef.current = true;
      shouldListenRef.current = false;
      clearRestartTimer();
      stopAudioAnalyser();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, [startRecognition, stopAudioAnalyser]);

  const requestMicrophonePermission = useCallback(async () => {
    destroyedRef.current = false;
    return await startAudioAnalyser();
  }, [startAudioAnalyser]);

  const startListening = async (language = 'vi-VN', inlineCallbacks = null) => {
    destroyedRef.current = false;
    currentLanguageRef.current = language;
    lastFinalTranscriptRef.current = '';
    audioChunksRef.current = [];
    hasDetectedVoiceRef.current = false;

    if (inlineCallbacks && typeof inlineCallbacks === 'object') {
      inlineCallbacksRef.current = inlineCallbacks;
      callbacksRef.current = { ...callbacksRef.current, ...inlineCallbacks };
    }
    shouldListenRef.current = true;

    // Kích hoạt audio analyser & recorder
    const isStreamActive =
      mediaStreamRef.current &&
      mediaStreamRef.current.active &&
      mediaStreamRef.current.getAudioTracks().some((t) => t.readyState === 'live');
    if (!isStreamActive) {
      await startAudioAnalyser();
    }

    if (recognitionRef.current) {
      setError(null);
      setTranscript('');
      const isEn = typeof language === 'string' && (language.toLowerCase().includes('en') || language.toLowerCase() === 'english');
      const targetLang = isEn ? 'en-US' : 'vi-VN';
      recognitionRef.current.lang = targetLang;

      // Abort phiên cũ để Chrome xả sạch bộ nhớ câu cũ trước đó
      if (liveRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
        liveRef.current = false;
      }
      startRecognition();
      setIsListening(true);
    } else {
      // Trường hợp trình duyệt không có Web Speech API: dùng 100% Backend STT Recorder
      setIsListening(true);
      setMicLive(true);
    }
  };

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    clearRestartTimer();
    liveRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort(); // Dùng abort để hủy bỏ ngay lập tức và dọn sạch buffer
      } catch (err) {}
    }
    setIsListening(false);
    setMicLive(false);
    stopAudioAnalyser();
  }, [stopAudioAnalyser]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    lastFinalTranscriptRef.current = '';
    audioChunksRef.current = [];
    hasDetectedVoiceRef.current = false;
    // Abort phiên đang chạy để xóa sạch buffer câu trước trong Chrome
    if (recognitionRef.current && liveRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      liveRef.current = false;
      if (shouldListenRef.current && !destroyedRef.current) {
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          if (shouldListenRef.current && !liveRef.current && !destroyedRef.current) {
            startRecognition();
          }
        }, 100);
      }
    }
  }, [startRecognition]);

  // Kích hoạt chốt giọng nói ngay lập tức (dùng khi bấm "Gửi ngay" hoặc "Nói xong")
  const finishVoiceCapture = useCallback(async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    await processBackendSTT();
  }, [processBackendSTT]);

  return {
    isListening,
    micLive,
    transcript,
    error,
    volumeLevel,
    hasMicPermission,
    isTranscribing,
    requestMicrophonePermission,
    startListening,
    stopListening,
    resetTranscript,
    finishVoiceCapture,
    hasSupport: !!(window.SpeechRecognition || window.webkitSpeechRecognition || navigator.mediaDevices?.getUserMedia),
  };
};