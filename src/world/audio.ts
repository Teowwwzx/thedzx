/**
 * Sound, synthesised on the fly.
 *
 * Every sound here is generated with oscillators and noise buffers rather
 * than loaded from a file. That is deliberate: the world's whole premise is
 * that it downloads nothing, and a handful of .mp3s would be the first
 * assets to break it — and the first thing to make a phone wait.
 *
 * Two browser rules shape the design:
 *
 * 1. An AudioContext created before a user gesture starts `suspended` and
 *    stays silent. The world auto-loads with no click, so the context is
 *    created lazily on the first real interaction instead.
 * 2. Autoplaying sound at someone is rude. Everything starts muted-until-
 *    touched, and the preference is remembered.
 */

const STORE_KEY = 'thedzx:sound';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = false;
let unlocked = false;

function readPref(): boolean {
  try {
    return window.localStorage.getItem(STORE_KEY) !== 'off';
  } catch {
    // Private windows and blocked storage both throw on access, not on read
    // of a missing key — so this has to be caught, not null-checked.
    return true;
  }
}

function writePref(on: boolean) {
  try {
    window.localStorage.setItem(STORE_KEY, on ? 'on' : 'off');
  } catch {
    /* nothing to do; the preference simply will not persist */
  }
}

/** Create the graph. Safe to call repeatedly. */
function ensure(): boolean {
  if (ctx) return true;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return false;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.28;
    master.connect(ctx.destination);
    return true;
  } catch {
    ctx = null;
    return false;
  }
}

/**
 * Called from the first pointer or key event. Until this runs there is no
 * AudioContext at all, so nothing can leak sound before the visitor has
 * touched the page.
 */
export function unlock() {
  if (unlocked) return;
  unlocked = true;
  enabled = readPref();
  if (!enabled) return;
  if (ensure()) void ctx?.resume();
}

export function isEnabled(): boolean {
  return enabled;
}

export function setEnabled(on: boolean) {
  enabled = on;
  writePref(on);
  if (on) {
    if (ensure()) void ctx?.resume();
  } else {
    void ctx?.suspend();
  }
}

/** One-shot noise burst, shaped by a band-pass. Footsteps and thuds. */
function noise(duration: number, freq: number, q: number, gain: number) {
  if (!enabled || !ctx || !master) return;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Decaying white noise. The square of the envelope reads as a knock
    // rather than a hiss.
    const t = 1 - i / frames;
    data[i] = (Math.random() * 2 - 1) * t * t;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(master);
  src.start();
  src.stop(ctx.currentTime + duration);
}

/** A short pitched blip. UI. */
function tone(from: number, to: number, duration: number, gain: number, type: OscillatorType = 'sine') {
  if (!enabled || !ctx || !master) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
  const g = ctx.createGain();
  // Ramps rather than steps: a gain that jumps to zero clicks audibly.
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(g).connect(master);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

let lastStep = 0;

export const sfx = {
  /** Alternating weight, so a walk cycle does not sound like a metronome. */
  step() {
    if (!enabled || !ctx) return;
    const now = ctx.currentTime;
    if (now - lastStep < 0.24) return;
    lastStep = now;
    const heavy = Math.floor(now * 4) % 2 === 0;
    noise(0.09, heavy ? 320 : 260, 1.4, heavy ? 0.5 : 0.36);
  },
  /** Opening a panel. */
  open() {
    tone(420, 760, 0.12, 0.16, 'triangle');
  },
  close() {
    tone(620, 340, 0.1, 0.12, 'triangle');
  },
  /** Walking through a door: a swept whoosh, low to high. */
  travel() {
    tone(180, 520, 0.34, 0.14, 'sawtooth');
    noise(0.36, 700, 0.8, 0.18);
  },
  /** Stepping into range of something interactive. */
  proximity() {
    tone(880, 1180, 0.07, 0.07);
  },
  /** Refused: a locked thing, or an action that did nothing. */
  denied() {
    tone(240, 150, 0.16, 0.12, 'square');
  },
};
