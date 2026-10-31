/** Helpers for driving the pure rules in tests. */
import { STEP_SECONDS } from '../platform/loop';
import { createBot, type Bot, type BotOptions } from './bot';
import { createState, step } from './rules';
import { defaultSave } from './save';
import { NO_INPUT, type GameEvent, type GameState, type InputFrame, type PlateMove, type SaveData } from './types';

export function titleState(save: SaveData = defaultSave(), seed = 7): GameState {
  return createState(save, seed);
}

export function press(partial: Partial<InputFrame>): InputFrame {
  return { ...NO_INPUT, ...partial };
}

/** One plate press. */
export function move(direction: PlateMove): InputFrame {
  return press({ moves: [direction] });
}

/** Starts Game A or B from the title screen. */
export function startGame(state: GameState, mode: 'A' | 'B' = 'A'): GameState {
  return step(state, move(mode === 'A' ? 'left' : 'right'), STEP_SECONDS).state;
}

export interface RunResult {
  state: GameState;
  events: GameEvent[];
}

/** Simulates `seconds` of idle time in fixed steps. */
export function run(state: GameState, seconds: number, input: InputFrame = NO_INPUT): RunResult {
  const events: GameEvent[] = [];
  let s = state;
  const steps = Math.round(seconds / STEP_SECONDS);
  for (let i = 0; i < steps; i++) {
    const r = step(s, i === 0 ? input : NO_INPUT, STEP_SECONDS);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

/** Steps until an event of `type` fires or `maxSeconds` pass. */
export function runUntil(state: GameState, type: GameEvent['type'], maxSeconds = 60): RunResult {
  const events: GameEvent[] = [];
  let s = state;
  const maxSteps = Math.round(maxSeconds / STEP_SECONDS);
  for (let i = 0; i < maxSteps; i++) {
    const r = step(s, NO_INPUT, STEP_SECONDS);
    s = r.state;
    events.push(...r.events);
    if (r.events.some((e) => e.type === type)) return { state: s, events };
  }
  throw new Error(`event "${type}" did not fire within ${maxSeconds}s`);
}

export interface BotRunResult extends RunResult {
  /** Real seconds played. */
  seconds: number;
}

/**
 * Lets a bot play until `stop` returns true or `maxSeconds` pass.
 * Events of every step are collected.
 */
export function playWithBot(
  state: GameState,
  bot: Bot,
  stop: (state: GameState) => boolean,
  maxSeconds: number,
): BotRunResult {
  const events: GameEvent[] = [];
  let s = state;
  const maxSteps = Math.round(maxSeconds / STEP_SECONDS);
  let i = 0;
  for (; i < maxSteps && !stop(s); i++) {
    const r = step(s, bot.input(s), STEP_SECONDS);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events, seconds: i * STEP_SECONDS };
}

/** Plays `seconds` with a bot of the given options. */
export function playBot(state: GameState, options: BotOptions, seconds: number): BotRunResult {
  return playWithBot(state, createBot(options), () => false, seconds);
}

export function types(events: GameEvent[]): GameEvent['type'][] {
  return events.map((e) => e.type);
}
