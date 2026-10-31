import { describe, expect, it } from 'vitest';
import { arcPosition, isRising, rollSpin, SPIN_TURNS, tumbleFrame } from './jump';

describe('arcPosition', () => {
  const from = { x: 0, y: 100 };
  const to = { x: 40, y: 100 };

  it('starts at the origin and ends at the target', () => {
    expect(arcPosition(from, to, 0, 20)).toEqual({ x: 0, y: 100 });
    expect(arcPosition(from, to, 1, 20)).toEqual({ x: 40, y: 100 });
  });

  it('reaches the apex half way', () => {
    expect(arcPosition(from, to, 0.5, 20)).toEqual({ x: 20, y: 80 });
  });

  it('moves x linearly', () => {
    expect(arcPosition(from, to, 0.25, 20).x).toBe(10);
  });

  it('clamps progress outside 0..1', () => {
    expect(arcPosition(from, to, -1, 20)).toEqual(from);
    expect(arcPosition(from, to, 2, 20)).toEqual(to);
  });

  it('knows when it rises', () => {
    expect(isRising(0.2)).toBe(true);
    expect(isRising(0.7)).toBe(false);
  });
});

describe('tumbleFrame', () => {
  it('starts upright and steps 45 degrees at a time for one turn', () => {
    expect(tumbleFrame(0, 1, 8)).toBe(0);
    expect(tumbleFrame(0.124, 1, 8)).toBe(0);
    expect(tumbleFrame(0.125, 1, 8)).toBe(1);
    expect(tumbleFrame(0.5, 1, 8)).toBe(4);
    expect(tumbleFrame(0.99, 1, 8)).toBe(7);
    expect(tumbleFrame(1, 1, 8)).toBe(0);
  });

  it('runs backwards for a negative spin and wraps for more than one turn', () => {
    expect(tumbleFrame(0.125, -1, 8)).toBe(7);
    expect(tumbleFrame(0.5, -1, 8)).toBe(4);
    expect(tumbleFrame(0.5, 1.5, 8)).toBe(6);
    expect(tumbleFrame(0.75, 1.5, 8)).toBe(1);
    expect(tumbleFrame(0.5, 0.5, 8)).toBe(2);
  });

  it('clamps the progress', () => {
    expect(tumbleFrame(-1, 1, 8)).toBe(0);
    expect(tumbleFrame(2, 1.5, 8)).toBe(tumbleFrame(1, 1.5, 8));
  });
});

describe('rollSpin', () => {
  it('rolls half to one and a half turns, either way round, from the seed', () => {
    let rng = { seed: 42 };
    const spins: number[] = [];
    for (let i = 0; i < 200; i++) {
      const r = rollSpin(rng);
      rng = r.rng;
      spins.push(r.value);
    }
    for (const spin of spins) {
      expect(Math.abs(spin)).toBeGreaterThanOrEqual(SPIN_TURNS.min);
      expect(Math.abs(spin)).toBeLessThanOrEqual(SPIN_TURNS.max);
    }
    expect(spins.some((s) => s > 0)).toBe(true);
    expect(spins.some((s) => s < 0)).toBe(true);
    expect(rollSpin({ seed: 42 })).toEqual(rollSpin({ seed: 42 }));
  });
});
