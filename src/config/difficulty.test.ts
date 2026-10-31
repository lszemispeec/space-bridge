import { describe, expect, it } from 'vitest';
import { curveEnd, densityAt, DIFFICULTY, speedAt } from './difficulty';

describe('speedAt', () => {
  const curve = [
    { score: 0, speed: 1 },
    { score: 100, speed: 2 },
  ];

  it('clamps below and above the curve', () => {
    expect(speedAt(curve, -5)).toBe(1);
    expect(speedAt(curve, 500)).toBe(2);
  });

  it('interpolates between points', () => {
    expect(speedAt(curve, 50)).toBe(1.5);
  });

  it('returns 1 for an empty curve', () => {
    expect(speedAt([], 10)).toBe(1);
  });

  it('keeps Game B faster than Game A everywhere', () => {
    for (const score of [0, 50, 100, 300, 600, 1000, 5000]) {
      expect(speedAt(DIFFICULTY.modes.B.curve, score)).toBeGreaterThan(speedAt(DIFFICULTY.modes.A.curve, score));
    }
  });

  it('has sorted curves', () => {
    for (const mode of Object.values(DIFFICULTY.modes)) {
      const scores = mode.curve.map((p) => p.score);
      expect(scores).toEqual([...scores].sort((a, b) => a - b));
    }
  });
});

describe('densityAt', () => {
  const ramp = [
    { score: 0, maxOnScreen: 2, spawnGap: 8 },
    { score: 100, maxOnScreen: 4, spawnGap: 4 },
  ];

  it('clamps below and above the ramp', () => {
    expect(densityAt(ramp, -1)).toEqual({ maxOnScreen: 2, spawnGap: 8 });
    expect(densityAt(ramp, 500)).toEqual({ maxOnScreen: 4, spawnGap: 4 });
  });

  it('interpolates the gap and steps the cap up at each point', () => {
    expect(densityAt(ramp, 50)).toEqual({ maxOnScreen: 2, spawnGap: 6 });
    expect(densityAt(ramp, 99).maxOnScreen).toBe(2);
    expect(densityAt(ramp, 100).maxOnScreen).toBe(4);
  });

  it('ramps every mode from a calm start to five on screen at the top of the curve', () => {
    for (const mode of Object.values(DIFFICULTY.modes)) {
      const scores = mode.density.map((p) => p.score);
      expect(scores).toEqual([...scores].sort((a, b) => a - b));
      expect(densityAt(mode.density, 0).maxOnScreen).toBeLessThanOrEqual(2);
      expect(densityAt(mode.density, curveEnd(mode.curve)).maxOnScreen).toBe(5);
      const gaps = mode.density.map((p) => p.spawnGap);
      expect(gaps).toEqual([...gaps].sort((a, b) => b - a));
    }
  });
});
