/** Helpers for driving the pure rules in tests. */
import { STEP_SECONDS } from '../platform/loop';
import { createState, step } from './rules';
import { defaultSave } from './save';
import { NO_INPUT, type GameEvent, type GameState, type InputFrame, type SaveData } from './types';

export function titleState(save: SaveData = defaultSave(), seed = 7): GameState {
  return createState(save, seed);
}

export function press(partial: Partial<InputFrame>): InputFrame {
  return { ...NO_INPUT, ...partial };
}

/** Starts Game A or B from the title screen. */
export function startGame(state: GameState, mode: 'A' | 'B' = 'A'): GameState {
  return step(state, press(mode === 'A' ? { left: true } : { right: true }), STEP_SECONDS).state;
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

export function types(events: GameEvent[]): GameEvent['type'][] {
  return events.map((e) => e.type);
}
