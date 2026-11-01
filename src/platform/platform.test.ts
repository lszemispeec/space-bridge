import { describe, expect, it } from 'vitest';
import { SHADER_PRESETS } from '../config/display';
import { CONSOLE_HUD, CONSOLE_MENU_BUTTON, PLAY_W, PLAY_X0, PORTRAIT_STRIP, roomLayout, SCREEN_H, SCREEN_W, TAP_TARGETS } from '../config/layout';
import { menuRowRect } from '../game/menu';
import { defaultSave } from '../game/save';
import { createCrtPass, persistedLevel, webgl2Available } from './crt';
import { menuTapAction, minHitSize, sideForPointer, tapAction, tapTarget, toRoomPoint } from './input';
import { accumulateSteps, STEP_SECONDS } from './loop';
import { loadSave, memoryStore, writeSave } from './storage';
import { readInsets } from './canvas';
import { canvasToFrame, CANVAS_SIZE, chooseLayout, chooseViewport, composition, fillScale, fitScale } from './viewport';

const landscape = chooseViewport(1280, 960);
const portrait = chooseViewport(390, 844, 3);
/** The reporter's iPhone 16 Pro in Safari, landscape, with no safe-area insets. */
const PHONE_SAFARI = [874, 300, 3] as const;
/** The same phone as a home-screen app: no browser toolbar. */
const PHONE_APP = [874, 402, 3] as const;
/** Its notch at the sides and the home bar at the bottom. */
const PHONE_INSETS = { top: 0, right: 59, bottom: 21, left: 59 };
const side = chooseViewport(...PHONE_SAFARI);
const ROOM_L = roomLayout('landscape');
const ROOM_P = roomLayout('portrait');
const ROOM_S = roomLayout('side');
const WIN = ROOM_L.window;
const consoleY = (room: { console: { y: number } | null }) => room.console?.y ?? -1;

