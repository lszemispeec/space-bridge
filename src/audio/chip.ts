import type { ChannelId, NoiseMode, NoteParams } from './types';

const HARMONICS = 48;

/** Band-limited pulse wave with the given duty (0..1). */
function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  const real = new Float32Array(HARMONICS + 1);
  const imag = new Float32Array(HARMONICS + 1);
  for (let n = 1; n <= HARMONICS; n++) {
    real[n] = Math.sin(2 * Math.PI * n * duty) / (n * Math.PI);
    imag[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (n * Math.PI);
  }
  return ctx.createPeriodicWave(real, imag);
}

/** Fourier series of an arbitrary one-cycle sample table, so stepped console waveforms keep their edges. */
function waveFromSamples(ctx: BaseAudioContext, samples: Float32Array): PeriodicWave {
  const n = samples.length;
  const real = new Float32Array(HARMONICS + 1);
  const imag = new Float32Array(HARMONICS + 1);
  for (let h = 1; h <= HARMONICS; h++) {
    let a = 0;
    let b = 0;
    for (let k = 0; k < n; k++) {
      const phase = (2 * Math.PI * h * k) / n;
      const sample = samples[k] ?? 0;
      a += sample * Math.cos(phase);
      b += sample * Math.sin(phase);
    }
    real[h] = (2 * a) / n;
    imag[h] = (2 * b) / n;
  }
  return ctx.createPeriodicWave(real, imag);
}

/** 4-bit stepped triangle: 32 steps, 15 → 0 → 15, oversampled so the steps survive the series. */
function steppedTriangle(ctx: BaseAudioContext): PeriodicWave {
  const steps = 32;
  const over = 16;
  const samples = new Float32Array(steps * over);
  for (let s = 0; s < steps; s++) {
    const level = s < 16 ? 15 - s : s - 16;
    const v = level / 7.5 - 1;
    for (let o = 0; o < over; o++) samples[s * over + o] = v;
  }
  return waveFromSamples(ctx, samples);
}

