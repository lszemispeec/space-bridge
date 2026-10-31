/**
 * Audio event API. The game emits these names; the audio engine plays them.
 * See docs/audio-events.md. The engine lives in src/audio/ and is built on a
 * separate issue. Until it lands, `nullAudio` keeps the game silent.
 */
import type { ThemeId } from '../config/themes';

export const AUDIO_EVENTS = [
  'footstep',
  'jump',
  'bounce',
  'plate_move',
  'save',
  'fall',
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
