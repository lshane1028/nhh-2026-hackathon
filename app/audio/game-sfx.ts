"use client";

let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  sharedContext ??= new window.AudioContext();
  void sharedContext.resume();
  return sharedContext;
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
  filter.type = "bandpass";
  filter.frequency.value = 1450;
  filter.Q.value = 0.75;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(start);
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
