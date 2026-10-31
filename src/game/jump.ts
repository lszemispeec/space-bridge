/** Pure arc math for a jump between two ground points, and the tumble on the way. */
import { nextRandom, type Rng } from './rng';

export interface Point {
  x: number;
  y: number;
}

/**
 * Position along a parabolic arc from `from` to `to`.
 * `progress` runs 0..1. `height` is the apex above the straight line.
 */
export function arcPosition(from: Point, to: Point, progress: number, height: number): Point {
  const p = Math.min(1, Math.max(0, progress));
  const x = from.x + (to.x - from.x) * p;
  const lineY = from.y + (to.y - from.y) * p;
  const lift = 4 * height * p * (1 - p);
  return { x, y: lineY - lift };
}

/** True while the jump still rises; false once it falls. */
export function isRising(progress: number): boolean {
  return progress < 0.5;
}

/** Whole turns a cosmonaut tumbles during one hop, before the direction is chosen. */
export const SPIN_TURNS = { min: 0.5, max: 1.5 } as const;

/** A random tumble for one hop: half to one and a half turns, either way round. */
export function rollSpin(rng: Rng): { value: number; rng: Rng } {
  const turns = nextRandom(rng);
  const direction = nextRandom(turns.rng);
  const magnitude = SPIN_TURNS.min + (SPIN_TURNS.max - SPIN_TURNS.min) * turns.value;
  return { value: direction.value < 0.5 ? -magnitude : magnitude, rng: direction.rng };
}

/**
 * Which frame of a `frameCount`-step tumble cycle shows at `progress` 0..1 of
 * a hop that spins `spin` signed turns. Frame 0 is upright at take-off; the
 * index runs forward for a positive spin and backward for a negative one.
 */
export function tumbleFrame(progress: number, spin: number, frameCount: number): number {
  const p = Math.min(1, Math.max(0, progress));
  const steps = Math.trunc(p * spin * frameCount);
  return ((steps % frameCount) + frameCount) % frameCount;
}
