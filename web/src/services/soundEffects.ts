/**
 * Web Audio API synthesizer for instant, zero-latency praise sound effects.
 * No external audio files or downloads required.
 */

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return null;

  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new AudioContextClass();
    } catch {
      return null;
    }
  }

  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {
      // ignore autoplay restriction errors if user hasn't interacted yet
    });
  }

  return sharedAudioContext;
}

export interface ChimeTone {
  freq: number;
  delay: number;
  duration: number;
  gain: number;
}

/**
 * Bright, cheerful 4-note ascending praise chime (G5 -> C6 -> E6 -> G6)
 */
const PRAISE_CHIME_NOTES: ChimeTone[] = [
  { freq: 783.99, delay: 0.0, duration: 0.28, gain: 0.18 }, // G5
  { freq: 1046.5, delay: 0.07, duration: 0.32, gain: 0.22 }, // C6
  { freq: 1318.51, delay: 0.14, duration: 0.38, gain: 0.24 }, // E6
  { freq: 1567.98, delay: 0.21, duration: 0.55, gain: 0.26 }, // G6 bell ring
];

/**
 * Plays the bright praise chime sound effect.
 */
export function playCompletionChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    for (const note of PRAISE_CHIME_NOTES) {
      const startTime = now + note.delay;
      const endTime = startTime + note.duration;

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, startTime);

      // Smooth attack & exponential decay bell envelope
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(note.gain, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(endTime);
    }
  } catch {
    // Graceful fallback: do nothing if browser audio is blocked or fails
  }
}
