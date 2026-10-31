/** Tiny deterministic PRNG (mulberry32) so the rules stay testable. */
export interface Rng {
  seed: number;
}

export function nextRandom(rng: Rng): { value: number; rng: Rng } {
  const a = (rng.seed + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, rng: { seed: a } };
}

export function pick<T>(rng: Rng, items: readonly T[]): { value: T; rng: Rng } {
  const r = nextRandom(rng);
  const index = Math.min(items.length - 1, Math.floor(r.value * items.length));
  const value = items[index];
  if (value === undefined) throw new Error('pick from empty list');
  return { value, rng: r.rng };
}
