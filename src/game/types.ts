import type { GameMode } from '../config/difficulty';
import type { ShaderPresetId } from '../config/display';
import type { ThemeId } from '../config/themes';
import type { Rng } from './rng';

export type Phase = 'title' | 'playing' | 'life_lost' | 'game_over';

/**
 * `crouch` is every stand on a slot: the emerge wait on the ledge outside the
 * hatch and the squash on the plate. The slot tells which one it is.
 */
export type CosmonautState = 'crouch' | 'air' | 'fall' | 'board';

export interface Cosmonaut {
  id: number;
  state: CosmonautState;
  /** Slot the cosmonaut stands on, or jumped from while in the air. */
  slot: number;
  /** Beat seconds spent in the current state. Real seconds while falling. */
  t: number;
  /** Length of the current state, in the same unit as `t`. */
  duration: number;
  /**
   * Tumble of the current hop in signed turns: positive spins one way,
   * negative the other, 0 when not in the air. Rolled at every take-off.
   */
  spin: number;
  /** True while the current hop flails with spread limbs instead of tumbling. */
  flail: boolean;
}

export interface HighScores {
  A: number;
  B: number;
}

/** Everything that survives a page reload. */
export interface SaveData {
  version: 1;
  highScores: HighScores;
  unlocked: ThemeId[];
  settings: {
    theme: ThemeId;
    muted: boolean;
    mode: GameMode;
    /** Music volume, 0..1. */
    music: number;
    /** Sound effects volume, 0..1. */
    sfx: number;
    /** The display preset; see `src/config/display.ts`. */
    shader: ShaderPresetId;
  };
}

/** The two volume buses the menu adjusts. */
export type VolumeBus = 'music' | 'sfx';

export interface GameState {
  phase: Phase;
  mode: GameMode;
  score: number;
  lives: number;
  /** Crater slot (1..4) the bridge plate covers. */
  plateSlot: number;
  cosmonauts: Cosmonaut[];
  nextId: number;
  /** Beat seconds until the next cosmonaut may leave the rocket. */
  spawnTimer: number;
  /** Real seconds left in a timed phase (life_lost freeze, game over lock). */
  phaseTimer: number;
  /** Total simulated real seconds in the current round. */
  time: number;
  rng: Rng;
  save: SaveData;
  /** Themes unlocked during the current round, shown on the game over screen. */
  newUnlocks: ThemeId[];
  /**
   * True while the pause menu is open. Nothing moves: no simulation, no
   * timers, no plate. The menu's commands are the only input that counts.
   */
  paused: boolean;
}

export type PlateMove = 'left' | 'right';

/** Buttons that flip a setting on every press. */
export type Toggle = 'theme' | 'mute';

/**
 * What the pause menu asks of the game. `pause` only pauses, and only during
 * a round: it is what a hidden tab sends. The rest come from the menu's rows.
 */
export type GameCommand =
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'quit' }
  | { type: 'theme'; theme: ThemeId }
  | { type: 'volume'; bus: VolumeBus; value: number }
  | { type: 'shader'; preset: ShaderPresetId };

/**
 * One simulation step of player input. `moves` lists every plate press
 * since the last step in press order; each one moves the plate one crater.
 * `theme` and `mute` count presses, so two presses in one step are two
 * toggles. `start` and `pause` are edge-triggered: `pause` is the Esc key,
 * which toggles the pause menu. `commands` are the menu's requests.
 */
export interface InputFrame {
  moves: readonly PlateMove[];
  /** Enter / space. */
  start: boolean;
  theme: number;
  mute: number;
  /** Esc / P / the console's MENU button: toggles the pause menu. */
  pause: boolean;
  commands: readonly GameCommand[];
}

export const NO_INPUT: InputFrame = {
  moves: [],
  start: false,
  theme: 0,
  mute: 0,
  pause: false,
  commands: [],
};

/** Events emitted by one step. Sound events share names with the audio API. */
export type GameEvent =
  | { type: 'footstep' }
  | { type: 'jump' }
  | { type: 'bounce' }
  | { type: 'plate_move' }
  | { type: 'save' }
  | { type: 'fall' }
  | { type: 'grab' }
  | { type: 'life_lost' }
  | { type: 'unlock'; theme: ThemeId }
  | { type: 'game_over' }
  | { type: 'round_start'; mode: GameMode }
  | { type: 'theme_changed'; theme: ThemeId }
  | { type: 'mute_changed'; muted: boolean }
  | { type: 'volume_changed'; bus: VolumeBus; value: number }
  | { type: 'shader_changed'; preset: ShaderPresetId }
  | { type: 'pause_changed'; paused: boolean }
  | { type: 'save_changed' };

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}
