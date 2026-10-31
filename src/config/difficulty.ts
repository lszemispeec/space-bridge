/**
 * Difficulty is a curve over the score, one per game mode.
 * Game A is the slower mode. Game B starts faster and climbs higher.
 *
 * Every duration below is in "beat seconds": seconds at speed 1.0. The
 * simulation advances all cosmonauts and the spawn clock by `dt * speed`, so
 * one number controls the tempo of the whole game and the gaps between
 * landings keep their proportions when the speed changes. The only real-time
 * values are the ones marked "not scaled".
 */
export type GameMode = 'A' | 'B';

export interface SpeedPoint {
  score: number;
  speed: number;
}

export interface ModeConfig {
  /** Piecewise-linear speed over score. Must be sorted by score. */
  curve: readonly SpeedPoint[];
  /** Points for landing on the plate. */
  bouncePoints: number;
  /** Points for boarding the rover. */
  rescuePoints: number;
  /** Max cosmonauts on the road at the same time. */
  maxOnScreen: number;
  /**
   * Shortest wait after a spawn before the next one may leave the rocket.
   * One value is picked at random per spawn. The landing scheduler can delay
   * the spawn further; it never shortens it.
   */
  spawnGap: readonly number[];
}

export interface TimingConfig {
  /** Wait at the rocket door before the first jump. */
  emerge: number;
  /** Squash on the plate between a landing and the next take-off. */
  squash: number;
  /** Time in the air between two slots. */
  jump: number;
  /** Fall animation into a crater. Not scaled. */
  fall: number;
  /** Walking into the rover. */
  board: number;
  /** Freeze after a life is lost. Not scaled. */
  lifeLostPause: number;
  /** Delay before a game over screen accepts input. Not scaled. */
  gameOverLock: number;
}

/**
 * What the player is promised about landings. A spawn is delayed until every
 * pair of consecutive landings on the road keeps these gaps, so a player who
 * reacts within `reactionMargin` and presses once per `pressTime` never has
 * to be in two places at once.
 */
export interface SchedulerConfig {
  /** Smallest gap between any two landings. */
  minSeparation: number;
  /** Time the plate needs for one press, so for one crater of travel. */
  pressTime: number;
  /** Reaction time the player gets after a take-off before the first press counts. */
  reactionMargin: number;
}

export interface DifficultyConfig {
  lives: number;
  timing: TimingConfig;
  scheduler: SchedulerConfig;
  modes: Record<GameMode, ModeConfig>;
}

export const DIFFICULTY: DifficultyConfig = {
  lives: 3,
  timing: {
    emerge: 0.45,
    squash: 0.12,
    jump: 0.7,
    fall: 0.6,
    board: 0.5,
    lifeLostPause: 1.2,
    gameOverLock: 1.5,
  },
  scheduler: {
    minSeparation: 0.5,
    pressTime: 0.18,
    reactionMargin: 0.34,
  },
  modes: {
    A: {
      curve: [
        { score: 0, speed: 1.0 },
        { score: 100, speed: 1.25 },
        { score: 300, speed: 1.55 },
        { score: 600, speed: 1.85 },
        { score: 1000, speed: 2.1 },
      ],
      bouncePoints: 1,
      rescuePoints: 5,
      maxOnScreen: 3,
      spawnGap: [3.4, 4.0, 4.8],
    },
    B: {
      curve: [
        { score: 0, speed: 1.35 },
        { score: 100, speed: 1.6 },
        { score: 300, speed: 1.9 },
        { score: 600, speed: 2.2 },
        { score: 1000, speed: 2.5 },
      ],
      bouncePoints: 2,
      rescuePoints: 10,
      maxOnScreen: 4,
      spawnGap: [3.4, 3.8, 4.4],
    },
  },
};

/** Interpolates the speed curve at a score. Clamps outside the curve. */
export function speedAt(curve: readonly SpeedPoint[], score: number): number {
  const first = curve[0];
  if (!first) return 1;
  if (score <= first.score) return first.speed;
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    if (!a || !b) break;
    if (score <= b.score) {
      const t = (score - a.score) / (b.score - a.score);
      return a.speed + (b.speed - a.speed) * t;
    }
  }
  const last = curve[curve.length - 1];
  return last ? last.speed : 1;
}

/** The score where a curve reaches its top speed. */
export function curveEnd(curve: readonly SpeedPoint[]): number {
  const last = curve[curve.length - 1];
  return last ? last.score : 0;
}
