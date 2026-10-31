import type { AudioSink } from './api';
import { ChipEngine } from './engine';
import { loadSettings, saveSettings } from './settings';
import { SFX } from './sfx';
import { compileSong, type CompiledSong, type Song } from './song';
import { JINGLE_SONGS, THEME_SONGS } from './songs/index';
import type { AudioEvent, AudioSettings, JingleId, ThemeId } from './types';

export type { AudioEvent, AudioSettings, JingleId, ThemeId } from './types';
export { AUDIO_EVENTS, JINGLES } from './types';

const LOOKAHEAD_SEC = 0.15;
const TICK_MS = 40;
const SFX_LATENCY = 0.005;
const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'keydown'] as const;

type SongKey = ThemeId | JingleId;

/**
 * Browser facade and the game's `AudioSink`. The game calls `unlock()` from
 * its first user gesture, as autoplay rules require; `init()` is an optional
 * stand-alone unlock for pages without the game, such as the demo page.
 * Requests made before unlock are remembered (music) or dropped (SFX).
 */
class GameAudio implements AudioSink {
  private ctx: AudioContext | null = null;
  private engine: ChipEngine | null = null;
  private settings: AudioSettings = loadSettings();
  private readonly songs = new Map<SongKey, CompiledSong>();
  /** What is playing now: a theme loop, a jingle, or nothing. */
  private current: SongKey | null = null;
  /** The theme the game asked for. Restored after a jingle and at unlock. */
  private theme: ThemeId | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tempo = 1;
  private installed = false;
  private readonly listeners = new Set<(s: AudioSettings) => void>();

  /** Attach one-time unlock listeners to the window. Safe to call more than once. */
  init(): void {
    if (this.installed || typeof window === 'undefined') return;
    this.installed = true;
    const unlock = (): void => {
      this.unlock();
    };
    for (const ev of UNLOCK_EVENTS) window.addEventListener(ev, unlock, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.resume();
    });
  }

  /** True once the AudioContext exists and is running. */
  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Create or resume the AudioContext. Must run inside a user gesture the first time. */
  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const Ctor = window.AudioContext as typeof AudioContext | undefined;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.engine = new ChipEngine(this.ctx, this.settings);
    }
    this.resume();
    if (this.theme && this.current === null) this.startSong(this.theme, THEME_SONGS[this.theme]);
  }

  /**
   * One sound effect. `game_over` also plays the jingle on the music channels;
   * the theme loop comes back by itself when the jingle ends.
   */
  play(event: AudioEvent): void {
    const engine = this.engine;
    const ctx = this.ctx;
    if (!engine || ctx?.state !== 'running') return;
    engine.playSfx(SFX[event], ctx.currentTime + SFX_LATENCY);
    if (event === 'game_over') this.jingle('gameOver');
  }

  /** Start a theme's loop, or stop music with `null`. Switching to the theme already playing is a no-op. */
  music(theme: ThemeId | null): void {
    this.theme = theme;
    if (!this.engine || !this.ctx) return;
    if (theme === null) {
      this.stopMusic();
      return;
    }
    if (this.current === theme && this.engine.sequencer.isPlaying) return;
    this.startSong(theme, THEME_SONGS[theme]);
  }

  /** Interrupt the music with a one-shot cue. The theme loop resumes when the cue ends. */
  jingle(id: JingleId): void {
    if (!this.engine || !this.ctx) return;
    this.startSong(id, JINGLE_SONGS[id]);
  }

  stopMusic(): void {
    if (!this.engine || !this.ctx) return;
    this.engine.stopMusic(this.ctx.currentTime + SFX_LATENCY);
    this.current = null;
    this.stopTicker();
  }

  /** Music tempo multiplier, for example 1.15 for Game B. Takes effect from the next step. */
  setTempo(multiplier: number): void {
    this.tempo = Math.min(2, Math.max(0.5, multiplier));
    if (this.engine) this.engine.sequencer.rate = this.tempo;
  }

  getSettings(): Readonly<AudioSettings> {
    return this.settings;
  }

  isMuted(): boolean {
    return this.settings.muted;
  }

  /** Applies the flag. The game save owns and persists it. */
  setMuted(muted: boolean): void {
    this.update({ muted });
  }

  toggleMuted(): boolean {
    this.setMuted(!this.settings.muted);
    return this.settings.muted;
  }

  /** Volume 0..1 for one bus. Volumes persist in localStorage. */
  setVolume(bus: 'master' | 'music' | 'sfx', value: number): void {
    this.update({ [bus]: Math.min(1, Math.max(0, value)) });
  }

  /** Observe settings changes, for a mute icon or an options screen. Returns an unsubscribe function. */
  onSettings(listener: (s: AudioSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(patch: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    this.engine?.mixer.apply(this.settings);
    for (const l of this.listeners) l(this.settings);
  }

  private resume(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'running') return;
    void ctx.resume().then(() => {
      if (this.engine?.sequencer.isPlaying) this.startTicker();
    });
  }

  private startSong(key: SongKey, song: Song): void {
    const engine = this.engine;
    const ctx = this.ctx;
    if (!engine || !ctx) return;
    let compiled = this.songs.get(key);
    if (!compiled) {
      compiled = compileSong(song);
      this.songs.set(key, compiled);
    }
    engine.sequencer.rate = this.tempo;
    engine.playSong(compiled, ctx.currentTime + 0.05);
    this.current = key;
    this.startTicker();
    this.tick();
  }

  private startTicker(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      this.tick();
    }, TICK_MS);
  }

  private stopTicker(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private tick(): void {
    const engine = this.engine;
    const ctx = this.ctx;
    if (!engine || !ctx) return;
    if (engine.schedule(ctx.currentTime + LOOKAHEAD_SEC)) return;
    const ended = this.current;
    this.current = null;
    this.stopTicker();
    if (ended !== null && ended !== this.theme && this.theme) this.startSong(this.theme, THEME_SONGS[this.theme]);
  }
}

export const audio = new GameAudio();
