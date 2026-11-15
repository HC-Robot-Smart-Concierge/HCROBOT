import { useCallback, useEffect } from 'react';
import { TTS_ERROR_CODES } from './videoCallTranslationHelpers';
import { base64ToUint8Array } from './messengerVideoCallUtils';

export function useMessengerCallAudioPlayback({
  activeAudioSourceRef, audioContextRef, audioQueueRef, audioSttAdapterRef, callEpochRef, callStatusRef, expectedPlaySeqRef, failedSeqsRef, isAiSpeakingRef, isEndingRef, isPlayingAudioRef, isSpeakerMutedRef, lastPlayedTtsTextRef, outOfOrderWaitTimerRef, persistentAudioRef, playInterpreterAudioRef, playbackWatchdogRef, playedUtteranceIdsRef, remoteVideoRef, role, setIsAiSpeaking, setIsAudioBlocked, subtitleReceivedAtRef, ttsActiveUntilRef,
}) {
  const getOrCreateAudioContext = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        // Dùng lại AudioContext dùng chung của Kiosk (useSpeechSynthesis / audioFeedback) nếu đã có:
        // context này đã được mở khóa bởi tương tác trước đó trên trang Robot, nên khi cuộc gọi
        // được mở bằng giọng nói (không có click trong modal) vẫn phát được âm thanh bản dịch.
        const shared = window._sharedAudioCtx;
        if (shared && shared.state !== 'closed') {
          audioContextRef.current = shared;
        } else {
          audioContextRef.current = new AudioCtx();
          window._sharedAudioCtx = audioContextRef.current;
        }
      }
      return audioContextRef.current;
    } catch (e) {
      console.warn('[VideoCall Audio] Không thể khởi tạo AudioContext:', e);
      return null;
    }
  }, []);

  // Unlock Audio trên mọi tương tác của người dùng (Click, Touch, Answer Call, v.v.)
  const primeAudioContext = useCallback(() => {
    const ctx = getOrCreateAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        if (ctx.state === 'running') {
          setIsAudioBlocked(false);
        }
      }).catch(() => {});
    } else if (ctx && ctx.state === 'running') {
      setIsAudioBlocked(false);
    }
    // Mở khóa luôn AudioContext của bộ thu âm STT (nếu bị tạo ở trạng thái suspended thì onaudioprocess không chạy)
    const sttCtx = audioSttAdapterRef.current?.ctx;
    if (sttCtx && sttCtx.state === 'suspended') {
      sttCtx.resume().catch(() => {});
    }
    if (persistentAudioRef.current) {
      try {
        persistentAudioRef.current.play().then(() => {
          persistentAudioRef.current.pause();
          setIsAudioBlocked(false);
        }).catch(() => {});
      } catch (e) {}
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = isSpeakerMutedRef.current;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [getOrCreateAudioContext]);

  // Hàng đợi phát âm thanh thông dịch AI tuần tự cho cả hai bên (Robot Kiosk & Staff)
  // Bảo vệ chống treo cờ isPlayingAudioRef / isAiSpeakingRef khi AudioContext.resume() bị treo hoặc lỗi
  const processAudioQueue = useCallback(async () => {
    if (isPlayingAudioRef.current) return;
    if (audioQueueRef.current.length === 0) return;
    if (isEndingRef.current || callStatusRef.current === 'ended') {
      audioQueueRef.current = [];
      return;
    }

    // Bo qua cac sequence da duoc danh dau la failed truoc do
    while (failedSeqsRef.current.has(expectedPlaySeqRef.current)) {
      expectedPlaySeqRef.current += 1;
    }

    const headItem = audioQueueRef.current[0];
    if (headItem && headItem.seq && headItem.seq > expectedPlaySeqRef.current) {
      if (!outOfOrderWaitTimerRef.current) {
        console.log(`[VideoCall Queue] [${role}] Waiting for seq=${expectedPlaySeqRef.current} (head seq=${headItem.seq}) max 1.2s`);
        outOfOrderWaitTimerRef.current = setTimeout(() => {
          outOfOrderWaitTimerRef.current = null;
          expectedPlaySeqRef.current = headItem.seq;
          processAudioQueue();
        }, 1200);
        return;
      }
      return;
    }

    if (outOfOrderWaitTimerRef.current) {
      clearTimeout(outOfOrderWaitTimerRef.current);
      outOfOrderWaitTimerRef.current = null;
    }

    const currentItem = audioQueueRef.current.shift();
    if (!currentItem || !currentItem.audioBase64) return;

    if (currentItem.seq) {
      expectedPlaySeqRef.current = Math.max(expectedPlaySeqRef.current, currentItem.seq + 1);
    }

    if (currentItem.utteranceId) {
      playedUtteranceIdsRef.current.add(currentItem.utteranceId);
    }

    const currentEpoch = callEpochRef.current;
    isPlayingAudioRef.current = true;
    let finishedHandled = false;

    const handleAudioFinished = (endReason = 'PLAY_ENDED') => {
      if (finishedHandled) return;
      finishedHandled = true;

      if (playbackWatchdogRef.current) {
        clearTimeout(playbackWatchdogRef.current);
        playbackWatchdogRef.current = null;
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.volume = 1.0;
      }

      const wasSpeaking = isAiSpeakingRef.current;
      isAiSpeakingRef.current = false;
      setIsAiSpeaking(false);
      // Nếu phát âm thanh thực sự diễn ra, đặt đuôi âm học ngắn 280ms; nếu bị chặn/lỗi thì mở khóa ngay (0ms)
      ttsActiveUntilRef.current = wasSpeaking && endReason === 'PLAY_ENDED' ? Date.now() + 280 : 0;
      activeAudioSourceRef.current = null;
      isPlayingAudioRef.current = false;

      console.log(
        `[VideoCall Flow] [${role}] utteranceId=${currentItem.utteranceId || 'unknown'} seq=${currentItem.seq || 0} step=${endReason} volume=1.0`
      );

      if (audioQueueRef.current.length > 0 && !isEndingRef.current && callEpochRef.current === currentEpoch) {
        setTimeout(processAudioQueue, 120);
      }
    };

    const markPlaybackStarted = (durationSec = 4.0, engine = 'web_audio') => {
      isAiSpeakingRef.current = true;
      setIsAiSpeaking(true);
      const boundedMs = Math.min(12000, Math.max(1500, Math.round(durationSec * 1000) + 500));
      ttsActiveUntilRef.current = Date.now() + boundedMs;

      if (currentItem.spokenText) {
        lastPlayedTtsTextRef.current = currentItem.spokenText.trim();
      }

      if (remoteVideoRef.current) {
        // Giữ nguyên 100% âm lượng video gốc, không giảm âm lượng (bỏ ducking theo yêu cầu)
        remoteVideoRef.current.volume = 1.0;
      }

      if (playbackWatchdogRef.current) {
        clearTimeout(playbackWatchdogRef.current);
      }
      playbackWatchdogRef.current = setTimeout(() => {
        handleAudioFinished('PLAY_WATCHDOG_TIMEOUT');
      }, boundedMs + 900);

      console.log(
        `[VideoCall Flow] [${role}] utteranceId=${currentItem.utteranceId || 'unknown'} seq=${currentItem.seq || 0} step=PLAY_STARTED engine=${engine} volume=1.0 len=${(currentItem.spokenText || '').length}`
      );
    };

    // 1. Dừng nguồn âm thanh cũ nếu đang phát
    if (activeAudioSourceRef.current) {
      try {
        activeAudioSourceRef.current.stop();
      } catch (e) {}
      activeAudioSourceRef.current = null;
    }
    if (persistentAudioRef.current) {
      try {
        persistentAudioRef.current.pause();
      } catch (e) {}
    }

    // 2. Thử phát bằng Web Audio API AudioContext (có timeout 400ms chống treo ctx.resume())
    const ctx = getOrCreateAudioContext();
    if (ctx) {
      try {
        if (ctx.state === 'suspended') {
          await Promise.race([
            ctx.resume().catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, 400)),
          ]);
        }
        if (ctx.state === 'running' && callEpochRef.current === currentEpoch) {
          setIsAudioBlocked(false);
          const uint8 = base64ToUint8Array(currentItem.audioBase64);
          const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          if (callEpochRef.current !== currentEpoch || isEndingRef.current) {
            handleAudioFinished('PLAY_ABORTED');
            return;
          }
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          source.onended = () => handleAudioFinished('PLAY_ENDED');
          activeAudioSourceRef.current = source;
          markPlaybackStarted(audioBuffer.duration || 4.0, 'web_audio');
          source.start(0);
          return;
        }
      } catch (ctxErr) {
        console.warn(
          `[VideoCall Flow] [${role}] utteranceId=${currentItem.utteranceId || 'unknown'} seq=${currentItem.seq || 0} step=PLAYBACK_ERROR code=${TTS_ERROR_CODES.PLAYBACK_DECODE_ERROR} detail="${ctxErr?.message || ctxErr}"`
        );
      }
    }

    // 3. Fallback: Phát bằng persistent HTML5 Audio Element
    if (persistentAudioRef.current && callEpochRef.current === currentEpoch) {
      const audioEl = persistentAudioRef.current;
      audioEl.src = `data:audio/mp3;base64,${currentItem.audioBase64}`;
      audioEl.currentTime = 0;
      audioEl.onended = () => handleAudioFinished('PLAY_ENDED');
      audioEl.onerror = (e) => {
        console.warn(
          `[VideoCall Flow] [${role}] utteranceId=${currentItem.utteranceId || 'unknown'} seq=${currentItem.seq || 0} step=PLAYBACK_ERROR code=${TTS_ERROR_CODES.PLAYBACK_DECODE_ERROR} detail="HTML5 Audio error"`
        );
        handleAudioFinished(TTS_ERROR_CODES.PLAYBACK_DECODE_ERROR);
      };
      try {
        const playPromise = audioEl.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (callEpochRef.current === currentEpoch) {
                setIsAudioBlocked(false);
                markPlaybackStarted(audioEl.duration && Number.isFinite(audioEl.duration) ? audioEl.duration : 4.5, 'html5_audio');
              } else {
                handleAudioFinished('PLAY_ABORTED');
              }
            })
            .catch((err) => {
              console.warn(
                `[VideoCall Flow] [${role}] utteranceId=${currentItem.utteranceId || 'unknown'} seq=${currentItem.seq || 0} step=PLAYBACK_ERROR code=${TTS_ERROR_CODES.PLAYBACK_BLOCKED} detail="${err?.message || err}"`
              );
              setIsAudioBlocked(true);
              handleAudioFinished(TTS_ERROR_CODES.PLAYBACK_BLOCKED);
            });
          return;
        }
      } catch (playErr) {
        console.warn(
          `[VideoCall Flow] [${role}] utteranceId=${currentItem.utteranceId || 'unknown'} seq=${currentItem.seq || 0} step=PLAYBACK_ERROR code=${TTS_ERROR_CODES.PLAYBACK_BLOCKED} detail="${playErr?.message || playErr}"`
        );
      }
    }

    // 4. Fallback 3: window.speechSynthesis (nếu cả Web Audio và HTML5 Audio bị trình duyệt chặn autoplay)
    if (typeof window !== 'undefined' && window.speechSynthesis && currentItem.spokenText && callEpochRef.current === currentEpoch) {
      try {
        const utter = new SpeechSynthesisUtterance(currentItem.spokenText);
        utter.lang = currentItem.targetLang === 'en' ? 'en-US' : 'vi-VN';
        utter.onend = () => handleAudioFinished('PLAY_ENDED');
        utter.onerror = () => {
          setIsAudioBlocked(true);
          handleAudioFinished(TTS_ERROR_CODES.PLAYBACK_BLOCKED);
        };
        markPlaybackStarted(Math.max(2.5, currentItem.spokenText.length * 0.08), 'speech_synthesis');
        window.speechSynthesis.speak(utter);
        return;
      } catch (synthErr) {
        console.warn(`[VideoCall Flow] [${role}] SpeechSynthesis fallback failed:`, synthErr);
      }
    }

    setIsAudioBlocked(true);
    handleAudioFinished(TTS_ERROR_CODES.PLAYBACK_BLOCKED);
  }, [getOrCreateAudioContext, role]);

  const enqueueInterpreterAudio = useCallback((item) => {
    if (!item?.audioBase64 || isSpeakerMutedRef.current) return;

    if (item.utteranceId && playedUtteranceIdsRef.current.has(item.utteranceId)) {
      console.log(`[VideoCall Queue] Skip already played utteranceId=${item.utteranceId}`);
      return;
    }

    // Chỉ so sánh trên đồng hồ của chính máy nhận: item.timestamp là Date.now() của máy gửi,
    // nếu Robot và Staff lệch giờ > 15s thì mọi audio của một chiều sẽ bị loại oan.
    const subtitleAt = item.utteranceId ? subtitleReceivedAtRef.current.get(item.utteranceId) : null;
    if (subtitleAt && Date.now() - subtitleAt > 15000) {
      console.warn(`[VideoCall Queue] Skip stale audio (>15s after subtitle) utteranceId=${item.utteranceId}`);
      return;
    }

    if (item.seq && item.seq < expectedPlaySeqRef.current) {
      console.warn(`[VideoCall Queue] Skip late audio seq=${item.seq} < expected=${expectedPlaySeqRef.current}`);
      return;
    }

    audioQueueRef.current.push({
      ...item,
      spokenText: item.translatedText || item.spokenText || '',
    });
    audioQueueRef.current.sort((a, b) => (a.seq || 0) - (b.seq || 0));

    if (audioQueueRef.current.length > 3) {
      audioQueueRef.current = audioQueueRef.current.slice(-3);
    }

    console.log(
      `[VideoCall Flow] [${role}] utteranceId=${item.utteranceId || 'unknown'} seq=${item.seq || 0} step=AUDIO_RECEIVED queueLen=${audioQueueRef.current.length}`
    );
    processAudioQueue();
  }, [processAudioQueue, role]);

  const playInterpreterAudio = useCallback((audioBase64, spokenText = '', meta = {}) => {
    enqueueInterpreterAudio({
      audioBase64,
      spokenText,
      ...meta,
    });
  }, [enqueueInterpreterAudio]);

  useEffect(() => {
    playInterpreterAudioRef.current = playInterpreterAudio;
  }, [playInterpreterAudio]);


  return {
    getOrCreateAudioContext,
    primeAudioContext,
    processAudioQueue,
    enqueueInterpreterAudio,
    playInterpreterAudio,
  };
}
