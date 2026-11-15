import { useCallback, useEffect } from 'react';
import { STAFF_CONVERSATIONAL_SILENCE_MS } from './messengerVideoCallUtils';

export function useMessengerCallWebSpeech({
  commitSpokenText,
  startCallAudioSttAdapter,
  stopCallAudioSttAdapter,
  callStatus, callStatusRef, inputLangMode, inputLangModeRef, isAiSpeakingRef, isEndingRef, isMicMuted, isMicMutedRef, lastAudioVadSpeechAtRef, pendingTranscriptRef, pendingWebSpeechFallbackTimerRef, role, setInterimText, setSttStatusMessage, speechRecognitionRef, staffTurnEpochRef, staffTurnTimerRef, sttSilenceTimerRef, translateMode, translateModeRef, turnCarryoverRef, turnStartIndexRef,
}) {
  // Khởi tạo nhận diện giọng nói Web Speech API (Streaming phụ đề tạm thời + kết hợp Audio Stream Adapter)
  const startSpeechRecognition = useCallback(() => {
    if (isEndingRef.current || isMicMutedRef.current) return;
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.log(`[VideoCall STT] [${role}] Web Speech API unavailable; relying on Audio Stream Bilingual STT Adapter.`);
      return;
    }

    if (sttSilenceTimerRef.current) {
      clearTimeout(sttSilenceTimerRef.current);
      sttSilenceTimerRef.current = null;
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current._isManualStop = true;
        speechRecognitionRef.current.abort();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // Xác định ngôn ngữ cho Web Speech API:
      // - Nếu người dùng khóa inputLangMode === 'vi' hoặc translateMode === 'bypass' -> 'vi-VN'
      // - Nếu khóa inputLangMode === 'en' -> 'en-US'
      // - Nếu inputLangMode === 'auto' -> mặc định theo vai trò ('vi-VN' cho staff, 'en-US' cho guest),
      //   trong khi Audio Stream Adapter song ngữ sẽ tự động phân loại cả EN & VI từ âm thanh thực tế.
      let listenLang = 'en-US';
      if (role === 'staff') {
        listenLang = 'vi-VN';
      } else if (translateMode === 'bypass' || inputLangMode === 'vi') {
        listenLang = 'vi-VN';
      } else if (inputLangMode === 'en') {
        listenLang = 'en-US';
      } else {
        listenLang = 'en-US';
      }
      recognition.lang = listenLang;

      recognition.onstart = () => {
        console.log(
          `[VideoCall Flow] [${role}] step=STT_STARTED engine=web_speech lang=${listenLang} inputMode=${inputLangMode} mode=${translateMode}`
        );
        if (role === 'staff') {
          turnStartIndexRef.current = 0;
        }
        setSttStatusMessage('');
      };

      const dispatchWebSpeechTranscript = (transcriptText) => {
        const clean = (transcriptText || '').trim();
        if (!clean) return;
        const fixedHint = listenLang.startsWith('vi') ? 'vi' : 'en';

        // Phía Nhân viên (role === 'staff') hoặc câu có dấu thanh tiếng Việt rõ ràng:
        // Commit ngay lập tức, không trì hoãn 1250ms để loại bỏ độ trễ và race condition
        const hasViDiacritics = /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(clean);
        if (role === 'staff' || hasViDiacritics) {
          if (pendingWebSpeechFallbackTimerRef.current) {
            clearTimeout(pendingWebSpeechFallbackTimerRef.current);
            pendingWebSpeechFallbackTimerRef.current = null;
          }
          commitSpokenText(clean, {
            engine: 'web_speech',
            detectedLang: 'vi',
          });
          return;
        }

        // Nếu đang ở chế độ Đa ngữ Tự động ('auto') và bộ thu âm Audio Stream VAD vừa thu được giọng nói thực tế,
        // ưu tiên chờ kết quả nhận diện song ngữ từ Audio Stream Adapter (tối đa 1250ms) để tránh nhận sai ngôn ngữ
        // khi khách nói tiếng Việt xen giữa tiếng Anh. Nếu Audio Adapter không phản hồi thì tự động fallback sang kết quả này.
        const audioVadRecentlyActive = Date.now() - lastAudioVadSpeechAtRef.current < 2400;
        if (inputLangModeRef.current === 'auto' && translateModeRef.current !== 'bypass' && audioVadRecentlyActive) {
          if (pendingWebSpeechFallbackTimerRef.current) {
            clearTimeout(pendingWebSpeechFallbackTimerRef.current);
          }
          pendingWebSpeechFallbackTimerRef.current = setTimeout(() => {
            pendingWebSpeechFallbackTimerRef.current = null;
            commitSpokenText(clean, {
              engine: 'web_speech_fallback',
              detectedLang: 'auto',
            });
          }, 1250);
          return;
        }

        commitSpokenText(clean, {
          engine: 'web_speech',
          detectedLang: inputLangModeRef.current === 'auto' ? 'auto' : fixedHint,
        });
      };

      recognition.onresult = (event) => {
        // --- NHÁNH DÀNH RIÊNG CHO STAFF (TIẾNG VIỆT LỄ TÂN) ---
        // Áp dụng chuẩn Conversational Endpointing theo mô hình Voice Bot (1.000ms):
        // 1. Chỉ lấy kết quả từ turnStartIndexRef trở đi để KHÔNG BAO GIỜ bị cộng dồn với câu đã nói trước đó.
        // 2. Chịu được nhịp ngắt nghỉ tự nhiên (~700ms - 800ms) giữa các vế câu.
        // 3. Khi Staff dứt lời 1.0s, tự động chốt dứt khoát lượt nói và cập nhật turnStartIndexRef = results.length.
        if (role === 'staff') {
          let turnFinalText = '';
          let currentInterim = '';

          const startIdx = Math.min(turnStartIndexRef.current, event.results.length);
          for (let i = startIdx; i < event.results.length; ++i) {
            const res = event.results[i];
            const transcript = (res[0] ? res[0].transcript : '').trim();
            if (!transcript) continue;

            if (res.isFinal) {
              turnFinalText += (turnFinalText ? ' ' : '') + transcript;
            } else {
              currentInterim += (currentInterim ? ' ' : '') + transcript;
            }
          }

          const carry = turnCarryoverRef.current;
          const combinedFinal = [carry, turnFinalText].filter(Boolean).join(' ').trim();
          const combinedPreview = [combinedFinal, currentInterim].filter(Boolean).join(' ').trim();
          if (!combinedPreview) return;

          if (isAiSpeakingRef.current) {
            console.log(`[VideoCall Flow] [staff] step=STT_SKIPPED reason=ECHO_AI_SPEAKING engine=web_speech len=${combinedPreview.length}`);
            return;
          }

          pendingTranscriptRef.current = combinedPreview;
          setInterimText(combinedPreview);
          console.log(
            `[VideoCall Flow] [staff] step=STT_RESULT engine=web_speech startIdx=${startIdx} carryLen=${carry.length} finalLen=${turnFinalText.length} interimLen=${currentInterim.length} totalLen=${combinedPreview.length}`
          );

          if (staffTurnTimerRef.current) {
            clearTimeout(staffTurnTimerRef.current);
          }
          const currentEpoch = staffTurnEpochRef.current;
          const currentResultsLen = event.results.length;

          staffTurnTimerRef.current = setTimeout(() => {
            staffTurnTimerRef.current = null;
            if (
              currentEpoch !== staffTurnEpochRef.current ||
              isMicMutedRef.current ||
              isEndingRef.current ||
              callStatusRef.current !== 'connected'
            ) {
              return;
            }

            const sentenceToCommit = (pendingTranscriptRef.current || combinedPreview).trim();
            if (sentenceToCommit.length > 1) {
              // Chốt dứt khoát lượt nói này:
              // Đẩy turnStartIndex lên vị trí kết quả hiện tại để các câu tiếp theo KHÔNG bị cộng dồn!
              turnStartIndexRef.current = currentResultsLen;
              turnCarryoverRef.current = '';
              pendingTranscriptRef.current = '';
              setInterimText('');

              commitSpokenText(sentenceToCommit, {
                engine: 'web_speech',
                detectedLang: 'vi',
              });
            }
          }, STAFF_CONVERSATIONAL_SILENCE_MS);
          return;
        }

        // --- NHÁNH DÀNH CHO GUEST / ROBOT (GIỮ NGUYÊN HOÀN TOÀN) ---
        let interim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const transcript = res[0] ? res[0].transcript : '';
          if (res.isFinal) {
            finalChunk += transcript;
          } else {
            interim += transcript;
          }
        }

        const candidate = (finalChunk ? finalChunk + ' ' : '') + interim;
        const cleanCandidate = candidate.trim();
        if (!cleanCandidate) return;

        // Kiểm tra nếu đang bị chặn bởi loa AI đang phát thì ghi log tường minh thay vì return im lặng
        if (isAiSpeakingRef.current) {
          console.log(`[VideoCall Flow] [${role}] step=STT_SKIPPED reason=ECHO_AI_SPEAKING engine=web_speech len=${cleanCandidate.length}`);
          return;
        }

        pendingTranscriptRef.current = cleanCandidate;
        setInterimText(cleanCandidate);
        console.log(
          `[VideoCall Flow] [${role}] step=STT_RESULT engine=web_speech final=${Boolean(finalChunk)} interimLen=${interim.length} totalLen=${cleanCandidate.length}`
        );

        // Chỉ chốt ngay nếu finalChunk đã có VÀ người dùng đã thực sự dừng lời (interim trống).
        // Nếu người dùng vẫn đang nói (interim còn chữ), KHÔNG ngắt câu sớm để tránh cắt cụt câu nói dài!
        if (finalChunk.trim() && !interim.trim()) {
          if (sttSilenceTimerRef.current) {
            clearTimeout(sttSilenceTimerRef.current);
            sttSilenceTimerRef.current = null;
          }
          dispatchWebSpeechTranscript(finalChunk.trim());
          return;
        }

        // Khi người dùng đang nói hoặc vừa có finalChunk nhưng interim đang tiếp nối,
        // duy trì timer 900ms để bắt trọn câu nói tự nhiên
        if (sttSilenceTimerRef.current) {
          clearTimeout(sttSilenceTimerRef.current);
        }
        sttSilenceTimerRef.current = setTimeout(() => {
          sttSilenceTimerRef.current = null;
          if (pendingTranscriptRef.current && pendingTranscriptRef.current.trim().length > 1) {
            dispatchWebSpeechTranscript(pendingTranscriptRef.current);
          }
        }, 900);
      };

      recognition.onerror = (err) => {
        if (err.error === 'not-allowed' || err.error === 'service-not-allowed') {
          recognition._hasPermError = true;
          console.warn(`[VideoCall Flow] [${role}] step=STT_ERROR reason=${err.error} engine=web_speech`);
        } else if (err.error !== 'no-speech' && err.error !== 'aborted') {
          console.warn(`[VideoCall Flow] [${role}] step=STT_ERROR reason=${err.error} engine=web_speech`);
        }
      };

      recognition.onend = () => {
        if (recognition._isManualStop) {
          return;
        }

        // Phía Guest: bàn giao pending transcript nếu có
        if (role !== 'staff') {
          if (pendingTranscriptRef.current && pendingTranscriptRef.current.trim().length > 1) {
            dispatchWebSpeechTranscript(pendingTranscriptRef.current);
          }
        } else {
          // Phía Staff: nếu đang có câu dở dang trong lượt nói khi browser tự ngắt onend,
          // lưu vào carryover để khi browser start lại session mới (results reset về 0)
          // câu nói tiếp theo vẫn được nối liền tự nhiên.
          if (pendingTranscriptRef.current && pendingTranscriptRef.current.trim()) {
            turnCarryoverRef.current = pendingTranscriptRef.current.trim();
          }
        }

        if (!isEndingRef.current && !isMicMutedRef.current && callStatusRef.current === 'connected' && !recognition._hasPermError) {
          setTimeout(() => {
            if (!recognition._isManualStop && !isEndingRef.current && !isMicMutedRef.current && callStatusRef.current === 'connected' && !recognition._hasPermError) {
              try {
                recognition.start();
              } catch (e) {
                setTimeout(() => {
                  if (!isEndingRef.current && !isMicMutedRef.current && callStatusRef.current === 'connected' && !recognition._hasPermError) {
                    startSpeechRecognition();
                  }
                }, 600);
              }
            }
          }, 200);
        }
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
    } catch (e) {
      console.warn(`[VideoCall STT] [${role}] Web Speech init fallback to Audio Stream STT:`, e);
    }
  }, [role, translateMode, inputLangMode, commitSpokenText]);

  // Kích hoạt cả Web Speech API và Audio Stream STT Adapter khi cuộc gọi đã kết nối thành công
  useEffect(() => {
    if (callStatus === 'connected' && !isMicMuted) {
      startCallAudioSttAdapter();
      startSpeechRecognition();
    } else {
      stopCallAudioSttAdapter();
    }
    return () => {
      if (sttSilenceTimerRef.current) {
        clearTimeout(sttSilenceTimerRef.current);
        sttSilenceTimerRef.current = null;
      }
      if (staffTurnTimerRef.current) {
        clearTimeout(staffTurnTimerRef.current);
        staffTurnTimerRef.current = null;
      }
      turnStartIndexRef.current = 0;
      turnCarryoverRef.current = '';
      stopCallAudioSttAdapter();
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current._isManualStop = true;
          speechRecognitionRef.current.abort();
        } catch (e) {}
        speechRecognitionRef.current = null;
      }
    };
  }, [callStatus, isMicMuted, startSpeechRecognition, startCallAudioSttAdapter, stopCallAudioSttAdapter]);


}
