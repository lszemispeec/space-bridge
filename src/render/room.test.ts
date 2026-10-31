import { describe, expect, it } from 'vitest';
import polar from '../../public/atlas/polar-signal.json';
import type { Atlas } from './atlas';
import { frameOf } from './sprites';
import { LEVER_PULL_MAX_MS, leverFrame, leverPullMs } from './room';

const atlas = polar as Atlas;

describe('leverFrame', () => {
  it('rests on idle, passes through the intermediate pose and holds the pulled one', () => {
    expect(leverFrame(atlas, 'left', 0, false, 0)).toBe(frameOf(atlas, 'ui.lever.l.idle.0'));
    expect(leverFrame(atlas, 'left', 0.25, false, 0)).toBe(frameOf(atlas, 'ui.lever.l.pull.0'));
    expect(leverFrame(atlas, 'left', 0.5, false, 0)).toBe(frameOf(atlas, 'ui.lever.l.pull.1'));
    expect(leverFrame(atlas, 'right', 1, false, 0)).toBe(frameOf(atlas, 'ui.lever.r.pull.1'));
  });

  it('returns through the intermediate pose, not straight to idle, whatever the idle hold lasts', () => {
    expect(leverFrame(atlas, 'right', 0.9, true, 0)).toBe(frameOf(atlas, 'ui.lever.r.pull.0'));
    expect(leverFrame(atlas, 'right', 0.6, true, 0)).toBe(frameOf(atlas, 'ui.lever.r.pull.0'));
    expect(leverFrame(atlas, 'right', 0.4, true, 0)).toBe(frameOf(atlas, 'ui.lever.r.idle.0'));
    expect(leverFrame(atlas, 'right', 0, true, 0)).toBe(frameOf(atlas, 'ui.lever.r.idle.0'));
  });
});

describe('leverPullMs', () => {
  it('compresses the art pull to the cap, so fast presses still read', () => {
    expect(LEVER_PULL_MAX_MS).toBeLessThanOrEqual(80);
    for (const side of ['left', 'right'] as const) {
      expect(leverPullMs(atlas, side)).toBeLessThanOrEqual(LEVER_PULL_MAX_MS);
      expect(leverPullMs(atlas, side)).toBeGreaterThan(0);
    }
  });
});
