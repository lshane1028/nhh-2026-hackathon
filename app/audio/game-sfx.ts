"use client";

import type { ScoreOperation } from "@/game/types";

const AUDIO_MUTED_KEY = "flower-board-go:audio-muted";
const MUSIC_VOLUME = 0.11;
const DUCKED_MUSIC_VOLUME = 0.035;

export const GAME_AUDIO_ASSETS = {
  music: "/assets/audio/bgm/noir-table.mp3",
  cardPlace: [1, 2, 3, 4].map((index) => `/assets/audio/sfx/card-place-${index}.ogg`),
  cardSlide: [1, 2, 3, 4].map((index) => `/assets/audio/sfx/card-slide-${index}.ogg`),
  cardShove: [1, 2].map((index) => `/assets/audio/sfx/card-shove-${index}.ogg`),
  hwatuSlap: [1, 2, 3, 4].map((index) => `/assets/audio/sfx/hwatu-slap-${index}.ogg`),
  hwatuSwipe: [1, 2, 3].map((index) => `/assets/audio/sfx/hwatu-swipe-${index}.wav`),
  chipLay: [1, 2, 3].map((index) => `/assets/audio/sfx/chip-lay-${index}.ogg`),
  chipStack: [1, 2, 3].map((index) => `/assets/audio/sfx/chips-stack-${index}.ogg`),
  cardShuffle: "/assets/audio/sfx/card-shuffle.ogg",
  packOpen: "/assets/audio/sfx/cards-pack-open-1.ogg",
  select: "/assets/audio/sfx/select_001.ogg",
  confirm: "/assets/audio/sfx/confirmation_002.ogg",
  multiplier: "/assets/audio/sfx/maximize_005.ogg",
  reset: "/assets/audio/sfx/glass_004.ogg",
  hit: "/assets/audio/sfx/jingles_HIT07.ogg",
  reward: "/assets/audio/sfx/jingles_PIZZI03.ogg",
  jackpot: "/assets/audio/sfx/jingles_STEEL07.ogg",
  cashRegister: "/assets/audio/sfx/cash-register.mp3",
  coinDrop: "/assets/audio/sfx/coin-drop.ogg",
} as const;

let audioPrimed = false;
let mutedPreference: boolean | null = null;
let backgroundMusic: HTMLAudioElement | null = null;
let musicDuckTimer: number | null = null;
const samplePools = new Map<string, HTMLAudioElement[]>();

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function readMutedPreference(): boolean {
  if (mutedPreference !== null) return mutedPreference;
  if (typeof window === "undefined") return false;
  try {
    mutedPreference = window.localStorage.getItem(AUDIO_MUTED_KEY) === "true";
  } catch {
    mutedPreference = false;
  }
  return mutedPreference;
}

function createAudio(url: string): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof window.Audio === "undefined") return null;
  const audio = new window.Audio(url);
  audio.preload = "auto";
  return audio;
}

function preloadSample(url: string): void {
  if (samplePools.has(url)) return;
  const audio = createAudio(url);
  if (!audio) return;
  samplePools.set(url, [audio]);
  audio.load();
}

function playSample(url: string, volume: number, playbackRate = 1): void {
  if (readMutedPreference()) return;
  let pool = samplePools.get(url);
  if (!pool) {
    const first = createAudio(url);
    if (!first) return;
    pool = [first];
    samplePools.set(url, pool);
  }
  let audio = pool.find((candidate) => candidate.paused || candidate.ended);
  if (!audio) {
    audio = createAudio(url) ?? undefined;
    if (!audio) return;
    if (pool.length < 5) pool.push(audio);
  }
  audio.currentTime = 0;
  audio.volume = clamp(volume, 0, 1);
  audio.playbackRate = clamp(playbackRate, 0.72, 1.65);
  void audio.play().catch(() => undefined);
}

function startGameMusic(): void {
  if (!audioPrimed || readMutedPreference()) return;
  backgroundMusic ??= createAudio(GAME_AUDIO_ASSETS.music);
  if (!backgroundMusic) return;
  backgroundMusic.preload = "metadata";
  backgroundMusic.loop = true;
  backgroundMusic.volume = MUSIC_VOLUME;
  void backgroundMusic.play().catch(() => undefined);
}

function duckGameMusic(duration = 900): void {
  if (!backgroundMusic || backgroundMusic.paused) return;
  backgroundMusic.volume = DUCKED_MUSIC_VOLUME;
  if (musicDuckTimer !== null) window.clearTimeout(musicDuckTimer);
  musicDuckTimer = window.setTimeout(() => {
    if (backgroundMusic && !readMutedPreference()) backgroundMusic.volume = MUSIC_VOLUME;
    musicDuckTimer = null;
  }, duration);
}

export function getGameAudioMuted(): boolean {
  return readMutedPreference();
}

export function setGameAudioMuted(muted: boolean): boolean {
  mutedPreference = muted;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(AUDIO_MUTED_KEY, String(muted));
    } catch {
      // Preferences are best-effort; audio should still work without storage.
    }
  }
  if (muted) backgroundMusic?.pause();
  else startGameMusic();
  return muted;
}

