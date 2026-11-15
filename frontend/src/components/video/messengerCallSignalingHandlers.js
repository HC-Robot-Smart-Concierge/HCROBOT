import { synthesizeSpeech } from '../../services/aiApi';
import { TTS_ERROR_CODES, advanceExpectedSeqOnFailure, normalizeLanguageCode } from './videoCallTranslationHelpers';

export function createCallSignalingOnMessage({
  pc,
  ws,
  processAudioQueue,
  activeAudioSourceRef, activeGuestLanguageRef, audioQueueRef, callStatusRef, callTranscriptsRef, calleeName, callerName, expectedPlaySeqRef, failedSeqsRef, iceCandidatesQueueRef, isAiSpeakingRef, isEndingRef, isManualLockedRef, isPlayingAudioRef, outOfOrderWaitTimerRef, pcRef, peerReconnectTimerRef, persistentAudioRef, playInterpreterAudioRef, playedUtteranceIdsRef, remoteVideoRef, role, serverHostIpsRef, serverLanIpRef, setActiveGuestLanguage, setActiveSubtitle, setCallStatus, setCallTranscripts, setIsAiSpeaking, setTranslateMode, setTtsStatus, subtitleReceivedAtRef, subtitleTimeoutRef, translateModeRef, ttsActiveUntilRef, wsRef,
}) {
  const handleEndCall = (...args) => handleEndCallRef.current?.(...args);
  return async (evt) => {
        try {
          const data = JSON.parse(evt.data);

          if (data.type === 'server_info') {
            if (data.lan_ip) {
              serverLanIpRef.current = data.lan_ip;
            }
            if (Array.isArray(data.all_ips)) {
              serverHostIpsRef.current = data.all_ips;
            }
          } else if (data.type === 'peer_joined') {
            if (peerReconnectTimerRef.current) {
              clearTimeout(peerReconnectTimerRef.current);
              peerReconnectTimerRef.current = null;
            }
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'translate_mode_sync',
                mode: translateModeRef.current,
                manualLocked: isManualLockedRef.current,
              }));
            }
            if (role === 'guest') {
              if (pc.signalingState !== 'stable') {
                return;
              }
              try {
                const offer = await pc.createOffer({
                  offerToReceiveAudio: true,
                  offerToReceiveVideo: true,
                });
                await pc.setLocalDescription(offer);
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
                }
              } catch (offerErr) {
                console.error('[VideoCall] Create offer error:', offerErr);
              }
            }
          } else if (data.type === 'offer') {
            try {
              if (pc.signalingState !== 'stable') {
                await pc.setLocalDescription({ type: 'rollback' });
              }
              await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

              while (iceCandidatesQueueRef.current.length > 0) {
                const cand = iceCandidatesQueueRef.current.shift();
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {}
              }

              const answer = await pc.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
              });
              await pc.setLocalDescription(answer);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'answer', sdp: answer }));
              }
              setCallStatus('connected');
              callStatusRef.current = 'connected';
            } catch (ansErr) {
              console.error('[VideoCall] Error handling offer:', ansErr);
            }
          } else if (data.type === 'answer') {
            if (pc.signalingState === 'have-local-offer') {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

                while (iceCandidatesQueueRef.current.length > 0) {
                  const cand = iceCandidatesQueueRef.current.shift();
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (e) {}
                }
              } catch (ansErr) {
                console.error('[VideoCall] Error applying answer:', ansErr);
              }
            }
            setCallStatus('connected');
            callStatusRef.current = 'connected';
          } else if (data.type === 'candidate') {
            if (data.candidate) {
              if (pc.remoteDescription && pc.remoteDescription.type) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (candErr) {}
              } else {
                iceCandidatesQueueRef.current.push(data.candidate);
              }
            }
          } else if (data.type === 'call_end') {
            handleEndCall(false);
          } else if (data.type === 'peer_disconnected') {
            console.warn(`[VideoCall Flow] [${role}] Peer disconnected from signaling server.`);
            if (peerReconnectTimerRef.current) {
              clearTimeout(peerReconnectTimerRef.current);
            }
            peerReconnectTimerRef.current = setTimeout(() => {
              peerReconnectTimerRef.current = null;
              if (
                !isEndingRef.current &&
                (!pcRef.current || pcRef.current.connectionState !== 'connected')
              ) {
                console.log(`[VideoCall Flow] [${role}] Peer did not reconnect after 12s, ending call.`);
                handleEndCall(false);
              }
            }, 12000);
          } else if (data.type === 'live_subtitle') {
            if (data.senderRole !== role) {
              console.log(
                `[VideoCall Flow] [${data.senderRole} -> ${role}] utteranceId=${data.utteranceId || 'unknown'} seq=${data.seq || 0} mode=${translateModeRef.current} step=SUBTITLE_RECEIVED src=${data.sourceLang || 'auto'} tgt=${data.targetLang || 'auto'} needsTrans=${data.needsTranslation}`
              );

              // Cập nhật ngôn ngữ thực tế của Guest theo từng lượt nói (per-turn guest language detection)
              if (data.senderRole === 'guest' && data.sourceLang) {
                const normalizedGuestLang = normalizeLanguageCode(data.sourceLang);
                if (normalizedGuestLang) {
                  const updatedLang = normalizedGuestLang === 'vi' ? 'Tiếng Việt' : 'English';
                  activeGuestLanguageRef.current = updatedLang;
                  setActiveGuestLanguage(updatedLang);
                }
              }

              if (data.utteranceId) {
                const receivedMap = subtitleReceivedAtRef.current;
                receivedMap.set(data.utteranceId, Date.now());
                if (receivedMap.size > 50) {
                  receivedMap.delete(receivedMap.keys().next().value);
                }
              }
              // Nếu câu này không cần dịch (sourceLang === targetLang), tiến ngay expectedPlaySeqRef để không chờ live_audio
              if (!data.needsTranslation && typeof data.seq === 'number' && data.seq > 0) {
                expectedPlaySeqRef.current = advanceExpectedSeqOnFailure(
                  expectedPlaySeqRef.current,
                  data.seq,
                  failedSeqsRef.current
                );
              }

              // Hiển thị phụ đề cho người nhận (kể cả khi giữ nguyên câu gốc cùng ngôn ngữ khi đang ở chế độ dịch)
              if (data.needsTranslation || translateModeRef.current !== 'bypass') {
                setActiveSubtitle(data);
                if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
                subtitleTimeoutRef.current = setTimeout(() => {
                  setActiveSubtitle(null);
                }, 6000);
              } else {
                setActiveSubtitle(null);
              }

              const transcriptItem = {
                speaker: data.senderRole === 'staff' ? 'Staff' : 'Guest',
                speaker_name: data.senderRole === 'staff' ? calleeName : callerName,
                raw_transcript: data.originalText,
                translated_text: data.translatedText,
                needs_translation: data.needsTranslation,
                source_lang: data.sourceLang,
                target_lang: data.targetLang,
                timestamp: new Date().toISOString(),
              };
              setCallTranscripts((prev) => [...prev, transcriptItem]);
              callTranscriptsRef.current.push(transcriptItem);

              if (data.needsTranslation && data.audioBase64 && playInterpreterAudioRef.current) {
                playInterpreterAudioRef.current(data.audioBase64, data.translatedText, {
                  utteranceId: data.utteranceId,
                  seq: data.seq,
                  timestamp: data.timestamp,
                });
              } else if (data.needsTranslation && !data.audioBase64 && data.translatedText && role === 'guest') {
                // Dự phòng bên nhận (Robot): nếu gói live_audio từ Staff không đến trong 2.2s (mạng chập chờn / TTS staff lỗi),
                // Robot tự tổng hợp TTS giọng Jenny đọc bản dịch tiếng Anh cho khách để không bị câm loa
                const targetUtt = data.utteranceId;
                const targetText = data.translatedText;
                const targetSeq = data.seq;
                setTimeout(() => {
                  if (
                    !playedUtteranceIdsRef.current.has(targetUtt) &&
                    !isEndingRef.current &&
                    callStatusRef.current !== 'ended' &&
                    playInterpreterAudioRef.current
                  ) {
                    console.log(`[VideoCall Flow] [${role}] Safety TTS synthesis on receiver for utt=${targetUtt}`);
                    synthesizeSpeech(targetText, { language: 'en-US', voice: 'en-US-JennyNeural', timeoutMs: 5000 })
                      .then((audioData) => {
                        if (audioData?.audio_base64 && !playedUtteranceIdsRef.current.has(targetUtt)) {
                          playInterpreterAudioRef.current(audioData.audio_base64, targetText, {
                            utteranceId: targetUtt,
                            seq: targetSeq,
                            timestamp: Date.now(),
                          });
                        }
                      })
                      .catch(() => {});
                  }
                }, 2200);
              }
            }
          } else if (data.type === 'live_audio') {
            if (data.senderRole !== role && data.audioBase64 && playInterpreterAudioRef.current) {
              playInterpreterAudioRef.current(data.audioBase64, data.translatedText, {
                utteranceId: data.utteranceId,
                seq: data.seq,
                timestamp: data.timestamp,
              });
            }
          } else if (data.type === 'live_audio_status') {
            if (data.senderRole !== role && data.status === 'failed') {
              const errCode = data.errorCode || TTS_ERROR_CODES.TTS_AUDIO_EMPTY;
              console.warn(
                `[VideoCall Flow] [${data.senderRole} -> ${role}] utteranceId=${data.utteranceId || 'unknown'} seq=${data.seq || 0} step=LIVE_AUDIO_FAILED code=${errCode} detail="${data.error || ''}"`
              );
              // Bỏ qua seq lỗi ngay lập tức để không làm kẹt các câu kế tiếp trong hàng đợi 1.2s
              expectedPlaySeqRef.current = advanceExpectedSeqOnFailure(
                expectedPlaySeqRef.current,
                data.seq,
                failedSeqsRef.current
              );
              if (outOfOrderWaitTimerRef.current) {
                clearTimeout(outOfOrderWaitTimerRef.current);
                outOfOrderWaitTimerRef.current = null;
              }
              processAudioQueue();

              setTtsStatus({
                utteranceId: data.utteranceId,
                status: 'failed',
                code: errCode,
                message: `Lỗi âm thanh (${errCode})`,
              });
              setTimeout(() => setTtsStatus(null), 3500);
            }
          } else if (data.type === 'translate_mode_change' || data.type === 'translate_mode_sync') {
            if (data.mode) {
              setTranslateMode(data.mode);
              translateModeRef.current = data.mode;
            }
            if (data.manualLocked !== undefined) {
              isManualLockedRef.current = Boolean(data.manualLocked);
            }
            if (data.mode === 'bypass') {
              audioQueueRef.current = [];
              if (activeAudioSourceRef.current) {
                try { activeAudioSourceRef.current.stop(); } catch (e) {}
                activeAudioSourceRef.current = null;
              }
              if (persistentAudioRef.current) {
                try { persistentAudioRef.current.pause(); } catch (e) {}
              }
              if (remoteVideoRef.current) {
                remoteVideoRef.current.volume = 1.0;
              }
              setIsAiSpeaking(false);
              isAiSpeakingRef.current = false;
              isPlayingAudioRef.current = false;
              ttsActiveUntilRef.current = 0;
            }
          }
        } catch (msgErr) {
          console.warn('[VideoCall] Parse signaling msg error:', msgErr);
        }
  };
}
