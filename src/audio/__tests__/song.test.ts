import { describe, expect, it } from 'vitest';
import { compileSong, songDuration, type Song, type Track } from '../song';
import { JINGLE_SONGS, THEME_SONGS } from '../songs/index';

const tiny: Song = {
  name: 'tiny',
  bpm: 120,
  stepsPerBeat: 4,
  loop: true,
  loopStart: 2,
  instruments: {
    lead: { vol: 0.2 },
    soft: { vol: 0.1 },
    k: { vol: 0.3, rate: 0.1 },
  },
  tracks: [
    { channel: 'pulse1', instrument: 'lead', steps: 'C4 - - . @soft E4 - . .' },
    { channel: 'noise', instrument: 'k', steps: 'k . k . | k . . .' },
  ],
};
const [leadTrack] = tiny.tracks as [Track, Track];

describe('compileSong', () => {
  it('turns tokens into notes with hold lengths and instrument switches', () => {
    const c = compileSong(tiny);
    expect(c.totalSteps).toBe(8);
    expect(c.stepSec).toBeCloseTo(0.125);
    expect(songDuration(c)).toBeCloseTo(1);
    const lead = c.tracks[0];
    if (!lead) throw new Error('no lead track');
    expect(lead.notes.map((n) => [n.step, n.len])).toEqual([
      [0, 3],
      [4, 2],
    ]);
    expect(lead.notes[0]?.params.vol).toBe(0.2);
    expect(lead.notes[1]?.params.vol).toBe(0.1);
    expect(lead.notes[0]?.freq).toBeCloseTo(261.63, 1);
  });

  it('maps drum tokens on the noise channel to playback rates', () => {
    const c = compileSong(tiny);
    const noise = c.tracks[1];
    if (!noise) throw new Error('no noise track');
    expect(noise.notes.map((n) => n.step)).toEqual([0, 2, 4]);
    expect(noise.notes[0]?.freq).toBe(0.1);
  });

  it('computes the loop index per track', () => {
    const c = compileSong(tiny);
    expect(c.loopStart).toBe(2);
    expect(c.tracks[0]?.loopIndex).toBe(1);
    expect(c.tracks[1]?.loopIndex).toBe(1);
  });

  it('rejects uneven tracks and unknown tokens', () => {
    expect(() => compileSong({ ...tiny, tracks: [leadTrack, { channel: 'tri', instrument: 'lead', steps: 'C3 -' }] })).toThrow(/steps/);
    expect(() => compileSong({ ...tiny, tracks: [{ channel: 'tri', instrument: 'lead', steps: 'C3 bogus' }] })).toThrow(/bad token/);
    expect(() => compileSong({ ...tiny, tracks: [{ channel: 'tri', instrument: 'nope', steps: 'C3' }] })).toThrow(/unknown instrument/);
  });

  it('compiles every shipped song', () => {
    for (const song of Object.values(THEME_SONGS)) {
      const c = compileSong(song);
      expect(c.loop).toBe(true);
      expect(c.totalSteps).toBe(256);
      expect(c.tracks.map((t) => t.channel)).toEqual(['pulse1', 'pulse2', 'tri', 'noise']);
      for (const t of c.tracks) expect(t.notes.length).toBeGreaterThan(0);
    }
    const jingle = compileSong(JINGLE_SONGS.gameOver);
    expect(jingle.loop).toBe(false);
    expect(songDuration(jingle)).toBeLessThan(8);
  });
});
