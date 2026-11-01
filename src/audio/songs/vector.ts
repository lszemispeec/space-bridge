import { transpose } from '../notes';
import type { Instrument, Song } from '../song';
import { MOTIF, bars, repeat } from './motif';

/**
 * Vector — cold, sparse arcade for the green wireframe theme.
 * C minor, 100 BPM. The triangle plays an Asteroids-style heartbeat, two
 * alternating thuds that race to eighths in the last four bars. A thin
 * 12.5 % lead carries the motif over it; the second pulse answers with a
 * sonar ping where the lead rests and a faint hum under the quiet bars.
 */

const ANSWER = bars(
  'G5 - - - - - - - . . . . . . . .',
  'Eb5 - - - - - - - F5 - - - - - - -',
  'D5 - - - - - - - . . . . C5 - - -',
  'G4 - - - - - - - - - - - . . . .',
);

const CLIMB = bars(
  'C5 - - - D5 - - - Eb5 - - - F5 - - -',
  'G5 - - - - - - - F5 - - - Eb5 - - -',
  'D5 - - - - - - - Eb5 - - - D5 - - -',
  'C5 - - - - - - - - - - - . . . .',
);

const LEAD = bars(transpose(MOTIF, 3), ANSWER, transpose(MOTIF, 3), CLIMB);

/** One thud per beat, root and the fifth below in turn. */
function heartbeat(root: string, fifth: string): string {
  return `${root} - - . ${fifth} - - . ${root} - - . ${fifth} - - .`;
}

/** The heart races: a thud on every eighth. */
function racing(root: string, fifth: string): string {
  return `${root} - ${fifth} - ${root} - ${fifth} - ${root} - ${fifth} - ${root} - ${fifth} -`;
}

const BASS = bars(
  heartbeat('C2', 'G1'),
  heartbeat('Ab1', 'Eb2'),
  heartbeat('Eb2', 'Bb1'),
  heartbeat('Bb1', 'F2'),
  heartbeat('C2', 'G1'),
  heartbeat('Ab1', 'Eb2'),
  heartbeat('Eb2', 'Bb1'),
  heartbeat('G1', 'D2'),
  heartbeat('C2', 'G1'),
  heartbeat('Ab1', 'Eb2'),
  heartbeat('Eb2', 'Bb1'),
  heartbeat('Bb1', 'F2'),
  racing('Ab1', 'Eb2'),
  racing('Bb1', 'F2'),
  racing('C2', 'G1'),
  racing('G1', 'D2'),
);

const QUIET = '. . . . . . . . . . . . . . . .';
/** A ping on the last beat, where the motif's bars end in rests. */
const PING = '. . . . . . . . . . . . C6 - - -';
const HUM = 'G4 - - - - - - - - - - - - - - -';
const HUM_PING = 'G4 - - - - - - - - - - - @ping C6 - - - @hum';

const PULSE2 = bars(
  QUIET, PING, QUIET, PING,
  HUM, HUM, HUM, HUM_PING,
  QUIET, PING, QUIET, PING,
  QUIET, QUIET, QUIET, PING,
);

const TICKS = '. . . . tk . . . . . . . tk . . .';
const TICKS_SWEEP = '. . . . tk . . . . . . . tk . sw .';
const TICKS_RACING = 'tk . tk . tk . tk . tk . tk . tk . tk .';

const NOISE = bars(
  repeat(TICKS, 3), TICKS_SWEEP,
  repeat(TICKS, 3), TICKS_SWEEP,
  repeat(TICKS, 3), TICKS_SWEEP,
  repeat(TICKS_RACING, 3), '. . . . tk . . . . . . . sw - - -',
);

const ping: Instrument = { vol: 0.12, duty: 0, decay: 0.22, glideTo: 0.94 };
const hum: Instrument = { vol: 0.09, duty: 0, decay: 1.2, sustain: 0.6, release: 0.05 };

export const vector: Song = {
  name: 'Vector',
  bpm: 100,
  stepsPerBeat: 4,
  loop: true,
  instruments: {
    lead: { vol: 0.26, duty: 0, decay: 0.5, sustain: 0.7, vib: { depth: 6, rate: 4.5, delay: 0.3 } },
    ping,
    hum,
    thud: { vol: 0.4, decay: 0.11, sustain: 0.2, release: 0.03 },
    tk: { vol: 0.09, decay: 0.012, rate: 0.5, noise: 'short' },
    sw: { vol: 0.1, decay: 0.2, sustain: 0.3, rate: 0.12, noise: 'long' },
  },
  tracks: [
    { channel: 'pulse1', instrument: 'lead', steps: LEAD },
    { channel: 'pulse2', instrument: 'ping', steps: PULSE2 },
    { channel: 'tri', instrument: 'thud', steps: BASS },
    { channel: 'noise', instrument: 'tk', steps: NOISE },
  ],
};
