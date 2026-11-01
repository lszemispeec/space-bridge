/**
 * Wires the pure game to the browser: loop, input, rendering, storage, audio,
 * and the pause menu, which is the shell's: the menu model turns keys and
 * taps into commands for the rules.
 */
import { isAudioEvent, nullAudio, type AudioSink } from './audio/api';
import { getTheme, type ThemeId } from './config/themes';
import { MENU_CLOSED, menuStep, menuTapAt, menuRows, type MenuCaps, type MenuState } from './game/menu';
import { createState, musicTempo, step } from './game/rules';
import type { GameCommand, GameEvent, GameState } from './game/types';
import { setupScreen } from './platform/canvas';
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
  /** What the shell offers in the menu: whether the display presets are available. */
  getCaps(): MenuCaps;
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
  const screen = setupScreen(options.canvas);
  let audio = options.audio ?? nullAudio;
  let state = createState(loadSave(store), options.seed ?? (Date.now() >>> 0));
  const listeners = new Set<EventListener>();
  const renderer = createRenderer();
  let menu: MenuState = MENU_CLOSED;
  const caps: MenuCaps = { shaders: screen.shaders() };
  /** Commands queued by the shell itself, such as the hidden-tab pause. */
  let pending: GameCommand[] = [];

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

  const applyVolumes = (): void => {
    audio.setVolume?.('music', state.save.settings.music);
    audio.setVolume?.('sfx', state.save.settings.sfx);
  };

  const input = createInput({
    getBox: () => screen.box(),
    getViewport: () => screen.viewport(),
    getPhase: () => state.phase,
    getPaused: () => state.paused,
    onFirstGesture: () => {
      audio.unlock();
      audio.setMuted(state.save.settings.muted);
      applyVolumes();
      audio.music(getTheme(state.save.settings.theme).id);
    },
  });

  listeners.add((event) => {
    if (event.type === 'save_changed') writeSave(store, state.save);
    if (isAudioEvent(event.type)) audio.play(event.type);
    if (event.type === 'mute_changed') audio.setMuted(event.muted);
    if (event.type === 'volume_changed') audio.setVolume?.(event.bus, event.value);
    if (event.type === 'shader_changed') screen.setShader(event.preset);
    if (event.type === 'pause_changed') {
      audio.setPaused?.(event.paused);
      if (event.paused) menu = MENU_CLOSED;
    }
    if (event.type === 'round_start') audio.music(state.save.settings.theme);
    if (event.type === 'theme_changed') {
      ensureArt(event.theme);
      audio.music(event.theme);
    }
    if (event.type === 'unlock') ensureArt(event.theme);
  });

  // A hidden tab pauses the round at once. It does not resume by itself.
  const onVisibility = (): void => {
    if (!document.hidden) return;
    pending.push({ type: 'pause' });
    if (state.phase === 'playing' || state.phase === 'life_lost') audio.setPaused?.(true);
  };
  document.addEventListener('visibilitychange', onVisibility);

  // The music follows the screen: the mode's tempo in a round, the song's own on the title.
  let tempo = 1;
  const followTempo = (): void => {
    const next = musicTempo(state);
    if (next === tempo) return;
    tempo = next;
    audio.setTempo?.(tempo);
  };

  // The scene clock drives every loop the renderer plays on time. It stops with the game.
  let sceneMs = 0;
  let lastFrameMs = performance.now();

  const renderFrame = (): void => {
    const now = performance.now();
    if (!state.paused) sceneMs += now - lastFrameMs;
    lastFrameMs = now;
    const theme = state.save.settings.theme;
    const target = {
      scene: screen.scene,
      room: screen.room,
      viewport: screen.viewport(),
      present: () => {
        screen.present();
      },
    };
    renderer.render(target, state, input.held(), art.get(theme) ?? null, sceneMs, { menu, caps });
    screen.flush(sceneMs);
  };

  const stopLoop = startLoop({
    update(dt) {
      const { frame, menu: menuInputs } = input.consume();
      const commands = pending;
      pending = [];
      let mute = frame.mute;
      if (state.paused) {
        for (const item of menuInputs) {
          const key = typeof item === 'string' ? item : menuTapAt(item.tap, menuRows(state, caps).length);
          if (!key) continue;
          const r = menuStep(menu, key, state, caps);
          menu = r.menu;
          commands.push(...r.commands);
          if (r.mute) mute += 1;
        }
      }
      for (const move of frame.moves) renderer.pull(move);
      const result = step(state, { ...frame, mute, commands }, dt);
      state = result.state;
      for (const event of result.events) emit(event);
      followTempo();
    },
    render: renderFrame,
  });

  // A rotation or a toolbar change re-lays the room out; drawing at once keeps the screen from going blank.
  screen.onResize(renderFrame);

  screen.setShader(state.save.settings.shader);

  return {
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState: () => state,
    setAudio(next) {
      audio = next;
      audio.setMuted(state.save.settings.muted);
      applyVolumes();
      audio.setTempo?.(tempo);
      audio.setPaused?.(state.paused);
    },
    getCaps: () => caps,
    stop() {
      stopLoop();
      input.dispose();
      document.removeEventListener('visibilitychange', onVisibility);
      screen.dispose();
    },
  };
}
