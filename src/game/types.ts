import type { GameMode } from '../config/difficulty';
import type { ThemeId } from '../config/themes';
import type { Rng } from './rng';

export type Phase = 'title' | 'playing' | 'life_lost' | 'game_over';

/**
 * `crouch` is every stand on a slot: the emerge wait at the rocket door and
 * the squash on the plate. The slot tells which one it is.
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
  };
}

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
}

export type PlateMove = 'left' | 'right';

/** Buttons that flip a setting on every press. */
export type Toggle = 'theme' | 'mute';

/**
 * One simulation step of player input. `moves` lists every plate press
 * since the last step in press order; each one moves the plate one crater.
 * `theme` and `mute` count presses, so two presses in one step are two
 * toggles. `start` is edge-triggered.
 */
export interface InputFrame {
  moves: readonly PlateMove[];
  /** Enter / space. */
  start: boolean;
  theme: number;
  mute: number;
}

export const NO_INPUT: InputFrame = {
  moves: [],
  start: false,
  theme: 0,
  mute: 0,
};

/** Events emitted by one step. Sound events share names with the audio API. */
export type GameEvent =
  | { type: 'footstep' }
  | { type: 'jump' }
  | { type: 'bounce' }
  | { type: 'plate_move' }
  | { type: 'save' }
  | { type: 'fall' }
  | { type: 'life_lost' }
  | { type: 'unlock'; theme: ThemeId }
  | { type: 'game_over' }
  | { type: 'round_start'; mode: GameMode }
  | { type: 'theme_changed'; theme: ThemeId }
  | { type: 'mute_changed'; muted: boolean }
  | { type: 'save_changed' };

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}
