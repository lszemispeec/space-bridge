import type { AudioSink } from './api';
import { ChipEngine } from './engine';
import { loadSettings, saveSettings } from './settings';
import { SFX } from './sfx';
import { compileSong, type CompiledSong, type Song } from './song';
import { JINGLE_SONGS, THEME_SONGS } from './songs/index';
import { JINGLES, type AudioEvent, type AudioSettings, type JingleId, type MusicId } from './types';
import { ACTIVATION_EVENTS, AutoplayUnlock, browserEnv, type UnlockEnv } from './unlock';

export type { AudioEvent, AudioSettings, JingleId, MusicId, ThemeId } from './types';
export { AUDIO_EVENTS, JINGLES } from './types';

const LOOKAHEAD_SEC = 0.15;
const TICK_MS = 40;
const SFX_LATENCY = 0.005;
/** Delay before a new song's first note, so the scheduler is never late for it. */
const SONG_START_SEC = 0.05;

type SongKey = MusicId | JingleId;

/**
 * Browser facade and the game's `AudioSink`. The game calls `unlock()` from
 * its first user gesture, as autoplay rules require; from then on the
 * context keeps itself running (see `unlock.ts`). `init()` is an optional
 * stand-alone unlock for pages without the game, such as the demo page.
 * Requests made before unlock are remembered (music) or dropped (SFX).
 */
export class GameAudio implements AudioSink {
  private ctx: AudioContext | null = null;
  private engine: ChipEngine | null = null;
  private unlocker: AutoplayUnlock | null = null;
  private settings: AudioSettings = loadSettings();
  private readonly songs = new Map<SongKey, CompiledSong>();
  /** What is playing now: a theme loop, a jingle, or nothing. */
  private current: SongKey | null = null;
  /** The theme the game asked for. Restored after a jingle and at unlock. */
  private theme: MusicId | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tempo = 1;
  private paused = false;
  private installed = false;
  private readonly listeners = new Set<(s: AudioSettings) => void>();

  /** `env` and `createContext` stand in for the page in tests. */
  constructor(
    private readonly env: () => UnlockEnv = browserEnv,
    private readonly createContext: () => AudioContext | null = defaultContext,
  ) {}

  /** Create the context from the first gesture on the window. Safe to call more than once. */
  init(): void {
    if (this.installed || typeof window === 'undefined') return;
    this.installed = true;
    const unlock = (): void => {
      this.unlock();
    };
    for (const ev of ACTIVATION_EVENTS) window.addEventListener(ev, unlock, { passive: true, once: true });
  }

  /** True once the AudioContext exists and is running. */
  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /**
   * Create or resume the AudioContext. Call it from a user gesture; when that
   * gesture is not activation yet, as a touch `pointerdown` is not, the
   * unlock finishes on the one that is.
   */
  unlock(): void {
    if (!this.ctx) {
      const ctx = this.createContext();
      if (!ctx) return;
      this.ctx = ctx;
      this.engine = new ChipEngine(ctx, this.settings);
      this.unlocker = new AutoplayUnlock(ctx, this.env(), () => {
        this.onRunning();
      });
    }
    this.unlocker?.gesture();
    if (this.theme && this.current === null) this.startSong(this.theme, THEME_SONGS[this.theme]);
  }

  /**
   * One sound effect, after its own offset. `game_over` also plays the jingle
   * on the music channels; the theme loop comes back by itself when the jingle ends.
   */
  play(event: AudioEvent): void {
    const engine = this.engine;
    const ctx = this.ctx;
    if (!engine || ctx?.state !== 'running') return;
    const def = SFX[event];
    engine.playSfx(def, ctx.currentTime + SFX_LATENCY + def.offset);
    if (event === 'game_over') this.jingle('gameOver');
  }

  /**
   * Start a theme's loop, or stop music with `null`. Switching to the theme
   * already playing is a no-op. While paused the request is remembered and
   * starts at resume.
   */
  music(theme: MusicId | null): void {
    this.theme = theme;
    if (!this.engine || !this.ctx) return;
    if (theme === null) {
      this.stopMusic();
      return;
    }
    if (this.paused) return;
    if (this.current === theme && this.engine.sequencer.isPlaying) return;
    this.startSong(theme, THEME_SONGS[theme]);
  }

  /**
   * The pause menu: the music stops where it is and no more notes are
   * scheduled; it continues from there at resume. A theme chosen while
   * paused starts at resume instead.
   */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    const engine = this.engine;
    const ctx = this.ctx;
    if (!engine || !ctx) return;
    if (paused) {
      this.stopTicker();
      engine.sequencer.pause(ctx.currentTime + SFX_LATENCY);
      return;
    }
    if (this.theme && this.current !== this.theme) {
      this.startSong(this.theme, THEME_SONGS[this.theme]);
    } else if (engine.sequencer.isPaused) {
      engine.sequencer.resume(ctx.currentTime + SONG_START_SEC);
      this.startTicker();
      this.tick();
    }
  }

  isPaused(): boolean {
    return this.paused;
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

  /** Theme loop tempo multiplier, for example 1.15 for Game B. Jingles keep their own tempo. Takes effect from the next step. */
  setTempo(multiplier: number): void {
    this.tempo = Math.min(2, Math.max(0.5, multiplier));
    this.applyTempo();
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

  /** Volume 0..1 for one bus. The game save owns the music and SFX volumes and applies them at start-up. */
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

  /** The context runs again after a lock, an interruption or a hidden tab: the scheduler must follow. */
  private onRunning(): void {
    if (this.engine?.sequencer.isPlaying && !this.paused) this.startTicker();
  }

  private applyTempo(): void {
    if (!this.engine || this.current === null) return;
    this.engine.sequencer.rate = isJingle(this.current) ? 1 : this.tempo;
  }

  /** The old song is cut at once; the new one starts after a short, silent gap. */
  private startSong(key: SongKey, song: Song): void {
    const engine = this.engine;
    const ctx = this.ctx;
    if (!engine || !ctx) return;
    let compiled = this.songs.get(key);
    if (!compiled) {
      compiled = compileSong(song);
      this.songs.set(key, compiled);
    }
    engine.playSong(compiled, ctx.currentTime + SONG_START_SEC, ctx.currentTime + SFX_LATENCY);
    this.current = key;
    this.applyTempo();
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

function isJingle(key: SongKey): key is JingleId {
  return (JINGLES as readonly string[]).includes(key);
}

function defaultContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext as typeof AudioContext | undefined;
  return Ctor ? new Ctor({ latencyHint: 'interactive' }) : null;
}

export const audio = new GameAudio();
