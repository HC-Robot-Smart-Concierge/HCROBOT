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
  const networkErrorCountRef = useRef(0);

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
  const speechFinalizeTimerRef = useRef(null);
  const listenEpochRef = useRef(0);
  const utteranceCommittedRef = useRef(false);
  const analyserInitPromiseRef = useRef(null);
  const isTranscribingRef = useRef(false);

  const clearSpeechFinalizeTimer = useCallback(() => {
    if (speechFinalizeTimerRef.current) {
      clearTimeout(speechFinalizeTimerRef.current);
      speechFinalizeTimerRef.current = null;
    }
  }, []);

  const commitFinalTranscript = useCallback((text) => {
    if (utteranceCommittedRef.current) return;
    const clean = (text || '').trim();
    if (!clean) return;
    utteranceCommittedRef.current = true;
    clearSpeechFinalizeTimer();
    const cbFinal = inlineCallbacksRef.current?.onFinal || callbacksRef.current?.onFinal;
    if (cbFinal) {
      cbFinal(clean);
    }
  }, [clearSpeechFinalizeTimer]);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  // Giai phong stream micro va AudioContext (permanent = true khi unmount component)
  const stopAudioAnalyser = useCallback((permanent = false) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    clearSpeechFinalizeTimer();

    // Chi giai phong phan cung khi tat han ung dung (unmount)
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
  }, [clearSpeechFinalizeTimer]);

  // Hàm gửi Audio Buffer lên Backend STT khi browser không nhận diện được chữ
  const processBackendSTT = useCallback(async () => {
    if (isTranscribingRef.current || utteranceCommittedRef.current || !shouldListenRef.current) {
      audioChunksRef.current = [];
      hasDetectedVoiceRef.current = false;
      return;
    }

    // Chỉ gửi khi có ít nhất ~0.7s âm thanh (khoảng 8 chunks) và đã phát hiện tiếng nói
    if (audioChunksRef.current.length < 8 || !hasDetectedVoiceRef.current) {
      audioChunksRef.current = [];
      hasDetectedVoiceRef.current = false;
      return;
    }

    // Nếu Web Speech API của Chrome đang hoạt động và đã có kết quả gần đây, không cần gửi lại Backend
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

      // Xóa buffer sau khi đã lấy để sẵn sàng cho câu tiếp theo
      audioChunksRef.current = [];
      hasDetectedVoiceRef.current = false;

      // Downsample về 16kHz chuẩn và encode WAV
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
  }, [commitFinalTranscript]);

  // Khởi động đo âm lượng thực tế & Recording Buffer từ Hardware Microphone
  const startAudioAnalyser = useCallback(async () => {
    if (analyserInitPromiseRef.current) {
      return analyserInitPromiseRef.current;
    }
    const initTask = (async () => {
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

        // Kiem tra stream hien co neu con hoat dong thi tai su dung
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
            await audioCtx.resume().catch(() => {});
          }

          // Analyser đo volume visualizer
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

          let consecutiveVoiceFrames = 0;

          processor.onaudioprocess = (e) => {
            if (!shouldListenRef.current) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const copy = new Float32Array(inputData.length);
            copy.set(inputData);
            audioChunksRef.current.push(copy);

            // Giới hạn buffer tối đa ~10 giây (tránh tràn RAM)
            const maxChunks = Math.ceil((audioCtx.sampleRate * 10) / bufferSize);
            if (audioChunksRef.current.length > maxChunks) {
              audioChunksRef.current.shift();
            }

            // Tính RMS (Root Mean Square) chính xác theo biên độ sóng âm thanh thực tế
            let sumSquares = 0;
            for (let i = 0; i < inputData.length; i++) {
              sumSquares += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sumSquares / inputData.length);
            // Âm lượng từ 0 đến 100
            const realVol = Math.min(100, Math.round(rms * 400));
            setVolumeLevel(realVol);

            // VAD (Voice Activity Detection): Phát hiện khi khách nói (nhạy hơn: RMS > 0.008 hoặc realVol >= 3)
            const isHumanSpeaking = rms > 0.008 || realVol >= 3;

            if (isHumanSpeaking) {
              consecutiveVoiceFrames++;
              if (consecutiveVoiceFrames >= 2) {
                hasDetectedVoiceRef.current = true;
                if (silenceTimerRef.current) {
                  clearTimeout(silenceTimerRef.current);
                  silenceTimerRef.current = null;
                }
              }
            } else {
              consecutiveVoiceFrames = 0;
              if (hasDetectedVoiceRef.current) {
                // Khách đã nói xong và im lặng 900ms
                if (!silenceTimerRef.current) {
                  silenceTimerRef.current = setTimeout(() => {
                    silenceTimerRef.current = null;
                    // Nếu sau khi nói mà trình duyệt không trả về chữ (do lỗi mạng Google Speech API hoặc không hỗ trợ)
                    // Tự động chốt file gửi sang Backend Whisper
                    if (!lastFinalTranscriptRef.current || lastFinalTranscriptRef.current.trim().length === 0) {
                      processBackendSTT();
                    }
                  }, 900);
                }
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
    })().finally(() => {
      analyserInitPromiseRef.current = null;
    });
    analyserInitPromiseRef.current = initTask;
    return initTask;
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
        console.warn('[SpeechRecognition] startRecognition error, fallback to hardware recorder:', err);
        setIsListening(true);
        setMicLive(true);
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          if (shouldListenRef.current && !liveRef.current && !destroyedRef.current) {
            startRecognition();
          }
        }, 800);
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
        if (!shouldListenRef.current) return;
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
            commitFinalTranscript(trimmed);
          } else {
            utteranceCommittedRef.current = false;
            if (cbInterim) cbInterim(trimmed);

            // Auto-Finalize Debounce: Tự động chốt câu khi người dùng ngừng nói 750ms (đặc trị cho iOS Safari không kích hoạt isFinal)
            clearSpeechFinalizeTimer();
            speechFinalizeTimerRef.current = setTimeout(() => {
              speechFinalizeTimerRef.current = null;
              if (shouldListenRef.current && lastFinalTranscriptRef.current?.trim()) {
                commitFinalTranscript(lastFinalTranscriptRef.current.trim());
              }
            }, 750);
          }
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          // 'no-speech': im lặng thông thường
          // 'aborted': ngắt chủ động khi mở modal, đổi màn hình hoặc dừng nhận diện
          return;
        }
        console.warn('[SpeechRecognition Error]:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          // Kiểm tra xem Hardware Microphone Stream có đang hoạt động không
          const isHardwareStreamAlive =
            mediaStreamRef.current &&
            mediaStreamRef.current.active &&
            mediaStreamRef.current.getAudioTracks().some((t) => t.readyState === 'live');

          if (isHardwareStreamAlive && shouldListenRef.current) {
            // Khi người dùng đã cấp quyền micro nhưng trình duyệt chặn Web Speech API vì cử chỉ tay hết hạn sau câu hỏi khó
            // TỰ ĐỘNG CHUYỂN SANG HARDWARE RECORDER + BACKEND STT (Whisper)
            console.log('[SpeechRecognition] Browser WebSpeech blocked due to gesture timeout. Auto-switching to Hardware Whisper STT.');
            liveRef.current = false;
            setIsListening(true);
            setMicLive(true);
            setError(null);
            return;
          }

          shouldListenRef.current = false;
          clearRestartTimer();
          liveRef.current = false;
          setIsListening(false);
          setMicLive(false);
          setHasMicPermission(false);
          setError('Trình duyệt chưa được cấp quyền Micro! Vui lòng bấm vào biểu tượng khóa trên thanh URL để Cấp quyền Micro.');
        } else if (event.error === 'network') {
          networkErrorCountRef.current += 1;
          console.warn(`[SpeechRecognition] Lỗi mạng Google Speech (${networkErrorCountRef.current}). Hệ thống tự động kích hoạt Backend STT Fallback.`);
          if (shouldListenRef.current) {
            setIsListening(true);
            setMicLive(true);
          }
        } else if (event.error === 'audio-capture') {
          setError('Không tìm thấy Microphone hoặc Micro đang bị ứng dụng khác chiếm dụng.');
        }
      };

      recognition.onend = () => {
        liveRef.current = false;
        // KHÔNG set isListening = false ở đây để tránh giao diện bị nhấp nháy bật/tắt liên tục!
        if (shouldListenRef.current && !destroyedRef.current) {
          // Nếu Google Speech liên tục lỗi mạng (>2 lần), chuyển sang Backend STT nhưng vẫn định kỳ thử kết nối lại
          if (networkErrorCountRef.current >= 2) {
            setMicLive(true);
            setIsListening(true);
            clearRestartTimer();
            restartTimerRef.current = setTimeout(() => {
              if (shouldListenRef.current && !liveRef.current && !destroyedRef.current) {
                networkErrorCountRef.current = 0;
                startRecognition();
              }
            }, 3500);
            return;
          }
          clearRestartTimer();
          restartTimerRef.current = setTimeout(() => {
            if (shouldListenRef.current && !liveRef.current && !destroyedRef.current) {
              startRecognition();
            }
          }, 150);
        } else {
          setIsListening(false);
          setMicLive(false);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      destroyedRef.current = true;
      shouldListenRef.current = false;
      clearRestartTimer();
      stopAudioAnalyser(true); // Giai phong hoan toan khi unmount
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, [startRecognition, stopAudioAnalyser]);

  // Tự động mở khóa AudioContext khi có tương tác người dùng (click, touch, keydown)
  useEffect(() => {
    const unlockAudio = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('pointerdown', unlockAudio);
    };
  }, []);

  const requestMicrophonePermission = useCallback(async () => {
    destroyedRef.current = false;
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (e) {}
    }
    return await startAudioAnalyser();
  }, [startAudioAnalyser]);

  const startListening = async (language = 'vi-VN', inlineCallbacks = null) => {
    destroyedRef.current = false;
    listenEpochRef.current += 1;
    utteranceCommittedRef.current = false;
    currentLanguageRef.current = language;
    networkErrorCountRef.current = 0;
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
    } else {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
        } catch (e) {}
      }
    }

    if (recognitionRef.current) {
      setError(null);
      setTranscript('');
      const isEn = typeof language === 'string' && (language.toLowerCase().includes('en') || language.toLowerCase() === 'english');
      const targetLang = isEn ? 'en-US' : 'vi-VN';
      try {
        recognitionRef.current.lang = targetLang;
      } catch (e) {}

      if (!liveRef.current) {
        startRecognition();
      }
      setIsListening(true);
      setMicLive(true);
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
    inlineCallbacksRef.current = {};
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (err) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    }
    setIsListening(false);
    setMicLive(false);
    clearSpeechFinalizeTimer();
    stopAudioAnalyser(false); // Giu stream phan cung alive de tranh bi iOS hoi quyen lai
  }, [stopAudioAnalyser, clearSpeechFinalizeTimer]);

  const resetTranscript = useCallback(() => {
    clearSpeechFinalizeTimer();
    setTranscript('');
    lastFinalTranscriptRef.current = '';
    audioChunksRef.current = [];
    hasDetectedVoiceRef.current = false;
    utteranceCommittedRef.current = false;
  }, [clearSpeechFinalizeTimer]);

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