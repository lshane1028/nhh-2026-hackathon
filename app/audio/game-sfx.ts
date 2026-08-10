"use client";

let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;

  try {
    sharedContext ??= new AudioContextConstructor();
    if (sharedContext.state === "suspended") {
      void sharedContext.resume().catch(() => undefined);
    }
    return sharedContext;
  } catch {
    // Audio must never make a game action fail (private mode and some embedded
    // browsers can expose AudioContext while still rejecting construction).
    return null;
  }
}

function tone(context: AudioContext, frequency: number, duration: number, volume: number, type: OscillatorType = "square", delay = 0) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(70, frequency * 0.72), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noise(context: AudioContext, duration: number, volume: number, delay = 0) {
  filteredNoise(context, duration, volume, delay, "bandpass", 1450, 1450, 0.75);
}

function sweptTone(
  context: AudioContext,
  startFrequency: number,
  endFrequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = "triangle",
  delay = 0,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(Math.max(20, startFrequency), start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.012, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function filteredNoise(
  context: AudioContext,
  duration: number,
  volume: number,
  delay: number,
  filterType: BiquadFilterType,
  startFrequency: number,
  endFrequency: number,
  q = 0.75,
) {
  const frameCount = Math.ceil(context.sampleRate * duration);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const start = context.currentTime + delay;
  source.buffer = buffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(Math.max(20, startFrequency), start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
  filter.Q.value = q;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.006, duration * 0.2));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(start);
  source.stop(start + duration + 0.01);
}

function discardWhoosh(context: AudioContext, delay = 0) {
  filteredNoise(context, 0.17, 0.055, delay, "bandpass", 4200, 560, 0.55);
  sweptTone(context, 480, 135, 0.16, 0.028, "triangle", delay);
}

function discardThud(context: AudioContext, delay = 0) {
  filteredNoise(context, 0.07, 0.045, delay, "lowpass", 1150, 380, 0.7);
  sweptTone(context, 155, 72, 0.13, 0.075, "square", delay);
}

export function playPackOpenSound() {
  const context = getContext();
  if (!context) return;
  noise(context, 0.3, 0.15);
  tone(context, 140, 0.2, 0.1, "sawtooth");
  tone(context, 260, 0.14, 0.075, "square", 0.08);
  tone(context, 520, 0.18, 0.065, "square", 0.16);
  tone(context, 920, 0.28, 0.05, "triangle", 0.25);
}

export function playCardRevealSound(index = 0) {
  const context = getContext();
  if (!context) return;
  noise(context, 0.055, 0.035);
  tone(context, 420 + (index % 5) * 56, 0.105, 0.035, "square");
}

export function playCardPickSound() {
  const context = getContext();
  if (!context) return;
  tone(context, 520, 0.12, 0.05, "square");
  tone(context, 780, 0.18, 0.045, "triangle", 0.075);
}

/** Call from a real click before delayed score/reward sounds begin. */
export function primeGameAudio() {
  getContext();
}

export function playRewardStepSound(index = 0) {
  const context = getContext();
  if (!context) return;
  noise(context, 0.045, 0.022);
  tone(context, 330 + index * 52, 0.11, 0.045, "square");
  tone(context, 660 + index * 42, 0.16, 0.025, "triangle", 0.055);
}

export function playRewardFinishSound() {
  const context = getContext();
  if (!context) return;
  tone(context, 520, 0.16, 0.05, "square");
  tone(context, 780, 0.2, 0.045, "triangle", 0.08);
  tone(context, 1040, 0.28, 0.04, "triangle", 0.16);
}

/** Announces the submitted two-card kkeut/yaku before its cards resolve. */
export function playYakuRevealSound() {
  const context = getContext();
  if (!context) return;
  filteredNoise(context, 0.09, 0.05, 0, "lowpass", 1050, 440, 0.9);
  sweptTone(context, 142, 82, 0.18, 0.075, "sawtooth");
  sweptTone(context, 390, 620, 0.2, 0.038, "triangle", 0.035);
  sweptTone(context, 585, 930, 0.24, 0.032, "triangle", 0.11);
}

/** Heavier ceremonial cadence for 땡 and 광땡. Higher tiers add buk-like hits and a longer chime. */
export function playHighYakuRevealSound(tier: 1 | 2 | 3) {
  const context = getContext();
  if (!context) return;
  playYakuRevealSound();
  const hits = tier + 1;
  for (let index = 0; index < hits; index += 1) {
    const delay = 0.2 + index * 0.12;
    filteredNoise(context, 0.07, 0.075 + tier * 0.015, delay, "lowpass", 780, 170, 0.85);
    sweptTone(context, 132 - tier * 8, 58, 0.15, 0.085, "sine", delay);
    sweptTone(context, 620 + tier * 130 + index * 90, 880 + tier * 180, 0.22, 0.032, "triangle", delay + 0.025);
  }
}

/** A compact, pitched impact for each of the two scoring kkeut cards. */
export function playKkeutHitSound(index = 0) {
  const context = getContext();
  if (!context) return;
  const step = Math.max(0, Math.min(5, index));
  filteredNoise(context, 0.052, 0.048, 0, "bandpass", 2100, 780, 1.1);
  sweptTone(context, 205 + step * 14, 92, 0.09, 0.065, "square");
  sweptTone(context, 560 + step * 85, 430 + step * 70, 0.14, 0.032, "triangle", 0.022);
}

/** An ascending abacus-like click for each card added while making a jit total. */
export function playJitAdditionSound(index = 0) {
  const context = getContext();
  if (!context) return;
  const step = Math.max(0, Math.min(8, index));
  const pitch = 350 + step * 52;
  filteredNoise(context, 0.032, 0.026, 0, "highpass", 2900, 1700, 0.6);
  sweptTone(context, pitch, pitch * 0.78, 0.085, 0.045, "square");
  sweptTone(context, pitch * 1.5, pitch * 1.22, 0.105, 0.02, "triangle", 0.035);
}

/** A dry hwatu-on-table slap as a scored card lands in the collection board. */
export function playCollectionSlapSound(index = 0) {
  const context = getContext();
  if (!context) return;
  const variation = Math.abs(index) % 4;
  // Plastic-coated hwatu has a much sharper edge than paper playing cards.
  // Three short noise bands make the initial "짝", while the low sine is the
  // wooden table answering underneath it. A quieter second edge gives the
  // slight double contact heard when a rigid card lands flat.
  filteredNoise(context, 0.018, 0.13, 0, "highpass", 8_600, 3_400, 0.35);
  filteredNoise(context, 0.052, 0.105, 0.002, "bandpass", 3_200 + variation * 170, 780, 1.35);
  filteredNoise(context, 0.11, 0.052, 0.004, "lowpass", 920, 210, 0.7);
  sweptTone(context, 168 + variation * 7, 61, 0.105, 0.085, "sine", 0.002);
  filteredNoise(context, 0.024, 0.055, 0.028, "highpass", 6_400, 2_600, 0.45);
  sweptTone(context, 880 + variation * 52, 520, 0.055, 0.026, "triangle", 0.026);
}

/** A short lacquered-card glide before the collection-board impact. */
export function playCollectionSlideSound(index = 0) {
  const context = getContext();
  if (!context) return;
  const variation = Math.abs(index) % 4;
  filteredNoise(context, 0.17, 0.026, 0, "bandpass", 780 + variation * 80, 2_900, 0.55);
  filteredNoise(context, 0.09, 0.018, 0.045, "highpass", 2_100, 4_800, 0.4);
}

/** The airborne half of a discard; exported separately for animation sync. */
export function playDiscardWhooshSound() {
  const context = getContext();
  if (!context) return;
  discardWhoosh(context);
}

/** The landing half of a discard; exported separately for animation sync. */
export function playDiscardThudSound() {
  const context = getContext();
  if (!context) return;
  discardThud(context);
}

/** A complete discard cue when the UI does not need to synchronize both halves. */
export function playDiscardSound() {
  const context = getContext();
  if (!context) return;
  discardWhoosh(context);
  discardThud(context, 0.12);
}

/** A taut paper snap for a card entering the hand. */
export function playDrawSnapSound(index = 0) {
  const context = getContext();
  if (!context) return;
  const variation = Math.abs(index) % 4;
  filteredNoise(context, 0.04, 0.052, 0, "highpass", 5100, 2400, 0.65);
  sweptTone(context, 940 + variation * 55, 460, 0.055, 0.038, "square");
  sweptTone(context, 245, 455 + variation * 20, 0.095, 0.025, "triangle", 0.018);
}

/** Resolves the complete submission sequence with a short celebratory cadence. */
export function playSubmissionFinaleSound() {
  const context = getContext();
  if (!context) return;
  filteredNoise(context, 0.09, 0.038, 0, "lowpass", 1200, 480, 0.8);
  sweptTone(context, 165, 88, 0.17, 0.065, "square");
  sweptTone(context, 294, 272, 0.18, 0.04, "triangle", 0.035);
  sweptTone(context, 440, 408, 0.2, 0.038, "triangle", 0.105);
  sweptTone(context, 587, 545, 0.24, 0.036, "triangle", 0.175);
  sweptTone(context, 880, 815, 0.32, 0.03, "triangle", 0.255);
}

/** A rising wooden chime for permanent talisman growth after scoring settles. */
export function playTalismanGrowthSound() {
  const context = getContext();
  if (!context) return;
  filteredNoise(context, 0.055, 0.045, 0, "bandpass", 2_600, 880, 0.8);
  sweptTone(context, 196, 392, 0.18, 0.055, "triangle");
  sweptTone(context, 392, 784, 0.26, 0.045, "triangle", 0.09);
  sweptTone(context, 587, 1_174, 0.34, 0.035, "sine", 0.18);
}

/** Low ceremonial strike followed by a sharp reveal for irreversible rituals. */
export function playForbiddenRitualSound() {
  const context = getContext();
  if (!context) return;
  filteredNoise(context, 0.24, 0.085, 0, "lowpass", 760, 120, 1.1);
  sweptTone(context, 118, 42, 0.38, 0.095, "sawtooth");
  filteredNoise(context, 0.055, 0.09, 0.2, "highpass", 6_800, 2_900, 0.55);
  sweptTone(context, 330, 660, 0.22, 0.048, "triangle", 0.21);
  sweptTone(context, 495, 990, 0.34, 0.036, "sine", 0.3);
}
