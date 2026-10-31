/** Derives on-screen positions from game state. Pure, used by the renderer. */
import {
  CRATER_SLOTS,
  DROP_HEIGHT,
  FALL_DEPTH,
  GROUND_Y,
  HOP_HEIGHT,
  JUMP_HEIGHT,
  ROCKET_HATCH,
  ROCKET_SLOT,
  ROVER_HATCH,
  SLOT_X,
} from '../config/layout';
import { arcPosition, isRising, type Point } from './jump';
import type { Cosmonaut } from './types';

/**
 * `emerge` then `crouch` play in the rocket's hatch mouth. `land` is the
 * squash on the plate; the take-off follows it at once, so there is no crouch
 * on a crater. `hop` is the short last leap into the rover: the plain
 * take-off pose for the whole arc, no tumble.
 */
export type Pose = 'emerge' | 'crouch' | 'rise' | 'descend' | 'land' | 'crater_fall' | 'hop' | 'board';

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
  /**
   * Sprite scale, one of `SCALE_STEPS`. A cosmonaut grows out of the rocket's
   * hatch and shrinks into the rover's; everywhere else it is 1.
   */
  scale: number;
}

/** The hatch mouths the cosmonauts leave from and board into. The atlas may move them; the defaults are the layout's. */
export interface Hatches {
  rocket: Point;
  rover: Point;
}

export const DEFAULT_HATCHES: Hatches = { rocket: ROCKET_HATCH, rover: ROVER_HATCH };

/**
 * The scale-in steps, small to full. Whole-pixel friendly, so a 20x22 cell
 * stays crisp with nearest-neighbour scaling: 10x11, 15x17, 20x22.
 */
export const SCALE_STEPS: readonly number[] = [0.5, 0.75, 1];

/** The scale at `progress` 0..1 of a scale-in: each step holds for an equal share. */
export function scaleIn(progress: number): number {
  const i = Math.min(SCALE_STEPS.length - 1, Math.max(0, Math.floor(progress * SCALE_STEPS.length)));
  return SCALE_STEPS[i] ?? 1;
}

/** The scale at `progress` 0..1 of a scale-out: the scale-in in reverse. */
export function scaleOut(progress: number): number {
  return scaleIn(1 - Math.min(1, Math.max(0, progress)) - 1e-9);
}

const LAST_CRATER = CRATER_SLOTS[CRATER_SLOTS.length - 1] ?? ROCKET_SLOT;

export function slotPoint(slot: number): Point {
  const x = SLOT_X[slot];
  if (x === undefined) throw new Error(`No slot ${slot}`);
  return { x, y: GROUND_Y };
}

export function progressOf(c: Cosmonaut): number {
  return c.duration <= 0 ? 1 : Math.min(1, c.t / c.duration);
}

/**
 * Where a cosmonaut is drawn. A cosmonaut on slot 0 stands in the rocket's
 * hatch mouth, high on the hull, growing from half size to full over the
 * emerge and the crouch; its first arc drops from there to crater 1. The last
 * hop is a low leap from crater 4 into the rover's hatch, where the cosmonaut
 * shrinks away while boarding. The atlas may move both hatches.
 */
export function cosmonautView(c: Cosmonaut, hatches: Hatches = DEFAULT_HATCHES): CosmonautView {
  const p = progressOf(c);
  const still = { progress: p, spin: 0, flail: false, scale: 1 };
  switch (c.state) {
    case 'crouch':
      if (c.slot === ROCKET_SLOT) return { ...still, pos: hatches.rocket, pose: p < 0.5 ? 'emerge' : 'crouch', scale: scaleIn(p) };
      return { ...still, pos: slotPoint(c.slot), pose: 'land' };
    case 'air':
      if (c.slot === LAST_CRATER) return { ...still, pos: arcPosition(slotPoint(c.slot), hatches.rover, p, HOP_HEIGHT), pose: 'hop' };
      return {
        pos:
          c.slot === ROCKET_SLOT
            ? arcPosition(hatches.rocket, slotPoint(c.slot + 1), p, DROP_HEIGHT)
            : arcPosition(slotPoint(c.slot), slotPoint(c.slot + 1), p, JUMP_HEIGHT),
        pose: isRising(p) ? 'rise' : 'descend',
        progress: p,
        spin: c.spin,
        flail: c.flail,
        scale: 1,
      };
    case 'fall': {
      const base = slotPoint(c.slot);
      return { ...still, pos: { x: base.x, y: base.y + FALL_DEPTH * p }, pose: 'crater_fall' };
    }
    case 'board':
      return { ...still, pos: hatches.rover, pose: 'board', scale: scaleOut(p) };
  }
}
