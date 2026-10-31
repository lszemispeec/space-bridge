import { isNoteName, noteToFreq } from './notes';
import type { ChannelId, NoteParams } from './types';

/**
 * An instrument is a set of note parameters plus, for drum-style tokens,
 * the pitch to use when the pattern names the instrument directly.
 */
export interface Instrument extends NoteParams {
  /** Note name used when a pattern token is this instrument's name (tri / pulse drums). */
  pitch?: string;
  /** Playback rate used when a pattern token is this instrument's name (noise drums). */
  rate?: number;
}

export interface Track {
  channel: ChannelId;
  /** Instrument used until a `@name` token switches it. */
  instrument: string;
  /**
   * Whitespace-separated tokens, one per step:
   * `C4` note on, `-` hold, `.` rest, `@name` switch instrument, `|` ignored,
   * any instrument name triggers that instrument at its own pitch or rate.
   */
  steps: string;
}

export interface Song {
  name: string;
  bpm: number;
  /** Steps per beat. 4 means a step is a sixteenth note. */
  stepsPerBeat: number;
  loop: boolean;
  /** Step to jump back to when the song loops. Defaults to 0. */
  loopStart?: number;
  instruments: Record<string, Instrument>;
  tracks: Track[];
}

export interface CompiledNote {
  step: number;
  /** Length in steps, including holds. */
  len: number;
  /** Hz, or playback rate for the noise channel. */
  freq: number;
  params: NoteParams;
}

export interface CompiledTrack {
  channel: ChannelId;
  notes: CompiledNote[];
  /** Index of the first note at or after `loopStart`. */
  loopIndex: number;
}

export interface CompiledSong {
  name: string;
  stepSec: number;
  totalSteps: number;
  loop: boolean;
  loopStart: number;
  tracks: CompiledTrack[];
}

export function tokenize(steps: string): string[] {
  return steps.split(/\s+/).filter((t) => t !== '' && t !== '|');
}

function compileTrack(track: Track, song: Song, loopStart: number): { track: CompiledTrack; steps: number } {
  const notes: CompiledNote[] = [];
  const tokens = tokenize(track.steps);
  let inst = song.instruments[track.instrument];
  if (!inst) throw new Error(`${song.name}: unknown instrument "${track.instrument}"`);
  let open: CompiledNote | null = null;
  let step = 0;

  for (const token of tokens) {
    if (token.startsWith('@')) {
      const next = song.instruments[token.slice(1)];
      if (!next) throw new Error(`${song.name}: unknown instrument "${token}"`);
      inst = next;
      continue;
    }
    if (token === '-') {
      if (open) open.len++;
      step++;
      continue;
    }
    if (token === '.') {
      open = null;
      step++;
      continue;
    }
    let freq: number;
    let params: NoteParams = inst;
    if (isNoteName(token)) {
      freq = track.channel === 'noise' ? (inst.rate ?? 1) : noteToFreq(token);
    } else {
      const drum = song.instruments[token];
      if (!drum) throw new Error(`${song.name}: bad token "${token}" in ${track.channel}`);
      params = drum;
      freq = track.channel === 'noise' ? (drum.rate ?? 1) : noteToFreq(drum.pitch ?? 'C3');
    }
    open = { step, len: 1, freq, params };
    notes.push(open);
    step++;
  }

  let loopIndex = notes.findIndex((n) => n.step >= loopStart);
  if (loopIndex < 0) loopIndex = notes.length;
  return { track: { channel: track.channel, notes, loopIndex }, steps: step };
}

export function compileSong(song: Song): CompiledSong {
  const loopStart = song.loopStart ?? 0;
  const compiled = song.tracks.map((t) => compileTrack(t, song, loopStart));
  const totalSteps = Math.max(...compiled.map((c) => c.steps));
  for (const c of compiled) {
    if (c.steps !== totalSteps) {
      throw new Error(`${song.name}: track ${c.track.channel} has ${c.steps} steps, expected ${totalSteps}`);
    }
  }
  return {
    name: song.name,
    stepSec: 60 / song.bpm / song.stepsPerBeat,
    totalSteps,
    loop: song.loop,
    loopStart,
    tracks: compiled.map((c) => c.track),
  };
}

/** Seconds for one pass of the song at its native tempo. */
export function songDuration(song: CompiledSong): number {
  return song.totalSteps * song.stepSec;
}
