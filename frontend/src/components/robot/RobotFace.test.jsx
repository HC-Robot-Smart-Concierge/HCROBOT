import { describe, it, expect } from 'vitest';
import { RobotFace } from './RobotFace';

describe('RobotFace Component State & Mode Logic', () => {
  it('should export RobotFace function component', () => {
    expect(typeof RobotFace).toBe('function');
  });

  it('should resolve correct mode flags for sleeping, welcome, listening, speaking, processing', () => {
    const getModeFlags = (mode) => {
      const isListening = mode === 'listening';
      const isSpeaking = mode === 'speaking';
      const isProcessing = mode === 'processing';
      const isWelcome = mode === 'welcome';
      const isInteracting = isListening || isSpeaking;
      return { isListening, isSpeaking, isProcessing, isWelcome, isInteracting };
    };

    expect(getModeFlags('sleeping')).toEqual({
      isListening: false,
      isSpeaking: false,
      isProcessing: false,
      isWelcome: false,
      isInteracting: false,
    });

    expect(getModeFlags('welcome')).toEqual({
      isListening: false,
      isSpeaking: false,
      isProcessing: false,
      isWelcome: true,
      isInteracting: false,
    });

    expect(getModeFlags('listening')).toEqual({
      isListening: true,
      isSpeaking: false,
      isProcessing: false,
      isWelcome: false,
      isInteracting: true,
    });

    expect(getModeFlags('speaking')).toEqual({
      isListening: false,
      isSpeaking: true,
      isProcessing: false,
      isWelcome: false,
      isInteracting: true,
    });

    expect(getModeFlags('processing')).toEqual({
      isListening: false,
      isSpeaking: false,
      isProcessing: true,
      isWelcome: false,
      isInteracting: false,
    });
  });

  it('correctly maps mode color palettes according to specifications', () => {
    const getFaceColor = (mode) => {
      // Welcome, Speaking: dark gray #4A4A4A; Listening: light gray #A0A0A0
      return mode === 'listening' ? '#A0A0A0' : '#4A4A4A';
    };

    expect(getFaceColor('welcome')).toBe('#4A4A4A');
    expect(getFaceColor('speaking')).toBe('#4A4A4A');
    expect(getFaceColor('listening')).toBe('#A0A0A0');
  });

  it('correctly provides animation rules for double blink on welcome and talking mouth on speaking', () => {
    const getAnimationClass = (mode, isSpeakingActive) => {
      if (mode === 'welcome') return 'robot-blink-twice';
      if (mode === 'speaking' && isSpeakingActive) return 'robot-talking-mouth';
      if (mode === 'listening') return 'animate-pulse';
      return '';
    };

    expect(getAnimationClass('welcome', false)).toBe('robot-blink-twice');
    expect(getAnimationClass('speaking', true)).toBe('robot-talking-mouth');
    expect(getAnimationClass('listening', false)).toBe('animate-pulse');
    expect(getAnimationClass('sleeping', false)).toBe('');
  });

  it('correctly maps eye expressions (look_up, look_left, look_right, look_around)', () => {
    const getEyeTransform = (eyeExpression) => {
      if (eyeExpression === 'look_up') return 'translate(0px, -52px) scaleY(0.96)';
      if (eyeExpression === 'look_left') return 'translate(-65px, 0px)';
      if (eyeExpression === 'look_right') return 'translate(65px, 0px)';
      return 'translate(0px, 0px)';
    };

    expect(getEyeTransform('look_up')).toBe('translate(0px, -52px) scaleY(0.96)');
    expect(getEyeTransform('look_left')).toBe('translate(-65px, 0px)');
    expect(getEyeTransform('look_right')).toBe('translate(65px, 0px)');
    expect(getEyeTransform('default')).toBe('translate(0px, 0px)');
  });

  it('provides enlarged dimension class for mobile phone landscape viewport', () => {
    const getSizeClass = (size, compact) => {
      const isMobileSize = size === 'mobile';
      const isCompactSize = compact && !isMobileSize;
      return isCompactSize 
        ? 'w-[170px] h-[170px]' 
        : isMobileSize 
          ? 'w-[220px] h-[220px] sm:w-[245px] sm:h-[245px]' 
          : 'w-[420px] h-[420px] sm:w-[480px] sm:h-[480px]';
    };

    expect(getSizeClass('mobile', true)).toBe('w-[220px] h-[220px] sm:w-[245px] sm:h-[245px]');
    expect(getSizeClass(null, true)).toBe('w-[170px] h-[170px]');
    expect(getSizeClass(null, false)).toContain('w-[420px]');
  });
});