describe('CANVAS_SIZE', () => {
  it('is the operator room: the scene in the window and the console below, plus the lever strip in portrait', () => {
    expect(CANVAS_SIZE.landscape).toEqual({ w: 352, h: 320 });
    expect(CANVAS_SIZE.portrait).toEqual({ w: 288, h: 344 });
    expect(CANVAS_SIZE.side).toEqual({ w: 448, h: 256 });
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

describe('fillScale', () => {
  it('is the exact fit, never below 1, and never below the whole-number fit', () => {
    const { w, h } = CANVAS_SIZE.side;
    expect(fillScale(874, 300, 3, w, h)).toBeCloseTo(900 / 256);
    expect(fillScale(1408, 1280, 1, CANVAS_SIZE.landscape.w, CANVAS_SIZE.landscape.h)).toBe(4);
    expect(fillScale(200, 100, 1, w, h)).toBe(1);
    for (const [vw, vh, dpr] of [[874, 300, 3], [390, 844, 3], [360, 640, 2], [1920, 1080, 1]] as const) {
      expect(fillScale(vw, vh, dpr, w, h)).toBeGreaterThanOrEqual(fitScale(vw, vh, dpr, w, h));
    }
  });
});

describe('chooseLayout', () => {
  it('keeps the console under the window on desktop, where it shows the scene as large or larger', () => {
    expect(chooseLayout(1280, 960, 1)).toBe('landscape');
    expect(chooseLayout(1408, 1280, 1)).toBe('landscape');
    expect(chooseLayout(1000, 1000, 1)).toBe('landscape');
    expect(chooseLayout(1280, 800, 1)).toBe('landscape');
  });

  it('puts the console beside the window on a short landscape screen', () => {
    expect(chooseLayout(...PHONE_SAFARI)).toBe('side');
    expect(chooseLayout(...PHONE_APP)).toBe('side');
    expect(chooseLayout(844, 390, 3)).toBe('side');
    // A wide dpr 1 screen too: 1080p shows the scene at 4x beside the panels, 3x above the console.
    expect(chooseLayout(1920, 1080, 1)).toBe('side');
    expect(chooseLayout(1366, 768, 1)).toBe('side');
  });

  it('always stacks the playfield on a tall screen', () => {
    expect(chooseLayout(390, 844, 3)).toBe('portrait');
    expect(chooseLayout(300, 310, 1)).toBe('portrait');
  });
});

describe('chooseViewport', () => {
  it('keeps the console under the window at whole scales on desktop', () => {
    expect(landscape).toEqual({ orientation: 'landscape', layout: 'landscape', scale: 3, width: 352, height: 320, cssW: 1056, cssH: 960 });
    expect(chooseViewport(1408, 1280)).toMatchObject({ layout: 'landscape', scale: 4, cssW: 1408, cssH: 1280 });
    expect(chooseViewport(1000, 1000)).toMatchObject({ layout: 'landscape', scale: 2 });
  });

  it('puts the console beside the window on a landscape phone and fills the screen', () => {
    // Before: the 352x320 room at 2 device px per room px, 235x213 CSS px of a 874x300 screen.
    expect(fitScale(...PHONE_SAFARI, CANVAS_SIZE.landscape.w, CANVAS_SIZE.landscape.h)).toBe(2);
    expect(side).toMatchObject({ orientation: 'landscape', layout: 'side', width: 448, height: 256, cssH: 300 });
    expect(side.scale).toBeCloseTo(3.515625);
    expect(side.cssW).toBeCloseTo(525);
    expect(side.cssW).toBeGreaterThanOrEqual(500);
    const app = chooseViewport(...PHONE_APP);
    expect(app).toMatchObject({ layout: 'side', cssH: 402 });
    expect(app.cssW).toBeCloseTo(703.5);
    expect(chooseViewport(844, 390, 3)).toMatchObject({ layout: 'side', cssH: 390 });
  });

  it('keeps the game inside the safe area, so the notch and the home bar cover nothing', () => {
    const safe = chooseViewport(...PHONE_SAFARI, PHONE_INSETS);
    expect(safe).toMatchObject({ layout: 'side', cssH: 300 - 21 });
    expect(safe.cssW).toBeLessThanOrEqual(874 - 59 - 59);
    expect(safe.cssW).toBeGreaterThan(480);
    expect(chooseViewport(390, 844, 3, { top: 59, right: 0, bottom: 34, left: 0 })).toMatchObject({ layout: 'portrait', cssW: 390 });
  });

  it('stacks the playfield over the console and the levers on a portrait phone, filled to the width', () => {
    // Before: 4 device px per room px, 384 CSS px wide. Fill: the whole 390 px.
    expect(fitScale(390, 844, 3, CANVAS_SIZE.portrait.w, CANVAS_SIZE.portrait.h)).toBe(4);
    expect(portrait).toMatchObject({ orientation: 'portrait', layout: 'portrait', scale: 4.0625, width: 288, height: 344, cssW: 390 });
    expect(portrait.cssH).toBeCloseTo(465.83, 1);
    expect(chooseViewport(430, 932, 3).scale).toBeGreaterThanOrEqual(4);
    expect(chooseViewport(360, 640, 2)).toMatchObject({ layout: 'portrait', scale: 2.5 });
  });

  it('keeps whole scales on a dpr 1 screen and never lets the portrait canvas outgrow a short viewport', () => {
    expect(chooseViewport(300, 310, 1)).toMatchObject({ layout: 'portrait', scale: 1 });
    expect(chooseViewport(1920, 1080, 1)).toMatchObject({ layout: 'side', scale: 4, cssW: 1792, cssH: 1024 });
    expect(chooseViewport(1366, 768, 1)).toMatchObject({ layout: 'side', scale: 3, cssW: 1344, cssH: 768 });
    expect(chooseViewport(1280, 800, 1)).toMatchObject({ layout: 'landscape', scale: 2 });
  });

  it('shows the drawn lever tap zones at thumb size on the phone', () => {
    for (const v of [side, chooseViewport(...PHONE_APP), chooseViewport(844, 390, 3)]) {
      const cssPerPx = v.cssW / v.width;
      for (const tap of Object.values(ROOM_S.leverTaps)) {
        expect(tap.w * cssPerPx).toBeGreaterThanOrEqual(44);
        expect(tap.h * cssPerPx).toBeGreaterThanOrEqual(44);
      }
    }
    // Inside Safari's safe area the drawn zone is a hair under 44 px wide; the hit area is the whole half, see tapAction.
    const safe = chooseViewport(...PHONE_SAFARI, PHONE_INSETS);
    expect((ROOM_S.leverTaps.left.w * safe.cssW) / safe.width).toBeGreaterThan(43);
    expect((ROOM_S.leverTaps.left.h * safe.cssW) / safe.width).toBeGreaterThan(80);
  });
});

describe('readInsets', () => {
  it('reads the safe-area custom properties and treats anything else as zero', () => {
    const values: Record<string, string> = { '--safe-top': '0px', '--safe-left': '59px', '--safe-right': ' 59px', '--safe-bottom': '' };
    expect(readInsets({ getPropertyValue: (name) => values[name] ?? '' })).toEqual({ top: 0, right: 59, bottom: 0, left: 59 });
  });
});

describe('composition', () => {
  it('puts the whole scene in the window in landscape', () => {
    expect(composition('landscape')).toEqual({ sx: 0, sy: 0, w: SCREEN_W, h: SCREEN_H, dx: WIN.x, dy: WIN.y });
  });

  it('puts the playfield in the window in portrait; the room art draws the lever strip', () => {
    expect(composition('portrait')).toEqual({ sx: PLAY_X0, sy: 0, w: PLAY_W, h: SCREEN_H, dx: 16, dy: 12 });
  });

  it('puts the whole scene between the panels in side', () => {
    expect(composition('side')).toEqual({ sx: 0, sy: 0, w: SCREEN_W, h: SCREEN_H, dx: 64, dy: 8 });
  });
});

describe('canvasToFrame', () => {
  it('shifts the window back to the scene in landscape and drops the frame and the console', () => {
    expect(canvasToFrame(WIN.x, WIN.y, landscape)).toEqual({ x: 0, y: 0 });
    expect(canvasToFrame(WIN.x + 10, WIN.y + 20, landscape)).toEqual({ x: 10, y: 20 });
    expect(canvasToFrame(WIN.x + SCREEN_W - 1, WIN.y + 100, landscape)).toEqual({ x: 319, y: 100 });
    expect(canvasToFrame(10, 20, landscape)).toBeNull();
    expect(canvasToFrame(WIN.x + SCREEN_W, WIN.y + 100, landscape)).toBeNull();
    expect(canvasToFrame(100, consoleY(ROOM_L), landscape)).toBeNull();
    expect(canvasToFrame(352, 20, landscape)).toBeNull();
  });

  it('shifts the playfield back into the scene and drops the console and the strip in portrait', () => {
    expect(canvasToFrame(16, 12, portrait)).toEqual({ x: PLAY_X0, y: 0 });
    expect(canvasToFrame(126, 207, portrait)).toEqual({ x: 142, y: 195 });
    expect(canvasToFrame(100, consoleY(ROOM_P), portrait)).toBeNull();
    expect(canvasToFrame(10, ROOM_P.strip?.y ?? 0, portrait)).toBeNull();
    expect(canvasToFrame(10, ROOM_P.h, portrait)).toBeNull();
  });

  it('shifts the window back to the scene in side and drops both panels', () => {
    const win = ROOM_S.window;
    expect(canvasToFrame(win.x, win.y, side)).toEqual({ x: 0, y: 0 });
    expect(canvasToFrame(win.x + 10, win.y + 20, side)).toEqual({ x: 10, y: 20 });
    expect(canvasToFrame(win.x + SCREEN_W - 1, win.y + SCREEN_H - 1, side)).toEqual({ x: 319, y: 239 });
    expect(canvasToFrame(win.x - 1, 100, side)).toBeNull();
    expect(canvasToFrame(win.x + SCREEN_W, 100, side)).toBeNull();
    expect(canvasToFrame(100, win.y - 1, side)).toBeNull();
    expect(canvasToFrame(100, win.y + SCREEN_H, side)).toBeNull();
    expect(canvasToFrame(ROOM_S.leverTaps.left.x + 2, ROOM_S.leverTaps.left.y + 2, side)).toBeNull();
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

  it('opens the menu from the console MENU button in every phase and orientation', () => {
    const menu = CONSOLE_MENU_BUTTON;
    const onMenu = { x: menu.x + menu.w / 2, y: menu.y + menu.h / 2 };
    expect(tapAction('title', onMenu, 'landscape', 'right')).toBe('pause');
    expect(tapAction('playing', onMenu, 'landscape', 'right')).toBe('pause');
    expect(tapAction('game_over', onMenu, 'portrait', 'right')).toBe('pause');
    expect(menu.x + menu.w).toBeLessThanOrEqual(ROOM_P.w);
    expect(menu.x).toBeGreaterThanOrEqual(sound.x + sound.w);
    // Grown hit areas: the sound readout and the MENU button stay apart.
    expect(tapAction('playing', { x: menu.x + 2, y: onMenu.y }, 'landscape', 'right', 44)).toBe('pause');
    expect(tapAction('playing', { x: sound.x + sound.w - 2, y: onSound.y }, 'landscape', 'right', 44)).toBe('mute');
  });

  it('finds the sound readout on the narrower portrait console too', () => {
    expect(sound.x + sound.w).toBeLessThanOrEqual(ROOM_P.w);
    expect(tapAction('playing', onSound, 'portrait', 'left')).toBe('mute');
    expect(tapAction('playing', { x: 126, y: 207 }, 'portrait', 'left')).toBe('left');
  });

  it('finds the sound readout and the MENU button on the side panels', () => {
    const hud = ROOM_S.hud;
    const menu = ROOM_S.menu;
    const minHit = 44 / (side.cssW / side.width);
    expect(tapAction('playing', { x: hud.sound.x + 18, y: hud.sound.y + 8 }, 'side', 'right')).toBe('mute');
    expect(tapAction('title', { x: hud.sound.x + 18, y: hud.sound.y + 8 }, 'side', 'right', minHit)).toBe('mute');
    expect(tapAction('playing', { x: menu.x + 18, y: menu.y + 8 }, 'side', 'right')).toBe('pause');
    expect(tapAction('game_over', { x: menu.x + 18, y: menu.y + 8 }, 'side', 'right', minHit)).toBe('pause');
    // Grown hit areas stay apart, and a tap on a lever zone or the window is a plate press.
    expect(tapAction('playing', { x: menu.x + 18, y: menu.y + 1 }, 'side', 'right', minHit)).toBe('pause');
    expect(tapAction('playing', { x: hud.sound.x + 18, y: hud.sound.y + hud.sound.h - 1 }, 'side', 'right', minHit)).toBe('mute');
    expect(tapAction('playing', { x: ROOM_S.leverTaps.right.x + 20, y: ROOM_S.leverTaps.right.y + 40 }, 'side', 'right', minHit)).toBe('right');
    expect(tapAction('playing', { x: ROOM_S.leverTaps.left.x + 20, y: ROOM_S.leverTaps.left.y + 40 }, 'side', 'left', minHit)).toBe('left');
    expect(tapAction('playing', { x: 200, y: 120 }, 'side', 'left', minHit)).toBe('left');
    expect(tapAction('playing', { x: 300, y: 120 }, 'side', 'right', minHit)).toBe('right');
    // The title buttons follow the window.
    expect(tapAction('title', { x: 100 + 64 + 28, y: 190 + 8 + 8 }, 'side', 'left')).toBe('theme');
    expect(tapAction('title', { x: 164 + 64 + 28, y: 190 + 8 + 8 }, 'side', 'right')).toBe('mute');
    expect(tapAction('title', { x: 160 + 64, y: 198 + 8 }, 'side', 'right')).toBe('none');
    // The whole half is a plate press, panel edge to panel edge.
    for (const x of [0, 30, 63, 64, 200]) expect(tapAction('playing', { x, y: 250 }, 'side', 'left', minHit)).toBe('left');
    for (const x of [300, 384, 447]) expect(tapAction('playing', { x, y: 250 }, 'side', 'right', minHit)).toBe('right');
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

describe('menuTapAction', () => {
  const menu = CONSOLE_MENU_BUTTON;

  it('closes the menu from the MENU button and hands window taps to the menu as scene points', () => {
    expect(menuTapAction({ x: menu.x + 1, y: menu.y + 1 }, landscape)).toBe('back');
    const row = menuRowRect(2);
    const tap = menuTapAction({ x: row.x + WIN.x + 3, y: row.y + WIN.y + 3 }, landscape);
    expect(tap).toEqual({ tap: { x: row.x + 3, y: row.y + 3 } });
    const portraitTap = menuTapAction({ x: row.x - PLAY_X0 + 16 + 3, y: row.y + 12 + 3 }, portrait);
    expect(portraitTap).toEqual({ tap: { x: row.x + 3, y: row.y + 3 } });
  });

  it('closes the menu from the side panel button and maps side window taps too', () => {
    const menu = ROOM_S.menu;
    expect(menuTapAction({ x: menu.x + 1, y: menu.y + 1 }, side)).toBe('back');
    // The landscape MENU rectangle is in the window here, so a tap there is a menu tap, not a close.
    expect(menuTapAction({ x: CONSOLE_MENU_BUTTON.x + 1, y: 200 }, side)).toEqual({ tap: { x: CONSOLE_MENU_BUTTON.x + 1 - 64, y: 192 } });
    const row = menuRowRect(2);
    expect(menuTapAction({ x: row.x + 64 + 3, y: row.y + 8 + 3 }, side)).toEqual({ tap: { x: row.x + 3, y: row.y + 3 } });
    expect(menuTapAction({ x: 20, y: 200 }, side)).toBeNull();
  });

  it('swallows taps on the console, the frame and off the canvas, so nothing moves the plate', () => {
    expect(menuTapAction({ x: 100, y: consoleY(ROOM_L) + 10 }, landscape)).toBeNull();
    expect(menuTapAction({ x: 4, y: 100 }, landscape)).toBeNull();
    expect(menuTapAction(null, landscape)).toBeNull();
  });
});

describe('crt pass without WebGL2', () => {
  const noGl = {
    getContext: () => null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  } as unknown as HTMLCanvasElement;

  it('reports WebGL2 as unavailable and creates no pass, so the 2D output stays', () => {
    expect(webgl2Available(noGl)).toBe(false);
    expect(createCrtPass(noGl, { onLost: () => undefined, onRestored: () => undefined })).toBeNull();
  });

  it('treats a throwing getContext as unavailable too', () => {
    const throwing = { getContext: () => { throw new Error('blocked'); } } as unknown as HTMLCanvasElement;
    expect(webgl2Available(throwing)).toBe(false);
    expect(createCrtPass(throwing, { onLost: () => undefined, onRestored: () => undefined })).toBeNull();
  });
});

describe('crt persistence', () => {
  /** Frames until a fully lit 8-bit level is black again, and whether it ever stalled. */
  const decay = (persistence: number): { frames: number; stalled: boolean } => {
    let level = 255;
    let frames = 0;
    while (level > 0) {
      const next = persistedLevel(level, persistence);
      if (next >= level) return { frames, stalled: true };
      level = next;
      frames++;
    }
    return { frames, stalled: false };
  };

  it('fades a lit pixel to black within a bounded number of frames on every preset', () => {
    for (const preset of SHADER_PRESETS.filter((p) => p.params.persistence > 0)) {
      const p = preset.params.persistence;
      const { frames, stalled } = decay(p);
      // Pure geometric decay needs log(255) / log(1 / p) frames; the floor only makes it quicker.
      expect(stalled, preset.id).toBe(false);
      expect(frames, preset.id).toBeLessThanOrEqual(Math.ceil(Math.log(255) / -Math.log(p)));
      expect(frames, preset.id).toBeLessThanOrEqual(12);
    }
  });

  it('takes the floor off the lowest levels, where 8-bit rounding alone would keep them lit', () => {
    // Without the floor, round(2 * 0.8) = 2 and round(1 * 0.8) = 1: a permanent ghost (DEIM-451).
    expect(Math.round(2 * 0.8)).toBe(2);
    expect(persistedLevel(2, 0.8)).toBe(1);
    expect(persistedLevel(1, 0.8)).toBe(0);
    expect(persistedLevel(2, 0.55)).toBe(0);
    expect(persistedLevel(0, 0.9)).toBe(0);
  });

  it('keeps a bright afterglow bright for the first frames, so the trail still reads', () => {
    expect(persistedLevel(255, 0.6)).toBe(152);
    expect(persistedLevel(255, 0.55)).toBe(139);
  });
});

describe('minHitSize', () => {
  it('is 44 room pixels when one room pixel is one CSS pixel', () => {
    expect(minHitSize(352, 352)).toBe(44);
  });

  it('shrinks in room pixels as the canvas grows on the screen', () => {
    expect(minHitSize(1408, 352)).toBe(11);
    expect(minHitSize(352 * (4 / 3), 352)).toBe(33);
    expect(minHitSize(portrait.cssW, portrait.width)).toBeCloseTo(32.49, 1);
    expect(minHitSize(side.cssW, side.width)).toBeCloseTo(37.5, 1);
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
