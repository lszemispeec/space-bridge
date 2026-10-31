/** Derives on-screen positions from game state. Pure, used by the renderer. */
import { DROP_HEIGHT, FALL_DEPTH, GROUND_Y, JUMP_HEIGHT, ROCKET_LEDGE, ROCKET_SLOT, ROVER, SLOT_X } from '../config/layout';
import { arcPosition, isRising, type Point } from './jump';
import type { Cosmonaut } from './types';

/**
 * `emerge` then `crouch` play on the ledge outside the hatch. `land` is the
 * squash on the plate; the take-off follows it at once, so there is no crouch
 * on a crater.
 */
export type Pose = 'emerge' | 'crouch' | 'rise' | 'descend' | 'land' | 'crater_fall' | 'board';

export interface CosmonautView {
  /** Feet position, bottom centre of the sprite. */
  pos: Point;
  pose: Pose;
  /** 0..1 progress through the current pose. */
  progress: number;
  /** Signed turns of the tumble over the whole hop. 0 on the ground. */
  spin: number;
  /** True while a flail hop is in the air; the arc shows spread limbs instead of the tumble. */
  flail: boolean;
}

export function slotPoint(slot: number): Point {
  const x = SLOT_X[slot];
  if (x === undefined) throw new Error(`No slot ${slot}`);
  return { x, y: GROUND_Y };
}

export function progressOf(c: Cosmonaut): number {
  return c.duration <= 0 ? 1 : Math.min(1, c.t / c.duration);
}

/**
 * Where a cosmonaut is drawn. A cosmonaut on slot 0 stands on the ledge, not
 * on the ground, and its first arc drops from there to crater 1. The atlas
 * may move the ledge; the default is the layout's.
 */
export function cosmonautView(c: Cosmonaut, ledge: Point = ROCKET_LEDGE): CosmonautView {
  const p = progressOf(c);
  switch (c.state) {
    case 'crouch':
      if (c.slot === ROCKET_SLOT) return { pos: ledge, pose: p < 0.5 ? 'emerge' : 'crouch', progress: p, spin: 0, flail: false };
      return { pos: slotPoint(c.slot), pose: 'land', progress: p, spin: 0, flail: false };
    case 'air':
      return {
        pos:
          c.slot === ROCKET_SLOT
            ? arcPosition(ledge, slotPoint(c.slot + 1), p, DROP_HEIGHT)
            : arcPosition(slotPoint(c.slot), slotPoint(c.slot + 1), p, JUMP_HEIGHT),
        pose: isRising(p) ? 'rise' : 'descend',
        progress: p,
        spin: c.spin,
        flail: c.flail,
      };
    case 'fall': {
      const base = slotPoint(c.slot);
      return { pos: { x: base.x, y: base.y + FALL_DEPTH * p }, pose: 'crater_fall', progress: p, spin: 0, flail: false };
    }
    case 'board': {
      const from = slotPoint(c.slot);
      const toX = ROVER.x + ROVER.w / 2;
      return { pos: { x: from.x + (toX - from.x) * p, y: from.y }, pose: 'board', progress: p, spin: 0, flail: false };
    }
  }
}
