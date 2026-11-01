import type { VoiceSet } from './chip';
import type { CompiledSong } from './song';

/**
 * Step sequencer that schedules notes ahead of the audio clock.
 * Call `scheduleUntil(horizon)` regularly from a timer (or once with a far
 * horizon for offline rendering); it schedules every step whose start time
 * is before `horizon` and keeps its own cursor.
 */
export class Sequencer {
  private song: CompiledSong | null = null;
  private cursors: number[] = [];
  private step = 0;
  private nextStepTime = 0;
  private playing = false;
  private paused = false;
  /** Tempo multiplier applied from the next step on. Game B can push this above 1. */
  rate = 1;

  constructor(private readonly voices: VoiceSet) {}

  get isPlaying(): boolean {
    return this.playing;
  }

  get current(): CompiledSong | null {
    return this.song;
  }

  /** True between `pause` and `resume`: the song is kept, nothing is scheduled. */
  get isPaused(): boolean {
    return this.paused;
  }

  play(song: CompiledSong, at: number): void {
    this.song = song;
    this.cursors = song.tracks.map(() => 0);
    this.step = 0;
    this.nextStepTime = at;
    this.playing = true;
    this.paused = false;
  }

  stop(at: number): void {
    this.playing = false;
    this.paused = false;
    this.song = null;
    this.cutAll(at);
  }

  /**
   * Freezes the song at its next unscheduled step: the voices are cut at
   * `at`, and no more steps are scheduled until `resume`. Up to the
   * look-ahead of already scheduled notes is lost; that is the cut.
   */
  pause(at: number): void {
    if (!this.playing || this.paused) return;
    this.playing = false;
    this.paused = true;
    this.cutAll(at);
  }

  /** Continues a paused song from where it stopped, with its first step at `at`. */
  resume(at: number): void {
    if (!this.paused || !this.song) return;
    this.paused = false;
    this.playing = true;
    this.nextStepTime = at;
  }

  private cutAll(at: number): void {
    for (const track of ['pulse1', 'pulse2', 'tri', 'noise'] as const) this.voices[track].cut(at);
  }

  /** Schedule all steps starting before `horizon`. Returns false once a non-looping song has ended. */
  scheduleUntil(horizon: number): boolean {
    const song = this.song;
    if (!song || !this.playing) return false;
    while (this.nextStepTime < horizon) {
      const stepSec = song.stepSec / this.rate;
      this.scheduleStep(song, this.step, this.nextStepTime, stepSec);
      this.step++;
      this.nextStepTime += stepSec;
      if (this.step >= song.totalSteps) {
        if (!song.loop) {
          this.playing = false;
          return false;
        }
        this.step = song.loopStart;
        song.tracks.forEach((t, i) => (this.cursors[i] = t.loopIndex));
      }
    }
    return true;
  }

  private scheduleStep(song: CompiledSong, step: number, t: number, stepSec: number): void {
    for (let i = 0; i < song.tracks.length; i++) {
      const track = song.tracks[i];
      if (!track) continue;
      const voice = this.voices[track.channel];
      let cursor = this.cursors[i] ?? 0;
      for (let note = track.notes[cursor]; note?.step === step; note = track.notes[cursor]) {
        voice.noteOn(t, note.freq, note.len * stepSec, note.params);
        cursor++;
      }
      this.cursors[i] = cursor;
    }
  }
}
