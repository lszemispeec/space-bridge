import { describe, expect, it } from 'vitest';
import { arcPosition, isRising } from './jump';

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
