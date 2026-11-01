/**
 * The creatures that live in the craters. Cosmetic only: one pair of eyes at
 * a time peeks out of a random crater, blinks and looks around, hides again,
 * and now and then a tentacle reaches up from the crater the eyes are in. A
 * cosmonaut that falls in is grabbed by that crater's tentacle, whoever is
 * out. The crater under the bridge plate stays empty: eyes vanish the moment
 * the plate covers them and never come out there. Pure, with its own seeded
 * RNG and real-second timers; the renderer steps it, the rules never see it.
 */
import { CRATER_SLOTS } from '../config/layout';
import { nextRandom, type Rng } from './rng';

/**
 * `watch` is the rest with the eyes out, between the acts. `grab` follows the
 * fall of a cosmonaut instead of a timer.
 */
export type CreatureAct = 'peek' | 'watch' | 'blink' | 'look_l' | 'look_r' | 'hide' | 'reach' | 'grab';

export interface Creature {
  slot: number;
  act: CreatureAct;
  /** Real seconds in the current act. */
  t: number;
  duration: number;
}

export interface Creatures {
  /** The creature that is out, or null while every crater is quiet. */
  active: Creature | null;
  /** Real seconds of quiet left before the next creature comes out. It does not count down while a grab plays. */
  rest: number;
  /** The crater that was out last, so the next pick is another one. */
  lastSlot: number | null;
  /** The grabs in progress, one per crater with a falling cosmonaut. */
  grabs: Creature[];
  rng: Rng;
}

/** What is going on above the craters, so a creature never gets in the player's way. */
export interface CreatureScene {
  /** The plate covers this crater: nothing shows in it, and eyes that are out vanish under the plate. */
  plateSlot: number;
  /** The player must bring the plate here next: no tentacle reaches out of it either. */
  nextLandingSlot: number | null;
  /** Craters a cosmonaut is falling into, with the fall progress 0..1. */
  falls: readonly { slot: number; progress: number }[];
}

/**
 * Real seconds of each timed act, as a range the RNG picks from. The
 * one-shots match the art's reference frame durations; the holds vary.
 * `quiet` is the rest between two appearances, with every crater empty.
 */
export const ACT_SECONDS: Record<Exclude<CreatureAct, 'grab'> | 'quiet', readonly [number, number]> = {
  quiet: [1, 4],
  peek: [0.54, 0.54],
  watch: [0.8, 2.5],
  blink: [0.32, 0.32],
  look_l: [0.6, 1.2],
  look_r: [0.6, 1.2],
  hide: [0.36, 0.36],
  reach: [0.68, 0.68],
};

/** What follows a watch, with the share of each choice. The reach is rare on purpose. */
const AFTER_WATCH: readonly { act: CreatureAct; share: number }[] = [
  { act: 'blink', share: 0.34 },
  { act: 'look_l', share: 0.11 },
  { act: 'look_r', share: 0.11 },
  { act: 'hide', share: 0.36 },
  { act: 'reach', share: 0.08 },
];

/** Quiet after a grab, before the eyes come back somewhere. */
const REST_AFTER_GRAB = 4;

export function createCreatures(seed: number): Creatures {
  const quiet = between({ seed }, ACT_SECONDS.quiet);
  return { active: null, rest: quiet.value, lastSlot: null, grabs: [], rng: quiet.rng };
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

/** A crater other than the last one and not under the plate, from the RNG. */
function pickSlot(lastSlot: number | null, scene: CreatureScene, rng: Rng): { slot: number; rng: Rng } {
  const choices = CRATER_SLOTS.filter((slot) => slot !== lastSlot && slot !== scene.plateSlot);
  const r = nextRandom(rng);
  const slot = choices[Math.min(choices.length - 1, Math.floor(r.value * choices.length))] ?? CRATER_SLOTS[0];
  return { slot, rng: r.rng };
}

/** The quiet after the eyes went in, never shorter than the rest already owed. */
function quietAfter(rest: number, rng: Rng, overrun = 0): { rest: number; rng: Rng } {
  const quiet = between(rng, ACT_SECONDS.quiet);
  return { rest: Math.max(quiet.value, rest) - overrun, rng: quiet.rng };
}

/** The act after `act` ran out, or null when the creature went back in. */
function follow(c: Creature, scene: CreatureScene, rng: Rng): { creature: Creature | null; rng: Rng } {
  const carry = c.t - c.duration;
  switch (c.act) {
    case 'peek':
    case 'blink':
    case 'look_l':
    case 'look_r':
      return begin(c.slot, 'watch', rng, carry);
    case 'hide':
    case 'grab':
      return { creature: null, rng };
    case 'reach':
      return begin(c.slot, 'hide', rng, carry);
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

/** Advances the director by `dt` real seconds. */
export function stepCreatures(state: Creatures, dt: number, scene: CreatureScene): Creatures {
  let rng = state.rng;
  const grabs = scene.falls.map((f): Creature => ({ slot: f.slot, act: 'grab', t: f.progress, duration: 1 }));
  let active = state.active;
  let rest = grabs.length > 0 ? REST_AFTER_GRAB : state.rest;
  let lastSlot = state.lastSlot;

  if (active?.slot === scene.plateSlot) {
    // The plate covers the crater: the eyes are gone at once, with no hide
    // frames, and the crater is only due again after the usual quiet.
    lastSlot = active.slot;
    const quiet = quietAfter(rest, rng);
    rng = quiet.rng;
    rest = quiet.rest;
    active = null;
  } else if (active) {
    // The eyes dive when a cosmonaut falls in anywhere, and when the next
    // landing needs the crater the tentacle is reaching out of.
    const startle = grabs.length > 0 && active.act !== 'hide';
    const cutReach = active.act === 'reach' && !mayReach(active.slot, scene);
    let next: Creature = { ...active, t: active.t + dt };
    if (startle || cutReach) {
      const cut = begin(active.slot, 'hide', rng);
      rng = cut.rng;
      next = cut.creature;
    }
    if (next.t < next.duration) {
      active = next;
    } else {
      const after = follow(next, scene, rng);
      rng = after.rng;
      active = after.creature;
      if (!active) {
        lastSlot = next.slot;
        const quiet = quietAfter(rest, rng, next.t - next.duration);
        rng = quiet.rng;
        rest = quiet.rest;
      }
    }
  } else if (grabs.length === 0) {
    rest -= dt;
    if (rest <= 0) {
      const pick = pickSlot(lastSlot, scene, rng);
      const peek = begin(pick.slot, 'peek', pick.rng, -rest);
      rng = peek.rng;
      active = peek.creature;
      rest = 0;
    }
  }
  return { active, rest, lastSlot, grabs, rng };
}

/** The creature showing in a crater: its grab, else the eyes if they are there, else null. */
export function creatureAt(state: Creatures, slot: number): Creature | null {
  return state.grabs.find((g) => g.slot === slot) ?? (state.active?.slot === slot ? state.active : null);
}

export interface CreatureAnimation {
  /** Atlas animation name, from the contract. */
  name: string;
  /** 0..1 through the act. `watch` holds the end of the peek. */
  progress: number;
}

/** The animation a creature shows for its act. */
export function creatureAnimation(c: Creature): CreatureAnimation {
  const p = c.duration <= 0 ? 1 : Math.min(1, c.t / c.duration);
  switch (c.act) {
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
