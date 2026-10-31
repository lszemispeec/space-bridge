import { OfflineAudioContext } from 'node-web-audio-api';
import { describe, expect, it } from 'vitest';
import { renderSfxStep } from '../render';
import { SFX } from '../sfx';
import { AUDIO_EVENTS } from '../types';

const SAMPLE_RATE = 22050;

function rms(samples: Float32Array, fromSec: number, toSec: number): number {
  const from = Math.floor(fromSec * SAMPLE_RATE);
  const to = Math.floor(toSec * SAMPLE_RATE);
  let sum = 0;
  for (let i = from; i < to; i++) sum += (samples[i] ?? 0) ** 2;
  return Math.sqrt(sum / Math.max(1, to - from));
}

describe('SFX definitions', () => {
  it('covers every event and stays short', () => {
    for (const ev of AUDIO_EVENTS) {
      const def = SFX[ev];
      expect(def.name).toBe(ev);
      expect(def.parts.length).toBeGreaterThan(0);
      expect(def.length).toBeLessThan(1);
    }
  });

  it('keeps parts ordered by channel then time so playback can cut per channel', () => {
    for (const ev of AUDIO_EVENTS) {
      const parts = SFX[ev].parts;
      for (let i = 1; i < parts.length; i++) {
        const a = parts[i - 1];
        const b = parts[i];
        if (!a || !b) throw new Error('missing part');
        expect(a.ch <= b.ch).toBe(true);
        if (a.ch === b.ch) expect(a.at).toBeLessThanOrEqual(b.at);
      }
    }
  });

  it('keeps music-safe volumes', () => {
    for (const ev of AUDIO_EVENTS) for (const p of SFX[ev].parts) expect(p.params.vol).toBeLessThanOrEqual(0.6);
  });

  it('fits the grab to the 660 ms animation and keeps it off the fall whistle channel', () => {
    expect(SFX.grab.length).toBeGreaterThanOrEqual(0.5);
    expect(SFX.grab.length).toBeLessThanOrEqual(0.7);
    expect(SFX.grab.parts.some((p) => p.ch === 'pulse1')).toBe(false);
    expect(SFX.fall.parts.filter((p) => p.ch === 'pulse1').length).toBeGreaterThan(0);
  });

  it('orders the miss step: fall and grab at once, life_lost after the grab, nothing else waits', () => {
    expect(SFX.fall.offset).toBe(0);
    expect(SFX.grab.offset).toBe(0);
    expect(SFX.life_lost.offset).toBeGreaterThanOrEqual(SFX.grab.length);
    for (const ev of AUDIO_EVENTS) if (ev !== 'life_lost') expect(SFX[ev].offset).toBe(0);
  });

  it('renders the miss step without clipping, with sound in the grab and in the life_lost', async () => {
    const buffer = await renderSfxStep(
      (sec, rate) => new OfflineAudioContext(1, Math.ceil(sec * rate), rate),
      [SFX.fall, SFX.grab, SFX.life_lost],
      { sampleRate: SAMPLE_RATE },
    );
    const samples = buffer.getChannelData(0);
    let peak = 0;
    for (const v of samples) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeLessThan(1);
    const grabEnd = SFX.grab.length;
    expect(rms(samples, 0.05, grabEnd)).toBeGreaterThan(0.02);
    expect(rms(samples, SFX.life_lost.offset + 0.05, SFX.life_lost.offset + SFX.life_lost.length)).toBeGreaterThan(0.02);
  });
});