/** 15-bit LFSR noise, exactly one period so the loop is seamless. */
function lfsrBuffer(ctx: BaseAudioContext, mode: NoiseMode): AudioBuffer {
  const tap = mode === 'short' ? 6 : 1;
  const period = mode === 'short' ? 93 : 32767;
  const buffer = ctx.createBuffer(1, period, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let reg = 1;
  for (let i = 0; i < period; i++) {
    const feedback = (reg & 1) ^ ((reg >> tap) & 1);
    reg = (reg >> 1) | (feedback << 14);
    data[i] = (reg & 1) === 1 ? 0.5 : -0.5;
  }
  return buffer;
}

/** Wavetables for one audio context. Built once and shared by every voice. */
export class ChipWaves {
  readonly pulse: readonly [PeriodicWave, PeriodicWave, PeriodicWave];
  readonly tri: PeriodicWave;
  readonly noise: Readonly<Record<NoiseMode, AudioBuffer>>;

  constructor(ctx: BaseAudioContext) {
    this.pulse = [pulseWave(ctx, 0.125), pulseWave(ctx, 0.25), pulseWave(ctx, 0.5)];
    this.tri = steppedTriangle(ctx);
    this.noise = { long: lfsrBuffer(ctx, 'long'), short: lfsrBuffer(ctx, 'short') };
  }
}

export type VoiceKind = 'pulse' | 'tri' | 'noise';

export function kindOf(channel: ChannelId): VoiceKind {
  if (channel === 'tri') return 'tri';
  if (channel === 'noise') return 'noise';
  return 'pulse';
}

const MAX_ARP_STEPS = 96;
const MIN_FREQ = 1e-3;
const DEFAULT_RELEASE = 0.004;
const CUT_RELEASE = 0.003;

interface EnvelopeState {
  start: number;
  vol: number;
  sustain: number;
  decay: number;
  end: number;
  release: number;
}

/**
 * One console channel. All sources run continuously; notes are scheduled as
 * automation on the gain, frequency and selector params, so playing a note
 * allocates nothing.
 *
 * Pulse: three oscillators (one per duty) behind selector gains.
 * Triangle: one oscillator with a stepped wave.
 * Noise: two looping LFSR buffers (long and short) behind selector gains; pitch is playback rate.
 */
export class ChipVoice {
  readonly env: GainNode;
  private readonly pitch: AudioParam[] = [];
  private readonly selectors: GainNode[] = [];
  private readonly lfo: OscillatorNode;
  private readonly lfoDepth: GainNode;
  private lastSelector = -1;
  /**
   * Every scheduled envelope in time order, so `levelAt` can read the one
   * that is sounding at any time. The sequencer schedules notes ahead of
   * the clock, so the newest envelope is often still in the future.
   */
  private envelopes: EnvelopeState[] = [];

  constructor(
    readonly ctx: BaseAudioContext,
    readonly kind: VoiceKind,
    waves: ChipWaves,
    out: AudioNode,
  ) {
    this.env = ctx.createGain();
    this.env.gain.value = 0;
    this.env.connect(out);

    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 6;
    this.lfoDepth = ctx.createGain();
    this.lfoDepth.gain.value = 0;
    this.lfo.connect(this.lfoDepth);

    const now = ctx.currentTime;
    if (kind === 'noise') {
      for (const mode of ['long', 'short'] as const) {
        const src = ctx.createBufferSource();
        src.buffer = waves.noise[mode];
        src.loop = true;
        src.playbackRate.value = 1;
        this.addSource(src, src.playbackRate, src.detune, now);
      }
    } else {
      const tables = kind === 'pulse' ? waves.pulse : [waves.tri];
      for (const table of tables) {
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(table);
        this.addSource(osc, osc.frequency, osc.detune, now);
      }
    }
    this.lfo.start(now);
  }

  private addSource(src: AudioScheduledSourceNode, pitch: AudioParam, detune: AudioParam, now: number): void {
    const selector = this.ctx.createGain();
    selector.gain.value = 0;
    src.connect(selector);
    selector.connect(this.env);
    this.lfoDepth.connect(detune);
    src.start(now);
    this.pitch.push(pitch);
    this.selectors.push(selector);
  }

  /**
   * Schedule one note. `freq` is Hz for pulse and triangle, and playback rate
   * (roughly 0.02 to 2) for noise. Calls on the same voice must be in time order.
   */
  noteOn(t: number, freq: number, dur: number, p: NoteParams): void {
    this.select(this.selectorFor(p), t);

    const target = Math.max(freq, MIN_FREQ);
    const start = p.slideFrom ? target * 2 ** (p.slideFrom / 12) : target;
    for (const param of this.pitch) {
      param.cancelScheduledValues(t);
      param.setValueAtTime(start, t);
      if (p.slideFrom) param.exponentialRampToValueAtTime(target, t + (p.slideTime ?? 0.05));
      if (p.glideTo) param.exponentialRampToValueAtTime(Math.max(target * p.glideTo, MIN_FREQ), t + dur);
      if (p.arp && p.arp.length > 1) {
        const rate = p.arpRate ?? 60;
        const steps = Math.min(Math.ceil(dur * rate), MAX_ARP_STEPS);
        for (let k = 1; k < steps; k++) {
          const offset = p.arp[k % p.arp.length] ?? 0;
          param.setValueAtTime(target * 2 ** (offset / 12), t + k / rate);
        }
      }
    }

    const depth = this.lfoDepth.gain;
    depth.cancelScheduledValues(t);
    depth.setValueAtTime(0, t);
    if (p.vib) {
      this.lfo.frequency.setValueAtTime(p.vib.rate, t);
      depth.setValueAtTime(0, t + p.vib.delay);
      depth.linearRampToValueAtTime(p.vib.depth, t + p.vib.delay + 0.08);
    }

    const sustain = p.decay ? p.vol * (p.sustain ?? 0) : p.vol;
    const release = p.release ?? DEFAULT_RELEASE;
    const g = this.env.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(p.vol, t);
    if (p.decay) g.setTargetAtTime(sustain, t, p.decay);
    this.remember({ start: t, vol: p.vol, sustain, decay: p.decay ?? 0, end: t + dur, release });
    const atEnd = this.levelAt(t + dur);
    g.setValueAtTime(atEnd, t + dur);
    g.setTargetAtTime(0, t + dur, release);
  }

  /** Silence the voice at `t` and drop anything scheduled after it. */
  cut(t: number): void {
    for (const param of this.pitch) param.cancelScheduledValues(t);
    this.lfoDepth.gain.cancelScheduledValues(t);
    this.lfoDepth.gain.setValueAtTime(0, t);
    const g = this.env.gain;
    const level = this.levelAt(t);
    g.cancelScheduledValues(t);
    g.setValueAtTime(level, t);
    g.setTargetAtTime(0, t, CUT_RELEASE);
    this.remember({ start: t, vol: level, sustain: level, decay: 0, end: t, release: CUT_RELEASE });
  }

  /**
   * Records an envelope that starts at `e.start`. The automation it came
   * with dropped everything scheduled from then on, so later envelopes go
   * too; ones silent for a second before it are forgotten.
   */
  private remember(e: EnvelopeState): void {
    this.envelopes = this.envelopes.filter((x) => x.start < e.start && x.end + 1 > e.start);
    this.envelopes.push(e);
  }

  /**
   * Envelope level the automation reaches at `t`, computed from the same
   * exponential the AudioParam uses. Every `setTargetAtTime` is preceded by a
   * `setValueAtTime` with this level so the curve is continuous; that is also
   * what keeps the offline Node renderer in step with browsers.
   */
  levelAt(t: number): number {
    let e: EnvelopeState | undefined;
    for (const x of this.envelopes) if (x.start <= t) e = x;
    if (!e) return 0;
    const held = e.decay > 0 ? e.sustain + (e.vol - e.sustain) * Math.exp(-(Math.min(t, e.end) - e.start) / e.decay) : e.sustain;
    if (t <= e.end) return held;
    return held * Math.exp(-(t - e.end) / e.release);
  }

  private selectorFor(p: NoteParams): number {
    if (this.kind === 'pulse') return (p.duty ?? 2);
    if (this.kind === 'noise') return p.noise === 'short' ? 1 : 0;
    return 0;
  }

  private select(index: number, t: number): void {
    if (index === this.lastSelector) return;
    this.lastSelector = index;
    this.selectors.forEach((sel, i) => sel.gain.setValueAtTime(i === index ? 1 : 0, t));
  }
}

export type VoiceSet = Readonly<Record<ChannelId, ChipVoice>>;

export function createVoiceSet(ctx: BaseAudioContext, waves: ChipWaves, out: AudioNode): VoiceSet {
  return {
    pulse1: new ChipVoice(ctx, 'pulse', waves, out),
    pulse2: new ChipVoice(ctx, 'pulse', waves, out),
    tri: new ChipVoice(ctx, 'tri', waves, out),
    noise: new ChipVoice(ctx, 'noise', waves, out),
  };
}
