import { noteToFreq } from './notes';
import type { ChannelId, NoteParams, AudioEvent } from './types';

export interface SfxPart {
  ch: ChannelId;
  /** Seconds after the effect starts. */
  at: number;
  dur: number;
  /** Hz, or playback rate on the noise channel. */
  freq: number;
  params: NoteParams;
}

export interface SfxDef {
  name: AudioEvent;
  /** Sorted by channel then time; `playSfx` relies on that order. */
  parts: readonly SfxPart[];
  /** Total length in seconds, used by the renderer and the demo page. */
  length: number;
}

const n = noteToFreq;

function part(ch: ChannelId, at: number, dur: number, freq: number, params: NoteParams): SfxPart {
  return { ch, at, dur, freq, params };
}

function sfx(name: AudioEvent, parts: SfxPart[]): SfxDef {
  const sorted = [...parts].sort((a, b) => (a.ch === b.ch ? a.at - b.at : a.ch < b.ch ? -1 : 1));
  const length = Math.max(...parts.map((p) => p.at + dur(p)));
  return { name, parts: sorted, length };
}

function dur(p: SfxPart): number {
  return p.dur + (p.params.release ?? 0.004) * 4;
}

/**
 * Every effect is under 0.8 s, and each one has its own pitch shape so they
 * read against the music: steps are low and dull, plate moves click,
 * jumps rise, bounces dip then spring, falls slide down, wins arpeggiate up.
 */
