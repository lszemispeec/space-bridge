import { describe, expect, it } from 'vitest';
import { CRATER_SLOTS } from '../config/layout';
import { ACT_SECONDS, createCreatures, creatureAnimation, creatureAt, stepCreatures, type Creature, type CreatureAct, type Creatures, type CreatureScene } from './creatures';

const QUIET: CreatureScene = { plateSlot: 1, nextLandingSlot: null, falls: [] };
const DT = 1 / 60;

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
    const { seen, acts, visits } = play(3, 180, QUIET);
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

  it('cuts a reach short when the plate arrives at that crater', () => {
    let state = withActive(resting(3, 'reach', 0.2, 1.2));
    state = stepCreatures(state, DT, { plateSlot: 3, nextLandingSlot: null, falls: [] });
    expect(state.active?.act).toBe('hide');
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
