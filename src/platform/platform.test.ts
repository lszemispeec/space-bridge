import { describe, expect, it } from 'vitest';
import { GUTTER_W, PLAY_W, PLAY_X0, PORTRAIT_STRIP, SCREEN_H, SCREEN_W, TAP_TARGETS } from '../config/layout';
import { defaultSave } from '../game/save';
import { minHitSize, sideForPointer, tapAction, tapTarget, toGamePoint } from './input';
import { accumulateSteps, STEP_SECONDS } from './loop';
import { loadSave, memoryStore, writeSave } from './storage';
import { canvasToFrame, chooseViewport, composition, fitScale, type Viewport } from './viewport';

const landscape = chooseViewport(1280, 960);
const portrait = chooseViewport(390, 844, 3);

describe('fitScale', () => {
  it('uses the largest whole multiple that fits', () => {
    expect(fitScale(1920, 1080, 1, SCREEN_W, SCREEN_H)).toBe(4);
    expect(fitScale(1280, 960, 1, SCREEN_W, SCREEN_H)).toBe(4);
    expect(fitScale(640, 1000, 1, SCREEN_W, SCREEN_H)).toBe(2);
    expect(fitScale(1000, 480, 1, SCREEN_W, SCREEN_H)).toBe(2);
  });

  it('never goes below 1', () => {
    expect(fitScale(200, 100, 1, SCREEN_W, SCREEN_H)).toBe(1);
  });

  it('counts device pixels on high-density screens', () => {
    expect(fitScale(844, 390, 3, SCREEN_W, SCREEN_H)).toBe(4);
    expect(fitScale(390, 844, 3, SCREEN_W, SCREEN_H)).toBe(3);
  });
});

describe('chooseViewport', () => {
  it('keeps the gutters at the sides on desktop and landscape phones', () => {
    expect(landscape).toEqual({ orientation: 'landscape', scale: 4, width: 320, height: 240, cssW: 1280, cssH: 960 });
    expect(chooseViewport(844, 390, 3)).toMatchObject({ orientation: 'landscape', scale: 4, cssW: 1280 / 3, cssH: 320 });
    expect(chooseViewport(1000, 1000)).toMatchObject({ orientation: 'landscape', scale: 3 });
  });

  it('stacks the playfield over the gutters on a portrait phone, scaled to the width', () => {
    expect(portrait).toEqual({
      orientation: 'portrait',
      scale: 4,
      width: PLAY_W,
      height: SCREEN_H + PORTRAIT_STRIP.h,
      cssW: 1024 / 3,
      cssH: (4 * (SCREEN_H + PORTRAIT_STRIP.h)) / 3,
    });
    expect(chooseViewport(430, 932, 3)).toMatchObject({ orientation: 'portrait', scale: 5 });
    expect(chooseViewport(360, 640, 2)).toMatchObject({ orientation: 'portrait', scale: 2 });
  });

  it('never lets the portrait canvas outgrow a short viewport', () => {
    expect(chooseViewport(300, 310, 1)).toMatchObject({ orientation: 'portrait', scale: 1 });
  });
});

describe('composition', () => {
  it('shows the whole frame in landscape', () => {
    expect(composition('landscape')).toEqual([{ sx: 0, sy: 0, w: SCREEN_W, h: SCREEN_H, dx: 0, dy: 0 }]);
  });

  it('puts the playfield on top and both gutter buttons in the strip below it in portrait', () => {
    const blits = composition('portrait');
    expect(blits[0]).toEqual({ sx: PLAY_X0, sy: 0, w: PLAY_W, h: SCREEN_H, dx: 0, dy: 0 });
    const strip = blits.slice(1);
    expect(strip.every((b) => b.dy === SCREEN_H && b.h === PORTRAIT_STRIP.h && b.w === GUTTER_W)).toBe(true);
    // The tiles cover the strip, then the two button slices land on its ends.
    expect(strip.map((b) => b.dx).slice(0, PLAY_W / GUTTER_W)).toEqual([0, 32, 64, 96, 128, 160, 192, 224]);
    expect(strip.at(-2)).toEqual({ sx: 0, sy: PORTRAIT_STRIP.y, w: GUTTER_W, h: PORTRAIT_STRIP.h, dx: 0, dy: SCREEN_H });
    expect(strip.at(-1)).toEqual({ sx: SCREEN_W - GUTTER_W, sy: PORTRAIT_STRIP.y, w: GUTTER_W, h: PORTRAIT_STRIP.h, dx: PLAY_W - GUTTER_W, dy: SCREEN_H });
  });
});

describe('canvasToFrame', () => {
  it('is the identity in landscape', () => {
    expect(canvasToFrame(10, 20, landscape)).toEqual({ x: 10, y: 20 });
    expect(canvasToFrame(320, 20, landscape)).toBeNull();
  });

  it('shifts the playfield back into the frame and drops the strip in portrait', () => {
    expect(canvasToFrame(0, 0, portrait)).toEqual({ x: PLAY_X0, y: 0 });
    expect(canvasToFrame(110, 195, portrait)).toEqual({ x: 142, y: 195 });
    expect(canvasToFrame(10, SCREEN_H, portrait)).toBeNull();
    expect(canvasToFrame(10, SCREEN_H + PORTRAIT_STRIP.h, portrait)).toBeNull();
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
  const three: Viewport = { ...landscape, scale: 3, cssW: 960, cssH: 720 };

  it('maps viewport pixels to game pixels', () => {
    expect(toGamePoint(100, 50, box, three)).toEqual({ x: 0, y: 0 });
    expect(toGamePoint(580, 410, box, three)).toEqual({ x: 160, y: 120 });
  });

  it('returns null outside the canvas', () => {
    expect(toGamePoint(50, 60, box, three)).toBeNull();
    expect(toGamePoint(1060, 60, box, three)).toBeNull();
    expect(toGamePoint(200, 800, box, three)).toBeNull();
    expect(toGamePoint(10, 10, { ...box, width: 0 }, three)).toBeNull();
  });

  it('maps a portrait canvas through its layout', () => {
    const phone = { left: 0, top: 100, width: portrait.cssW, height: portrait.cssH };
    // The title's THEME button, drawn at frame x 100..156, sits at canvas x 68..124.
    const button = TAP_TARGETS.titleTheme;
    const cssPerPx = portrait.cssW / portrait.width;
    const p = toGamePoint((button.x - PLAY_X0 + 2) * cssPerPx, 100 + (button.y + 2) * cssPerPx, phone, portrait);
    expect(p?.x).toBeCloseTo(button.x + 2);
    expect(p?.y).toBeCloseTo(button.y + 2);
    expect(toGamePoint(10, 100 + (SCREEN_H + 10) * cssPerPx, phone, portrait)).toBeNull();
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

  it('swallows a tap in the gap between the title buttons', () => {
    expect(tapAction('title', { x: 160, y: 198 }, 'right')).toBe('none');
    expect(tapAction('title', { x: 160, y: 198 }, 'right', 33)).toBe('none');
    expect(tapAction('title', { x: 160, y: 182 }, 'right', 33)).toBe('none');
    expect(tapAction('title', { x: 160, y: 182 }, 'right')).toBe('right');
    expect(tapAction('title', { x: 98, y: 198 }, 'left', 33)).toBe('left');
    expect(tapAction('title', { x: 222, y: 198 }, 'right', 33)).toBe('right');
    expect(tapAction('playing', { x: 160, y: 198 }, 'right', 33)).toBe('right');
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
    expect(minHitSize(portrait.cssW, portrait.width)).toBe(33);
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
