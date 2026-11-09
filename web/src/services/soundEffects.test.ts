import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playCompletionChime } from './soundEffects';

describe('SoundEffects Web Audio Service (Seam 2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('runs safely without throwing in environments where AudioContext is unavailable', () => {
    const originalAudioContext = window.AudioContext;
    // @ts-expect-error - simulating environment without AudioContext
    delete window.AudioContext;

    expect(() => {
      playCompletionChime();
    }).not.toThrow();

    window.AudioContext = originalAudioContext;
  });

  it('creates oscillator nodes and plays cheerful chime sequence when AudioContext exists', () => {
    const mockGainNode = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    const mockOscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    const mockAudioContext = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createGain: vi.fn(() => mockGainNode),
      createOscillator: vi.fn(() => mockOscillator),
      resume: vi.fn().mockResolvedValue(undefined),
    };

    // @ts-expect-error - Mocking AudioContext
    window.AudioContext = vi.fn(() => mockAudioContext);

    playCompletionChime();

    expect(mockAudioContext.createGain).toHaveBeenCalled();
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockOscillator.start).toHaveBeenCalled();
    expect(mockOscillator.stop).toHaveBeenCalled();
  });
});
