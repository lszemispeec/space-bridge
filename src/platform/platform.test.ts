import { describe, expect, it } from 'vitest';
import { defaultSave } from '../game/save';
import { cssSize, fitScale } from './canvas';
import { minHitSize, sideForPointer, tapAction, tapTarget, toGamePoint } from './input';
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

describe('toGamePoint', () => {
  const box = { left: 100, top: 50, width: 960, height: 720 };

  it('maps viewport pixels to game pixels', () => {
    expect(toGamePoint(100, 50, box)).toEqual({ x: 0, y: 0 });
    expect(toGamePoint(580, 410, box)).toEqual({ x: 160, y: 120 });
  });

  it('returns null outside the canvas', () => {
    expect(toGamePoint(50, 60, box)).toBeNull();
    expect(toGamePoint(1060, 60, box)).toBeNull();
    expect(toGamePoint(200, 800, box)).toBeNull();
    expect(toGamePoint(10, 10, { ...box, width: 0 })).toBeNull();
  });
});

describe('tapAction', () => {
  it('hits the theme and mute buttons on the title screen', () => {
    expect(tapAction('title', { x: 110, y: 195 }, 'left')).toBe('theme');
    expect(tapAction('title', { x: 170, y: 195 }, 'right')).toBe('mute');
    expect(tapAction('title', { x: 150, y: 10 }, 'left')).toBe('mute');
  });

  it('hits only the HUD mute button during play', () => {
    expect(tapAction('playing', { x: 150, y: 10 }, 'left')).toBe('mute');
    expect(tapAction('playing', { x: 110, y: 195 }, 'left')).toBe('left');
    expect(tapAction('life_lost', { x: 170, y: 195 }, 'right')).toBe('right');
  });

  it('treats everything else, including the letterbox, as a plate press', () => {
    expect(tapAction('title', { x: 20, y: 120 }, 'left')).toBe('left');
    expect(tapAction('playing', null, 'right')).toBe('right');
  });

  it('grows the hit area around the drawn button without moving its centre', () => {
    // 16 px tall art, 44 px hit area: 14 px above and below.
    expect(tapAction('playing', { x: 150, y: 30 }, 'left', 44)).toBe('mute');
    expect(tapAction('playing', { x: 150, y: 35 }, 'left', 44)).toBe('left');
    expect(tapAction('title', { x: 128, y: 180 }, 'left', 44)).toBe('theme');
    expect(tapAction('title', { x: 128, y: 219 }, 'left', 44)).toBe('theme');
    expect(tapAction('title', { x: 128, y: 221 }, 'left', 44)).toBe('left');
    expect(tapAction('title', { x: 128, y: 180 }, 'left')).toBe('left');
  });

  it('gives an overlap between grown hit areas to the nearest button', () => {
    expect(tapTarget('title', { x: 158, y: 198 }, 80)).toBe('titleTheme');
    expect(tapTarget('title', { x: 162, y: 198 }, 80)).toBe('titleMute');
  });
});

describe('minHitSize', () => {
  it('is 44 game pixels when one game pixel is one CSS pixel', () => {
    expect(minHitSize(320)).toBe(44);
  });

  it('shrinks in game pixels as the canvas grows on the screen', () => {
    expect(minHitSize(1280)).toBe(11);
    expect(minHitSize(320 * (4 / 3))).toBe(33);
  });

  it('is zero without a canvas box', () => {
    expect(minHitSize(0)).toBe(0);
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
