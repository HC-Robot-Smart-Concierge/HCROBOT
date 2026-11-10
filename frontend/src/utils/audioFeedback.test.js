import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { playEarcon } from './audioFeedback';

describe('playEarcon', () => {
  let mockOscillator;
  let mockGain;
  let mockAudioContext;
  let originalAudioContext;

  beforeEach(() => {
    originalAudioContext = globalThis.AudioContext;

    mockOscillator = {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    };

    mockGain = {
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    };

    mockAudioContext = {
      state: 'running',
      currentTime: 0.5,
      destination: {},
      createOscillator: vi.fn(() => mockOscillator),
      createGain: vi.fn(() => mockGain),
      resume: vi.fn().mockResolvedValue(undefined),
    };

    globalThis.AudioContext = vi.fn(() => mockAudioContext);
    globalThis._sharedAudioCtx = mockAudioContext;
  });

  afterEach(() => {
    globalThis.AudioContext = originalAudioContext;
    delete globalThis._sharedAudioCtx;
  });

  it('synthesizes chime earcon without crashing', () => {
    playEarcon('chime');
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
    expect(mockOscillator.start).toHaveBeenCalledWith(0.5);
    expect(mockOscillator.stop).toHaveBeenCalled();
  });

  it('synthesizes start_listening earcon', () => {
    playEarcon('start_listening');
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(523.25, 0.5);
    expect(mockOscillator.start).toHaveBeenCalled();
  });

  it('synthesizes barge_in earcon', () => {
    playEarcon('barge_in');
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(330, 0.5);
    expect(mockOscillator.stop).toHaveBeenCalled();
  });

  it('handles suspended audio context gracefully', () => {
    mockAudioContext.state = 'suspended';
    playEarcon('chime');
    expect(mockAudioContext.resume).toHaveBeenCalled();
  });
});
