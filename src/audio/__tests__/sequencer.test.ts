import { describe, expect, it } from 'vitest';
import type { VoiceSet } from '../chip';
import { Sequencer } from '../sequencer';
import { compileSong, type Song } from '../song';
import type { NoteParams } from '../types';

interface Call {
  ch: string;
  t: number;
  freq: number;
  dur: number;
  params: NoteParams;
}

function fakeVoices(): { voices: VoiceSet; calls: Call[]; cuts: string[] } {
  const calls: Call[] = [];
  const cuts: string[] = [];
  const make = (ch: string) =>
    ({
      noteOn: (t: number, freq: number, dur: number, params: NoteParams) => calls.push({ ch, t, freq, dur, params }),
      cut: () => cuts.push(ch),
    }) as unknown as VoiceSet['pulse1'];
  return { voices: { pulse1: make('pulse1'), pulse2: make('pulse2'), tri: make('tri'), noise: make('noise') }, calls, cuts };
}

const song: Song = {
  name: 'loop',
  bpm: 120,
  stepsPerBeat: 4,
  loop: true,
  loopStart: 2,
  instruments: { a: { vol: 0.2 } },
  tracks: [{ channel: 'pulse1', instrument: 'a', steps: 'C4 D4 E4 F4' }],
};

describe('Sequencer', () => {
  it('schedules steps on the audio clock and loops from loopStart', () => {
    const { voices, calls } = fakeVoices();
    const seq = new Sequencer(voices);
    seq.play(compileSong(song), 1);
    expect(seq.scheduleUntil(1.5)).toBe(true);
    expect(calls.map((c) => c.t)).toEqual([1, 1.125, 1.25, 1.375]);
    expect(seq.scheduleUntil(1.75)).toBe(true);
    expect(calls.slice(4).map((c) => [c.t, Math.round(c.freq)])).toEqual([
      [1.5, 330],
      [1.625, 349],
    ]);
    expect(calls[0]?.dur).toBeCloseTo(0.125);
  });

  it('does not schedule past the horizon or before play', () => {
    const { voices, calls } = fakeVoices();
    const seq = new Sequencer(voices);
    expect(seq.scheduleUntil(10)).toBe(false);
    seq.play(compileSong(song), 0);
    seq.scheduleUntil(0.2);
    expect(calls).toHaveLength(2);
  });

  it('stops after a non-looping song and reports it', () => {
    const { voices, calls } = fakeVoices();
    const seq = new Sequencer(voices);
    seq.play(compileSong({ ...song, loop: false }), 0);
    expect(seq.scheduleUntil(10)).toBe(false);
    expect(calls).toHaveLength(4);
    expect(seq.isPlaying).toBe(false);
  });

  it('applies the tempo rate to following steps', () => {
    const { voices, calls } = fakeVoices();
    const seq = new Sequencer(voices);
    seq.rate = 2;
    seq.play(compileSong(song), 0);
    seq.scheduleUntil(0.25);
    expect(calls.map((c) => c.t)).toEqual([0, 0.0625, 0.125, 0.1875]);
  });

  it('cuts every voice on stop', () => {
    const { voices, cuts } = fakeVoices();
    const seq = new Sequencer(voices);
    seq.play(compileSong(song), 0);
    seq.stop(0.5);
    expect(cuts.sort()).toEqual(['noise', 'pulse1', 'pulse2', 'tri']);
    expect(seq.current).toBeNull();
  });
});
