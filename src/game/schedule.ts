/**
 * The landing scheduler. One plate must be under every landing, so the
 * rules only let a cosmonaut leave the rocket when its landings fit between
 * the landings that are already on the road. All times are beat seconds
 * relative to now; negative means the landing already happened.
 */
import type { SchedulerConfig, TimingConfig } from '../config/difficulty';
import { CRATER_SLOTS, ROVER_SLOT } from '../config/layout';
import type { Cosmonaut } from './types';

export interface Landing {
  slot: number;
  /** Beat seconds from now. */
  at: number;
}

function isCrater(slot: number): boolean {
  return (CRATER_SLOTS as readonly number[]).includes(slot);
}

/**
 * Every crater landing of one cosmonaut, from the current state to the rover.
 * The landing it stands on right now is included with a negative time, because
 * the plate is still committed to it until the take-off.
 */
export function landingsOf(c: Cosmonaut, timing: TimingConfig): Landing[] {
  const out: Landing[] = [];
  let slot = c.slot;
  let landingAt: number;
  switch (c.state) {
    case 'crouch':
      if (isCrater(slot)) out.push({ slot, at: -c.t });
      landingAt = c.duration - c.t + timing.jump;
      break;
    case 'air':
      landingAt = c.duration - c.t;
      break;
    case 'fall':
    case 'board':
      return out;
  }
  for (;;) {
    slot += 1;
    if (slot >= ROVER_SLOT) return out;
    out.push({ slot, at: landingAt });
    landingAt += timing.squash + timing.jump;
  }
}

/** The landings of a cosmonaut that leaves the rocket now. */
export function landingsOfNewSpawn(timing: TimingConfig): Landing[] {
  return landingsOf({ id: 0, state: 'crouch', slot: 0, t: 0, duration: timing.emerge }, timing);
}

export function allLandings(cosmonauts: readonly Cosmonaut[], timing: TimingConfig): Landing[] {
  return cosmonauts.flatMap((c) => landingsOf(c, timing));
}

/**
 * Beat seconds the plate needs from one landing to the next: the squash on
 * the first one, one reaction, then one press interval per crater after the
 * first. Two landings on the same slot need no press at all.
 */
export function travelTime(from: Landing, to: Landing, timing: TimingConfig, cfg: SchedulerConfig): number {
  const presses = Math.abs(to.slot - from.slot);
  if (presses === 0) return timing.squash;
  return timing.squash + cfg.reactionMargin + (presses - 1) * cfg.pressTime;
}

/**
 * True when every pair of consecutive landings keeps the minimum separation
 * and leaves the plate enough time to travel between them.
 */
export function landingsFit(landings: readonly Landing[], timing: TimingConfig, cfg: SchedulerConfig): boolean {
  const sorted = [...landings].sort((a, b) => a.at - b.at);
  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1];
    const to = sorted[i];
    if (!from || !to) break;
    const gap = to.at - from.at;
    if (gap < cfg.minSeparation) return false;
    if (gap < travelTime(from, to, timing, cfg)) return false;
  }
  return true;
}

/** True when a cosmonaut that leaves the rocket now would not clash with the road. */
export function spawnFits(cosmonauts: readonly Cosmonaut[], timing: TimingConfig, cfg: SchedulerConfig): boolean {
  return landingsFit([...allLandings(cosmonauts, timing), ...landingsOfNewSpawn(timing)], timing, cfg);
}

/** The next landing the plate has to be under, or null when the road is clear. */
export function nextLanding(cosmonauts: readonly Cosmonaut[], timing: TimingConfig): Landing | null {
  let best: Landing | null = null;
  for (const landing of allLandings(cosmonauts, timing)) {
    if (landing.at < 0) continue;
    if (!best || landing.at < best.at) best = landing;
  }
  return best;
}
