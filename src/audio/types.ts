/**
 * Vocabulary shared inside the audio engine. The names the game emits come
 * from `api.ts` (events) and `config/themes.ts` (themes); nothing here
 * redefines them.
 */
export type { AudioEvent } from './api';
export { AUDIO_EVENTS } from './api';
export type { ThemeId } from '../config/themes';

/** One-shot, non-looping music cues that interrupt the current track. */
export type JingleId = 'gameOver';

export const JINGLES: readonly JingleId[] = ['gameOver'];

/** The four console channels. Pulse 1 and 2 are identical; by convention 1 is lead, 2 is harmony. */
export type ChannelId = 'pulse1' | 'pulse2' | 'tri' | 'noise';

export const CHANNELS: readonly ChannelId[] = ['pulse1', 'pulse2', 'tri', 'noise'];

/** Pulse duty cycle: 0 = 12.5 %, 1 = 25 %, 2 = 50 %. */
export type Duty = 0 | 1 | 2;

/** Noise generator mode. `short` is the 93-step metallic LFSR, `long` is the 32767-step white noise. */
export type NoiseMode = 'long' | 'short';

export interface Vibrato {
  /** Depth in cents. */
  depth: number;
  /** Rate in Hz. */
  rate: number;
  /** Seconds after note start before vibrato fades in. */
  delay: number;
}

/**
 * Everything a voice needs to shape one note, apart from pitch and duration.
 * Instruments and SFX segments are both expressed with this.
 */
export interface NoteParams {
  /** Peak volume, 0..1. Music voices should stay at or below 0.3 so four channels never clip. */
  vol: number;
  /** Exponential decay time constant in seconds from `vol` towards `vol * sustain`. */
  decay?: number;
  /** Sustain level as a fraction of `vol`. Defaults to 0 when `decay` is set. */
  sustain?: number;
  /** Release time constant in seconds after the note ends. Defaults to a near-instant 4 ms. */
  release?: number;
  /** Pulse channels only. */
  duty?: Duty;
  /** Noise channel only. */
  noise?: NoiseMode;
  /** Semitone offsets cycled at `arpRate` steps per second. `[0, 4, 7]` is a major chord. */
  arp?: readonly number[];
  /** Arpeggio speed in steps per second. Defaults to 60, like a 60 Hz console frame. */
  arpRate?: number;
  vib?: Vibrato;
  /** Start this many semitones away from the target pitch and slide in over `slideTime` seconds. */
  slideFrom?: number;
  slideTime?: number;
  /** Multiply the pitch by this ratio over the whole note (0.5 = glide down one octave). */
  glideTo?: number;
}

/** Mixer state. `muted` is owned by the game save; only the volumes persist here. */
export interface AudioSettings {
  muted: boolean;
  /** 0..1 */
  master: number;
  /** 0..1 */
  music: number;
  /** 0..1 */
  sfx: number;
}
