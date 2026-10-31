/**
 * Wires the pure game to the browser: loop, input, rendering, storage, audio.
 */
import { isAudioEvent, nullAudio, type AudioSink } from './audio/api';
import { getTheme } from './config/themes';
import { createState, step } from './game/rules';
import type { GameEvent, GameState } from './game/types';
import { setupCanvas } from './platform/canvas';
import { createInput } from './platform/input';
import { startLoop } from './platform/loop';
import { browserStore, loadSave, writeSave, type KeyValueStore } from './platform/storage';
import { render } from './render/draw';

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
    if (event.type === 'theme_changed') audio.music(event.theme);
  });

  const stopLoop = startLoop({
    update(dt) {
      const result = step(state, input.consume(), dt);
      state = result.state;
      for (const event of result.events) emit(event);
    },
    render() {
      render(ctx, state, input.held());
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
