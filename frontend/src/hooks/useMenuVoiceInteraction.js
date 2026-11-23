import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shared voice interaction controller for all full-screen Robot Kiosk menus
 * (Food, Room Service, Bellman, Maintenance).
 */
export function useMenuVoiceInteraction({
  lastVoiceTranscript = null,
  voiceReplyText = '',
  speak = null,
  onStartTalk = null,
  onStopSpeaking = null,
  isSpeaking = false,
  isEn = false,
  onVoiceCommand = null,
  onUnhandledVoice = null,
}) {
  const [localReply, setLocalReply] = useState('');
  const lastSeqRef = useRef(null);
  const onVoiceCommandRef = useRef(onVoiceCommand);
  const onUnhandledVoiceRef = useRef(onUnhandledVoice);

  useEffect(() => {
    onVoiceCommandRef.current = onVoiceCommand;
  }, [onVoiceCommand]);

  useEffect(() => {
    onUnhandledVoiceRef.current = onUnhandledVoice;
  }, [onUnhandledVoice]);

  useEffect(() => {
    if (voiceReplyText) {
      setLocalReply(voiceReplyText);
    }
  }, [voiceReplyText]);

  const announce = useCallback(
    (msg, { relisten = true } = {}) => {
      if (!msg) return;
      setLocalReply(msg);
      if (typeof speak === 'function') {
        speak(msg, isEn ? 'en-US' : 'vi-VN', () => {
          if (relisten && typeof onStartTalk === 'function') {
            setTimeout(() => onStartTalk({ silent: true }), 120);
          }
        });
      }
    },
    [speak, isEn, onStartTalk]
  );

  const toggleVoice = useCallback(() => {
    if (isSpeaking && typeof onStopSpeaking === 'function') {
      onStopSpeaking();
      return;
    }
    if (typeof onStartTalk === 'function') {
      setLocalReply('');
      onStartTalk();
    }
  }, [isSpeaking, onStopSpeaking, onStartTalk]);

  useEffect(() => {
    if (!lastVoiceTranscript || !lastVoiceTranscript.text) return;
    const seq = lastVoiceTranscript.seq || lastVoiceTranscript.text;
    if (lastSeqRef.current === seq) return;
    lastSeqRef.current = seq;

    const text = String(lastVoiceTranscript.text || '').trim();
    if (!text) return;

    const handled = onVoiceCommandRef.current ? onVoiceCommandRef.current(text) : false;
    if (!handled && typeof onUnhandledVoiceRef.current === 'function') {
      onUnhandledVoiceRef.current(text);
    }
  }, [lastVoiceTranscript]);

  return {
    voiceReply: localReply,
    setVoiceReply: setLocalReply,
    clearVoiceReply: () => setLocalReply(''),
    announce,
    toggleVoice,
  };
}
