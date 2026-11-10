import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Speech Synthesis Voice Consistency & Web Audio API Fallback Tests', () => {
  const useSpeechSynthesisPath = path.resolve(__dirname, '../useSpeechSynthesis.js');
  const useSpeechSynthesisContent = fs.readFileSync(useSpeechSynthesisPath, 'utf8');

  const robotScreenPath = path.resolve(__dirname, '../../pages/robot/RobotScreenPage.jsx');
  const robotScreenContent = fs.readFileSync(robotScreenPath, 'utf8');

  it('guarantees no emoji characters in useSpeechSynthesis and RobotScreenPage', () => {
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(useSpeechSynthesisContent)).toBe(false);
    expect(emojiRegex.test(robotScreenContent)).toBe(false);
  });

  it('provides playAudioBufferViaWebAudio helper to decode base64 audio and bypass iOS Safari gesture locks', () => {
    expect(useSpeechSynthesisContent).toContain('playAudioBufferViaWebAudio = useCallback(async (base64Data, rate, onStartCallback, onEndCallback, speechId)');
    expect(useSpeechSynthesisContent).toContain('ctx.decodeAudioData');
    expect(useSpeechSynthesisContent).toContain('ctx.createBufferSource()');
  });

  it('falls back to Web Audio API when HTML5 audio play fails or errors in speakWebSpeech', () => {
    expect(useSpeechSynthesisContent).toContain('const played = await playAudioBufferViaWebAudio(data.audio_base64');
    expect(useSpeechSynthesisContent).toContain('audio.play().catch(async (playErr)');
  });

  it('falls back to Web Audio API when preloaded audio HTML5 playback fails', () => {
    expect(useSpeechSynthesisContent).toContain('const played = await playAudioBufferViaWebAudio(preloadedAudioBase64');
  });

  it('primes audio engine on mobile/touch gesture and mic talk initiation', () => {
    expect(robotScreenContent).toContain('try { if (prime) prime(); } catch (e) {}');
  });

  it('preloads step 2 and QR prompt TTS audio in RobotScreenPage wayfinding', () => {
    expect(robotScreenContent).toContain('let preloadedStep2Audio = null;');
    expect(robotScreenContent).toContain('let preloadedQrAudio = null;');
    expect(robotScreenContent).toContain('synthesizeSpeech(step2Speech');
    expect(robotScreenContent).toContain('synthesizeSpeech(qrVoicePrompt');
    expect(robotScreenContent).toContain('chatRes.audio_base64 || null');
    expect(robotScreenContent).toContain('preloadedStep2Audio || null');
    expect(robotScreenContent).toContain('preloadedQrAudio || null');
  });
});

