import type { Song } from '../song';
import { DRUMS, MOTIF, bars, echo } from './motif';

/**
 * Polar Signal — the main theme. Calm, graphic, a beacon in the snow.
 * A minor, 108 BPM. Lead on 25 % pulse with a 12.5 % echo three steps behind.
 */

const LEAD_B = bars(
  'A4 - - - . . . . E5 - - - . . . .',
  'D5 - - - . . . . C5 - - - . . . .',
  'A4 - . . A4 - E5 - - - - - - - - -',
  'G5 - - - E5 - - - D5 - - - - - . .',
  'F5 - . . F5 - C5 - - - D5 - E5 - - -',
  'D5 - - - C5 - - - B4 - - - - - . .',
  'C5 - - - B4 - - - A4 - - - - - - -',
  'E5 - - - - - - - - - - - . . . .',
);

const LEAD = bars(MOTIF, MOTIF, LEAD_B);

function bassBar(root: string, fifth: string): string {
  return `${root} - - - - - . . ${root} - - - ${fifth} - - -`;
}

const BASS = bars(
  bassBar('A2', 'E2'),
  bassBar('F2', 'C3'),
  bassBar('C2', 'G2'),
  bassBar('G2', 'D3'),
  bassBar('A2', 'E2'),
  bassBar('F2', 'C3'),
  bassBar('C2', 'G2'),
  bassBar('E2', 'B2'),
  bassBar('F2', 'C3'),
  bassBar('G2', 'D3'),
  bassBar('A2', 'E2'),
  bassBar('A2', 'E2'),
  bassBar('F2', 'C3'),
  bassBar('G2', 'D3'),
  bassBar('A2', 'E2'),
  bassBar('E2', 'B2'),
);

const DRUM_BAR = 'k . . h r . . h s . . h r . . h';
const DRUM_FILL = 'k . . h r . . h s . r . s . s s';
const DRUMS_ALL = bars(...Array.from({ length: 16 }, (_, i) => (i % 8 === 7 ? DRUM_FILL : DRUM_BAR)));

export const polarSignal: Song = {
  name: 'Polar Signal',
  bpm: 108,
  stepsPerBeat: 4,
  loop: true,
  instruments: {
    lead: { vol: 0.26, duty: 1, decay: 0.45, sustain: 0.7, vib: { depth: 10, rate: 5.5, delay: 0.2 } },
    echo: { vol: 0.09, duty: 0, decay: 0.3, sustain: 0.4 },
    bass: { vol: 0.34, decay: 0.6, sustain: 0.85, release: 0.015 },
    ...DRUMS,
  },
  tracks: [
    { channel: 'pulse1', instrument: 'lead', steps: LEAD },
    { channel: 'pulse2', instrument: 'echo', steps: echo(LEAD, 3) },
    { channel: 'tri', instrument: 'bass', steps: BASS },
    { channel: 'noise', instrument: 'h', steps: DRUMS_ALL },
  ],
};
