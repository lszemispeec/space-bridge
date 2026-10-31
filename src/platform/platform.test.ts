import { describe, expect, it } from 'vitest';
import { defaultSave } from '../game/save';
import { cssSize, fitScale } from './canvas';
import { sideForPointer } from './input';
import { accumulateSteps, STEP_SECONDS } from './loop';
import { loadSave, memoryStore, writeSave } from './storage';

describe('fitScale', () => {
  it('uses the largest whole multiple that fits', () => {
    expect(fitScale(1920, 1080)).toBe(4);
    expect(fitScale(1280, 960)).toBe(4);
    expect(fitScale(640, 1000)).toBe(2);
    expect(fitScale(1000, 480)).toBe(2);
  });

  it('never goes below 1', () => {
    expect(fitScale(200, 100)).toBe(1);
  });

  it('counts device pixels on high-density screens', () => {
    expect(fitScale(844, 390, 3)).toBe(4);
    expect(fitScale(390, 844, 3)).toBe(3);
    expect(cssSize(4, 3)).toEqual({ w: 1280 / 3, h: 320 });
    expect(cssSize(4, 1)).toEqual({ w: 1280, h: 960 });
  });
});

describe('sideForPointer', () => {
  it('splits the viewport in halves', () => {
    expect(sideForPointer(10, 400)).toBe('left');
    expect(sideForPointer(199, 400)).toBe('left');
    expect(sideForPointer(200, 400)).toBe('right');
  });
});

describe('accumulateSteps', () => {
  it('runs whole steps and keeps the rest', () => {
    const r = accumulateSteps(0, STEP_SECONDS * 2.5, STEP_SECONDS);
    expect(r.steps).toBe(2);
    expect(r.rest).toBeCloseTo(STEP_SECONDS * 0.5);
  });

  it('clamps long frames so the game never spirals', () => {
    expect(accumulateSteps(0, 10, STEP_SECONDS).steps).toBe(15);
  });
});

describe('storage', () => {
  it('round-trips through a store', () => {
    const store = memoryStore();
    const save = defaultSave();
    save.highScores.A = 77;
    writeSave(store, save);
    expect(loadSave(store)).toEqual(save);
  });

  it('falls back to defaults on a broken store', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSave(broken)).toEqual(defaultSave());
    expect(() => {
      writeSave(broken, defaultSave());
    }).not.toThrow();
  });
});
