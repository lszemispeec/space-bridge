/**
 * Audio event API. The game emits these names; the audio engine plays them.
 * See docs/audio-events.md. The engine is `audio` in src/audio/index.ts;
 * `nullAudio` is the silent sink for tests and for an app without audio.
 */
import type { ThemeId } from '../config/themes';

export const AUDIO_EVENTS = [
  'footstep',
  'jump',
  'bounce',
  'plate_move',
  'save',
  'fall',
  'grab',
  'life_lost',
  'unlock',
  'game_over',
] as const;

export type AudioEvent = (typeof AUDIO_EVENTS)[number];

export interface AudioSink {
  /** Plays one sound effect. Safe to call before the audio context exists. */
  play(event: AudioEvent): void;
  /** Starts the looping track of a theme, or stops music with null. */
  music(theme: ThemeId | null): void;
  setMuted(muted: boolean): void;
  /** Call from the first user gesture so the browser allows playback. */
  unlock(): void;
  /**
   * Music speed as a multiplier of the song's own tempo, for example 1.15 in
   * Game B. Optional: an engine without it plays every song as written.
   */
  setTempo?(multiplier: number): void;
  /**
   * The pause menu: freeze the music and schedule nothing until resumed.
   * Optional: an engine without it plays on under the menu.
   */
  setPaused?(paused: boolean): void;
  /** Volume 0..1 of the music or SFX bus. The game save owns the values. Optional. */
  setVolume?(bus: 'music' | 'sfx', value: number): void;
}

export function isAudioEvent(name: string): name is AudioEvent {
  return (AUDIO_EVENTS as readonly string[]).includes(name);
}

export const nullAudio: AudioSink = {
  play: () => undefined,
  music: () => undefined,
  setMuted: () => undefined,
  unlock: () => undefined,
};
