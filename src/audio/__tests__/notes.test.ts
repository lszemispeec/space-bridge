import { describe, expect, it } from 'vitest';
import { isNoteName, midiToNote, noteToFreq, noteToMidi, transpose } from '../notes';

describe('notes', () => {
  it('maps names to MIDI and Hz', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('C#4')).toBe(61);
    expect(noteToMidi('Db4')).toBe(61);
    expect(noteToFreq('A4')).toBeCloseTo(440);
    expect(noteToFreq('A3')).toBeCloseTo(220);
  });

  it('round-trips through midiToNote', () => {
    for (let m = 24; m < 108; m++) expect(noteToMidi(midiToNote(m))).toBe(m);
  });

  it('recognises note tokens only', () => {
    expect(isNoteName('G#5')).toBe(true);
    expect(isNoteName('-')).toBe(false);
    expect(isNoteName('k')).toBe(false);
    expect(isNoteName('@lead')).toBe(false);
  });

  it('transposes notes and leaves other tokens alone', () => {
    expect(transpose('A4 - . C#5 @lead k | Bb3', 2)).toBe('B4 - . D#5 @lead k | C4');
    expect(transpose('A4', -12)).toBe('A3');
  });
});
