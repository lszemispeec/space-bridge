/**
 * Difficulty is a curve over the score, one per game mode.
 * Game A is the slower mode. Game B starts faster and climbs higher.
 * Every duration below is in seconds at speed 1.0 and is divided by the
 * current speed, so one number controls the tempo of the whole game.
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
  /** How many jump+crouch beats a new cosmonaut waits after the previous one. */
  spawnGapBeats: readonly number[];
}

export interface TimingConfig {
  /** Pause on a slot before the next jump. */
  crouch: number;
  /** Time in the air between two slots. */
  jump: number;
  /** Fall animation into a crater. */
  fall: number;
  /** Walking into the rover. */
  board: number;
  /** Freeze after a life is lost. Not scaled by speed. */
  lifeLostPause: number;
  /** Delay before a game over screen accepts input. Not scaled by speed. */
  gameOverLock: number;
}

export interface DifficultyConfig {
  lives: number;
  timing: TimingConfig;
  modes: Record<GameMode, ModeConfig>;
}

export const DIFFICULTY: DifficultyConfig = {
  lives: 3,
  timing: {
    crouch: 0.45,
    jump: 0.7,
    fall: 0.6,
    board: 0.5,
    lifeLostPause: 1.2,
    gameOverLock: 1.5,
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
      spawnGapBeats: [2, 2, 3, 1, 2],
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
      spawnGapBeats: [1, 2, 1, 1, 2, 1],
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
