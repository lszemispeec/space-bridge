import { describe, expect, it } from 'vitest';
import { DIFFICULTY, speedAt } from './difficulty';

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
