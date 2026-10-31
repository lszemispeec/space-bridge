const SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const NOTE_RE = /^([A-G])([#b]?)(-?\d)$/;

/** True for tokens such as `C4`, `F#3`, `Bb5`. */
export function isNoteName(token: string): boolean {
  return NOTE_RE.test(token);
}

/** MIDI number for a note name. `A4` is 69. Throws on malformed input. */
export function noteToMidi(name: string): number {
  const m = NOTE_RE.exec(name);
  if (!m) throw new Error(`Bad note name: ${name}`);
  const accidental = m[2];
  const octave = Number(m[3]);
  const base = SEMITONES[m[1] ?? ''];
  if (base === undefined) throw new Error(`Bad note name: ${name}`);
  const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return 12 * (octave + 1) + base + shift;
}

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function noteToFreq(name: string): number {
  return midiToFreq(noteToMidi(name));
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNote(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NAMES[((midi % 12) + 12) % 12]}${octave}`;
}

/**
 * Shift every note token in a pattern string by `semitones`.
 * Rests, holds, instrument switches and drum tokens pass through unchanged.
 */
export function transpose(pattern: string, semitones: number): string {
  if (semitones === 0) return pattern;
  return pattern.replace(/[A-G][#b]?-?\d/g, (tok) => midiToNote(noteToMidi(tok) + semitones));
}
