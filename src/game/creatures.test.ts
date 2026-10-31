import { describe, expect, it } from 'vitest';
import { CRATER_SLOTS } from '../config/layout';
import { ACT_SECONDS, createCreatures, creatureAnimation, creatureAt, stepCreatures, type Creature, type CreatureAct, type Creatures, type CreatureScene } from './creatures';

const QUIET: CreatureScene = { plateSlot: 1, nextLandingSlot: null, falls: [] };
const DT = 1 / 60;
/** The plate parks on each crater in turn, a few seconds at a time, as in play. */
const plateTour = (t: number): CreatureScene => ({ ...QUIET, plateSlot: CRATER_SLOTS[Math.floor(t / 7) % CRATER_SLOTS.length] ?? 1 });

function play(seed: number, seconds: number, scene: CreatureScene | ((t: number) => CreatureScene)) {
  let state = createCreatures(seed);
  const seen: Record<number, Set<CreatureAct>> = {};
  const acts: { t: number; slot: number | null; act: CreatureAct | 'quiet' }[] = [];
  const visits: number[] = [];
  for (let t = 0; t < seconds; t += DT) {
    const before = state.active;
    state = stepCreatures(state, DT, typeof scene === 'function' ? scene(t) : scene);
    const a = state.active;
    if (a) (seen[a.slot] ??= new Set()).add(a.act);
    if (a && before?.slot !== a.slot) visits.push(a.slot);
    acts.push({ t, slot: a?.slot ?? null, act: a?.act ?? 'quiet' });
  }
  return { state, seen, acts, visits };
}

const resting = (slot: number, act: CreatureAct, t = 0, duration = 2): Creature => ({ slot, act, t, duration });
const withActive = (active: Creature | null, seed = 1): Creatures => ({ active, rest: 0, lastSlot: null, grabs: [], rng: { seed } });

