export class SfxManager {
  private context: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  unlock(): void {
    const AudioContextClass = window.AudioContext;
    if (!this.context) {
      this.context = new AudioContextClass();
      this.noiseBuffer = this.createNoiseBuffer(this.context);
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  cardSlap(strength = 1): void {
    if (!this.context || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    this.noiseBurst(now, 0.075, 900, 0.24 * strength);
    this.oscillator(now, 112, 64, 0.09, 0.2 * strength, 'triangle');
    this.oscillator(now + 0.018, 185, 120, 0.05, 0.09 * strength, 'sine');
  }

  cardFlip(): void {
    if (!this.context || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    this.noiseBurst(now, 0.12, 2200, 0.08);
    this.oscillator(now, 460, 680, 0.08, 0.025, 'sine');
  }

  capture(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.oscillator(now, 280, 360, 0.055, 0.08, 'triangle');
    this.oscillator(now + 0.055, 370, 520, 0.07, 0.07, 'triangle');
  }

  tactic(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    [0, 0.055, 0.11].forEach((offset, index) => {
      this.oscillator(now + offset, 420 + index * 120, 610 + index * 100, 0.13, 0.055, 'sine');
    });
  }

  yaku(): void {
    if (!this.context || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    this.oscillator(now, 170, 88, 0.7, 0.2, 'sine');
    this.oscillator(now, 340, 175, 0.55, 0.08, 'sine');
    this.noiseBurst(now, 0.16, 640, 0.1);
  }

  stamp(): void {
    if (!this.context || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    this.noiseBurst(now, 0.11, 500, 0.3);
    this.oscillator(now, 92, 44, 0.28, 0.3, 'triangle');
  }

  lose(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.oscillator(now, 220, 110, 0.55, 0.08, 'sine');
    this.oscillator(now + 0.14, 165, 82, 0.7, 0.07, 'sine');
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const length = Math.floor(context.sampleRate * 0.5);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private noiseBurst(at: number, duration: number, frequency: number, volume: number): void {
    if (!this.context || !this.noiseBuffer) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter).connect(gain).connect(this.context.destination);
    source.start(at);
    source.stop(at + duration);
  }

  private oscillator(
    at: number,
    from: number,
    to: number,
    duration: number,
    volume: number,
    type: OscillatorType,
  ): void {
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(to, 1), at + duration);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(at);
    oscillator.stop(at + duration);
  }
}

