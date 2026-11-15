export function useMessengerCallMediaControls({
  stopRecordingAndUpload,
  cleanUpResources,
  activeAudioSourceRef, activeGuestLanguageRef, audioQueueRef, callStatusRef, inputLangMode, inputLangModeRef, isAiSpeakingRef, isEndingRef, isManualLockedRef, isMicMuted, isMicMutedRef, isPlayingAudioRef, isSpeakerMutedRef, localStreamRef, modalContainerRef, onClose, pendingTranscriptRef, persistentAudioRef, remoteVideoRef, setActiveGuestLanguage, setCallStatus, setInputLangMode, setInterimText, setIsAiSpeaking, setIsFullscreen, setIsMicMuted, setIsSpeakerMuted, setIsVideoDisabled, setShowTranslateSettings, setTranslateMode, staffTurnEpochRef, staffTurnTimerRef, translateModeRef, ttsActiveUntilRef, turnCarryoverRef, turnStartIndexRef, wsRef,
}) {
  const handleToggleTranslateMode = (newMode, newLang = null) => {
    isManualLockedRef.current = true;
    setTranslateMode(newMode);
    translateModeRef.current = newMode;
    const targetLang = newLang || (newMode === 'auto' ? 'English' : 'Tiếng Việt');
    setActiveGuestLanguage(targetLang);
    activeGuestLanguageRef.current = targetLang;
    setShowTranslateSettings(false);

    if (newMode === 'bypass') {
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

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'translate_mode_change',
        mode: newMode,
        guestLang: targetLang,
        manualLocked: true,
      }));
    }
  };

  // Chuyển đổi chế độ ngôn ngữ đầu vào của Micro: 'auto' (Đa ngữ EN/VI) -> 'en' -> 'vi'
  const cycleInputLangMode = () => {
    const order = ['auto', 'en', 'vi'];
    const nextIdx = (order.indexOf(inputLangMode) + 1) % order.length;
    const nextMode = order[nextIdx];
    setInputLangMode(nextMode);
    inputLangModeRef.current = nextMode;
  };

  // Kết thúc cuộc gọi
  const handleEndCall = (notifyPeer = true) => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    if (notifyPeer && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'call_end' }));
      } catch (e) {}
    }

    setCallStatus('ended');
    callStatusRef.current = 'ended';

    // 1. Kích hoạt thu chunk cuối và gửi lưu ngầm
    stopRecordingAndUpload();

    // 2. Giải phóng MediaStream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // 3. Đóng giao diện tức thì (không bắt người dùng phải đợi upload Cloudinary)
    cleanUpResources();
    onClose();
  };

  // Bật/tắt Loa (Chỉ tắt tiếng video đầu xa & âm thanh AI TTS, tuyệt đối không làm ngắt kết nối WebRTC/WS)
  const toggleSpeaker = (e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    const next = !isSpeakerMutedRef.current;
    isSpeakerMutedRef.current = next;
    setIsSpeakerMuted(next);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = next;
    }
    if (next) {
      audioQueueRef.current = [];
      if (activeAudioSourceRef.current) {
        try {
          activeAudioSourceRef.current.stop();
        } catch (err) {}
        activeAudioSourceRef.current = null;
      }
      if (persistentAudioRef.current) {
        try {
          persistentAudioRef.current.pause();
        } catch (err) {}
      }
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      isPlayingAudioRef.current = false;
      ttsActiveUntilRef.current = 0;
    }
  };

  // Bật/tắt Mic
  const toggleMic = () => {
    const nextMuted = !isMicMuted;
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    setIsMicMuted(nextMuted);
    isMicMutedRef.current = nextMuted;

    if (nextMuted) {
      staffTurnEpochRef.current += 1;
      if (staffTurnTimerRef.current) {
        clearTimeout(staffTurnTimerRef.current);
        staffTurnTimerRef.current = null;
      }
      turnStartIndexRef.current = 0;
      turnCarryoverRef.current = '';
      setInterimText('');
      pendingTranscriptRef.current = '';
    }
  };

  // Bật/tắt Video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
      }
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!modalContainerRef.current) return;
    if (!document.fullscreenElement) {
      modalContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return {
    handleToggleTranslateMode,
    cycleInputLangMode,
    handleEndCall,
    toggleSpeaker,
    toggleMic,
    toggleVideo,
    toggleFullscreen,
  };
}
