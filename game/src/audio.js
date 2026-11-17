// WebAudio sound effects, synthesised in code: no sound files, no network.
// Every effect is a short oscillator envelope; the win fanfare is a tiny
// ascending arpeggio. Mute is remembered in localStorage.
import { MUTE_KEY } from './config.js';

export function createAudio() {
  let context = null;
  let muted = false;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }

  function ensure() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function tone(freq, dur, type, gain, when = 0, slideTo = null) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    isMuted() { return muted; },
    toggleMute() {
      muted = !muted;
      try { window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch {}
      return muted;
    },
    unlock() { ensure(); },
    click() { tone(660, 0.07, 'triangle', 0.12); },
    eat() { tone(520, 0.09, 'sine', 0.18, 0, 880); },
    bonus() { tone(660, 0.1, 'triangle', 0.18); tone(880, 0.12, 'triangle', 0.18, 0.08); },
    gold() { tone(784, 0.1, 'sine', 0.2); tone(988, 0.1, 'sine', 0.2, 0.07); tone(1319, 0.18, 'sine', 0.2, 0.14); },
    level() { tone(523, 0.1, 'square', 0.1); tone(659, 0.1, 'square', 0.1, 0.09); tone(784, 0.16, 'square', 0.1, 0.18); },
    hit() { tone(220, 0.35, 'sawtooth', 0.22, 0, 55); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, 'triangle', 0.2, i * 0.11)); },
  };
}
