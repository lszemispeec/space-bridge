/**
 * Balance measurement, not a test. Run with `npm run measure`.
 * Prints how far bots of different skill get in Game A and Game B.
 */
import { describe, it } from 'vitest';
import { STEP_SECONDS } from '../platform/loop';
import { curveEnd, DIFFICULTY, type GameMode } from '../config/difficulty';
import { createBot, goodHumanOptions, limitBotOptions, type BotOptions } from './bot';
import { step } from './rules';
import { defaultSave } from './save';
import { playWithBot, startGame, titleState } from './testing';

const PLAYERS: Record<string, BotOptions> = {
  'limit (scheduler promise)': limitBotOptions(),
  'sharp human 0.15s/0.12s': { reaction: 0.15, pressInterval: 0.12, beatSeconds: false },
  'good human 0.22s/0.15s': goodHumanOptions(),
  'good human with jitter 0.25s/0.18s': { reaction: 0.25, pressInterval: 0.18, beatSeconds: false },
  'casual human 0.30s/0.20s': { reaction: 0.3, pressInterval: 0.2, beatSeconds: false },
};
const SEEDS = [11, 22, 33, 44, 55];
const CHECKPOINTS = [60, 120, 180, 240, 300, 360];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

describe.skipIf(import.meta.env.MODE !== 'measure')('balance measurement', () => {
  it.each<GameMode>(['A', 'B'])('Game %s', (mode) => {
    const lines: string[] = [`Game ${mode}: curve ends at ${curveEnd(DIFFICULTY.modes[mode].curve)}`];
    for (const [name, options] of Object.entries(PLAYERS)) {
      const atCheckpoint = CHECKPOINTS.map(() => [] as number[]);
      const finalScores: number[] = [];
      const endTimes: number[] = [];
      for (const seed of SEEDS) {
        let s = startGame(titleState(defaultSave(), seed), mode);
        const bot = createBot(options);
        let elapsed = 0;
        CHECKPOINTS.forEach((checkpoint, i) => {
          if (s.phase === 'game_over') return;
          const r = playWithBot(s, bot, (st) => st.phase === 'game_over', checkpoint - elapsed);
          s = r.state;
          elapsed += r.seconds;
          if (s.phase !== 'game_over') atCheckpoint[i]?.push(s.score);
        });
        finalScores.push(s.score);
        endTimes.push(s.phase === 'game_over' ? elapsed : Infinity);
      }
      const checkpoints = CHECKPOINTS.map((c, i) => {
        const scores = atCheckpoint[i] ?? [];
        return `${c}s=${scores.length === SEEDS.length ? median(scores) : `dead(${scores.length}/${SEEDS.length} alive)`}`;
      }).join(' ');
      const ends = endTimes.every((t) => t === Infinity) ? 'never dies' : `dies at ~${median(endTimes.map((t) => (t === Infinity ? 999 : t))).toFixed(0)}s, final ${median(finalScores)}`;
      lines.push(`  ${name}: ${checkpoints} | ${ends}`);
    }
    console.log(lines.join('\n'));
  });

  /** How crowded the road is along the density ramp, for the good human. */
  it.each<GameMode>(['A', 'B'])('Game %s density', (mode) => {
    const edges = [...DIFFICULTY.modes[mode].density.map((p) => p.score), Infinity];
    const bands = edges.slice(1).map((end, i) => ({ from: edges[i] ?? 0, to: end, onScreen: [] as number[], inAir: [] as number[] }));
    for (const seed of SEEDS) {
      let s = startGame(titleState(defaultSave(), seed), mode);
      const bot = createBot(goodHumanOptions());
      const target = curveEnd(DIFFICULTY.modes[mode].curve) + 200;
      for (let i = 0; i < 60 * 900 && s.score < target && s.phase !== 'game_over'; i++) {
        s = step(s, bot.input(s), STEP_SECONDS).state;
        if (s.phase !== 'playing') continue;
        const band = bands.find((b) => s.score >= b.from && s.score < b.to);
        band?.onScreen.push(s.cosmonauts.length);
        band?.inAir.push(s.cosmonauts.filter((c) => c.state === 'air').length);
      }
    }
    const mean = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : '-');
    const share = (xs: number[]) =>
      [0, 1, 2, 3, 4, 5].map((n) => `${n}:${xs.length ? Math.round((100 * xs.filter((x) => x === n).length) / xs.length) : 0}%`).join(' ');
    const lines = bands.map((b) => `  ${b.from}-${b.to === Infinity ? 'end' : b.to}: on screen ${mean(b.onScreen)} [${share(b.onScreen)}] | in air ${mean(b.inAir)} [${share(b.inAir)}]`);
    console.log([`Game ${mode} density (good human):`, ...lines].join('\n'));
  });
});
