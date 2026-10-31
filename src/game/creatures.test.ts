import { describe, expect, it } from 'vitest';
import { CRATER_SLOTS } from '../config/layout';
import { ACT_SECONDS, createCreatures, creatureAnimation, stepCreatures, type CreatureAct, type Creatures, type CreatureScene } from './creatures';

const QUIET: CreatureScene = { plateSlot: 1, nextLandingSlot: null, falls: [] };
const DT = 1 / 60;

function play(seed: number, seconds: number, scene: CreatureScene | ((t: number) => CreatureScene)) {
  let state = createCreatures(seed);
  const seen: Record<number, Set<CreatureAct>> = {};
  const acts: { t: number; slot: number; act: CreatureAct }[] = [];
  for (let t = 0; t < seconds; t += DT) {
    state = stepCreatures(state, DT, typeof scene === 'function' ? scene(t) : scene);
    for (const c of state.creatures) {
      (seen[c.slot] ??= new Set()).add(c.act);
      acts.push({ t, slot: c.slot, act: c.act });
    }
  }
  return { state, seen, acts };
}

describe('crater creatures', () => {
  it('has one creature per crater, all hidden at first', () => {
    const { creatures } = createCreatures(1);
    expect(creatures.map((c) => c.slot)).toEqual([...CRATER_SLOTS]);
    for (const c of creatures) expect(c.act).toBe('hidden');
  });

  it('peeks, blinks, looks both ways and hides again over a minute, in every crater', () => {
    const { seen } = play(3, 90, QUIET);
    const everywhere = new Set<CreatureAct>();
    for (const slot of CRATER_SLOTS) {
      for (const act of ['hidden', 'peek', 'watch', 'blink', 'hide'] as const) expect(seen[slot]?.has(act), `${act} in crater ${slot}`).toBe(true);
      for (const act of seen[slot] ?? []) everywhere.add(act);
    }
    expect(everywhere.has('look_l')).toBe(true);
    expect(everywhere.has('look_r')).toBe(true);
    expect(everywhere.has('reach')).toBe(true);
    expect(everywhere.has('grab')).toBe(false);
  });

  it('is deterministic for a seed and differs between seeds', () => {
    const a = play(5, 20, QUIET).acts;
    const b = play(5, 20, QUIET).acts;
    const c = play(6, 20, QUIET).acts;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('never reaches out of the crater under the plate or the one the plate must go to next', () => {
    const scene: CreatureScene = { plateSlot: 2, nextLandingSlot: 4, falls: [] };
    const { acts } = play(8, 240, scene);
    const reaches = acts.filter((a) => a.act === 'reach');
    expect(reaches.length).toBeGreaterThan(0);
    for (const r of reaches) {
      expect(r.slot).not.toBe(2);
      expect(r.slot).not.toBe(4);
    }
  });

  it('cuts a reach short when the plate arrives at that crater', () => {
    let state: Creatures = { creatures: [{ slot: 3, act: 'reach', t: 0.2, duration: 1.2 }], rng: { seed: 1 } };
    state = stepCreatures(state, DT, { plateSlot: 3, nextLandingSlot: null, falls: [] });
    expect(state.creatures[0]?.act).toBe('hide');
  });

  it('grabs a falling cosmonaut with the fall progress, then rests hidden', () => {
    let state: Creatures = { creatures: [{ slot: 2, act: 'watch', t: 0, duration: 2 }], rng: { seed: 1 } };
    state = stepCreatures(state, DT, { ...QUIET, falls: [{ slot: 2, progress: 0.25 }] });
    const first = state.creatures[0] ?? { slot: 0, act: 'hidden', t: 0, duration: 0 };
    expect(first).toMatchObject({ act: 'grab', t: 0.25, duration: 1 });
    expect(creatureAnimation(first)).toEqual({ name: 'crater.tentacle.grab', progress: 0.25 });
    state = stepCreatures(state, DT, { ...QUIET, falls: [{ slot: 2, progress: 0.9 }] });
    expect(creatureAnimation(state.creatures[0] ?? first)?.progress).toBeCloseTo(0.9);
    state = stepCreatures(state, DT, QUIET);
    expect(state.creatures[0]?.act).toBe('hidden');
    expect(state.creatures[0]?.duration).toBeGreaterThan(ACT_SECONDS.hidden[1] - 1.5);
  });

  it('maps every act to a contract animation and holds the open eyes while watching', () => {
    const at = (act: CreatureAct, t: number) => creatureAnimation({ slot: 1, act, t, duration: 1 });
    expect(at('hidden', 0.5)).toBeNull();
    expect(at('peek', 0.5)).toEqual({ name: 'crater.eyes.peek', progress: 0.5 });
    expect(at('watch', 0.1)).toEqual({ name: 'crater.eyes.peek', progress: 1 });
    expect(at('blink', 0.5)?.name).toBe('crater.eyes.blink');
    expect(at('look_l', 0.5)?.name).toBe('crater.eyes.look.l');
    expect(at('look_r', 0.5)?.name).toBe('crater.eyes.look.r');
    expect(at('hide', 0.5)?.name).toBe('crater.eyes.hide');
    expect(at('reach', 0.5)?.name).toBe('crater.tentacle.reach');
    expect(at('reach', 2)?.progress).toBe(1);
  });

  it('keeps the eyes out most of the time they are up, and the tentacle rare', () => {
    const { acts } = play(11, 300, QUIET);
    const up = acts.filter((a) => a.act !== 'hidden').length;
    const reaching = acts.filter((a) => a.act === 'reach').length;
    expect(up / acts.length).toBeGreaterThan(0.3);
    expect(reaching / acts.length).toBeLessThan(0.08);
  });
});
