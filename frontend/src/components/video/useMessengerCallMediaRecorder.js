import { uploadCallRecording } from '../../services/conciergeApi';
import { createFakeVideoStream } from './messengerVideoCallUtils';

export function useMessengerCallMediaRecorder({
  activeAudioSourceRef, audioQueueRef, callEpochRef, callStartTimeRef, callTranscriptsRef, checkPeerIntervalRef, expectedPlaySeqRef, failedSeqsRef, guestTtsSeqRef, interpreterAudioRef, isAiSpeakingRef, isPlayingAudioRef, lastPlayedTtsTextRef, localStreamRef, mediaRecorderRef, onCallEnded, outOfOrderWaitTimerRef, pcRef, peerReconnectTimerRef, pendingTranscriptRef, persistentAudioRef, playbackWatchdogRef, playedUtteranceIdsRef, recordedChunksRef, recordingDuration, remoteVideoRef, role, sessionId, setErrorMessage, setHasNoCamera, setIsAiSpeaking, setIsAudioBlocked, setIsRecording, setTtsStatus, speechRecognitionRef, staffTtsSeqRef, staffTurnEpochRef, staffTurnTimerRef, stopCallAudioSttAdapterRef, sttSilenceTimerRef, subtitleReceivedAtRef, subtitleTimeoutRef, timerIntervalRef, ttsActiveUntilRef, turnCarryoverRef, turnStartIndexRef, wsRef,
}) {
  // 2. Lấy Media Stream của thiết bị (Đa tầng fallback cho cả PC và iPhone Safari)
  const acquireLocalMedia = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('[VideoCall] navigator.mediaDevices.getUserMedia không được hỗ trợ');
      return createFakeVideoStream(role === 'staff' ? 'Concierge Staff' : 'Hotel Guest');
    }

    // Tầng 1: Thử camera trước + mic tiêu chuẩn
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: role === 'staff'
          ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      setHasNoCamera(false);
      return stream;
    } catch (videoError) {
      console.warn('[VideoCall] Thử camera tiêu chuẩn thất bại:', videoError?.message || videoError?.name);
    }

    // Tầng 2: Thử video + audio cơ bản không ràng buộc resolution (iOS Safari)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setHasNoCamera(false);
      return stream;
    } catch (basicErr) {
      console.warn('[VideoCall] Thử video+audio cơ bản thất bại:', basicErr?.message || basicErr?.name);
    }

    // Tầng 3: Thử chỉ Mic + Fake canvas video (nếu không có camera hoặc bị chặn)
    setHasNoCamera(true);
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const fakeVideoStream = createFakeVideoStream(role === 'staff' ? 'Nhân viên Concierge' : 'Robot Kiosk');
      return new MediaStream([
        ...audioStream.getAudioTracks(),
        ...fakeVideoStream.getVideoTracks(),
      ]);
    } catch (audioError) {
      console.warn('[VideoCall] Cả mic và camera đều không truy cập được:', audioError);
      if (audioError?.name === 'NotAllowedError' || audioError?.name === 'PermissionDeniedError') {
        setErrorMessage('Quyền Micro hoặc Camera chưa được cấp. Hãy kiểm tra cài đặt trình duyệt trên thiết bị (biểu tượng ổ khóa/Cài đặt Safari) để Cho phép Micro & Camera.');
      } else if (audioError?.name === 'NotReadableError' || audioError?.name === 'TrackStartError') {
        setErrorMessage('Camera hoặc Micro đang bị ứng dụng khác chiếm giữ. Hệ thống tự động chuyển sang luồng đàm thoại dự phòng.');
      }
      return createFakeVideoStream('No Device Available');
    }
  };

  // 3. Khởi tạo ghi hình cuộc gọi (Ưu tiên WebM VP8/Opus bitrate 600kbps tiết kiệm băng thông)
  const startRecording = (stream) => {
    try {
      if (!window.MediaRecorder) {
        return;
      }

      recordedChunksRef.current = [];
      let mimeType = '';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          mimeType = 'video/webm;codecs=vp8,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
          mimeType = 'video/webm;codecs=vp9,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          mimeType = 'video/webm';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        }
      }

      const recorderOptions = {
        videoBitsPerSecond: 600000, // 600 Kbps - rõ nét chuẩn web nhưng siêu nhẹ dung lượng
      };
      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }

      const recorder = new MediaRecorder(stream, recorderOptions);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => {
        setIsRecording(true);
        if (!callStartTimeRef.current) {
          callStartTimeRef.current = new Date().toISOString();
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn('[VideoCall] Lỗi khởi tạo MediaRecorder (bỏ qua ghi hình):', err);
    }
  };

  // 4. Dừng ghi hình và tự động gửi lưu ngầm độc lập với vòng đời đóng UI
  const stopRecordingAndUpload = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const recorder = mediaRecorderRef.current;
    const durationSec = recordingDuration;
    const startedAt = callStartTimeRef.current;
    const endedAt = new Date().toISOString();
    const transcripts = callTranscriptsRef.current ? [...callTranscriptsRef.current] : [];

    const finalizeAndSend = () => {
      if (recordedChunksRef.current && recordedChunksRef.current.length > 0) {
        const mime = recorder?.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        uploadCallRecording(sessionId, blob, durationSec, startedAt, endedAt, transcripts)
          .then((uploadRes) => {
            console.log('[VideoCall] Background recording upload accepted (HTTP 202):', uploadRes);
            if (typeof onCallEnded === 'function') {
              onCallEnded(uploadRes);
            }
          })
          .catch((upErr) => {
            console.warn('[VideoCall] Background upload notice:', upErr?.message || upErr);
          });
      }
    };

    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.addEventListener('stop', finalizeAndSend, { once: true });
        recorder.stop();
      } catch (e) {
        finalizeAndSend();
      }
    } else {
      finalizeAndSend();
    }
  };

  // Khởi tạo AudioContext cho Web Audio API

  const stopCallAudioSttAdapter = () => stopCallAudioSttAdapterRef.current?.();

  // Dọn dẹp tài nguyên
  const cleanUpResources = () => {
    if (checkPeerIntervalRef.current) {
      clearInterval(checkPeerIntervalRef.current);
      checkPeerIntervalRef.current = null;
    }
    if (peerReconnectTimerRef.current) {
      clearTimeout(peerReconnectTimerRef.current);
      peerReconnectTimerRef.current = null;
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (sttSilenceTimerRef.current) {
      clearTimeout(sttSilenceTimerRef.current);
      sttSilenceTimerRef.current = null;
    }

    if (playbackWatchdogRef.current) {
      clearTimeout(playbackWatchdogRef.current);
      playbackWatchdogRef.current = null;
    }

    staffTurnEpochRef.current += 1;
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
        speechRecognitionRef.current.stop();
        speechRecognitionRef.current.abort();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }

    if (subtitleTimeoutRef.current) {
      clearTimeout(subtitleTimeoutRef.current);
      subtitleTimeoutRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      if (localStreamRef.current._canvasInterval) {
        clearInterval(localStreamRef.current._canvasInterval);
      }
    }

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {}
      pcRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }

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

    if (interpreterAudioRef.current) {
      try {
        interpreterAudioRef.current.pause();
        interpreterAudioRef.current = null;
      } catch (e) {}
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = 1.0;
    }
    callEpochRef.current += 1;
    if (outOfOrderWaitTimerRef.current) {
      clearTimeout(outOfOrderWaitTimerRef.current);
      outOfOrderWaitTimerRef.current = null;
    }
    staffTtsSeqRef.current = 0;
    guestTtsSeqRef.current = 0;
    expectedPlaySeqRef.current = 1;
    failedSeqsRef.current.clear();
    audioQueueRef.current = [];
    playedUtteranceIdsRef.current.clear();
    subtitleReceivedAtRef.current.clear();
    isPlayingAudioRef.current = false;
    isAiSpeakingRef.current = false;
    ttsActiveUntilRef.current = 0;
    lastPlayedTtsTextRef.current = '';
    pendingTranscriptRef.current = '';
    setIsAiSpeaking(false);
    setTtsStatus(null);
    setIsAudioBlocked(false);
  };

  return {
    acquireLocalMedia,
    startRecording,
    stopRecordingAndUpload,
    cleanUpResources,
  };
}
