import { ChipWaves, createVoiceSet, type VoiceSet } from './chip';
import { Mixer } from './mixer';
import { Sequencer } from './sequencer';
import type { SfxDef } from './sfx';
import type { CompiledSong } from './song';
import type { AudioSettings } from './types';

/**
 * The console: a mixer, a music voice set driven by the sequencer, and a
 * separate SFX voice set so effects never steal music notes. Works on any
 * `BaseAudioContext`, so the same code renders offline in Node and in the browser.
 */
export class ChipEngine {
  readonly mixer: Mixer;
  readonly musicVoices: VoiceSet;
  readonly sfxVoices: VoiceSet;
  readonly sequencer: Sequencer;

  constructor(
    readonly ctx: BaseAudioContext,
    settings: AudioSettings,
  ) {
    const waves = new ChipWaves(ctx);
    this.mixer = new Mixer(ctx, settings);
    this.musicVoices = createVoiceSet(ctx, waves, this.mixer.music);
    this.sfxVoices = createVoiceSet(ctx, waves, this.mixer.sfx);
    this.sequencer = new Sequencer(this.musicVoices);
  }

  /** Fire an effect at `at`. A new effect cuts whatever the previous one still had scheduled on the same channels. */
  playSfx(def: SfxDef, at: number): void {
    let last: string | null = null;
    for (const part of def.parts) {
      const voice = this.sfxVoices[part.ch];
      if (part.ch !== last) {
        voice.cut(at);
        last = part.ch;
      }
      voice.noteOn(at + part.at, part.freq, part.dur, part.params);
    }
  }

  /** Start a song at `at`. Whatever was playing is cut at `cutAt`, by default at the same moment. */
  playSong(song: CompiledSong, at: number, cutAt = at): void {
    this.sequencer.stop(cutAt);
    this.sequencer.play(song, at);
  }

  stopMusic(at: number): void {
    this.sequencer.stop(at);
  }

  /** Schedule music up to `horizon`. Call from a timer in the browser, or once with a far horizon offline. */
  schedule(horizon: number): boolean {
    return this.sequencer.scheduleUntil(horizon);
  }
}