export const SFX: Readonly<Record<AudioEvent, SfxDef>> = {
  footstep: sfx('footstep', [
    part('noise', 0, 0.035, 0.12, { vol: 0.35, decay: 0.012, noise: 'long' }),
    part('tri', 0, 0.04, n('A2'), { vol: 0.5, decay: 0.015, glideTo: 0.6 }),
  ]),

  jump: sfx('jump', [
    part('pulse1', 0, 0.16, n('E5'), { vol: 0.32, duty: 1, slideFrom: -12, slideTime: 0.12, decay: 0.12 }),
    part('noise', 0, 0.03, 0.6, { vol: 0.2, decay: 0.01 }),
  ]),

  bounce: sfx('bounce', [
    part('pulse1', 0, 0.06, n('A4'), { vol: 0.32, duty: 2, glideTo: 0.55, decay: 0.08, sustain: 0.6 }),
    part('pulse1', 0.06, 0.14, n('D4'), { vol: 0.32, duty: 2, glideTo: 2.5, decay: 0.1 }),
    part('tri', 0, 0.09, n('A2'), { vol: 0.6, decay: 0.05, glideTo: 0.5 }),
    part('noise', 0, 0.04, 0.3, { vol: 0.3, decay: 0.015 }),
  ]),

  plate_move: sfx('plate_move', [
    part('pulse2', 0, 0.03, n('C6'), { vol: 0.22, duty: 0, decay: 0.012 }),
    part('pulse2', 0.045, 0.03, n('G5'), { vol: 0.18, duty: 0, decay: 0.012 }),
    part('noise', 0, 0.025, 1, { vol: 0.25, decay: 0.008, noise: 'short' }),
  ]),

  save: sfx('save', [
    part('pulse1', 0, 0.06, n('C5'), { vol: 0.3, duty: 1, decay: 0.05 }),
    part('pulse1', 0.06, 0.06, n('E5'), { vol: 0.3, duty: 1, decay: 0.05 }),
    part('pulse1', 0.12, 0.06, n('G5'), { vol: 0.3, duty: 1, decay: 0.05 }),
    part('pulse1', 0.18, 0.3, n('C6'), { vol: 0.3, duty: 1, decay: 0.18, vib: { depth: 25, rate: 7, delay: 0.1 } }),
    part('pulse2', 0.18, 0.3, n('E5'), { vol: 0.16, duty: 0, decay: 0.18 }),
    part('tri', 0, 0.42, n('C3'), { vol: 0.5, decay: 0.3 }),
  ]),

  fall: sfx('fall', [
    part('pulse1', 0, 0.45, n('A5'), { vol: 0.3, duty: 1, glideTo: 0.08, decay: 0.5, sustain: 0.7, vib: { depth: 60, rate: 12, delay: 0 } }),
    part('tri', 0.42, 0.12, n('A1'), { vol: 0.55, decay: 0.07, glideTo: 0.5 }),
    part('noise', 0.42, 0.18, 0.15, { vol: 0.45, decay: 0.06 }),
  ]),

  // The crater creature: a wet slurp on the noise channel and a low, wobbling
  // pulse that dives as the tentacle pulls. Placeholder shape for the composer.
  grab: sfx('grab', [
    part('pulse2', 0, 0.3, n('G3'), { vol: 0.26, duty: 0, glideTo: 0.5, decay: 0.35, sustain: 0.6, vib: { depth: 90, rate: 9, delay: 0 } }),
    part('tri', 0.05, 0.25, n('E2'), { vol: 0.5, decay: 0.2, glideTo: 0.6 }),
    part('noise', 0, 0.12, 0.08, { vol: 0.35, decay: 0.05, noise: 'long' }),
    part('noise', 0.16, 0.08, 0.04, { vol: 0.3, decay: 0.04, noise: 'long' }),
  ]),

  life_lost: sfx('life_lost', [
    part('pulse1', 0, 0.22, n('E4'), { vol: 0.3, duty: 2, decay: 0.4, sustain: 0.8, vib: { depth: 20, rate: 5, delay: 0.08 } }),
    part('pulse1', 0.22, 0.42, n('Eb4'), { vol: 0.3, duty: 2, decay: 0.45, sustain: 0.6, vib: { depth: 35, rate: 5, delay: 0.1 } }),
    part('pulse2', 0, 0.22, n('C4'), { vol: 0.18, duty: 1, decay: 0.4, sustain: 0.8 }),
    part('pulse2', 0.22, 0.42, n('B3'), { vol: 0.18, duty: 1, decay: 0.45, sustain: 0.6 }),
    part('tri', 0.22, 0.45, n('E2'), { vol: 0.5, decay: 0.3 }),
  ]),

  unlock: sfx('unlock', [
    // The first three motif notes (A A E), then a sparkle up two octaves.
    part('pulse1', 0, 0.07, n('A4'), { vol: 0.3, duty: 0, decay: 0.05 }),
    part('pulse1', 0.1, 0.07, n('A4'), { vol: 0.3, duty: 0, decay: 0.05 }),
    part('pulse1', 0.2, 0.14, n('E5'), { vol: 0.3, duty: 1, decay: 0.1 }),
    part('pulse1', 0.34, 0.05, n('A5'), { vol: 0.28, duty: 0, decay: 0.04 }),
    part('pulse1', 0.39, 0.05, n('C#6'), { vol: 0.28, duty: 0, decay: 0.04 }),
    part('pulse1', 0.44, 0.05, n('E6'), { vol: 0.28, duty: 0, decay: 0.04 }),
    part('pulse1', 0.49, 0.3, n('A6'), { vol: 0.28, duty: 0, decay: 0.2, vib: { depth: 20, rate: 8, delay: 0.05 } }),
    part('pulse2', 0.34, 0.45, n('A4'), { vol: 0.18, duty: 1, arp: [0, 4, 7], decay: 0.3 }),
    part('tri', 0.2, 0.6, n('A2'), { vol: 0.5, decay: 0.4 }),
  ]),

  game_over: sfx('game_over', [
    part('pulse1', 0, 0.12, n('E5'), { vol: 0.3, duty: 2, decay: 0.1 }),
    part('pulse1', 0.14, 0.12, n('C5'), { vol: 0.3, duty: 2, decay: 0.1 }),
    part('pulse1', 0.28, 0.12, n('A4'), { vol: 0.3, duty: 2, decay: 0.1 }),
    part('pulse1', 0.42, 0.4, n('E4'), { vol: 0.3, duty: 2, glideTo: 0.7, decay: 0.3, sustain: 0.5 }),
    part('tri', 0.42, 0.45, n('A1'), { vol: 0.55, decay: 0.25, glideTo: 0.75 }),
    part('noise', 0.42, 0.35, 0.2, { vol: 0.35, decay: 0.12 }),
  ]),
};