describe('crater creatures', () => {
  it('starts quiet, with no eyes out', () => {
    const state = createCreatures(1);
    expect(state.active).toBeNull();
    expect(state.rest).toBeGreaterThan(0);
    for (const slot of CRATER_SLOTS) expect(creatureAt(state, slot)).toBeNull();
  });

  it('shows one pair of eyes at a time, in every crater over a few minutes', () => {
    const { seen, acts, visits } = play(3, 180, plateTour);
    for (const slot of CRATER_SLOTS) {
      for (const act of ['peek', 'watch', 'blink', 'hide'] as const) expect(seen[slot]?.has(act), `${act} in crater ${slot}`).toBe(true);
    }
    const everywhere = new Set(Object.values(seen).flatMap((s) => [...s]));
    expect(everywhere.has('look_l')).toBe(true);
    expect(everywhere.has('look_r')).toBe(true);
    expect(everywhere.has('reach')).toBe(true);
    expect(everywhere.has('grab')).toBe(false);
    expect(visits.length).toBeGreaterThan(15);
    // The eyes go in before they come out elsewhere, and never in the same crater twice in a row.
    for (let i = 1; i < visits.length; i++) expect(visits[i]).not.toBe(visits[i - 1]);
    expect(acts.filter((a) => a.act === 'quiet').length).toBeGreaterThan(0);
  });

  it('picks the next crater from the seeded RNG: deterministic for a seed, different between seeds', () => {
    const a = play(5, 40, QUIET);
    const b = play(5, 40, QUIET);
    const c = play(6, 40, QUIET);
    expect(a.acts).toEqual(b.acts);
    expect(a.visits).not.toEqual(c.visits);
  });

  it('never reaches out of the crater under the plate or the one the plate must go to next', () => {
    const scene: CreatureScene = { plateSlot: 2, nextLandingSlot: 4, falls: [] };
    const { acts } = play(8, 400, scene);
    const reaches = acts.filter((a) => a.act === 'reach');
    expect(reaches.length).toBeGreaterThan(0);
    for (const r of reaches) {
      expect(r.slot).not.toBe(2);
      expect(r.slot).not.toBe(4);
    }
  });

  it('cuts a reach short when the next landing needs that crater', () => {
    let state = withActive(resting(3, 'reach', 0.2, 1.2));
    state = stepCreatures(state, DT, { plateSlot: 1, nextLandingSlot: 3, falls: [] });
    expect(state.active?.act).toBe('hide');
  });

  describe('under the plate', () => {
    const over = (slot: number): CreatureScene => ({ ...QUIET, plateSlot: slot });

    it.each(['peek', 'watch', 'blink', 'look_l', 'look_r', 'hide', 'reach'] as const)('%s eyes vanish at once when the plate arrives', (act) => {
      let state = withActive(resting(3, act, 0.5, 2));
      state = stepCreatures(state, DT, over(3));
      expect(state.active).toBeNull();
      expect(creatureAt(state, 3)).toBeNull();
      expect(state.lastSlot).toBe(3);
      expect(state.rest).toBeGreaterThanOrEqual(ACT_SECONDS.quiet[0]);
    });

    it('vanishing eyes do not cut the rest a grab already owes', () => {
      let state = { ...withActive(resting(3, 'watch')), rest: 3.5 };
      state = stepCreatures(state, DT, over(3));
      expect(state.rest).toBeGreaterThanOrEqual(3.5);
    });

    it('never starts a peek in the crater under the plate', () => {
      let state: Creatures = { ...withActive(null), rest: 0.001, lastSlot: 2 };
      for (let i = 0; i < 20; i++) {
        state = stepCreatures(state, DT, over(3));
        expect(state.active?.slot).not.toBe(3);
        state = { ...state, active: null, rest: 0.001 };
      }
    });

    it('never shows eyes under the plate in a seeded run where the plate tours every crater', () => {
      const { acts, seen } = play(21, 600, plateTour);
      for (const a of acts) {
        if (a.slot !== null) expect(a.slot, `${a.act} at ${a.t.toFixed(2)}s`).not.toBe(plateTour(a.t).plateSlot);
      }
      for (const slot of CRATER_SLOTS) expect(seen[slot]?.has('peek'), `crater ${slot} gets eyes once the plate leaves`).toBe(true);
    });

    it('gives the crater eyes again on the normal schedule after the plate leaves', () => {
      let state = withActive(resting(2, 'watch'));
      state = stepCreatures(state, DT, over(2));
      expect(state.active).toBeNull();
      const rest = state.rest;
      expect(rest).toBeLessThanOrEqual(ACT_SECONDS.quiet[1]);
      let t = 0;
      while (!state.active) {
        state = stepCreatures(state, DT, { ...QUIET, plateSlot: 1, nextLandingSlot: null });
        t += DT;
      }
      expect(t).toBeCloseTo(rest, 1);
      expect(state.active.act).toBe('peek');
      expect(state.active.slot).not.toBe(2);
      let state2: Creatures = { ...state, active: null, rest: 0.001, lastSlot: 1, rng: { seed: 9 } };
      // After a different crater was last, crater 2 is a candidate again.
      const slots = new Set<number>();
      for (let i = 0; i < 40; i++) {
        state2 = stepCreatures(state2, DT, over(4));
        if (state2.active) slots.add(state2.active.slot);
        state2 = { ...state2, active: null, rest: 0.001 };
      }
      expect(slots.has(2)).toBe(true);
      expect(slots.has(4)).toBe(false);
    });

    it('leaves the grab of a falling cosmonaut alone when the plate moves over its crater', () => {
      let state = withActive(null);
      state = stepCreatures(state, DT, { ...QUIET, plateSlot: 2, falls: [{ slot: 2, progress: 0.4 }] });
      expect(creatureAt(state, 2)).toMatchObject({ slot: 2, act: 'grab', t: 0.4 });
      expect(state.active).toBeNull();
    });
  });

  it('grabs a falling cosmonaut with the fall progress, the eyes dive, then everything rests', () => {
    let state = withActive(resting(3, 'watch'));
    state = stepCreatures(state, DT, { ...QUIET, falls: [{ slot: 2, progress: 0.25 }] });
    const grab = creatureAt(state, 2);
    expect(grab).toMatchObject({ slot: 2, act: 'grab', t: 0.25, duration: 1 });
    expect(creatureAnimation(grab ?? resting(0, 'peek'))).toEqual({ name: 'crater.tentacle.grab', progress: 0.25 });
    expect(state.active?.act).toBe('hide');
    expect(creatureAt(state, 3)?.act).toBe('hide');
    state = stepCreatures(state, DT, { ...QUIET, falls: [{ slot: 2, progress: 0.9 }] });
    expect(creatureAnimation(creatureAt(state, 2) ?? resting(0, 'peek')).progress).toBeCloseTo(0.9);
    for (let t = 0; t < 1; t += DT) state = stepCreatures(state, DT, QUIET);
    expect(state.active).toBeNull();
    expect(state.grabs).toEqual([]);
    expect(state.rest).toBeGreaterThan(2);
  });

  it('grabs in the crater the eyes are in without showing both', () => {
    let state = withActive(resting(2, 'watch'));
    state = stepCreatures(state, DT, { ...QUIET, falls: [{ slot: 2, progress: 0.1 }] });
    expect(creatureAt(state, 2)?.act).toBe('grab');
  });

  it('maps every act to a contract animation and holds the open eyes while watching', () => {
    const at = (act: CreatureAct, t: number) => creatureAnimation({ slot: 1, act, t, duration: 1 });
    expect(at('peek', 0.5)).toEqual({ name: 'crater.eyes.peek', progress: 0.5 });
    expect(at('watch', 0.1)).toEqual({ name: 'crater.eyes.peek', progress: 1 });
    expect(at('blink', 0.5).name).toBe('crater.eyes.blink');
    expect(at('look_l', 0.5).name).toBe('crater.eyes.look.l');
    expect(at('look_r', 0.5).name).toBe('crater.eyes.look.r');
    expect(at('hide', 0.5).name).toBe('crater.eyes.hide');
    expect(at('reach', 0.5).name).toBe('crater.tentacle.reach');
    expect(at('reach', 2).progress).toBe(1);
  });

  it('keeps the eyes out about half the time, and the tentacle rare', () => {
    const { acts } = play(11, 300, QUIET);
    const out = acts.filter((a) => a.act !== 'quiet').length;
    const reaching = acts.filter((a) => a.act === 'reach').length;
    expect(out / acts.length).toBeGreaterThan(0.4);
    expect(out / acts.length).toBeLessThan(0.8);
    expect(reaching / acts.length).toBeLessThan(0.05);
    expect(ACT_SECONDS.quiet[0]).toBeGreaterThan(0);
  });
});
