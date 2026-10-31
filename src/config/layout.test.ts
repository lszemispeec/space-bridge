import { describe, expect, it } from 'vitest';
import { CONSOLE_HUD, CONSOLE_MENU_BUTTON, frameToRoom, PLAY_W, PLAY_X0, ROOM, roomLayout, SCREEN_H, SCREEN_W, TAP_TARGETS } from './layout';

describe('roomLayout', () => {
  it('puts the whole scene in the window and the console under it in landscape', () => {
    const room = roomLayout('landscape');
    expect(room.window).toEqual({ x: ROOM.bezel.side, y: ROOM.bezel.top, w: SCREEN_W, h: SCREEN_H });
    expect(room.console).toEqual({ x: 0, y: ROOM.bezel.top + SCREEN_H, w: room.w, h: ROOM.consoleH.landscape });
    expect(room.strip).toBeNull();
    expect([room.w, room.h]).toEqual([352, 320]);
    expect(room.h).toBe(room.console.y + room.console.h);
    expect(room.leverTaps).toEqual({ left: { x: 20, y: 164, w: 24, h: 48 }, right: { x: 308, y: 164, w: 24, h: 48 } });
  });

  it('mounts the lever art wholly on the console deck at both ends', () => {
    for (const orientation of ['landscape', 'portrait'] as const) {
      const room = roomLayout(orientation);
      expect(room.levers.left).toEqual({ x: 8, y: 270 });
      expect(room.levers.right).toEqual({ x: room.w - 8 - ROOM.lever.w, y: 270 });
      expect(room.levers.left.y).toBeGreaterThanOrEqual(room.console.y);
      expect(room.levers.left.y + ROOM.lever.h).toBeLessThanOrEqual(room.console.y + room.console.h);
    }
    expect(roomLayout('landscape').levers.right.x).toBe(320);
    expect(roomLayout('portrait').levers.right.x).toBe(256);
  });

  it('shows only the playfield and adds the lever strip in portrait', () => {
    const room = roomLayout('portrait');
    expect(room.window.w).toBe(PLAY_W);
    expect(room.w).toBe(PLAY_W + 2 * ROOM.bezel.side);
    expect(room.strip).toEqual({ x: 16, y: 288, w: PLAY_W, h: 56 });
    expect([room.w, room.h]).toEqual([288, 344]);
    expect(room.h).toBe((room.strip?.y ?? 0) + (room.strip?.h ?? 0));
    expect(room.console).toEqual({ x: 0, y: 252, w: 288, h: ROOM.consoleH.portrait });
    expect(room.leverTaps).toEqual({ left: { x: 20, y: 292, w: 24, h: 48 }, right: { x: 244, y: 292, w: 24, h: 48 } });
  });
});

describe('frameToRoom', () => {
  it('moves a scene rectangle to where the window shows it', () => {
    const r = TAP_TARGETS.titleTheme;
    expect(frameToRoom(r, roomLayout('landscape'))).toEqual({ ...r, x: r.x + 16, y: r.y + 12 });
    expect(frameToRoom(r, roomLayout('portrait'))).toEqual({ ...r, x: r.x - PLAY_X0 + 16, y: r.y + 12 });
  });
});

describe('CONSOLE_HUD', () => {
  it('keeps every readout inside the console in both orientations, in order', () => {
    const hud = CONSOLE_HUD;
    const digitsEnd = hud.digits.x + hud.digits.pitch * hud.digits.count;
    const livesEnd = hud.lives.x + hud.lives.pitch * 2 + 14;
    expect(digitsEnd).toBeLessThanOrEqual(hud.modeLabel.x);
    expect(hud.modeLabel.x + 24).toBeLessThanOrEqual(hud.sound.x);
    // The lives sit on their own row under the score, clear of the lights.
    expect(hud.lives.y).toBeGreaterThanOrEqual(hud.sound.y + hud.sound.h);
    expect(livesEnd).toBeLessThanOrEqual(hud.lights.x);
    for (const orientation of ['landscape', 'portrait'] as const) {
      const c = roomLayout(orientation).console;
      expect(hud.scoreIcon.x).toBeGreaterThanOrEqual(c.x);
      expect(hud.sound.x + hud.sound.w).toBeLessThanOrEqual(c.x + c.w);
      for (const y of [hud.scoreIcon.y + 12, hud.digits.y + 10, hud.lives.y + 16, hud.sound.y + hud.sound.h, hud.lights.y + 6]) {
        expect(y).toBeLessThanOrEqual(c.y + c.h);
      }
      expect(hud.sound.y).toBeGreaterThanOrEqual(c.y);
      expect(hud.lights.y).toBeGreaterThanOrEqual(c.y);
    }
  });

  it('keeps the MENU button clear of the sound readout and of the right lever in both orientations', () => {
    const menu = CONSOLE_MENU_BUTTON;
    expect(menu.x).toBeGreaterThanOrEqual(CONSOLE_HUD.sound.x + CONSOLE_HUD.sound.w + 4);
    for (const orientation of ['landscape', 'portrait'] as const) {
      const room = roomLayout(orientation);
      expect(menu.y).toBeGreaterThanOrEqual(room.console.y);
      expect(menu.y + menu.h).toBeLessThanOrEqual(room.console.y + room.console.h);
      expect(menu.x + menu.w + 4).toBeLessThanOrEqual(room.levers.right.x);
    }
  });
});
