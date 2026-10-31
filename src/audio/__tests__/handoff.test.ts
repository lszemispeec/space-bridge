import { OfflineAudioContext } from 'node-web-audio-api';
import { describe, expect, it } from 'vitest';
import { ChipVoice, ChipWaves } from '../chip';
import { ChipEngine } from '../engine';
import { compileSong } from '../song';
import { THEME_SONGS } from '../songs/index';

const SAMPLE_RATE = 22050;
const SETTINGS = { muted: false, master: 1, music: 1, sfx: 1 };

/** The browser schedules this far ahead of the clock, so a switch always finds notes already scheduled. */
const LOOKAHEAD = 0.15;
const SWITCH_AT = 1;
const CUT_AT = SWITCH_AT + 0.005;
const START_AT = SWITCH_AT + 0.05;
/** A cut releases with a 3 ms time constant; after this long it is below -80 dB. */
const SETTLE = 0.03;
const END = 2;

function context(seconds: number): OfflineAudioContext {
  return new OfflineAudioContext(1, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
}

function peak(samples: Float32Array, fromSec: number, toSec: number): number {
  let max = 0;
  for (let i = Math.floor(fromSec * SAMPLE_RATE); i < Math.floor(toSec * SAMPLE_RATE); i++) max = Math.max(max, Math.abs(samples[i] ?? 0));
  return max;
}

function rms(samples: Float32Array, fromSec: number, toSec: number): number {
  const from = Math.floor(fromSec * SAMPLE_RATE);
  const to = Math.floor(toSec * SAMPLE_RATE);
  let sum = 0;
  for (let i = from; i < to; i++) sum += (samples[i] ?? 0) ** 2;
  return Math.sqrt(sum / Math.max(1, to - from));
}

/**
 * Largest relative loudness difference over 50 ms windows. The oscillators
 * run all the time, so their phase depends on what played before and the
 * samples never match exactly; the loudness does, unless a note leaks.
 */
function maxLoudnessDifference(a: Float32Array, b: Float32Array, fromSec: number, toSec: number): number {
  let max = 0;
  for (let t = fromSec; t + 0.05 <= toSec; t += 0.05) {
    const ra = rms(a, t, t + 0.05);
    const rb = rms(b, t, t + 0.05);
    max = Math.max(max, Math.abs(ra - rb) / Math.max(ra, rb, 1e-3));
  }
  return max;
}

const polar = compileSong(THEME_SONGS['polar-signal']);
const neon = compileSong(THEME_SONGS['neon-orbit']);

/** Polar plays from the start; at SWITCH_AT the game switches to Neon the way GameAudio does. */
async function renderSwitch(): Promise<Float32Array> {
  const ctx = context(END);
  const engine = new ChipEngine(ctx, SETTINGS);
  engine.playSong(polar, 0.05);
  engine.schedule(SWITCH_AT + LOOKAHEAD);
  engine.playSong(neon, START_AT, CUT_AT);
  engine.schedule(END);
  return (await ctx.startRendering()).getChannelData(0);
}

/** Neon alone, started at the same moment. */
async function renderNeonOnly(): Promise<Float32Array> {
  const ctx = context(END);
  const engine = new ChipEngine(ctx, SETTINGS);
  engine.playSong(neon, START_AT);
  engine.schedule(END);
  return (await ctx.startRendering()).getChannelData(0);
}

describe('music handoff', () => {
  it('cuts the old track at once and plays only the new one afterwards', async () => {
    const [switched, neonOnly] = await Promise.all([renderSwitch(), renderNeonOnly()]);
    expect(peak(switched, 0.5, SWITCH_AT)).toBeGreaterThan(0.05);
    // Silence between the cut and the first note of the new track.
    expect(peak(switched, CUT_AT + SETTLE, START_AT)).toBeLessThan(1e-3);
    // From then on, nothing of the old track remains.
    expect(peak(neonOnly, START_AT, END)).toBeGreaterThan(0.05);
    expect(maxLoudnessDifference(switched, neonOnly, START_AT, END)).toBeLessThan(0.1);
  });
});

describe('ChipVoice.levelAt', () => {
  it('reads the note that is sounding, not the newest one scheduled ahead', () => {
    const ctx = context(1);
    const voice = new ChipVoice(ctx, 'pulse', new ChipWaves(ctx), ctx.destination);
    voice.noteOn(0.1, 440, 0.2, { vol: 0.3 });
    voice.noteOn(0.5, 440, 0.2, { vol: 0.2 });
    expect(voice.levelAt(0.05)).toBe(0);
    expect(voice.levelAt(0.2)).toBeCloseTo(0.3);
    expect(voice.levelAt(0.4)).toBeLessThan(1e-6);
    expect(voice.levelAt(0.6)).toBeCloseTo(0.2);
  });

  it('after a cut, reports the cut level and forgets the notes it dropped', () => {
    const ctx = context(1);
    const voice = new ChipVoice(ctx, 'tri', new ChipWaves(ctx), ctx.destination);
    voice.noteOn(0.1, 220, 0.5, { vol: 0.25 });
    voice.noteOn(0.7, 220, 0.2, { vol: 0.2 });
    voice.cut(0.3);
    expect(voice.levelAt(0.3)).toBeCloseTo(0.25);
    expect(voice.levelAt(0.35)).toBeLessThan(1e-6);
    expect(voice.levelAt(0.8)).toBeLessThan(1e-6);
  });
});
