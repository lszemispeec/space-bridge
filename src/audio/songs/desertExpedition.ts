import { transpose } from '../notes';
import type { Instrument, Song } from '../song';
import { DRUMS, MOTIF, bars } from './motif';

/**
 * Desert Expedition — warm, adventurous, a march across the dunes.
 * D minor with a Phrygian E♭, 126 BPM. Bold 50 % lead, galloping bass,
 * off-beat chord stabs on the second pulse.
 */

const LEAD_B = bars(
  'D4 - F4 - A4 - - - G4 - F4 - E4 - - -',
  'F4 - - - D4 - - - Eb4 - - - D4 - - -',
  'C4 - Eb4 - G4 - - - F4 - Eb4 - D4 - - -',
  'Eb4 - - - D4 - - - - - - - . . . .',
  'D4 - . . D4 - A4 - - - - - D5 - - -',
  'C5 - - - A4 - - - G4 - - - F4 - - -',
  'Eb4 - - - F4 - - - G4 - - - A4 - - -',
  'D4 - - - - - - - - - - - . . . .',
);

const LEAD = bars(transpose(MOTIF, -7), transpose(MOTIF, -7), LEAD_B);

function gallop(root: string, fifth: string): string {
  return `${root} - ${root} ${root} ${root} - ${root} ${root} ${root} - ${root} ${root} ${fifth} - ${fifth} ${fifth}`;
}

const BASS = bars(
  gallop('D2', 'A2'),
  gallop('Bb1', 'F2'),
  gallop('C2', 'G2'),
  gallop('D2', 'A2'),
  gallop('D2', 'A2'),
  gallop('Bb1', 'F2'),
  gallop('Eb2', 'Bb2'),
  gallop('A1', 'E2'),
  gallop('D2', 'A2'),
  gallop('Bb1', 'F2'),
  gallop('C2', 'G2'),
  gallop('Eb2', 'D2'),
  gallop('D2', 'A2'),
  gallop('F2', 'C3'),
  gallop('Eb2', 'Bb2'),
  gallop('D2', 'A2'),
);

function stabs(chord: string): string {
  return `. . ${chord} - . . ${chord} - . . ${chord} - . . ${chord} .`;
}

const STABS = bars(
  stabs('Dm'),
  stabs('Bb'),
  stabs('C'),
  stabs('Dm'),
  stabs('Dm'),
  stabs('Bb'),
  stabs('Eb'),
  stabs('A'),
  stabs('Dm'),
  stabs('Bb'),
  stabs('C'),
  stabs('Eb'),
  stabs('Dm'),
  stabs('F'),
  stabs('Eb'),
  stabs('Dm'),
);

const DRUM_BAR = 'k . . h s . . h k . h . s . . s';
const DRUM_FILL = 'k . . h s . s . k . s s s . s s';
const DRUMS_ALL = bars(...Array.from({ length: 16 }, (_, i) => (i % 4 === 3 ? DRUM_FILL : DRUM_BAR)));

const stab: Instrument = { vol: 0.14, duty: 1, decay: 0.07, arpRate: 60 };

export const desertExpedition: Song = {
  name: 'Desert Expedition',
  bpm: 126,
  stepsPerBeat: 4,
  loop: true,
  instruments: {
    lead: { vol: 0.26, duty: 2, decay: 0.3, sustain: 0.8, vib: { depth: 14, rate: 6, delay: 0.15 } },
    bass: { vol: 0.36, decay: 0.08, sustain: 0.5, release: 0.01 },
    Dm: { ...stab, pitch: 'D4', arp: [0, 3, 7] },
    Bb: { ...stab, pitch: 'Bb3', arp: [0, 4, 7] },
    C: { ...stab, pitch: 'C4', arp: [0, 4, 7] },
    Eb: { ...stab, pitch: 'Eb4', arp: [0, 4, 7] },
    F: { ...stab, pitch: 'F4', arp: [0, 4, 7] },
    A: { ...stab, pitch: 'A3', arp: [0, 4, 7] },
    ...DRUMS,
  },
  tracks: [
    { channel: 'pulse1', instrument: 'lead', steps: LEAD },
    { channel: 'pulse2', instrument: 'Dm', steps: STABS },
    { channel: 'tri', instrument: 'bass', steps: BASS },
    { channel: 'noise', instrument: 'h', steps: DRUMS_ALL },
  ],
};
