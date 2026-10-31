/** Derives on-screen positions from game state. Pure, used by the renderer. */
import { FALL_DEPTH, GROUND_Y, JUMP_HEIGHT, ROCKET_SLOT, ROVER, SLOT_X } from '../config/layout';
import { arcPosition, isRising, type Point } from './jump';
import type { Cosmonaut } from './types';

/**
 * `emerge` then `crouch` play at the rocket door. `land` is the squash on the
 * plate; the take-off follows it at once, so there is no crouch on a crater.
 */
export type Pose = 'emerge' | 'crouch' | 'rise' | 'descend' | 'land' | 'crater_fall' | 'board';

export interface CosmonautView {
  /** Feet position, bottom centre of the sprite. */
  pos: Point;
  pose: Pose;
  /** 0..1 progress through the current pose. */
  progress: number;
}

export function slotPoint(slot: number): Point {
  const x = SLOT_X[slot];
  if (x === undefined) throw new Error(`No slot ${slot}`);
  return { x, y: GROUND_Y };
}

export function progressOf(c: Cosmonaut): number {
  return c.duration <= 0 ? 1 : Math.min(1, c.t / c.duration);
}

export function cosmonautView(c: Cosmonaut): CosmonautView {
  const p = progressOf(c);
  switch (c.state) {
    case 'crouch':
      if (c.slot === ROCKET_SLOT) return { pos: slotPoint(c.slot), pose: p < 0.5 ? 'emerge' : 'crouch', progress: p };
      return { pos: slotPoint(c.slot), pose: 'land', progress: p };
    case 'air':
      return {
        pos: arcPosition(slotPoint(c.slot), slotPoint(c.slot + 1), p, JUMP_HEIGHT),
        pose: isRising(p) ? 'rise' : 'descend',
        progress: p,
      };
    case 'fall': {
      const base = slotPoint(c.slot);
      return { pos: { x: base.x, y: base.y + FALL_DEPTH * p }, pose: 'crater_fall', progress: p };
    }
    case 'board': {
      const from = slotPoint(c.slot);
      const toX = ROVER.x + ROVER.w / 2;
      return { pos: { x: from.x + (toX - from.x) * p, y: from.y }, pose: 'board', progress: p };
    }
  }
}
