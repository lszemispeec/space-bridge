import { tokenize } from '../song';
import type { Instrument } from '../song';

/**
 * The Space Bridge motif: "A A E — D C | D E A", in A minor.
 * Four bars of sixteen sixteenth-steps. Every theme plays it transposed and
 * re-dressed, so it stays recognisable across the three looks.
 */
export const MOTIF = bars(
  'A4 - . . A4 - E5 - - - D5 - C5 - - -',
  'D5 - - - E5 - - - A4 - - - - - . .',
  'A4 - . . A4 - E5 - - - G5 - E5 - - -',
  'D5 - - - C5 - - - B4 - - - - - . .',
);

/** Join bars with a readable separator. */
export function bars(...lines: string[]): string {
  return lines.join(' | ');
}

export function rests(n: number): string {
  return Array.from({ length: n }, () => '.').join(' ');
}

export function repeat(pattern: string, times: number): string {
  return bars(...Array.from({ length: times }, () => pattern));
}

/**
 * The classic chip echo: the same line delayed by `delay` steps, cut to the
 * original length, so it can go on the second pulse channel at low volume.
 */
export function echo(pattern: string, delay: number): string {
  const tokens = tokenize(pattern);
  return [...Array.from({ length: delay }, () => '.'), ...tokens.slice(0, tokens.length - delay)].join(' ');
}

/** Noise drum kit shared by the themes. Rates are playback rates of the LFSR buffer. */
export const DRUMS: Record<string, Instrument> = {
  k: { vol: 0.3, decay: 0.045, rate: 0.07, noise: 'long' },
  s: { vol: 0.25, decay: 0.07, rate: 0.45, noise: 'long' },
  h: { vol: 0.11, decay: 0.018, rate: 1, noise: 'short' },
  o: { vol: 0.13, decay: 0.07, rate: 1, noise: 'short' },
  r: { vol: 0.09, decay: 0.03, rate: 0.3, noise: 'long' },
};
