import { useCallback } from 'react';
import { transcribeCallAudio } from '../../services/aiApi';
import {
  evaluateSpokenTextCommit,
  calculateFrameRms,
  encodeWavBlobFromFloat32,
} from './videoCallTranslationHelpers';

export function useMessengerCallAudioAdapter({
  primeAudioContext,
  audioSttAdapterRef, callStatus, callStatusRef, handleProcessSpokenTextRef, inputLangModeRef, isAiSpeaking, isAiSpeakingRef, isEndingRef, isMicMuted, isMicMutedRef, lastAudioVadSpeechAtRef, lastPlayedTtsTextRef, lastProcessedTextRef, lastProcessedTimeRef, localStreamRef, pendingTranscriptRef, pendingWebSpeechFallbackTimerRef, role, setInterimText, speechRecognitionRef, translateModeRef, ttsActiveUntilRef,
}) {
  // Dừng riêng adapter thu âm STT từ localStreamRef (KHÔNG làm dừng track WebRTC gốc)
  const stopCallAudioSttAdapter = useCallback(() => {
    if (pendingWebSpeechFallbackTimerRef.current) {
      clearTimeout(pendingWebSpeechFallbackTimerRef.current);
      pendingWebSpeechFallbackTimerRef.current = null;
    }
    if (audioSttAdapterRef.current) {
      const { processor, source, ctx } = audioSttAdapterRef.current;
      audioSttAdapterRef.current.stopped = true;
      try {
        if (processor) {
          processor.onaudioprocess = null;
          processor.disconnect();
        }
      } catch (e) {}
      try {
        if (source) source.disconnect();
      } catch (e) {}
      try {
        if (ctx && ctx.state !== 'closed') {
          ctx.close().catch(() => {});
        }
      } catch (e) {}
      audioSttAdapterRef.current = null;
    }
  }, []);

  // Chốt câu nói hoàn chỉnh và gửi sang luồng dịch (mọi nhánh bỏ qua đều ghi log reason rõ ràng)
  const commitSpokenText = useCallback((text, meta = {}) => {
    const sttEngine = meta.engine || 'web_speech';
    const detectedLangHint = meta.detectedLang || null;
    const now = Date.now();

    const evalRes = evaluateSpokenTextCommit({
      text,
      isMicMuted: isMicMutedRef.current,
      callStatus: callStatusRef.current,
      isAiSpeaking: isAiSpeakingRef.current,
      now,
      ttsActiveUntil: ttsActiveUntilRef.current,
      lastPlayedTtsText: lastPlayedTtsTextRef.current,
      lastProcessedText: lastProcessedTextRef.current,
      lastProcessedTime: lastProcessedTimeRef.current,
      duplicateWindowMs: 2200,
    });

    if (!evalRes.allowed) {
      console.log(
        `[VideoCall Flow] [${role}] step=STT_SKIPPED reason=${evalRes.reason} engine=${sttEngine} len=${evalRes.cleanText.length}`
      );
      return false;
    }

    if (pendingWebSpeechFallbackTimerRef.current) {
      clearTimeout(pendingWebSpeechFallbackTimerRef.current);
      pendingWebSpeechFallbackTimerRef.current = null;
    }

    const cleanText = evalRes.cleanText;
    lastProcessedTextRef.current = cleanText;
    lastProcessedTimeRef.current = now;
    pendingTranscriptRef.current = '';
    setInterimText('');

    console.log(
      `[VideoCall Flow] [${role}] step=COMMITTED engine=${sttEngine} detectedLang=${detectedLangHint || 'auto'} len=${cleanText.length}`
    );
    if (handleProcessSpokenTextRef.current) {
      handleProcessSpokenTextRef.current(cleanText, {
        detectedLang: detectedLangHint,
        sttEngine,
      });
    }
    return true;
  }, [role]);

  // Khởi tạo Call Audio Stream STT Adapter:
  // Tách các câu nói từ localStreamRef.current (16kHz Mono WAV) khi dừng lời (VAD silence)
  // và gửi tới Backend Bilingual STT (/api/v1/ai/stt/transcribe) để nhận diện chính xác cả EN & VI từ âm thanh,
  // đồng thời đảm bảo Staff/Robot luôn nhận diện được tiếng nói ngay cả khi Web Speech API bị trình duyệt abort.
  const startCallAudioSttAdapter = useCallback(() => {
    stopCallAudioSttAdapter();
    if (isEndingRef.current || isMicMutedRef.current || callStatusRef.current !== 'connected') {
      return;
    }

    const stream = localStreamRef.current;
    if (!stream || typeof stream.getAudioTracks !== 'function') return;
    const audioTracks = stream.getAudioTracks().filter((t) => t.readyState === 'live');
    if (audioTracks.length === 0) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      let ctx;
      try {
        ctx = new AudioCtx({ sampleRate: 16000 });
      } catch (rateErr) {
        ctx = new AudioCtx();
      }
      if (typeof ctx.createMediaStreamSource !== 'function' || typeof ctx.createScriptProcessor !== 'function') {
        if (ctx.close) ctx.close().catch(() => {});
        return;
      }

      // Tạo MediaStream chỉ gồm audio track (không ảnh hưởng tới track WebRTC gốc)
      const audioOnlyStream = new MediaStream(audioTracks);
      const source = ctx.createMediaStreamSource(audioOnlyStream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      const state = {
        ctx,
        source,
        processor,
        stopped: false,
        isSpeaking: false,
        speechChunks: [],
        preRollChunks: [],
        silenceFrames: 0,
        speechFrames: 0,
        inflight: false,
      };
      audioSttAdapterRef.current = state;

      const sampleRate = ctx.sampleRate || 16000;
      const frameDurationMs = (4096 / sampleRate) * 1000;
      // Tối ưu siêu nhạy (0.0018 thay vì 0.0028): bắt trọn cả tiếng nói nhỏ/thì thầm, không cần hét
      const SPEECH_RMS_THRESHOLD = 0.0018;
      const SILENCE_RMS_THRESHOLD = 0.0011;
      // 950ms im lặng liên tục để chốt câu hoàn chỉnh, tránh ngắt cụt câu khi người dùng ngắt nhịp tự nhiên giữa các từ
      const SILENCE_FRAMES_TO_FLUSH = Math.max(4, Math.round(950 / frameDurationMs));
      // Tối thiểu 350ms âm thanh thực tế để loại bỏ tiếng click
      const MIN_SPEECH_FRAMES = Math.max(2, Math.round(350 / frameDurationMs));
      // Tối đa 9 giây âm thanh liên tục
      const MAX_SPEECH_FRAMES = Math.round(9000 / frameDurationMs);

      const flushAudioSegment = async (chunksToFlush) => {
        if (!chunksToFlush || chunksToFlush.length < MIN_SPEECH_FRAMES || state.stopped) return;
        // Nếu Web Speech API đang hoạt động bình thường ở phía Staff, không flush song song sang backend STT
        // để tránh race condition làm vỡ câu nói thành 2 nửa.
        // Audio Stream Adapter lúc này chỉ dùng VAD theo dõi mức năng lượng giọng nói (lastAudioVadSpeechAtRef).
        if (role === 'staff' && speechRecognitionRef.current && !speechRecognitionRef.current._hasPermError) {
          return;
        }
        const wavBlob = encodeWavBlobFromFloat32(chunksToFlush, ctx.sampleRate || 16000);
        if (!wavBlob || wavBlob.size < 2500) return;

        const curInputMode = translateModeRef.current === 'bypass' ? 'vi' : inputLangModeRef.current;
        const preferredLang = role === 'staff' ? 'vi' : 'en';

        state.inflight = true;
        try {
          const sttRes = await transcribeCallAudio(wavBlob, {
            language: curInputMode,
            preferredLang,
          });
          if (state.stopped || isEndingRef.current || isMicMutedRef.current) return;
          if (sttRes?.success && sttRes.text) {
            console.log(
              `[VideoCall Flow] [${role}] step=STT_RESULT engine=${sttRes.provider || 'audio_stt'} detectedLang=${sttRes.detected_language} conf=${sttRes.confidence} len=${sttRes.text.length}`
            );
            commitSpokenText(sttRes.text, {
              engine: sttRes.provider || 'audio_stt',
              detectedLang: sttRes.detected_language,
            });
          }
        } catch (err) {
          console.warn(`[VideoCall STT] [${role}] Audio STT adapter error:`, err?.message || err);
        } finally {
          state.inflight = false;
        }
      };

      processor.onaudioprocess = (event) => {
        if (state.stopped || isEndingRef.current || isMicMutedRef.current || callStatusRef.current === 'ended') {
          state.isSpeaking = false;
          state.speechChunks = [];
          state.speechFrames = 0;
          state.silenceFrames = 0;
          return;
        }

        // Không thu âm khi loa AI đang phát để tránh thu tiếng vọng
        if (isAiSpeakingRef.current || Date.now() < ttsActiveUntilRef.current) {
          state.isSpeaking = false;
          state.speechChunks = [];
          state.speechFrames = 0;
          state.silenceFrames = 0;
          return;
        }

        const inputBuffer = event.inputBuffer.getChannelData(0);
        const frameCopy = new Float32Array(inputBuffer.length);
        frameCopy.set(inputBuffer);
        const rms = calculateFrameRms(frameCopy);

        if (rms >= SPEECH_RMS_THRESHOLD) {
          lastAudioVadSpeechAtRef.current = Date.now();
          if (!state.isSpeaking) {
            state.isSpeaking = true;
            state.speechChunks = state.preRollChunks && state.preRollChunks.length > 0 ? [...state.preRollChunks] : [];
            state.speechFrames = 0;
            state.silenceFrames = 0;
          }
          state.speechChunks.push(frameCopy);
          state.speechFrames += 1;
          state.silenceFrames = 0;

          if (state.speechFrames >= MAX_SPEECH_FRAMES) {
            const batch = state.speechChunks;
            state.isSpeaking = false;
            state.speechChunks = [];
            state.speechFrames = 0;
            state.silenceFrames = 0;
            flushAudioSegment(batch);
          }
        } else if (state.isSpeaking) {
          state.speechChunks.push(frameCopy);
          if (rms <= SILENCE_RMS_THRESHOLD) {
            state.silenceFrames += 1;
          } else {
            state.silenceFrames = 0;
          }

          if (state.silenceFrames >= SILENCE_FRAMES_TO_FLUSH) {
            const batch = state.speechChunks;
            const totalSpeechFrames = state.speechFrames;
            state.isSpeaking = false;
            state.speechChunks = [];
            state.speechFrames = 0;
            state.silenceFrames = 0;
            if (totalSpeechFrames >= MIN_SPEECH_FRAMES) {
              flushAudioSegment(batch);
            }
          }
        } else {
          state.preRollChunks = (state.preRollChunks || []).slice(-1);
          state.preRollChunks.push(frameCopy);
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      // Context được tạo trong callback bất đồng bộ (offer/answer/ontrack) nên có thể ở trạng thái 'suspended';
      // khi đó onaudioprocess không bao giờ chạy và bộ thu âm STT dự phòng bị câm. primeAudioContext() cũng resume lại khi có tương tác.
      if (ctx.state === 'suspended') {
        ctx.resume()
          .then(() => {
            console.log(`[VideoCall Flow] [${role}] step=STT_ADAPTER_CTX state=${ctx.state}`);
          })
          .catch((resumeErr) => {
            console.warn(`[VideoCall Flow] [${role}] step=STT_ADAPTER_CTX state=${ctx.state} detail="${resumeErr?.message || resumeErr}"`);
          });
      }
      console.log(`[VideoCall Flow] [${role}] step=STT_STARTED engine=audio_stream_adapter inputMode=${inputLangModeRef.current} ctxState=${ctx.state}`);
    } catch (adapterErr) {
      console.warn(`[VideoCall STT] [${role}] Cannot initialize Audio Stream STT Adapter:`, adapterErr);
    }
  }, [role, commitSpokenText, stopCallAudioSttAdapter]);

  return {
    stopCallAudioSttAdapter,
    commitSpokenText,
    startCallAudioSttAdapter,
  };
}