export function toggleGameAudio(): boolean {
  return setGameAudioMuted(!readMutedPreference());
}

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
  playSample(GAME_AUDIO_ASSETS.packOpen, 0.7);
  playSample(GAME_AUDIO_ASSETS.cardShuffle, 0.28, 1.08);
  const context = getContext();
  if (!context) return;
  noise(context, 0.3, 0.15);
  tone(context, 140, 0.2, 0.1, "sawtooth");
  tone(context, 260, 0.14, 0.075, "square", 0.08);
  tone(context, 520, 0.18, 0.065, "square", 0.16);
  tone(context, 920, 0.28, 0.05, "triangle", 0.25);
}

export function playCardRevealSound(index = 0) {
  playSample(GAME_AUDIO_ASSETS.cardSlide[Math.abs(index) % GAME_AUDIO_ASSETS.cardSlide.length], 0.52, 0.96 + (index % 4) * 0.025);
  const context = getContext();
  if (!context) return;
  noise(context, 0.055, 0.035);
  tone(context, 420 + (index % 5) * 56, 0.105, 0.035, "square");
}

export function playCardPickSound() {
  playSample(GAME_AUDIO_ASSETS.select, 0.5, 1.04);
  const context = getContext();
  if (!context) return;
  tone(context, 520, 0.12, 0.05, "square");
  tone(context, 780, 0.18, 0.045, "triangle", 0.075);
}

/** Call from a real click before delayed score/reward sounds begin. */
export function primeGameAudio() {
  audioPrimed = true;
  getContext();
  [
    ...GAME_AUDIO_ASSETS.cardPlace,
    ...GAME_AUDIO_ASSETS.cardSlide,
    ...GAME_AUDIO_ASSETS.cardShove,
    ...GAME_AUDIO_ASSETS.hwatuSlap,
    ...GAME_AUDIO_ASSETS.hwatuSwipe,
    ...GAME_AUDIO_ASSETS.chipLay,
    ...GAME_AUDIO_ASSETS.chipStack,
    GAME_AUDIO_ASSETS.select,
    GAME_AUDIO_ASSETS.confirm,
    GAME_AUDIO_ASSETS.multiplier,
    GAME_AUDIO_ASSETS.reset,
    GAME_AUDIO_ASSETS.reward,
    GAME_AUDIO_ASSETS.jackpot,
    GAME_AUDIO_ASSETS.cashRegister,
    GAME_AUDIO_ASSETS.coinDrop,
  ].forEach(preloadSample);
  startGameMusic();
}

export function playRewardStepSound(index = 0) {
  playSample(GAME_AUDIO_ASSETS.chipLay[Math.abs(index) % GAME_AUDIO_ASSETS.chipLay.length], 0.48, 0.95 + Math.min(index, 7) * 0.055);
  const context = getContext();
  if (!context) return;
  noise(context, 0.045, 0.022);
  tone(context, 330 + index * 52, 0.11, 0.045, "square");
  tone(context, 660 + index * 42, 0.16, 0.025, "triangle", 0.055);
}

export function playRewardFinishSound() {
  duckGameMusic(1_200);
  playSample(GAME_AUDIO_ASSETS.reward, 0.62, 1.02);
  const context = getContext();
  if (!context) return;
  tone(context, 520, 0.16, 0.05, "square");
  tone(context, 780, 0.2, 0.045, "triangle", 0.08);
  tone(context, 1040, 0.28, 0.04, "triangle", 0.16);
}

/** A till bell fired from the click that actually collects the payout. */
export function playCashRegisterSound() {
  duckGameMusic(1_350);
  playSample(GAME_AUDIO_ASSETS.cashRegister, 0.9, 1);
  if (typeof window !== "undefined") {
    window.setTimeout(() => playSample(GAME_AUDIO_ASSETS.coinDrop, 0.5, 1.04), 130);
  }
}

/** Announces the submitted two-card kkeut/yaku before its cards resolve. */
export function playYakuRevealSound() {
  playSample(GAME_AUDIO_ASSETS.confirm, 0.68, 0.94);
  const context = getContext();
  if (!context) return;
  filteredNoise(context, 0.09, 0.05, 0, "lowpass", 1050, 440, 0.9);
  sweptTone(context, 142, 82, 0.18, 0.075, "sawtooth");
  sweptTone(context, 390, 620, 0.2, 0.038, "triangle", 0.035);
  sweptTone(context, 585, 930, 0.24, 0.032, "triangle", 0.11);
}

/** A compact, pitched impact for each of the two scoring kkeut cards. */
export function playKkeutHitSound(index = 0) {
  playSample(GAME_AUDIO_ASSETS.hwatuSwipe[Math.abs(index) % GAME_AUDIO_ASSETS.hwatuSwipe.length], 0.4, 1.06 + Math.min(index, 2) * 0.025);
  playSample(GAME_AUDIO_ASSETS.cardPlace[Math.abs(index) % GAME_AUDIO_ASSETS.cardPlace.length], 0.58, 1.02 + Math.min(index, 3) * 0.018);
  playSample(GAME_AUDIO_ASSETS.hwatuSlap[Math.abs(index) % GAME_AUDIO_ASSETS.hwatuSlap.length], 0.32, 1.16 + Math.min(index, 3) * 0.025);
  const context = getContext();
  if (!context) return;
  const step = Math.max(0, Math.min(5, index));
  filteredNoise(context, 0.052, 0.048, 0, "bandpass", 2100, 780, 1.1);
  sweptTone(context, 205 + step * 14, 92, 0.09, 0.065, "square");
  sweptTone(context, 560 + step * 85, 430 + step * 70, 0.14, 0.032, "triangle", 0.022);
}

