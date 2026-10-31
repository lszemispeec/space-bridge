import type { GameMode } from '../config/difficulty';
import type { ThemeId } from '../config/themes';
import type { Rng } from './rng';

export type Phase = 'title' | 'playing' | 'life_lost' | 'game_over';

export type CosmonautState = 'crouch' | 'air' | 'fall' | 'board';

export interface Cosmonaut {
  id: number;
  state: CosmonautState;
  /** Slot the cosmonaut stands on, or jumped from while in the air. */
  slot: number;
  /** Seconds spent in the current state. */
  t: number;
  /** Length of the current state in seconds. */
  duration: number;
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
  /** Seconds until the next cosmonaut may leave the rocket. */
  spawnTimer: number;
  /** Seconds left in a timed phase (life_lost freeze, game over lock). */
  phaseTimer: number;
  /** Total simulated seconds in the current round. */
  time: number;
  rng: Rng;
  save: SaveData;
  /** Themes unlocked during the current round, shown on the game over screen. */
  newUnlocks: ThemeId[];
}

/** One simulation step of player input. All flags are edge-triggered. */
export interface InputFrame {
  left: boolean;
  right: boolean;
  /** Enter / space / tap in the middle. */
  start: boolean;
  theme: boolean;
  mute: boolean;
}

export const NO_INPUT: InputFrame = {
  left: false,
  right: false,
  start: false,
  theme: false,
  mute: false,
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
