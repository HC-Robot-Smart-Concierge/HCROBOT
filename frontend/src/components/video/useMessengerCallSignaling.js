import { useCallback, useEffect, useRef } from 'react';
import { getCallSignalingWsUrl } from '../../services/conciergeApi';
import { ICE_SERVERS } from './messengerVideoCallUtils';
import { createCallSignalingOnMessage } from './messengerCallSignalingHandlers';

export function useMessengerCallSignaling({
  acquireLocalMedia,
  startRecording,
  cleanUpResources,
  primeAudioContext,
  processAudioQueue,
  activeAudioSourceRef, activeGuestLanguageRef, audioQueueRef, callStartTimeRef, callStatus, callStatusRef, callTranscriptsRef, calleeName, callerName, checkPeerIntervalRef, expectedPlaySeqRef, failedSeqsRef, iceCandidatesQueueRef, isAiSpeakingRef, isEndingRef, isManualLockedRef, isMicMutedRef, isOpen, isPlayingAudioRef, isSpeakerMutedRef, localStreamRef, localVideoRef, mediaRecorderRef, outOfOrderWaitTimerRef, pcRef, peerReconnectTimerRef, persistentAudioRef, playInterpreterAudioRef, playedUtteranceIdsRef, remoteStreamRef, remoteVideoRef, role, serverHostIpsRef, serverLanIpRef, sessionId, setActiveGuestLanguage, setActiveSubtitle, setCallStatus, setCallTranscripts, setErrorMessage, setInterimText, setIsAiSpeaking, setIsMicMuted, setIsSpeakerMuted, setRecordingDuration, setTranslateMode, setTtsStatus, setUploadStatus, subtitleReceivedAtRef, subtitleTimeoutRef, translateModeRef, ttsActiveUntilRef, wsRef,
}) {
  // 5. Kết nối WebSocket Signaling & RTCPeerConnection
  const setupWebRTC = useCallback(async () => {
    try {
      primeAudioContext();
      const stream = await acquireLocalMedia();
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        console.log('[VideoCall] ontrack received track:', event.track.kind, event.track.id);

        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }

        event.track.enabled = true;

        if (!remoteStreamRef.current.getTracks().some((t) => t.id === event.track.id)) {
          remoteStreamRef.current.addTrack(event.track);
        }

        event.track.onunmute = () => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(() => {});
          }
        };

        if (remoteVideoRef.current) {
          if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
          }
          const playPromise = remoteVideoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((e) => {
              if (e.name !== 'AbortError' && e.name === 'NotAllowedError' && remoteVideoRef.current) {
                remoteVideoRef.current.muted = true;
                remoteVideoRef.current.play().catch(() => {});
              }
            });
          }
        }
        setCallStatus('connected');
        callStatusRef.current = 'connected';
        if (!mediaRecorderRef.current && remoteStreamRef.current) {
          startRecording(remoteStreamRef.current);
        }
      };

      pc.onconnectionstatechange = async () => {
        console.log('[VideoCall] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setCallStatus('connected');
          callStatusRef.current = 'connected';
          if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(() => {});
          }
        } else if (pc.connectionState === 'failed') {
          if (role === 'guest' && pc.restartIce && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            try {
              pc.restartIce();
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              wsRef.current.send(JSON.stringify({ type: 'offer', sdp: offer }));
            } catch (iceErr) {
              console.error('[VideoCall] ICE restart error:', iceErr);
            }
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setCallStatus('connected');
          callStatusRef.current = 'connected';
          if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(() => {});
          }
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'candidate',
                candidate: event.candidate,
              })
            );
          }

          if (role === 'guest') {
            const candStr = event.candidate.candidate;
            const targetIps = serverHostIpsRef.current.length > 0 ? serverHostIpsRef.current : (serverLanIpRef.current ? [serverLanIpRef.current] : []);
            if (candStr && candStr.includes('.local')) {
              for (const targetIp of targetIps) {
                if (targetIp && targetIp !== '127.0.0.1') {
                  const unmDnsStr = candStr.replace(/[a-zA-Z0-9_\-]+\.local/g, targetIp);
                  if (unmDnsStr !== candStr && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(
                      JSON.stringify({
                        type: 'candidate',
                        candidate: {
                          candidate: unmDnsStr,
                          sdpMid: event.candidate.sdpMid,
                          sdpMLineIndex: event.candidate.sdpMLineIndex,
                          usernameFragment: event.candidate.usernameFragment,
                        },
                      })
                    );
                  }
                }
              }
            }
          }
        }
      };

      const wsUrl = getCallSignalingWsUrl(sessionId, role, role === 'guest' ? callerName : calleeName);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      if (checkPeerIntervalRef.current) clearInterval(checkPeerIntervalRef.current);
      checkPeerIntervalRef.current = setInterval(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          } catch (e) {}
        }
      }, 10000);

      ws.onopen = () => {
        console.log('[VideoCall] Signaling WS Connected for session:', sessionId);
        if (role === 'guest') {
          setCallStatus('ringing');
          callStatusRef.current = 'ringing';
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'translate_mode_sync',
            mode: translateModeRef.current,
            manualLocked: isManualLockedRef.current,
          }));
        }
      };

      ws.onmessage = createCallSignalingOnMessage({
        pc,
        ws,
        processAudioQueue,
        activeAudioSourceRef,
        activeGuestLanguageRef,
        audioQueueRef,
        callStatusRef,
        callTranscriptsRef,
        calleeName,
        callerName,
        expectedPlaySeqRef,
        failedSeqsRef,
        iceCandidatesQueueRef,
        isAiSpeakingRef,
        isEndingRef,
        isManualLockedRef,
        isPlayingAudioRef,
        outOfOrderWaitTimerRef,
        pcRef,
        peerReconnectTimerRef,
        persistentAudioRef,
        playInterpreterAudioRef,
        playedUtteranceIdsRef,
        remoteVideoRef,
        role,
        serverHostIpsRef,
        serverLanIpRef,
        setActiveGuestLanguage,
        setActiveSubtitle,
        setCallStatus,
        setCallTranscripts,
        setIsAiSpeaking,
        setTranslateMode,
        setTtsStatus,
        subtitleReceivedAtRef,
        subtitleTimeoutRef,
        translateModeRef,
        ttsActiveUntilRef,
        wsRef,
      });

      ws.onerror = (err) => {
        console.error('[VideoCall] WS Signaling Error:', err);
      };

      ws.onclose = () => {
        console.log('[VideoCall] WS Signaling Closed');
      };
    } catch (err) {
      console.error('[VideoCall] Setup error:', err);
      setErrorMessage(err.message || 'Không thể thiết lập cuộc gọi');
    }
  }, [sessionId, role, callerName, calleeName, primeAudioContext, processAudioQueue]);

  const setupWebRTCRef = useRef(null);
  useEffect(() => {
    setupWebRTCRef.current = setupWebRTC;
  }, [setupWebRTC]);

  // Khởi động khi modal mở (chỉ phụ thuộc isOpen, sessionId, role — tuyệt đối không phụ thuộc state UI như tắt loa/mic)
  useEffect(() => {
    if (isOpen) {
      isEndingRef.current = false;
      isMicMutedRef.current = false;
      isSpeakerMutedRef.current = false;
      setIsMicMuted(false);
      setIsSpeakerMuted(false);
      setCallStatus('calling');
      callStatusRef.current = 'calling';
      setRecordingDuration(0);
      setUploadStatus(null);
      setErrorMessage('');
      setActiveSubtitle(null);
      setInterimText('');
      setCallTranscripts([]);
      callTranscriptsRef.current = [];
      if (setupWebRTCRef.current) {
        setupWebRTCRef.current();
      }
    }

    return () => {
      cleanUpResources();
    };
  }, [isOpen, sessionId, role]);

  // Độc lập tính thời lượng cuộc gọi khi kết nối thành công
  useEffect(() => {
    let callTimer = null;
    if (callStatus === 'connected') {
      if (!callStartTimeRef.current) {
        callStartTimeRef.current = new Date().toISOString();
      }
      callTimer = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (callTimer) clearInterval(callTimer);
    };
  }, [callStatus]);

}
