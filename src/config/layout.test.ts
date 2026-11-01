import { describe, expect, it } from 'vitest';
import {
  CONSOLE_HUD, CONSOLE_MENU_BUTTON, frameToRoom, hitRect, inRect, PLAY_W, PLAY_X0, ROOM, roomLayout, SCREEN_H, SCREEN_W, SIDE_HUD,
  SIDE_MENU_BUTTON, SIDE_ROOM, TAP_TARGETS, type Rect, type RoomLayout,
} from './layout';

/** The console deck of a layout that has one. */
function consoleOf(room: RoomLayout): Rect {
  if (!room.console) throw new Error(`${room.id} has no console deck`);
  return room.console;
}

describe('roomLayout', () => {
  it('puts the whole scene in the window and the console under it in landscape', () => {
    const room = roomLayout('landscape');
    expect(room.window).toEqual({ x: ROOM.bezel.side, y: ROOM.bezel.top, w: SCREEN_W, h: SCREEN_H });
    expect(room.console).toEqual({ x: 0, y: ROOM.bezel.top + SCREEN_H, w: room.w, h: ROOM.consoleH.landscape });
    expect(room.strip).toBeNull();
    expect(room.panels).toBeNull();
    expect([room.id, room.orientation]).toEqual(['landscape', 'landscape']);
    expect([room.w, room.h]).toEqual([352, 320]);
    expect(room.h).toBe(consoleOf(room).y + consoleOf(room).h);
    expect(room.hud).toBe(CONSOLE_HUD);
    expect(room.menu).toBe(CONSOLE_MENU_BUTTON);
    expect(room.leverTaps).toEqual({ left: { x: 20, y: 164, w: 24, h: 48 }, right: { x: 308, y: 164, w: 24, h: 48 } });
  });

  it('mounts the lever art wholly on the console deck at both ends', () => {
    for (const orientation of ['landscape', 'portrait'] as const) {
      const room = roomLayout(orientation);
      expect(room.levers.left).toEqual({ x: 8, y: 270 });
      expect(room.levers.right).toEqual({ x: room.w - 8 - ROOM.lever.w, y: 270 });
      expect(room.levers.left.y).toBeGreaterThanOrEqual(consoleOf(room).y);
      expect(room.levers.left.y + ROOM.lever.h).toBeLessThanOrEqual(consoleOf(room).y + consoleOf(room).h);
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

  it('puts the whole scene between two console panels in side, with the levers in their lower halves', () => {
    const room = roomLayout('side');
    expect([room.id, room.orientation]).toEqual(['side', 'landscape']);
    expect([room.w, room.h]).toEqual([448, 256]);
    expect(room.window).toEqual({ x: 64, y: 8, w: SCREEN_W, h: SCREEN_H });
    expect(room.console).toBeNull();
    expect(room.strip).toBeNull();
    expect(room.panels).toEqual({ left: { x: 0, y: 0, w: 64, h: 256 }, right: { x: 384, y: 0, w: 64, h: 256 } });
    expect(room.levers).toEqual({ left: { x: 14, y: 180 }, right: { x: 410, y: 180 } });
    expect(room.leverTaps).toEqual({ left: { x: 6, y: 160, w: 40, h: 80 }, right: { x: 402, y: 160, w: 40, h: 80 } });
    expect(room.hud).toBe(SIDE_HUD);
    expect(room.menu).toBe(SIDE_MENU_BUTTON);
    // The window and the panels tile the room; nothing on a panel reaches the window.
    expect(room.window.x).toBe(room.panels?.left.w);
    expect(room.window.x + room.window.w).toBe(room.panels?.right.x);
    expect(room.window.y + room.window.h).toBeLessThanOrEqual(room.h);
    for (const side of ['left', 'right'] as const) {
      const panel = room.panels?.[side] ?? { x: 0, y: 0, w: 0, h: 0 };
      const lever = { ...room.levers[side], ...ROOM.lever };
      for (const r of [lever, room.leverTaps[side]]) {
        expect(r.x).toBeGreaterThanOrEqual(panel.x);
        expect(r.x + r.w).toBeLessThanOrEqual(panel.x + panel.w);
        expect(r.y + r.h).toBeLessThanOrEqual(panel.y + panel.h);
      }
      // The tap zone contains the lever art.
      expect(inRect(room.leverTaps[side], lever.x, lever.y)).toBe(true);
      expect(inRect(room.leverTaps[side], lever.x + lever.w - 1, lever.y + lever.h - 1)).toBe(true);
    }
    expect(SIDE_ROOM.leverTap.w).toBeGreaterThanOrEqual(ROOM.lever.w);
  });
});

describe('SIDE_HUD', () => {
  it('keeps the readouts on the left panel and the buttons on the right one, clear of the levers', () => {
    const room = roomLayout('side');
    const hud = room.hud;
    const left = room.panels?.left ?? { x: 0, y: 0, w: 0, h: 0 };
    const right = room.panels?.right ?? { x: 0, y: 0, w: 0, h: 0 };
    const within = (r: Rect, panel: Rect) => r.x >= panel.x && r.x + r.w <= panel.x + panel.w && r.y >= panel.y && r.y + r.h <= panel.y + panel.h;
    expect(within({ ...hud.scoreIcon, w: 12, h: 12 }, left)).toBe(true);
    expect(within({ x: hud.digits.x, y: hud.digits.y, w: hud.digits.pitch * hud.digits.count, h: 10 }, left)).toBe(true);
    expect(within({ ...hud.modeLabel, w: 23, h: 5 }, left)).toBe(true);
    expect(within({ x: hud.lives.x, y: hud.lives.y, w: hud.lives.pitch * 2 + 14, h: 16 }, left)).toBe(true);
    expect(within(hud.sound, right)).toBe(true);
    expect(within(room.menu, right)).toBe(true);
    expect(within({ ...hud.lights, w: 6, h: 6 }, right)).toBe(true);
    // The two buttons sit apart, and both are above the lever tap zone even when grown to a thumb.
    expect(room.menu.y).toBeGreaterThanOrEqual(hud.sound.y + hud.sound.h + 4);
    const grownMenu = hitRect(room.menu, 44);
    expect(grownMenu.y + grownMenu.h).toBeLessThanOrEqual(room.leverTaps.right.y);
    expect(hud.lives.y + 16).toBeLessThanOrEqual(room.leverTaps.left.y);
  });
});

describe('frameToRoom', () => {
  it('moves a scene rectangle to where the window shows it', () => {
    const r = TAP_TARGETS.titleTheme;
    expect(frameToRoom(r, roomLayout('landscape'))).toEqual({ ...r, x: r.x + 16, y: r.y + 12 });
    expect(frameToRoom(r, roomLayout('portrait'))).toEqual({ ...r, x: r.x - PLAY_X0 + 16, y: r.y + 12 });
    expect(frameToRoom(r, roomLayout('side'))).toEqual({ ...r, x: r.x + 64, y: r.y + 8 });
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
      const c = consoleOf(roomLayout(orientation));
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
      expect(menu.y).toBeGreaterThanOrEqual(consoleOf(room).y);
      expect(menu.y + menu.h).toBeLessThanOrEqual(consoleOf(room).y + consoleOf(room).h);
      expect(menu.x + menu.w + 4).toBeLessThanOrEqual(room.levers.right.x);
    }
  });
});
