/**
 * audioFeedback.js
 * Synthesizes high-fidelity sound cues (earcons) via Web Audio API.
 * Zero external assets, zero network latency, operates 100% offline.
 */

export const playEarcon = (type = 'chime') => {
  const globalObj = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
  if (!globalObj) return;

  try {
    const AudioCtx = globalObj.AudioContext || globalObj.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = globalObj._sharedAudioCtx || new AudioCtx();
    globalObj._sharedAudioCtx = ctx;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime || 0;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'chime') {
      // Gentle two-tone acknowledging chime: 587.33Hz (D5) -> 880Hz (A5)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc.start(now);
      osc.stop(now + 0.19);
    } else if (type === 'start_listening') {
      // Crisp subtle ping when microphone activates: 523.25Hz (C5)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.06);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === 'barge_in') {
      // Soft dampening tone when user interrupts the robot: 330Hz (E4) -> 261Hz (C4)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.exponentialRampToValueAtTime(261.63, now + 0.05);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      osc.start(now);
      osc.stop(now + 0.1);
    }
  } catch {
    // Fail silently without disrupting UI flow
  }
};
