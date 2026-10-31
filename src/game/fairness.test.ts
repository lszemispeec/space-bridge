/**
 * Property test: a player who meets the limits in `DIFFICULTY.scheduler`
 * never loses a life, in either mode, across the whole speed curve, whatever
 * the seed. This is the guard against landings the plate cannot reach.
 */
import { describe, expect, it } from 'vitest';
import { curveEnd, DIFFICULTY, type GameMode } from '../config/difficulty';
import { createBot, goodHumanOptions, instantBotOptions, limitBotOptions, type BotOptions } from './bot';
import { defaultSave } from './save';
import { travelTime } from './schedule';
import { playWithBot, startGame, titleState, types } from './testing';

const SEEDS = Array.from({ length: 12 }, (_, i) => 1000 + i * 7919);
const MAX_SECONDS = 900;

function playFullCurve(mode: GameMode, seed: number, options: BotOptions) {
  const target = curveEnd(DIFFICULTY.modes[mode].curve) + 100;
  const start = startGame(titleState(defaultSave(), seed), mode);
  return playWithBot(start, createBot(options), (s) => s.score >= target || s.phase === 'game_over', MAX_SECONDS);
}

describe.each<GameMode>(['A', 'B'])('Game %s is fair', (mode) => {
  it.each(SEEDS)('a player at the scheduler limits never loses a life (seed %i)', (seed) => {
    const r = playFullCurve(mode, seed, limitBotOptions());
    const falls = types(r.events).filter((e) => e === 'fall');
    expect(falls).toHaveLength(0);
    expect(r.state.lives).toBe(DIFFICULTY.lives);
    expect(r.state.score).toBeGreaterThanOrEqual(curveEnd(DIFFICULTY.modes[mode].curve) + 100);
  });

  it('an instant player never loses a life either', () => {
    for (const seed of SEEDS.slice(0, 4)) {
      const r = playFullCurve(mode, seed, instantBotOptions());
      expect(types(r.events)).not.toContain('fall');
    }
  });

  /**
   * The wall Probe found: a good player in real time died on every 4 -> 1
   * return trip once the speed passed 1.85. The budget must hold at the cap.
   */
  it.each(SEEDS.slice(0, 6))('a good player in real time reaches the speed cap (seed %i)', (seed) => {
    const r = playFullCurve(mode, seed, goodHumanOptions());
    expect(types(r.events)).not.toContain('fall');
    expect(r.state.score).toBeGreaterThanOrEqual(curveEnd(DIFFICULTY.modes[mode].curve) + 100);
  });
});

describe('scheduler config', () => {
  const { timing, scheduler } = DIFFICULTY;
  const oneCrater = travelTime({ slot: 1, at: 0 }, { slot: 2, at: 0 }, timing, scheduler);
  const returnTrip = travelTime({ slot: 4, at: 0 }, { slot: 1, at: 0 }, timing, scheduler);

  it('lets one cosmonaut be followed from crater to crater', () => {
    expect(timing.squash + timing.jump).toBeGreaterThanOrEqual(oneCrater);
    expect(timing.squash + timing.jump).toBeGreaterThanOrEqual(scheduler.minSeparation);
  });

  it('gives a spawn the same budget as the return trip, so the plate can come back from crater 4', () => {
    expect(timing.emerge + timing.jump).toBeGreaterThanOrEqual(returnTrip);
  });

  it('keeps the return trip inside a good player\'s reach at the top speed of every mode', () => {
    const good = goodHumanOptions();
    const needed = good.reaction + 2 * good.pressInterval;
    for (const mode of Object.values(DIFFICULTY.modes)) {
      const cap = mode.curve[mode.curve.length - 1]?.speed ?? 1;
      expect(returnTrip / cap).toBeGreaterThan(needed * 1.1);
    }
  });

  it('keeps the squash shorter than the separation so the plate never leaves someone standing', () => {
    expect(timing.squash).toBeLessThan(scheduler.minSeparation);
    expect(timing.squash).toBeLessThan(scheduler.reactionMargin);
  });
});
