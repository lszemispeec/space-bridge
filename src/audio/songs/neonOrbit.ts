import { transpose } from '../notes';
import type { Instrument, Song } from '../song';
import { DRUMS, MOTIF, bars } from './motif';

/**
 * Neon Orbit — energetic arcade tension under a midnight sky.
 * E minor, 150 BPM. Driving octave bass, four-on-the-floor kit, and a
 * 60 Hz arpeggio pad on the second pulse. The last four bars lift the motif an octave.
 */

const LEAD_B = bars(
  'E5 - D5 - B4 - D5 - E5 - D5 - B4 - G4 -',
  'A4 - B4 - C5 - B4 - A4 - G4 - F#4 - G4 -',
  'E5 - D5 - B4 - D5 - E5 - G5 - E5 - D5 -',
  'B4 - - - - - - - . . . . . . . .',
);

const LEAD = bars(transpose(MOTIF, -5), transpose(MOTIF, -5), LEAD_B, transpose(MOTIF, 7));

function octaves(low: string, high: string): string {
  return `${low} - ${high} - ${low} - ${high} - ${low} - ${high} - ${low} - ${high} -`;
}

const BASS = bars(
  octaves('E2', 'E3'),
  octaves('C2', 'C3'),
  octaves('D2', 'D3'),
  octaves('E2', 'E3'),
  octaves('E2', 'E3'),
  octaves('C2', 'C3'),
  octaves('D2', 'D3'),
  octaves('B1', 'B2'),
  octaves('C2', 'C3'),
  octaves('D2', 'D3'),
  octaves('E2', 'E3'),
  octaves('B1', 'B2'),
  octaves('E2', 'E3'),
  octaves('C2', 'C3'),
  octaves('D2', 'D3'),
  octaves('B1', 'B2'),
);

function pad(chord: string): string {
  return `${chord} - - - - - - - - - - - - - - -`;
}

const PAD = bars(
  pad('Em'),
  pad('C'),
  pad('D'),
  pad('Em'),
  pad('Em'),
  pad('C'),
  pad('D'),
  pad('B'),
  pad('C'),
  pad('D'),
  pad('Em'),
  pad('B'),
  pad('Em'),
  pad('C'),
  pad('D'),
  pad('B'),
);

const DRUM_BAR = 'k . h . s . h . k . h . s . h h';
const DRUM_FILL = 'k . h . s . h . k . s . s s o .';
const DRUMS_ALL = bars(...Array.from({ length: 16 }, (_, i) => (i % 4 === 3 ? DRUM_FILL : DRUM_BAR)));

const padInst: Instrument = { vol: 0.11, duty: 0, decay: 0.9, sustain: 0.8, arpRate: 60 };

export const neonOrbit: Song = {
  name: 'Neon Orbit',
  bpm: 150,
  stepsPerBeat: 4,
  loop: true,
  instruments: {
    lead: { vol: 0.26, duty: 2, decay: 0.25, sustain: 0.85, vib: { depth: 16, rate: 6.5, delay: 0.12 } },
    bass: { vol: 0.36, decay: 0.12, sustain: 0.4, release: 0.01 },
    Em: { ...padInst, pitch: 'E4', arp: [0, 3, 7] },
    C: { ...padInst, pitch: 'C4', arp: [0, 4, 7] },
    D: { ...padInst, pitch: 'D4', arp: [0, 4, 7] },
    B: { ...padInst, pitch: 'B3', arp: [0, 4, 7] },
    ...DRUMS,
  },
  tracks: [
    { channel: 'pulse1', instrument: 'lead', steps: LEAD },
    { channel: 'pulse2', instrument: 'Em', steps: PAD },
    { channel: 'tri', instrument: 'bass', steps: BASS },
    { channel: 'noise', instrument: 'h', steps: DRUMS_ALL },
  ],
};
