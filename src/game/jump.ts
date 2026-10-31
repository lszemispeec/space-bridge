/** Pure arc math for a jump between two ground points. */
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