/** An ascending abacus-like click for each card added while making a jit total. */
export function playJitAdditionSound(index = 0) {
  playSample(GAME_AUDIO_ASSETS.chipStack[Math.abs(index) % GAME_AUDIO_ASSETS.chipStack.length], 0.58, 0.94 + Math.min(index, 8) * 0.055);
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
  playSample(GAME_AUDIO_ASSETS.cardPlace[Math.abs(index) % GAME_AUDIO_ASSETS.cardPlace.length], 0.74, 1.01 + (index % 4) * 0.018);
  playSample(GAME_AUDIO_ASSETS.hwatuSlap[Math.abs(index) % GAME_AUDIO_ASSETS.hwatuSlap.length], 0.46, 1.12 + (index % 4) * 0.025);
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
  playSample(GAME_AUDIO_ASSETS.hwatuSwipe[Math.abs(index) % GAME_AUDIO_ASSETS.hwatuSwipe.length], 0.82, 1.02 + (index % 3) * 0.028);
  playSample(GAME_AUDIO_ASSETS.cardSlide[Math.abs(index) % GAME_AUDIO_ASSETS.cardSlide.length], 0.3, 0.98 + (index % 4) * 0.018);
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
  playSample(GAME_AUDIO_ASSETS.cardShove[Math.abs(index) % GAME_AUDIO_ASSETS.cardShove.length], 0.52, 1 + (index % 3) * 0.025);
  const context = getContext();
  if (!context) return;
  const variation = Math.abs(index) % 4;
  filteredNoise(context, 0.04, 0.052, 0, "highpass", 5100, 2400, 0.65);
  sweptTone(context, 940 + variation * 55, 460, 0.055, 0.038, "square");
  sweptTone(context, 245, 455 + variation * 20, 0.095, 0.025, "triangle", 0.018);
}

/** Gives each score-operation lane its own material and weight. */
export function playScoreOperationSound(operation: ScoreOperation, index = 0) {
  const step = Math.max(0, Math.min(8, index));
  if (operation.operation === "multiply_heung") {
    duckGameMusic(620);
    playSample(GAME_AUDIO_ASSETS.multiplier, 0.76, 0.92 + step * 0.035);
  } else if (operation.operation === "add_heung") {
    playSample(GAME_AUDIO_ASSETS.confirm, 0.58, 0.96 + step * 0.045);
  } else if (operation.operation === "set_kkeut") {
    playSample(GAME_AUDIO_ASSETS.reset, 0.66, 0.98);
  } else {
    playSample(GAME_AUDIO_ASSETS.chipStack[step % GAME_AUDIO_ASSETS.chipStack.length], 0.6, 0.94 + step * 0.055);
  }

  const context = getContext();
  if (!context) return;
  if (operation.operation === "multiply_heung") {
    sweptTone(context, 210, 780 + step * 45, 0.22, 0.055, "sawtooth");
    sweptTone(context, 720 + step * 38, 1_080 + step * 55, 0.2, 0.035, "triangle", 0.08);
  } else if (operation.operation === "add_heung") {
    tone(context, 610 + step * 58, 0.13, 0.042, "triangle");
    tone(context, 910 + step * 70, 0.18, 0.03, "sine", 0.045);
  } else if (operation.operation === "set_kkeut") {
    filteredNoise(context, 0.1, 0.04, 0, "highpass", 5_200, 1_900, 0.7);
    sweptTone(context, 900, 240, 0.18, 0.045, "triangle");
  } else {
    sweptTone(context, 390 + step * 48, 315 + step * 42, 0.1, 0.04, "square");
  }
}

/** Resolves the complete submission sequence with a short celebratory cadence. */
export function playSubmissionFinaleSound(score = 0) {
  duckGameMusic(1_450);
  playSample(score >= 1_000 ? GAME_AUDIO_ASSETS.jackpot : GAME_AUDIO_ASSETS.hit, score >= 1_000 ? 0.82 : 0.7);
  const context = getContext();
  if (!context) return;
  filteredNoise(context, 0.09, 0.038, 0, "lowpass", 1200, 480, 0.8);
  sweptTone(context, 165, 88, 0.17, 0.065, "square");
  sweptTone(context, 294, 272, 0.18, 0.04, "triangle", 0.035);
  sweptTone(context, 440, 408, 0.2, 0.038, "triangle", 0.105);
  sweptTone(context, 587, 545, 0.24, 0.036, "triangle", 0.175);
  sweptTone(context, 880, 815, 0.32, 0.03, "triangle", 0.255);
}
