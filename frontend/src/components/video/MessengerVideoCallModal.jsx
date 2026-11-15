import React, { useState, useEffect, useRef } from 'react';
import { normalizeLanguageCode } from './videoCallTranslationHelpers';
import { useMessengerCallAudioPlayback } from './useMessengerCallAudioPlayback';
import { useMessengerCallMediaRecorder } from './useMessengerCallMediaRecorder';
import { useMessengerCallSignaling } from './useMessengerCallSignaling';
import { useMessengerCallAudioAdapter } from './useMessengerCallAudioAdapter';
import { useMessengerCallWebSpeech } from './useMessengerCallWebSpeech';
import { useMessengerCallTranslation } from './useMessengerCallTranslation';
import { useMessengerCallMediaControls } from './useMessengerCallMediaControls';
import { MessengerCallTopAndTestBars } from './MessengerCallTopAndTestBars';
import { MessengerCallStageAndControls } from './MessengerCallStageAndControls';

export const MessengerVideoCallModal = ({
  isOpen = false,
  sessionId = 'default-call',
  role = 'guest', // 'guest' (Kiosk/User) | 'staff' (Concierge Specialist)
  callerName = 'Khách hàng',
  calleeName = 'Nhân viên hỗ trợ',
  roomNumber = '',
  ticketCode = null,
  guestLanguage = 'Tiếng Việt', // 'Tiếng Việt' | 'English'
  onClose = () => {},
  onCallEnded = () => {},
}) => {
  // Call status: 'calling' | 'ringing' | 'connected' | 'ended' | 'uploading'
  const [callStatus, setCallStatus] = useState('calling');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasNoCamera, setHasNoCamera] = useState(false);

  // Live Subtitle & Auto-Translation State (EN ⇄ VI)
  // Mode: 'auto' (Tự động dịch thông minh 2 chiều) | 'bypass' (Thuần Việt - Không dịch)
  const [translateMode, setTranslateMode] = useState('auto');
  // Chế độ nhận diện ngôn ngữ đầu vào của Micro: 'auto' (Đa ngữ EN/VI theo âm thanh) | 'en' | 'vi'
  const [inputLangMode, setInputLangMode] = useState('auto');
  const isInitialGuestVi =
    normalizeLanguageCode(guestLanguage) === 'vi' || guestLanguage === 'Tiếng Việt';
  const [activeGuestLanguage, setActiveGuestLanguage] = useState(
    isInitialGuestVi ? 'Tiếng Việt' : 'English'
  );
  const [activeSubtitle, setActiveSubtitle] = useState(null);
  const [interimText, setInterimText] = useState('');
  const [callTranscripts, setCallTranscripts] = useState([]);
  const [showTranslateSettings, setShowTranslateSettings] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testCustomText, setTestCustomText] = useState('');
  const [isTestTranslating, setIsTestTranslating] = useState(false);

  // References
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const modalContainerRef = useRef(null);

  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const callStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);
  const isEndingRef = useRef(false);

  // Speech Recognition, Audio Stream STT Adapter & Subtitle Refs
  const speechRecognitionRef = useRef(null);
  const audioSttAdapterRef = useRef(null);
  const lastAudioVadSpeechAtRef = useRef(0);
  const pendingWebSpeechFallbackTimerRef = useRef(null);
  const subtitleTimeoutRef = useRef(null);
  const callTranscriptsRef = useRef([]);
  const isMicMutedRef = useRef(false);
  const isSpeakerMutedRef = useRef(false);
  const checkPeerIntervalRef = useRef(null);
  const peerReconnectTimerRef = useRef(null);
  const serverLanIpRef = useRef(null);
  const serverHostIpsRef = useRef([]);
  const interpreterAudioRef = useRef(null);
  const playInterpreterAudioRef = useRef(null);
  const handleEndCallRef = useRef(null);
  const stopCallAudioSttAdapterRef = useRef(null);
  const activeGuestLanguageRef = useRef(isInitialGuestVi ? 'Tiếng Việt' : 'English');
  const translateModeRef = useRef('auto');
  const inputLangModeRef = useRef('auto');

  // Quản lý gom lượt nói cho Staff (Staff Turn Accumulation & Conversational Endpointing)
  const turnStartIndexRef = useRef(0);
  const turnCarryoverRef = useRef('');
  const staffTurnTimerRef = useRef(null);
  const staffTurnEpochRef = useRef(0);

  // Web Audio Context & Persistent Player for Autoplay Bypass
  const audioContextRef = useRef(null);
  const activeAudioSourceRef = useRef(null);
  const persistentAudioRef = useRef(null);
  const playbackWatchdogRef = useRef(null);
  const lastProcessedTextRef = useRef('');
  const lastProcessedTimeRef = useRef(0);
  const pendingTranscriptRef = useRef('');
  const sttSilenceTimerRef = useRef(null);
  const handleProcessSpokenTextRef = useRef(null);

  // Chống lặp vòng lặp âm thanh (Acoustic Echo Loop Prevention)
  const isAiSpeakingRef = useRef(false);
  const ttsActiveUntilRef = useRef(0);
  const lastPlayedTtsTextRef = useRef('');
  const staffTtsSeqRef = useRef(0);
  const guestTtsSeqRef = useRef(0);
  const expectedPlaySeqRef = useRef(1);
  const failedSeqsRef = useRef(new Set());
  const outOfOrderWaitTimerRef = useRef(null);
  const callEpochRef = useRef(0);
  const callStatusRef = useRef('calling');
  const [sttStatusMessage, setSttStatusMessage] = useState('');
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);
  const [ttsStatus, setTtsStatus] = useState(null);
  const isManualLockedRef = useRef(false);
  const audioQueueRef = useRef([]);
  const isPlayingAudioRef = useRef(false);
  const playedUtteranceIdsRef = useRef(new Set());
  // utteranceId -> thời điểm (đồng hồ máy nhận) nhận phụ đề; dùng để loại audio quá trễ mà không phụ thuộc đồng hồ máy gửi
  const subtitleReceivedAtRef = useRef(new Map());
  const previousWebRtcVolumeRef = useRef(1.0);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    activeGuestLanguageRef.current = activeGuestLanguage;
  }, [activeGuestLanguage]);

  useEffect(() => {
    translateModeRef.current = translateMode;
  }, [translateMode]);

  useEffect(() => {
    inputLangModeRef.current = inputLangMode;
  }, [inputLangMode]);

  useEffect(() => {
    isSpeakerMutedRef.current = isSpeakerMuted;
  }, [isSpeakerMuted]);

  const { primeAudioContext, processAudioQueue } = useMessengerCallAudioPlayback({ activeAudioSourceRef, audioContextRef, audioQueueRef, audioSttAdapterRef, callEpochRef, callStatusRef, expectedPlaySeqRef, failedSeqsRef, isAiSpeakingRef, isEndingRef, isPlayingAudioRef, isSpeakerMutedRef, lastPlayedTtsTextRef, outOfOrderWaitTimerRef, persistentAudioRef, playInterpreterAudioRef, playbackWatchdogRef, playedUtteranceIdsRef, remoteVideoRef, role, setIsAiSpeaking, setIsAudioBlocked, subtitleReceivedAtRef, ttsActiveUntilRef });

  const { acquireLocalMedia, startRecording, stopRecordingAndUpload, cleanUpResources } = useMessengerCallMediaRecorder({ activeAudioSourceRef, audioQueueRef, callEpochRef, callStartTimeRef, callTranscriptsRef, checkPeerIntervalRef, expectedPlaySeqRef, failedSeqsRef, guestTtsSeqRef, interpreterAudioRef, isAiSpeakingRef, isPlayingAudioRef, lastPlayedTtsTextRef, localStreamRef, mediaRecorderRef, onCallEnded, outOfOrderWaitTimerRef, pcRef, peerReconnectTimerRef, pendingTranscriptRef, persistentAudioRef, playbackWatchdogRef, playedUtteranceIdsRef, recordedChunksRef, recordingDuration, remoteVideoRef, role, sessionId, setErrorMessage, setHasNoCamera, setIsAiSpeaking, setIsAudioBlocked, setIsRecording, setTtsStatus, speechRecognitionRef, staffTtsSeqRef, staffTurnEpochRef, staffTurnTimerRef, stopCallAudioSttAdapterRef, sttSilenceTimerRef, subtitleReceivedAtRef, subtitleTimeoutRef, timerIntervalRef, ttsActiveUntilRef, turnCarryoverRef, turnStartIndexRef, wsRef });

  useMessengerCallSignaling({ acquireLocalMedia, startRecording, cleanUpResources, primeAudioContext, processAudioQueue, activeAudioSourceRef, activeGuestLanguageRef, audioQueueRef, callStartTimeRef, callStatus, callStatusRef, callTranscriptsRef, calleeName, callerName, checkPeerIntervalRef, expectedPlaySeqRef, failedSeqsRef, iceCandidatesQueueRef, isAiSpeakingRef, isEndingRef, isManualLockedRef, isMicMutedRef, isOpen, isPlayingAudioRef, isSpeakerMutedRef, localStreamRef, localVideoRef, mediaRecorderRef, outOfOrderWaitTimerRef, pcRef, peerReconnectTimerRef, persistentAudioRef, playInterpreterAudioRef, playedUtteranceIdsRef, remoteStreamRef, remoteVideoRef, role, serverHostIpsRef, serverLanIpRef, sessionId, setActiveGuestLanguage, setActiveSubtitle, setCallStatus, setCallTranscripts, setErrorMessage, setInterimText, setIsAiSpeaking, setIsMicMuted, setIsSpeakerMuted, setRecordingDuration, setTranslateMode, setTtsStatus, setUploadStatus, subtitleReceivedAtRef, subtitleTimeoutRef, translateModeRef, ttsActiveUntilRef, wsRef });

  const { stopCallAudioSttAdapter, commitSpokenText, startCallAudioSttAdapter } = useMessengerCallAudioAdapter({ primeAudioContext, audioSttAdapterRef, callStatus, callStatusRef, handleProcessSpokenTextRef, inputLangModeRef, isAiSpeaking, isAiSpeakingRef, isEndingRef, isMicMuted, isMicMutedRef, lastAudioVadSpeechAtRef, lastPlayedTtsTextRef, lastProcessedTextRef, lastProcessedTimeRef, localStreamRef, pendingTranscriptRef, pendingWebSpeechFallbackTimerRef, role, setInterimText, speechRecognitionRef, translateModeRef, ttsActiveUntilRef });
  stopCallAudioSttAdapterRef.current = stopCallAudioSttAdapter;

  useMessengerCallWebSpeech({ commitSpokenText, startCallAudioSttAdapter, stopCallAudioSttAdapter, callStatus, callStatusRef, inputLangMode, inputLangModeRef, isAiSpeakingRef, isEndingRef, isMicMuted, isMicMutedRef, lastAudioVadSpeechAtRef, pendingTranscriptRef, pendingWebSpeechFallbackTimerRef, role, setInterimText, setSttStatusMessage, speechRecognitionRef, staffTurnEpochRef, staffTurnTimerRef, sttSilenceTimerRef, translateMode, translateModeRef, turnCarryoverRef, turnStartIndexRef });

  const { handleSimulateGuestSpeech, handleSimulateStaffSpeech } = useMessengerCallTranslation({ activeGuestLanguageRef, callEpochRef, callStatusRef, callTranscriptsRef, calleeName, callerName, guestTtsSeqRef, handleProcessSpokenTextRef, inputLangModeRef, isEndingRef, isTestTranslating, playInterpreterAudioRef, role, sessionId, setActiveSubtitle, setCallTranscripts, setInterimText, setIsTestTranslating, setTtsStatus, staffTtsSeqRef, subtitleTimeoutRef, translateModeRef, wsRef });

  const { handleToggleTranslateMode, cycleInputLangMode, handleEndCall, toggleSpeaker, toggleMic, toggleVideo, toggleFullscreen } = useMessengerCallMediaControls({ stopRecordingAndUpload, cleanUpResources, activeAudioSourceRef, activeGuestLanguageRef, audioQueueRef, callStatusRef, inputLangMode, inputLangModeRef, isAiSpeakingRef, isEndingRef, isManualLockedRef, isMicMuted, isMicMutedRef, isPlayingAudioRef, isSpeakerMutedRef, localStreamRef, modalContainerRef, onClose, pendingTranscriptRef, persistentAudioRef, remoteVideoRef, setActiveGuestLanguage, setCallStatus, setInputLangMode, setInterimText, setIsAiSpeaking, setIsFullscreen, setIsMicMuted, setIsSpeakerMuted, setIsVideoDisabled, setShowTranslateSettings, setTranslateMode, staffTurnEpochRef, staffTurnTimerRef, translateModeRef, ttsActiveUntilRef, turnCarryoverRef, turnStartIndexRef, wsRef });
  handleEndCallRef.current = handleEndCall;

  if (!isOpen) return null;

  const micLangBadgeLabel = translateMode === 'bypass'
    ? 'VI'
    : (inputLangMode === 'auto' ? 'AUTO EN/VI' : inputLangMode.toUpperCase());

  return (
    <div
      ref={modalContainerRef}
      onClick={primeAudioContext}
      onTouchStart={primeAudioContext}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#141413]/85 backdrop-blur-sm transition-all duration-300 p-0 lg:p-6"
    >
      {/* Thẻ audio cố định để giải phóng autoplay trên iOS Safari / Chrome */}
      <audio ref={persistentAudioRef} playsInline autoPlay={false} style={{ display: 'none' }} />

      {/* Video Call Modal Window */}
      <div className="relative w-full h-full lg:h-[620px] lg:max-w-4xl bg-[#1A1A1A] rounded-none lg:rounded-3xl overflow-hidden shadow-2xl border-0 lg:border lg:border-stone-800 flex flex-col">
        <MessengerCallTopAndTestBars
          micLangBadgeLabel={micLangBadgeLabel}
          primeAudioContext={primeAudioContext}
          processAudioQueue={processAudioQueue}
          cycleInputLangMode={cycleInputLangMode}
          handleToggleTranslateMode={handleToggleTranslateMode}
          toggleMic={toggleMic}
          toggleFullscreen={toggleFullscreen}
          handleSimulateGuestSpeech={handleSimulateGuestSpeech}
          handleSimulateStaffSpeech={handleSimulateStaffSpeech}
          callStatus={callStatus}
          calleeName={calleeName}
          callerName={callerName}
          inputLangMode={inputLangMode}
          isAiSpeaking={isAiSpeaking}
          isAudioBlocked={isAudioBlocked}
          isFullscreen={isFullscreen}
          isMicMuted={isMicMuted}
          isTestTranslating={isTestTranslating}
          recordingDuration={recordingDuration}
          role={role}
          roomNumber={roomNumber}
          setIsAudioBlocked={setIsAudioBlocked}
          setShowTestPanel={setShowTestPanel}
          setSttStatusMessage={setSttStatusMessage}
          setTestCustomText={setTestCustomText}
          showTestPanel={showTestPanel}
          sttStatusMessage={sttStatusMessage}
          testCustomText={testCustomText}
          translateMode={translateMode}
          ttsStatus={ttsStatus}
        />
        <MessengerCallStageAndControls
          toggleMic={toggleMic}
          toggleVideo={toggleVideo}
          toggleSpeaker={toggleSpeaker}
          handleEndCall={handleEndCall}
          activeSubtitle={activeSubtitle}
          callStatus={callStatus}
          calleeName={calleeName}
          callerName={callerName}
          errorMessage={errorMessage}
          hasNoCamera={hasNoCamera}
          interimText={interimText}
          isAiSpeaking={isAiSpeaking}
          isMicMuted={isMicMuted}
          isSpeakerMuted={isSpeakerMuted}
          isVideoDisabled={isVideoDisabled}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          role={role}
          translateMode={translateMode}
        />
      </div>
    </div>
  );
};
