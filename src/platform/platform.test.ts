import { describe, expect, it } from 'vitest';
import { CONSOLE_HUD, PLAY_W, PLAY_X0, PORTRAIT_STRIP, roomLayout, SCREEN_H, SCREEN_W, TAP_TARGETS } from '../config/layout';
import { defaultSave } from '../game/save';
import { minHitSize, sideForPointer, tapAction, tapTarget, toRoomPoint } from './input';
import { accumulateSteps, STEP_SECONDS } from './loop';
import { loadSave, memoryStore, writeSave } from './storage';
import { canvasToFrame, CANVAS_SIZE, chooseViewport, composition, fitScale } from './viewport';

const landscape = chooseViewport(1280, 960);
const portrait = chooseViewport(390, 844, 3);
const ROOM_L = roomLayout('landscape');
const ROOM_P = roomLayout('portrait');
const WIN = ROOM_L.window;

describe('CANVAS_SIZE', () => {
  it('is the operator room: the scene in the window and the console below, plus the lever strip in portrait', () => {
    expect(CANVAS_SIZE.landscape).toEqual({ w: 352, h: 320 });
    expect(CANVAS_SIZE.portrait).toEqual({ w: 288, h: 344 });
    expect(WIN).toEqual({ x: 16, y: 12, w: SCREEN_W, h: SCREEN_H });
    expect(ROOM_P.window).toEqual({ x: 16, y: 12, w: PLAY_W, h: SCREEN_H });
    expect(ROOM_P.strip).toEqual({ x: 16, y: 288, w: PLAY_W, h: PORTRAIT_STRIP.h });
  });
});

describe('fitScale', () => {
  const { w, h } = CANVAS_SIZE.landscape;
  it('uses the largest whole multiple that fits', () => {
    expect(fitScale(1408, 1280, 1, w, h)).toBe(4);
    expect(fitScale(1920, 1080, 1, w, h)).toBe(3);
    expect(fitScale(1280, 960, 1, w, h)).toBe(3);
    expect(fitScale(720, 1000, 1, w, h)).toBe(2);
    expect(fitScale(1000, 660, 1, w, h)).toBe(2);
  });

  it('never goes below 1', () => {
    expect(fitScale(200, 100, 1, w, h)).toBe(1);
  });

  it('counts device pixels on high-density screens', () => {
    // A 390 CSS px tall landscape phone has 1170 device px: 3x of the 320 px room, not 4x.
    expect(fitScale(844, 390, 3, w, h)).toBe(3);
    expect(fitScale(390, 844, 3, CANVAS_SIZE.portrait.w, CANVAS_SIZE.portrait.h)).toBe(4);
  });
});

describe('chooseViewport', () => {
  it('keeps the gutters at the sides on desktop and landscape phones', () => {
    expect(landscape).toEqual({ orientation: 'landscape', scale: 3, width: 352, height: 320, cssW: 1056, cssH: 960 });
    expect(chooseViewport(1408, 1280)).toMatchObject({ orientation: 'landscape', scale: 4, cssW: 1408, cssH: 1280 });
    expect(chooseViewport(844, 390, 3)).toMatchObject({ orientation: 'landscape', scale: 3, cssW: 352, cssH: 320 });
    expect(chooseViewport(1000, 1000)).toMatchObject({ orientation: 'landscape', scale: 2 });
  });

  it('stacks the playfield over the console and the levers on a portrait phone, scaled to the width', () => {
    expect(portrait).toEqual({ orientation: 'portrait', scale: 4, width: 288, height: 344, cssW: 384, cssH: 1376 / 3 });
    expect(chooseViewport(430, 932, 3)).toMatchObject({ orientation: 'portrait', scale: 4 });
    expect(chooseViewport(360, 640, 2)).toMatchObject({ orientation: 'portrait', scale: 2 });
  });

  it('never lets the portrait canvas outgrow a short viewport', () => {
    expect(chooseViewport(300, 310, 1)).toMatchObject({ orientation: 'portrait', scale: 1 });
  });
});

