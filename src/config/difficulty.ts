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

/**
 * One point of the density ramp. `maxOnScreen` caps the cosmonauts on the
 * road; `spawnGap` is the shortest wait after a spawn before the next one may
 * leave the hatch. Both are soft: the landing scheduler can always delay a
 * spawn further, it never shortens the gap, and the cap only matters when the
 * scheduler would admit more.
 *
 * The gap is tuned together with `timing.jump`: a follower one crater behind
 * lands `gap - (squash + jump)` after its leader. At the top of the ramp the
 * gaps sit inside the window where the scheduler accepts the spawn at once,
 * so the landings are not pushed onto the exact limits of the plate-travel
 * guarantee, and a good player in real time still survives the top of the
 * Game B curve.
 */
export interface DensityPoint {
  score: number;
  maxOnScreen: number;
  spawnGap: number;
}

export interface Density {
  maxOnScreen: number;
  spawnGap: number;
}

export interface ModeConfig {
  /** Piecewise-linear speed over score. Must be sorted by score. */
  curve: readonly SpeedPoint[];
  /** Points for landing on the plate. */
  bouncePoints: number;
  /** Points for boarding the rover. */
  rescuePoints: number;
  /**
   * How crowded the road gets, as a curve over the score. A round starts
   * calm with one or two cosmonauts and fills up to five at the top of the
   * curve. Must be sorted by score; the values clamp outside it.
   */
  density: readonly DensityPoint[];
  /**
   * Added to the spawn gap of the moment, one value picked at random per
   * spawn, so the rhythm of the spawns is not a metronome.
   */
  spawnJitter: readonly number[];
  /** Playback speed of the theme music during a round. 1 is the song's own tempo. */
  musicTempo: number;
}

export interface TimingConfig {
  /** Hatch opening and the scale-in in the hatch mouth before the first jump. */
  emerge: number;
  /**
   * Time in the air for the first arc, from the rocket's hatch down to
   * crater 1. Shorter than a hop between craters, because it starts high.
   */
  drop: number;
  /** Squash on the plate between a landing and the next take-off. */
  squash: number;
  /**
   * Time in the air between two slots. Long on purpose: the IM-09 keeps three
   * or four cosmonauts in tall arcs at once, and the landings only spread out
   * when every hop is long.
   */
  jump: number;
  /**
   * Time in the air for the last leap, from crater 4 into the rover's hatch.
   * Short and low: it needs no plate, and a full arc would look like one more
   * landing to catch.
   */
  hop: number;
  /** The grab into the crater: the art's 660 ms reference sequence. Not scaled. */
  fall: number;
  /** The scale-out into the rover's hatch. */
  board: number;
  /** Freeze after a life is lost. Not scaled. */
  lifeLostPause: number;
  /** Delay before a game over screen accepts input. Not scaled. */
  gameOverLock: number;
}

/**
 * What the player is promised about landings. A spawn is delayed until every
 * pair of consecutive landings on the road keeps these gaps, so a player who
 * reacts within `reactionMargin` and then presses once per `pressTime` never
 * has to be in two places at once.
 *
 * The plate travel budget between two landings `n` craters apart is
 * `squash + reactionMargin + (n - 1) * pressTime`: one reaction, then one
 * press interval for every crater after the first. A human plays in real
 * seconds, so the budget must still be enough at the top of the speed curve.
 * The longest trip is the return from crater 4 to crater 1 (n = 3); the same
 * budget must fit between a spawn and its first landing (`emerge + drop`),
 * because the spawn is the first thing the player can react to.
 */
export interface SchedulerConfig {
  /** Smallest gap between any two landings. */
  minSeparation: number;
  /** Time the plate gets for every press after the first. */
  pressTime: number;
  /** Time the player gets, after a landing or a spawn, before the first press counts. */
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
    emerge: 0.74,
    drop: 2.6,
    squash: 0.12,
    jump: 3.0,
    hop: 1.0,
    fall: 0.66,
    board: 0.5,
    lifeLostPause: 1.2,
    gameOverLock: 1.5,
  },
  scheduler: {
    minSeparation: 0.5,
    pressTime: 0.42,
    /**
     * 0.24 s real at the top of Game B (speed 2.5), one 60 Hz step more than
     * the good player's 0.22 s. At the top of the density ramp the scheduler
     * packs the landings onto this promise, so it must hold in real time there.
     */
    reactionMargin: 0.6,
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
      density: [
        { score: 0, maxOnScreen: 2, spawnGap: 8.0 },
        { score: 100, maxOnScreen: 3, spawnGap: 5.6 },
        { score: 300, maxOnScreen: 4, spawnGap: 4.1 },
        { score: 600, maxOnScreen: 5, spawnGap: 3.0 },
        { score: 1000, maxOnScreen: 5, spawnGap: 2.4 },
      ],
      spawnJitter: [0, 0.3, 0.6],
      musicTempo: 1,
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
      density: [
        { score: 0, maxOnScreen: 2, spawnGap: 7.0 },
        { score: 100, maxOnScreen: 3, spawnGap: 5.2 },
        { score: 300, maxOnScreen: 4, spawnGap: 4.1 },
        { score: 600, maxOnScreen: 5, spawnGap: 3.0 },
        { score: 1000, maxOnScreen: 5, spawnGap: 2.4 },
      ],
      spawnJitter: [0, 0.3, 0.6],
      musicTempo: 1.15,
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

/**
 * The density at a score: the gap interpolates between the points, the cap
 * steps up at each point (it holds the lower value in between). Clamps
 * outside the ramp.
 */
export function densityAt(ramp: readonly DensityPoint[], score: number): Density {
  const first = ramp[0];
  if (!first) return { maxOnScreen: 1, spawnGap: 1 };
  if (score <= first.score) return { maxOnScreen: first.maxOnScreen, spawnGap: first.spawnGap };
  for (let i = 1; i < ramp.length; i++) {
    const a = ramp[i - 1];
    const b = ramp[i];
    if (!a || !b) break;
    if (score < b.score) {
      const t = (score - a.score) / (b.score - a.score);
      return {
        maxOnScreen: Math.min(a.maxOnScreen, b.maxOnScreen),
        spawnGap: a.spawnGap + (b.spawnGap - a.spawnGap) * t,
      };
    }
  }
  const last = ramp[ramp.length - 1] ?? first;
  return { maxOnScreen: last.maxOnScreen, spawnGap: last.spawnGap };
}

/** The score where a curve reaches its top speed. */
export function curveEnd(curve: readonly SpeedPoint[]): number {
  const last = curve[curve.length - 1];
  return last ? last.score : 0;
}
