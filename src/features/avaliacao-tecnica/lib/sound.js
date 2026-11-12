/**
 * Feedback sonoro sintetizado com Web Audio (sem arquivos de áudio).
 * O AudioContext só é criado após o primeiro toque/clique (exigência dos navegadores).
 */

let ctx = null;
let enabled = true;

export function setSoundEnabled(value) {
  enabled = value;
}

function audio() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(frequency, durationMs, { type = 'sine', gain = 0.08, delayMs = 0 } = {}) {
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + delayMs / 1000;
  const end = start + durationMs / 1000;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(amp).connect(ac.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

export const sfx = {
  /** Chamar dentro de um gesto do usuário para liberar o áudio */
  unlock: () => void audio(),
  correct: () => {
    tone(660, 110);
    tone(990, 180, { delayMs: 110 });
  },
  wrong: () => tone(170, 300, { type: 'square', gain: 0.045 }),
  tick: () => tone(1320, 45, { type: 'square', gain: 0.025 }),
  go: () => tone(880, 240, { gain: 0.07 }),
  move: () => tone(520, 40, { type: 'triangle', gain: 0.05 }),
  finish: () => {
    tone(523, 120);
    tone(659, 120, { delayMs: 120 });
    tone(784, 240, { delayMs: 240 });
  },
};
