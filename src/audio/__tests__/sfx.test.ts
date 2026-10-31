import { describe, expect, it } from 'vitest';
import { SFX } from '../sfx';
import { AUDIO_EVENTS } from '../types';

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
});