describe('composition', () => {
  it('puts the whole scene in the window in landscape', () => {
    expect(composition('landscape')).toEqual({ sx: 0, sy: 0, w: SCREEN_W, h: SCREEN_H, dx: WIN.x, dy: WIN.y });
  });

  it('puts the playfield in the window in portrait; the room art draws the lever strip', () => {
    expect(composition('portrait')).toEqual({ sx: PLAY_X0, sy: 0, w: PLAY_W, h: SCREEN_H, dx: 16, dy: 12 });
  });
});

describe('canvasToFrame', () => {
  it('shifts the window back to the scene in landscape and drops the frame and the console', () => {
    expect(canvasToFrame(WIN.x, WIN.y, landscape)).toEqual({ x: 0, y: 0 });
    expect(canvasToFrame(WIN.x + 10, WIN.y + 20, landscape)).toEqual({ x: 10, y: 20 });
    expect(canvasToFrame(WIN.x + SCREEN_W - 1, WIN.y + 100, landscape)).toEqual({ x: 319, y: 100 });
    expect(canvasToFrame(10, 20, landscape)).toBeNull();
    expect(canvasToFrame(WIN.x + SCREEN_W, WIN.y + 100, landscape)).toBeNull();
    expect(canvasToFrame(100, ROOM_L.console.y, landscape)).toBeNull();
    expect(canvasToFrame(352, 20, landscape)).toBeNull();
  });

  it('shifts the playfield back into the scene and drops the console and the strip in portrait', () => {
    expect(canvasToFrame(16, 12, portrait)).toEqual({ x: PLAY_X0, y: 0 });
    expect(canvasToFrame(126, 207, portrait)).toEqual({ x: 142, y: 195 });
    expect(canvasToFrame(100, ROOM_P.console.y, portrait)).toBeNull();
    expect(canvasToFrame(10, ROOM_P.strip?.y ?? 0, portrait)).toBeNull();
    expect(canvasToFrame(10, ROOM_P.h, portrait)).toBeNull();
  });
});

describe('sideForPointer', () => {
  it('splits the viewport in halves', () => {
    expect(sideForPointer(10, 400)).toBe('left');
    expect(sideForPointer(199, 400)).toBe('left');
    expect(sideForPointer(200, 400)).toBe('right');
  });
});

describe('toRoomPoint', () => {
  const box = { left: 100, top: 50, width: 1056, height: 960 };

  it('maps page pixels to room pixels', () => {
    expect(toRoomPoint(100, 50, box, landscape)).toEqual({ x: 0, y: 0 });
    expect(toRoomPoint(580, 410, box, landscape)).toEqual({ x: 160, y: 120 });
  });

  it('returns null outside the canvas', () => {
    expect(toRoomPoint(50, 60, box, landscape)).toBeNull();
    expect(toRoomPoint(1156, 60, box, landscape)).toBeNull();
    expect(toRoomPoint(200, 1010, box, landscape)).toBeNull();
    expect(toRoomPoint(10, 10, { ...box, width: 0 }, landscape)).toBeNull();
  });

  it('maps a portrait canvas through its layout', () => {
    const phone = { left: 0, top: 100, width: portrait.cssW, height: portrait.cssH };
    // The title's THEME button, drawn at scene x 100..156, sits at room x 84..140, y 202..218.
    const button = TAP_TARGETS.titleTheme;
    const cssPerPx = portrait.cssW / portrait.width;
    const p = toRoomPoint((button.x - PLAY_X0 + 16 + 2) * cssPerPx, 100 + (button.y + 12 + 2) * cssPerPx, phone, portrait);
    expect(p?.x).toBeCloseTo(86);
    expect(p?.y).toBeCloseTo(204);
    const back = canvasToFrame(p?.x ?? 0, p?.y ?? 0, portrait);
    expect(back?.x).toBeCloseTo(button.x + 2);
    expect(back?.y).toBeCloseTo(button.y + 2);
    expect(toRoomPoint(10, 100 + (portrait.height + 1) * cssPerPx, phone, portrait)).toBeNull();
  });
});

