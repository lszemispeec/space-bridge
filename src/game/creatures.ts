/**
 * The creatures that live in the craters. Cosmetic only: eyes that peek out,
 * blink and look around at random, a tentacle that reaches up now and then,
 * and the grab when a cosmonaut falls in. Pure, with its own seeded RNG and
 * real-second timers; the renderer steps it, the rules never see it.
 */
import { CRATER_SLOTS } from '../config/layout';
import { nextRandom, type Rng } from './rng';

/**
 * `watch` is the rest with the eyes out, between the acts. `grab` follows the
 * fall of a cosmonaut instead of a timer.
 */
export type CreatureAct = 'hidden' | 'peek' | 'watch' | 'blink' | 'look_l' | 'look_r' | 'hide' | 'reach' | 'grab';

export interface Creature {
  slot: number;
  act: CreatureAct;
  /** Real seconds in the current act. */
  t: number;
  duration: number;
}

export interface Creatures {
  creatures: Creature[];
  rng: Rng;
}

/** What is going on above the craters, so a tentacle never gets in the player's way. */
export interface CreatureScene {
  /** The plate covers this crater: no tentacle reaches out of it. */
  plateSlot: number;
  /** The player must bring the plate here next: no tentacle reaches out of it either. */
  nextLandingSlot: number | null;
  /** Craters a cosmonaut is falling into, with the fall progress 0..1. */
  falls: readonly { slot: number; progress: number }[];
}

/** Real seconds of each timed act, as a range the RNG picks from. */
export const ACT_SECONDS: Record<Exclude<CreatureAct, 'grab'>, readonly [number, number]> = {
  hidden: [1.5, 5],
  peek: [0.35, 0.35],
  watch: [0.8, 2.5],
  blink: [0.18, 0.18],
  look_l: [0.6, 1.2],
  look_r: [0.6, 1.2],
  hide: [0.35, 0.35],
  reach: [1.2, 1.2],
};

/** What follows a watch, with the share of each choice. The reach is rare on purpose. */
const AFTER_WATCH: readonly { act: CreatureAct; share: number }[] = [
  { act: 'blink', share: 0.42 },
  { act: 'look_l', share: 0.15 },
  { act: 'look_r', share: 0.15 },
  { act: 'hide', share: 0.2 },
  { act: 'reach', share: 0.08 },
];

/** Rest after a grab, before the eyes come back. */
const REST_AFTER_GRAB = 4;

export function createCreatures(seed: number): Creatures {
  let rng: Rng = { seed };
  const creatures = CRATER_SLOTS.map((slot) => {
    const started = begin(slot, 'hidden', rng);
    rng = started.rng;
    return started.creature;
  });
  return { creatures, rng };
}

function between(rng: Rng, range: readonly [number, number]): { value: number; rng: Rng } {
  const r = nextRandom(rng);
  return { value: range[0] + (range[1] - range[0]) * r.value, rng: r.rng };
}

function begin(slot: number, act: Exclude<CreatureAct, 'grab'>, rng: Rng, t = 0): { creature: Creature; rng: Rng } {
  const d = between(rng, ACT_SECONDS[act]);
  return { creature: { slot, act, t: Math.min(t, d.value), duration: d.value }, rng: d.rng };
}

function mayReach(slot: number, scene: CreatureScene): boolean {
  return slot !== scene.plateSlot && slot !== scene.nextLandingSlot;
}

/** The act after `act` ran out. */
function follow(c: Creature, scene: CreatureScene, rng: Rng): { creature: Creature; rng: Rng } {
  const carry = c.t - c.duration;
  switch (c.act) {
    case 'hidden':
      return begin(c.slot, 'peek', rng, carry);
    case 'peek':
    case 'blink':
    case 'look_l':
    case 'look_r':
      return begin(c.slot, 'watch', rng, carry);
    case 'hide':
      return begin(c.slot, 'hidden', rng, carry);
    case 'reach':
      return begin(c.slot, 'hide', rng, carry);
    case 'grab':
      return begin(c.slot, 'hidden', rng, carry);
    case 'watch': {
      const roll = nextRandom(rng);
      let acc = 0;
      for (const choice of AFTER_WATCH) {
        acc += choice.share;
        if (roll.value >= acc) continue;
        if (choice.act === 'reach' && !mayReach(c.slot, scene)) break;
        if (choice.act !== 'grab') return begin(c.slot, choice.act, roll.rng, carry);
      }
      return begin(c.slot, 'blink', roll.rng, carry);
    }
  }
}

/** Advances every creature by `dt` real seconds. */
export function stepCreatures(state: Creatures, dt: number, scene: CreatureScene): Creatures {
  let rng = state.rng;
  const creatures = state.creatures.map((c): Creature => {
    const fall = scene.falls.find((f) => f.slot === c.slot);
    if (fall) return { slot: c.slot, act: 'grab', t: fall.progress, duration: 1 };

    let next: Creature = c.act === 'grab' ? { slot: c.slot, act: 'hidden', t: 0, duration: REST_AFTER_GRAB } : { ...c, t: c.t + dt };
    if (next.act === 'reach' && !mayReach(c.slot, scene)) {
      const cut = begin(c.slot, 'hide', rng);
      rng = cut.rng;
      next = cut.creature;
    }
    if (next.t < next.duration) return next;
    const after = follow(next, scene, rng);
    rng = after.rng;
    return after.creature;
  });
  return { creatures, rng };
}

export interface CreatureAnimation {
  /** Atlas animation name, from the contract. */
  name: string;
  /** 0..1 through the act. `watch` holds the end of the peek. */
  progress: number;
}

/** The frame a creature shows, or null while it hides. */
export function creatureAnimation(c: Creature): CreatureAnimation | null {
  const p = c.duration <= 0 ? 1 : Math.min(1, c.t / c.duration);
  switch (c.act) {
    case 'hidden':
      return null;
    case 'peek':
      return { name: 'crater.eyes.peek', progress: p };
    case 'watch':
      return { name: 'crater.eyes.peek', progress: 1 };
    case 'blink':
      return { name: 'crater.eyes.blink', progress: p };
    case 'look_l':
      return { name: 'crater.eyes.look.l', progress: p };
    case 'look_r':
      return { name: 'crater.eyes.look.r', progress: p };
    case 'hide':
      return { name: 'crater.eyes.hide', progress: p };
    case 'reach':
      return { name: 'crater.tentacle.reach', progress: p };
    case 'grab':
      return { name: 'crater.tentacle.grab', progress: p };
  }
}
