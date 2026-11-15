import { useCallback, useEffect } from 'react';
import { quickTranslateText, synthesizeSpeech } from '../../services/aiApi';
import {
  TTS_ERROR_CODES,
  resolveTranslationTarget,
  normalizeLanguageCode,
} from './videoCallTranslationHelpers';

export function useMessengerCallTranslation({
  activeGuestLanguageRef, callEpochRef, callStatusRef, callTranscriptsRef, calleeName, callerName, guestTtsSeqRef, handleProcessSpokenTextRef, inputLangModeRef, isEndingRef, isTestTranslating, playInterpreterAudioRef, role, sessionId, setActiveSubtitle, setCallTranscripts, setInterimText, setIsTestTranslating, setTtsStatus, staffTtsSeqRef, subtitleTimeoutRef, translateModeRef, wsRef,
}) {
  // Xử lý dịch và phát tán phụ đề & âm thanh hai chiều (Staff ⇄ Robot)
  // Tách biệt hoàn toàn Ngôn ngữ câu nói (sourceLang) và Ngôn ngữ đích của phía nhận (targetLang)
  const handleProcessSpokenText = useCallback(async (spokenText, meta = {}) => {
    if (!spokenText || !spokenText.trim()) return;

    try {
      const curMode = translateModeRef.current;
      const cleanText = spokenText.trim();
      const targetConfig = resolveTranslationTarget(role, curMode, activeGuestLanguageRef.current);
      const { peerRole, targetLang, ttsLangCode, ttsVoice, isBypassMode } = targetConfig;

      // 1. CHẾ ĐỘ THUẦN VIỆT (BYPASS DO NGƯỜI DÙNG CHỌN): Không dịch, không phát TTS
      if (isBypassMode) {
        const payload = {
          type: 'live_subtitle',
          senderRole: role,
          originalText: cleanText,
          translatedText: cleanText,
          needsTranslation: false,
          sourceLang: 'vi',
          targetLang: 'vi',
          audioBase64: null,
          timestamp: Date.now(),
        };

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(payload));
        }
        displaySubtitleLocally(payload);
        return;
      }

      // 2. XÁC ĐỊNH NGÔN NGỮ NGUỒN CỦA CÂU NÓI (CHUẨN HÓA DUY NHẤT 'vi' HOẶC 'en')
      const normalizedMetaLang = normalizeLanguageCode(meta.detectedLang);
      const normalizedInputMode = normalizeLanguageCode(inputLangModeRef.current);
      const hintLang = normalizedMetaLang || normalizedInputMode || 'auto';

      const utteranceId = `utt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const seqRef = role === 'staff' ? staffTtsSeqRef : guestTtsSeqRef;
      const currentSeq = ++seqRef.current;

      console.log(
        `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} mode=${curMode} step=TRANSLATE_REQUEST srcHint=${hintLang} tgt=${targetLang} len=${cleanText.length}`
      );

      const res = await quickTranslateText({
        text: cleanText,
        sourceLang: hintLang,
        targetLang,
        sessionId,
        senderRole: role,
        withAudio: false,
      });

      const normalizedResSource = normalizeLanguageCode(res.source_lang);
      const resolvedSourceLang = normalizedResSource || (hintLang !== 'auto' ? hintLang : (role === 'staff' ? 'vi' : 'en'));
      const needsTranslation = Boolean(res.needs_translation) && resolvedSourceLang !== targetLang;
      const finalTranslatedText = needsTranslation ? (res.translated_text || cleanText) : cleanText;

      console.log(
        `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} mode=${curMode} step=TRANSLATED src=${resolvedSourceLang} tgt=${targetLang} needsTrans=${needsTranslation}`
      );

      const payload = {
        type: 'live_subtitle',
        senderRole: role,
        utteranceId,
        seq: currentSeq,
        originalText: cleanText,
        translatedText: finalTranslatedText,
        needsTranslation,
        sourceLang: resolvedSourceLang,
        targetLang,
        audioBase64: null,
        timestamp: Date.now(),
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
        console.log(
          `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} step=SUBTITLE_SENT needsTrans=${needsTranslation}`
        );
      }
      displaySubtitleLocally(payload);

      // 3. Nếu câu nói đã cùng ngôn ngữ với đích nhận (vd: Khách nói tiếng Việt gửi cho Staff target='vi',
      // hoặc Staff nói tiếng Anh gửi cho Khách target='en'):
      // Giữ nguyên câu gốc, KHÔNG dịch vòng, KHÔNG gọi TTS thừa, và KHÔNG tự chuyển mode sang Thuần Việt!
      if (!needsTranslation || !finalTranslatedText.trim()) {
        return;
      }

      // 4. Tổng hợp giọng đọc TTS cho bản dịch (có 1 lần retry nhanh nếu timeout/provider lỗi tạm thời)
      const currentEpoch = callEpochRef.current;
      setTtsStatus({ utteranceId, status: 'generating', message: 'Đang tạo âm thanh bản dịch...' });

      console.log(
        `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} step=TTS_REQUEST lang=${ttsLangCode} voice=${ttsVoice} len=${finalTranslatedText.length}`
      );

      const requestTtsWithRetry = async () => {
        const firstAttempt = await synthesizeSpeech(finalTranslatedText, {
          language: ttsLangCode,
          voice: ttsVoice,
          timeoutMs: 6500,
        });
        if (firstAttempt?.audio_base64) {
          return firstAttempt;
        }
        const retryableCodes = [TTS_ERROR_CODES.TTS_TIMEOUT, TTS_ERROR_CODES.TTS_PROVIDER_ERROR];
        if (retryableCodes.includes(firstAttempt?.error_code)) {
          console.log(
            `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} step=TTS_RETRY reason=${firstAttempt.error_code}`
          );
          return await synthesizeSpeech(finalTranslatedText, {
            language: ttsLangCode,
            voice: ttsVoice,
            timeoutMs: 4500,
          });
        }
        return firstAttempt;
      };

      requestTtsWithRetry()
        .then((audioData) => {
          if (
            isEndingRef.current ||
            callStatusRef.current !== 'connected' ||
            translateModeRef.current === 'bypass' ||
            currentEpoch !== callEpochRef.current
          ) {
            return;
          }
          if (audioData?.audio_base64 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            setTtsStatus(null);
            console.log(
              `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} step=TTS_READY provider=${audioData.provider_used || 'edge'} bytes=${audioData.audio_base64.length}`
            );
            wsRef.current.send(JSON.stringify({
              type: 'live_audio',
              callId: sessionId,
              utteranceId,
              seq: currentSeq,
              senderRole: role,
              audioBase64: audioData.audio_base64,
              translatedText: finalTranslatedText,
              targetLang,
              timestamp: Date.now(),
            }));
            console.log(
              `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} step=TTS_SENT bytes=${audioData.audio_base64.length}`
            );
          } else {
            const errCode = audioData?.error_code || TTS_ERROR_CODES.TTS_AUDIO_EMPTY;
            const errDetail = audioData?.error_detail || audioData?.error || 'TTS returned empty audio';
            console.warn(
              `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} step=TTS_EMPTY code=${errCode} detail="${errDetail}"`
            );
            setTtsStatus({
              utteranceId,
              status: 'failed',
              code: errCode,
              message: `Không thể tạo âm thanh (${errCode})`,
            });
            setTimeout(() => setTtsStatus(null), 3500);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'live_audio_status',
                callId: sessionId,
                utteranceId,
                seq: currentSeq,
                senderRole: role,
                status: 'failed',
                errorCode: errCode,
                error: errDetail,
                timestamp: Date.now(),
              }));
            }
          }
        })
        .catch((err) => {
          const errCode = TTS_ERROR_CODES.TTS_PROVIDER_ERROR;
          const errDetail = err?.message || String(err);
          console.warn(
            `[VideoCall Flow] [${role} -> ${peerRole}] utteranceId=${utteranceId} seq=${currentSeq} step=TTS_EMPTY code=${errCode} detail="${errDetail}"`
          );
          setTtsStatus({
            utteranceId,
            status: 'failed',
            code: errCode,
            message: `Lỗi tạo âm thanh (${errCode})`,
          });
          setTimeout(() => setTtsStatus(null), 3500);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'live_audio_status',
              callId: sessionId,
              utteranceId,
              seq: currentSeq,
              senderRole: role,
              status: 'failed',
              errorCode: errCode,
              error: errDetail,
              timestamp: Date.now(),
            }));
          }
        });
    } catch (err) {
      console.warn('[VideoCall Flow] Subtitle/Translation process error:', err);
      displaySubtitleLocally({
        type: 'live_subtitle',
        senderRole: role,
        originalText: spokenText,
        translatedText: spokenText,
        needsTranslation: false,
        sourceLang: 'vi',
        targetLang: 'vi',
        audioBase64: null,
        timestamp: Date.now(),
      });
    }
  }, [role, sessionId]);

  useEffect(() => {
    handleProcessSpokenTextRef.current = handleProcessSpokenText;
  }, [handleProcessSpokenText]);

  // Giả lập câu nói của Khách (English hoặc Tiếng Việt) để kiểm tra âm thanh TTS & phụ đề
  const handleSimulateGuestSpeech = async (text) => {
    if (!text || !text.trim() || isTestTranslating) return;
    try {
      setIsTestTranslating(true);
      setInterimText('');
      const clean = text.trim();
      const res = await quickTranslateText({
        text: clean,
        sourceLang: 'auto',
        targetLang: 'vi',
        sessionId: sessionId,
        senderRole: 'guest',
        withAudio: true,
      });

      const utteranceId = `sim_guest_${Date.now()}`;
      const payload = {
        type: 'live_subtitle',
        senderRole: 'guest',
        utteranceId,
        seq: ++guestTtsSeqRef.current,
        originalText: clean,
        translatedText: res.translated_text || clean,
        needsTranslation: Boolean(res.needs_translation),
        sourceLang: res.source_lang || 'en',
        targetLang: 'vi',
        audioBase64: res.audio_base64 || null,
        timestamp: Date.now(),
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }
      displaySubtitleLocally(payload);

      if (payload.needsTranslation && payload.audioBase64 && playInterpreterAudioRef.current) {
        playInterpreterAudioRef.current(payload.audioBase64, payload.translatedText, { utteranceId });
      }
    } catch (err) {
      console.warn('[VideoCall Flow] Simulate guest speech error:', err);
    } finally {
      setIsTestTranslating(false);
    }
  };

  // Giả lập câu nói của Nhân viên (Tiếng Việt -> Dịch sang Tiếng Anh cho Khách) để kiểm tra giọng đọc Jenny
  const handleSimulateStaffSpeech = async (text) => {
    if (!text || !text.trim() || isTestTranslating) return;
    try {
      setIsTestTranslating(true);
      setInterimText('');
      const clean = text.trim();
      const res = await quickTranslateText({
        text: clean,
        sourceLang: 'auto',
        targetLang: 'en',
        sessionId: sessionId,
        senderRole: 'staff',
        withAudio: true,
      });

      const utteranceId = `sim_staff_${Date.now()}`;
      const payload = {
        type: 'live_subtitle',
        senderRole: 'staff',
        utteranceId,
        seq: ++staffTtsSeqRef.current,
        originalText: clean,
        translatedText: res.translated_text || clean,
        needsTranslation: Boolean(res.needs_translation),
        sourceLang: res.source_lang || 'vi',
        targetLang: 'en',
        audioBase64: res.audio_base64 || null,
        timestamp: Date.now(),
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }
      displaySubtitleLocally(payload);

      if (payload.needsTranslation && payload.audioBase64 && playInterpreterAudioRef.current) {
        playInterpreterAudioRef.current(payload.audioBase64, payload.translatedText, { utteranceId });
      }
    } catch (err) {
      console.warn('[VideoCall Flow] Simulate staff speech error:', err);
    } finally {
      setIsTestTranslating(false);
    }
  };

  const displaySubtitleLocally = (payload) => {
    const transcriptItem = {
      speaker: payload.senderRole === 'staff' ? 'Staff' : 'Guest',
      speaker_name: payload.senderRole === 'staff' ? calleeName : callerName,
      raw_transcript: payload.originalText,
      translated_text: payload.translatedText,
      needs_translation: payload.needsTranslation,
      source_lang: payload.sourceLang,
      target_lang: payload.targetLang,
      timestamp: new Date().toISOString(),
    };
    setCallTranscripts((prev) => [...prev, transcriptItem]);
    callTranscriptsRef.current.push(transcriptItem);

    if (payload.needsTranslation || translateModeRef.current !== 'bypass') {
      setActiveSubtitle(payload);
      if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
      subtitleTimeoutRef.current = setTimeout(() => {
        setActiveSubtitle(null);
      }, 6000);
    } else {
      setActiveSubtitle(null);
    }
  };

  // Thay đổi chế độ dịch và đồng bộ cho peer đối diện

  return {
    handleProcessSpokenText,
    handleSimulateGuestSpeech,
    handleSimulateStaffSpeech,
    displaySubtitleLocally,
  };
}
