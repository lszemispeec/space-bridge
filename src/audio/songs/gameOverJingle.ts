import type { Song } from '../song';
import { DRUMS, bars } from './motif';

/**
 * Game-over jingle: the motif's opening turned downwards, slowing to a thud.
 * A minor, 100 BPM, non-looping, about five seconds.
 */
export const gameOverJingle: Song = {
  name: 'Game Over',
  bpm: 100,
  stepsPerBeat: 4,
  loop: false,
  instruments: {
    lead: { vol: 0.28, duty: 2, decay: 0.5, sustain: 0.7, vib: { depth: 18, rate: 4.5, delay: 0.25 } },
    harm: { vol: 0.12, duty: 1, decay: 0.5, sustain: 0.6 },
    bass: { vol: 0.36, decay: 0.5, sustain: 0.8, release: 0.02 },
    thud: { vol: 0.5, decay: 0.3, glideTo: 0.5, pitch: 'A1' },
    ...DRUMS,
    c: { vol: 0.3, decay: 0.35, rate: 0.25, noise: 'long' },
  },
  tracks: [
    {
      channel: 'pulse1',
      instrument: 'lead',
      steps: bars(
        'A4 - . . A4 - E4 - - - - - - - - -',
        'D4 - - - C4 - - - B3 - - - - - - -',
        'A3 - - - - - - - - - - - - - - -',
      ),
    },
    {
      channel: 'pulse2',
      instrument: 'harm',
      steps: bars(
        '. . . . . . C4 - - - - - - - - -',
        'B3 - - - A3 - - - G#3 - - - - - - -',
        'E3 - - - - - - - - - - - - - - -',
      ),
    },
    {
      channel: 'tri',
      instrument: 'bass',
      steps: bars(
        'A2 - - - - - - - - - - - - - - -',
        'F2 - - - - - - - E2 - - - - - - -',
        'thud - - - - - - - - - - - - - - -',
      ),
    },
    {
      channel: 'noise',
      instrument: 'h',
      steps: bars(
        '. . . . . . . . . . . . . . . .',
        '. . . . . . . . . . . . . . . .',
        'c - - - - - - - - - - - - - - -',
      ),
    },
  ],
};
