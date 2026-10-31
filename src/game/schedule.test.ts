import { describe, expect, it } from 'vitest';
import { DIFFICULTY, type SchedulerConfig, type TimingConfig } from '../config/difficulty';
import { landingsFit, landingsOf, landingsOfNewSpawn, nextLanding, spawnFits, travelTime } from './schedule';
import type { Cosmonaut } from './types';

const timing: TimingConfig = { ...DIFFICULTY.timing, emerge: 0.5, drop: 0.8, squash: 0.1, jump: 1 };
const cfg: SchedulerConfig = { minSeparation: 0.5, pressTime: 0.1, reactionMargin: 0.2 };

function cosmonaut(partial: Partial<Cosmonaut>): Cosmonaut {
  return { id: 1, state: 'crouch', slot: 0, t: 0, duration: timing.emerge, spin: 0, flail: false, ...partial };
}

describe('landingsOf', () => {
  it('lists the four crater landings of a cosmonaut on the ledge, the first one after the drop', () => {
    const landings = landingsOf(cosmonaut({}), timing);
    expect(landings.map((l) => l.slot)).toEqual([1, 2, 3, 4]);
    expect(landings.map((l) => l.at)).toEqual([1.3, 2.4, 3.5, 4.6].map((at) => expect.closeTo(at) as number));
  });

  it('uses the hop time, not the drop, for a cosmonaut that stands on a crater', () => {
    const c = cosmonaut({ slot: 1, t: 0, duration: timing.squash });
    expect(landingsOf(c, timing).map((l) => l.at)).toEqual([0, 1.1, 2.2, 3.3].map((at) => expect.closeTo(at) as number));
  });

  it('starts from the remaining air time', () => {
    const c = cosmonaut({ state: 'air', slot: 2, t: 0.75, duration: 1 });
    expect(landingsOf(c, timing)).toEqual([
      { slot: 3, at: expect.closeTo(0.25) as number },
      { slot: 4, at: expect.closeTo(1.35) as number },
    ]);
  });

  it('keeps the landing a cosmonaut stands on as a past landing', () => {
    const c = cosmonaut({ slot: 4, t: 0.04, duration: timing.squash });
    expect(landingsOf(c, timing)).toEqual([{ slot: 4, at: -0.04 }]);
  });

  it('has no landings for a boarding or fallen cosmonaut', () => {
    expect(landingsOf(cosmonaut({ state: 'board', slot: 5 }), timing)).toEqual([]);
    expect(landingsOf(cosmonaut({ state: 'fall', slot: 2 }), timing)).toEqual([]);
  });

  it('matches a fresh spawn', () => {
    expect(landingsOfNewSpawn(timing)).toEqual(landingsOf(cosmonaut({}), timing));
  });
});

describe('landingsFit', () => {
  it('rejects two landings in the same tick', () => {
    expect(
      landingsFit(
        [
          { slot: 1, at: 2 },
          { slot: 3, at: 2 },
        ],
        timing,
        cfg,
      ),
    ).toBe(false);
  });

  it('rejects landings closer than the minimum separation', () => {
    expect(
      landingsFit(
        [
          { slot: 1, at: 2 },
          { slot: 1, at: 2.4 },
        ],
        timing,
        cfg,
      ),
    ).toBe(false);
  });

  it('rejects a gap too short for the plate to travel', () => {
    const from = { slot: 1, at: 2 };
    const to = { slot: 4, at: 2.45 };
    expect(travelTime(from, to, timing, cfg)).toBeCloseTo(0.5);
    expect(landingsFit([from, to], timing, cfg)).toBe(false);
    expect(landingsFit([from, { slot: 4, at: 2.5 }], timing, cfg)).toBe(true);
  });

  it('counts the travel from a landing that already happened', () => {
    expect(
      landingsFit(
        [
          { slot: 4, at: -0.05 },
          { slot: 1, at: 0.4 },
        ],
        timing,
        cfg,
      ),
    ).toBe(false);
  });

  it('checks the order by time, not the order given', () => {
    const ok = landingsFit(
      [
        { slot: 4, at: 5 },
        { slot: 1, at: 1 },
        { slot: 2, at: 2.5 },
      ],
      timing,
      cfg,
    );
    expect(ok).toBe(true);
  });
});

describe('spawnFits', () => {
  it('always fits on an empty road', () => {
    expect(spawnFits([], timing, cfg)).toBe(true);
  });

  it('refuses a spawn whose landing would clash with a cosmonaut on the road', () => {
    const ahead = cosmonaut({ state: 'air', slot: 1, t: 0.6, duration: 1 });
    expect(landingsOf(ahead, timing).map((l) => l.at)).toEqual([0.4, 1.5, 2.6].map((at) => expect.closeTo(at) as number));
    expect(spawnFits([ahead], timing, cfg)).toBe(false);
  });

  it('accepts a spawn that lands after the road has cleared', () => {
    const ahead = cosmonaut({ state: 'air', slot: 3, t: 0.9, duration: 1 });
    expect(spawnFits([ahead], timing, cfg)).toBe(true);
  });
});

describe('nextLanding', () => {
  it('returns the soonest future landing', () => {
    const a = cosmonaut({ id: 1, state: 'air', slot: 3, t: 0.2, duration: 1 });
    const b = cosmonaut({ id: 2, state: 'air', slot: 1, t: 0.9, duration: 1 });
    expect(nextLanding([a, b], timing)).toEqual({ slot: 2, at: expect.closeTo(0.1) as number });
  });

  it('ignores the landing a cosmonaut already stands on', () => {
    const squashing = cosmonaut({ slot: 2, t: 0.02, duration: timing.squash });
    expect(nextLanding([squashing], timing)).toEqual({ slot: 3, at: expect.closeTo(1.08) as number });
    expect(nextLanding([], timing)).toBeNull();
  });
});
