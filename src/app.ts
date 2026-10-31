/**
 * Wires the pure game to the browser: loop, input, rendering, storage, audio.
 */
import { isAudioEvent, nullAudio, type AudioSink } from './audio/api';
import { getTheme, type ThemeId } from './config/themes';
import { createState, step } from './game/rules';
import type { GameEvent, GameState } from './game/types';
import { setupCanvas } from './platform/canvas';
import { createInput } from './platform/input';
import { startLoop } from './platform/loop';
import { browserStore, loadSave, writeSave, type KeyValueStore } from './platform/storage';
import { createRenderer } from './render/draw';
import { loadArt, type Art } from './render/sprites';

export type EventListener = (event: GameEvent, state: GameState) => void;

export interface App {
  /** Subscribes to game events. Returns an unsubscribe function. */
  onEvent(listener: EventListener): () => void;
  getState(): GameState;
  /** Replaces the audio engine. The game forwards sound events to it. */
  setAudio(audio: AudioSink): void;
  stop(): void;
}

export interface AppOptions {
  canvas: HTMLCanvasElement;
  store?: KeyValueStore;
  audio?: AudioSink;
  seed?: number;
}

export function createApp(options: AppOptions): App {
  const store = options.store ?? browserStore();
  const ctx = setupCanvas(options.canvas);
  let audio = options.audio ?? nullAudio;
  let state = createState(loadSave(store), options.seed ?? (Date.now() >>> 0));
  const listeners = new Set<EventListener>();
  const renderer = createRenderer();

  // Every unlocked theme's sheet is loaded once, so a switch on the title
  // screen is instant. The loading screen shows until the sheet is decoded.
  const art = new Map<ThemeId, Art>();
  const loading = new Set<ThemeId>();
  const ensureArt = (id: ThemeId): void => {
    if (art.has(id) || loading.has(id)) return;
    loading.add(id);
    loadArt(getTheme(id))
      .then((loaded) => {
        art.set(id, loaded);
      })
      .catch((error: unknown) => {
        console.error(`Art for theme ${id} did not load`, error);
      })
      .finally(() => loading.delete(id));
  };
  for (const id of state.save.unlocked) ensureArt(id);

  const emit = (event: GameEvent): void => {
    for (const listener of listeners) listener(event, state);
  };

  const input = createInput({
    canvas: options.canvas,
    getPhase: () => state.phase,
    onFirstGesture: () => {
      audio.unlock();
      audio.setMuted(state.save.settings.muted);
      audio.music(getTheme(state.save.settings.theme).id);
    },
  });

  listeners.add((event) => {
    if (event.type === 'save_changed') writeSave(store, state.save);
    if (isAudioEvent(event.type)) audio.play(event.type);
    if (event.type === 'mute_changed') audio.setMuted(event.muted);
    if (event.type === 'theme_changed') {
      ensureArt(event.theme);
      audio.music(event.theme);
    }
    if (event.type === 'unlock') ensureArt(event.theme);
  });

  const stopLoop = startLoop({
    update(dt) {
      const result = step(state, input.consume(), dt);
      state = result.state;
      for (const event of result.events) emit(event);
    },
    render() {
      const theme = state.save.settings.theme;
      renderer.render(ctx, state, input.held(), art.get(theme) ?? null, performance.now());
    },
  });

  return {
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState: () => state,
    setAudio(next) {
      audio = next;
      audio.setMuted(state.save.settings.muted);
    },
    stop() {
      stopLoop();
      input.dispose();
    },
  };
}