describe('tapAction', () => {
  // Room points: the scene is shifted by the window (16,12) in landscape.
  const sound = CONSOLE_HUD.sound;
  const onSound = { x: sound.x + sound.w / 2, y: sound.y + sound.h / 2 };

  it('hits the theme and mute buttons on the title screen', () => {
    expect(tapAction('title', { x: 126, y: 207 }, 'landscape', 'left')).toBe('theme');
    expect(tapAction('title', { x: 186, y: 207 }, 'landscape', 'right')).toBe('mute');
    expect(tapAction('title', onSound, 'landscape', 'left')).toBe('mute');
  });

  it('hits only the console sound readout during play', () => {
    expect(tapAction('playing', onSound, 'landscape', 'left')).toBe('mute');
    expect(tapAction('playing', { x: 126, y: 207 }, 'landscape', 'left')).toBe('left');
    expect(tapAction('life_lost', { x: 186, y: 207 }, 'landscape', 'right')).toBe('right');
  });

  it('finds the sound readout on the narrower portrait console too', () => {
    expect(sound.x + sound.w).toBeLessThanOrEqual(ROOM_P.w);
    expect(tapAction('playing', onSound, 'portrait', 'left')).toBe('mute');
    expect(tapAction('playing', { x: 126, y: 207 }, 'portrait', 'left')).toBe('left');
  });

  it('treats everything else, including the frame and the letterbox, as a plate press', () => {
    expect(tapAction('title', { x: 8, y: 120 }, 'landscape', 'left')).toBe('left');
    expect(tapAction('title', { x: 100, y: 270 }, 'landscape', 'left')).toBe('left');
    expect(tapAction('playing', null, 'landscape', 'right')).toBe('right');
  });

  it('swallows a tap in the gap between the title buttons', () => {
    expect(tapAction('title', { x: 176, y: 210 }, 'landscape', 'right')).toBe('none');
    expect(tapAction('title', { x: 176, y: 210 }, 'landscape', 'right', 33)).toBe('none');
    expect(tapAction('title', { x: 176, y: 194 }, 'landscape', 'right', 33)).toBe('none');
    expect(tapAction('title', { x: 176, y: 194 }, 'landscape', 'right')).toBe('right');
    expect(tapAction('title', { x: 114, y: 210 }, 'landscape', 'left', 33)).toBe('left');
    expect(tapAction('title', { x: 238, y: 210 }, 'landscape', 'right', 33)).toBe('right');
    expect(tapAction('playing', { x: 176, y: 210 }, 'landscape', 'right', 33)).toBe('right');
  });

  it('grows the hit area around the drawn button without moving its centre', () => {
    // 16 px tall art, 44 px hit area: 14 px above and below.
    expect(tapAction('playing', { x: onSound.x, y: sound.y - 14 }, 'landscape', 'left', 44)).toBe('mute');
    expect(tapAction('playing', { x: onSound.x, y: sound.y - 15 }, 'landscape', 'left', 44)).toBe('left');
    expect(tapAction('title', { x: 144, y: 192 }, 'landscape', 'left', 44)).toBe('theme');
    expect(tapAction('title', { x: 144, y: 231 }, 'landscape', 'left', 44)).toBe('theme');
    expect(tapAction('title', { x: 144, y: 233 }, 'landscape', 'left', 44)).toBe('left');
    expect(tapAction('title', { x: 144, y: 192 }, 'landscape', 'left')).toBe('left');
  });

  it('gives an overlap between grown hit areas to the nearest button', () => {
    expect(tapTarget('title', { x: 174, y: 210 }, 'landscape', 80)).toBe('titleTheme');
    expect(tapTarget('title', { x: 178, y: 210 }, 'landscape', 80)).toBe('titleMute');
  });
});

describe('minHitSize', () => {
  it('is 44 room pixels when one room pixel is one CSS pixel', () => {
    expect(minHitSize(352, 352)).toBe(44);
  });

  it('shrinks in room pixels as the canvas grows on the screen', () => {
    expect(minHitSize(1408, 352)).toBe(11);
    expect(minHitSize(352 * (4 / 3), 352)).toBe(33);
    expect(minHitSize(portrait.cssW, portrait.width)).toBe(33);
  });

  it('is zero without a canvas box', () => {
    expect(minHitSize(0, 352)).toBe(0);
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
