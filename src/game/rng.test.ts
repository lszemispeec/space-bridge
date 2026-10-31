import { describe, expect, it } from 'vitest';
import { nextRandom, pick } from './rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = nextRandom({ seed: 42 });
    const b = nextRandom({ seed: 42 });
    expect(a.value).toBe(b.value);
    expect(a.rng).toEqual(b.rng);
  });

  it('produces values in [0, 1)', () => {
    let rng = { seed: 1 };
    for (let i = 0; i < 1000; i++) {
      const r = nextRandom(rng);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      rng = r.rng;
    }
  });

  it('picks only items from the list', () => {
    let rng = { seed: 3 };
    for (let i = 0; i < 100; i++) {
      const r = pick(rng, [1, 2, 3]);
      expect([1, 2, 3]).toContain(r.value);
      rng = r.rng;
    }
  });
});
