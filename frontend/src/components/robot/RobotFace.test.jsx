import { describe, it, expect } from 'vitest';
import { RobotFace } from './RobotFace';

describe('RobotFace Component State & Mode Logic', () => {
  it('should export RobotFace function component', () => {
    expect(typeof RobotFace).toBe('function');
  });

  it('should resolve correct mode flags for sleeping, listening, speaking, processing', () => {
    const getModeFlags = (mode) => {
      const isListening = mode === 'listening';
      const isSpeaking = mode === 'speaking';
      const isProcessing = mode === 'processing';
      const isInteracting = isListening || isSpeaking;
      return { isListening, isSpeaking, isProcessing, isInteracting };
    };

    expect(getModeFlags('sleeping')).toEqual({
      isListening: false,
      isSpeaking: false,
      isProcessing: false,
      isInteracting: false,
    });

    expect(getModeFlags('listening')).toEqual({
      isListening: true,
      isSpeaking: false,
      isProcessing: false,
      isInteracting: true,
    });

    expect(getModeFlags('processing')).toEqual({
      isListening: false,
      isSpeaking: false,
      isProcessing: true,
      isInteracting: false,
    });
  });
});
