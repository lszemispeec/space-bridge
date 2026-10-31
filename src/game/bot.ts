/**
 * A plate-moving bot for tests and balance measurements. It always heads for
 * the next landing, with a configurable reaction time and press rate, and it
 * waits for the take-off before it leaves a cosmonaut that stands on the plate.
 */
import { DIFFICULTY } from '../config/difficulty';
import { currentSpeed } from './rules';
import { nextLanding } from './schedule';
import { NO_INPUT, type GameState, type InputFrame, type PlateMove } from './types';

export interface BotOptions {
  /** Delay between a new landing target and the first press. */
  reaction: number;
  /** Delay between two presses. 0 means every press lands in the same step. */
  pressInterval: number;
  /** When true the two delays are beat seconds and shrink with the speed. */
  beatSeconds: boolean;
}

export interface Bot {
  /** The input for the step that follows `state`. */
  input(state: GameState): InputFrame;
}

/** A bot at the exact limits the landing scheduler promises the player. */
export function limitBotOptions(): BotOptions {
  return {
    reaction: DIFFICULTY.scheduler.reactionMargin,
    pressInterval: DIFFICULTY.scheduler.pressTime,
    beatSeconds: true,
  };
}

/**
 * A good human in real seconds: the profile the difficulty curve is tuned
 * for. It must survive both modes up to the speed cap.
 */
export function goodHumanOptions(): BotOptions {
  return { reaction: 0.22, pressInterval: 0.15, beatSeconds: false };
}

/** A bot with no reaction time that presses as often as it needs. */
export function instantBotOptions(): BotOptions {
  return { reaction: 0, pressInterval: 0, beatSeconds: false };
}

/** True while a cosmonaut stands on the plate between its landing and take-off. */
export function plateBusy(state: GameState): boolean {
  return state.cosmonauts.some((c) => c.state === 'crouch' && c.slot === state.plateSlot);
}

export function createBot(options: BotOptions): Bot {
  let lastTarget: number | null = null;
  let nextDue = 0;

  const scale = (seconds: number, state: GameState): number =>
    options.beatSeconds ? seconds / currentSpeed(state) : seconds;

  return {
    input(state) {
      if (state.phase !== 'playing' && state.phase !== 'life_lost') return NO_INPUT;
      const now = state.time;
      const landing = nextLanding(state.cosmonauts, DIFFICULTY.timing);
      const target = landing ? landing.slot : null;

      if (target !== lastTarget) {
        lastTarget = target;
        nextDue = now + scale(options.reaction, state);
      }
      if (target === null || target === state.plateSlot) return NO_INPUT;
      if (plateBusy(state)) {
        nextDue = Math.max(nextDue, now);
        return NO_INPUT;
      }

      const moves: PlateMove[] = [];
      const direction: PlateMove = target < state.plateSlot ? 'left' : 'right';
      let plate = state.plateSlot;
      const interval = scale(options.pressInterval, state);
      while (plate !== target && now >= nextDue) {
        moves.push(direction);
        plate += direction === 'left' ? -1 : 1;
        nextDue += interval;
        if (interval <= 0) nextDue = now;
      }
      return moves.length > 0 ? { ...NO_INPUT, moves } : NO_INPUT;
    },
  };
}
