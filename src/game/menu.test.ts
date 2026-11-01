import { describe, expect, it } from 'vitest';
import { PLAY_X0, PLAY_W } from '../config/layout';
import { MENU_PANEL, MENU_ROW_H, menuPanelRect, menuRowRect, menuRows, menuStep, menuTapAt, type MenuCaps, type MenuState } from './menu';
import { defaultSave } from './save';
import { startGame, titleState } from './testing';

const caps: MenuCaps = { shaders: true };
const noShaders: MenuCaps = { shaders: false };
const at = (cursor: number): MenuState => ({ cursor });

function playing() {
  const save = defaultSave();
  save.unlocked = ['polar-signal', 'desert-expedition', 'neon-orbit'];
  return { ...startGame(titleState(save)), paused: true };
}

describe('menuRows', () => {
  it('lists every setting in a round, with restart and quit', () => {
    expect(menuRows(playing(), caps).map((r) => r.id)).toEqual(['resume', 'restart', 'theme', 'sound', 'music', 'sfx', 'display', 'quit']);
  });

  it('drops the round rows on the title and calls resume close', () => {
    const rows = menuRows({ ...titleState(), paused: true }, caps);
    expect(rows.map((r) => r.id)).toEqual(['resume', 'theme', 'sound', 'music', 'sfx', 'display']);
    expect(rows[0]?.label).toBe('CLOSE');
  });

  it('shows the current values', () => {
    const rows = menuRows(playing(), caps);
    const value = (id: string) => rows.find((r) => r.id === id)?.value;
    expect(value('theme')).toBe('POLAR SIGNAL');
    expect(value('sound')).toBe('ON');
    expect(value('music')).toBe('6');
    expect(value('sfx')).toBe('10');
    expect(value('display')).toBe('OFF');
    expect(value('resume')).toBeNull();
  });

  it('marks the display unavailable without WebGL2 and the theme fixed with one theme', () => {
    const display = menuRows(playing(), noShaders).find((r) => r.id === 'display');
    expect(display).toMatchObject({ value: 'N/A', enabled: false });
    const theme = menuRows({ ...startGame(titleState()), paused: true }, caps).find((r) => r.id === 'theme');
    expect(theme?.enabled).toBe(false);
  });
});

describe('menuStep with keys', () => {
  it('moves the cursor with wrap-around', () => {
    const s = playing();
    expect(menuStep(at(0), 'down', s, caps).menu.cursor).toBe(1);
    expect(menuStep(at(0), 'up', s, caps).menu.cursor).toBe(7);
    expect(menuStep(at(7), 'down', s, caps).menu.cursor).toBe(0);
    expect(menuStep(at(0), 'down', s, caps).commands).toEqual([]);
  });

  it('resumes, restarts and quits from their rows, and resumes on back', () => {
    const s = playing();
    expect(menuStep(at(0), 'confirm', s, caps).commands).toEqual([{ type: 'resume' }]);
    expect(menuStep(at(1), 'confirm', s, caps).commands).toEqual([{ type: 'restart' }]);
    expect(menuStep(at(7), 'confirm', s, caps).commands).toEqual([{ type: 'quit' }]);
    expect(menuStep(at(3), 'back', s, caps).commands).toEqual([{ type: 'resume' }]);
    expect(menuStep(at(1), 'left', s, caps).commands).toEqual([]);
  });

  it('cycles the theme through the unlocked list both ways', () => {
    const s = playing();
    expect(menuStep(at(2), 'right', s, caps).commands).toEqual([{ type: 'theme', theme: 'desert-expedition' }]);
    expect(menuStep(at(2), 'left', s, caps).commands).toEqual([{ type: 'theme', theme: 'neon-orbit' }]);
    expect(menuStep(at(2), 'confirm', s, caps).commands).toEqual([{ type: 'theme', theme: 'desert-expedition' }]);
    const one = { ...startGame(titleState()), paused: true };
    expect(menuStep(at(2), 'right', one, caps).commands).toEqual([]);
  });

  it('toggles the sound as a mute press', () => {
    const r = menuStep(at(3), 'confirm', playing(), caps);
    expect(r.mute).toBe(true);
    expect(r.commands).toEqual([]);
    expect(menuStep(at(3), 'left', playing(), caps).mute).toBe(true);
  });

  it('steps the volumes in tenths and clamps at the ends', () => {
    const s = playing();
    expect(menuStep(at(4), 'right', s, caps).commands).toEqual([{ type: 'volume', bus: 'music', value: 0.7 }]);
    expect(menuStep(at(4), 'left', s, caps).commands).toEqual([{ type: 'volume', bus: 'music', value: 0.5 }]);
    expect(menuStep(at(5), 'right', s, caps).commands).toEqual([{ type: 'volume', bus: 'sfx', value: 1 }]);
    expect(menuStep(at(5), 'left', s, caps).commands).toEqual([{ type: 'volume', bus: 'sfx', value: 0.9 }]);
    const quiet = { ...s, save: { ...s.save, settings: { ...s.save.settings, music: 0 } } };
    expect(menuStep(at(4), 'left', quiet, caps).commands).toEqual([{ type: 'volume', bus: 'music', value: 0 }]);
  });

  it('cycles the display presets, and refuses without WebGL2', () => {
    const s = playing();
    expect(menuStep(at(6), 'right', s, caps).commands).toEqual([{ type: 'shader', preset: 'crt' }]);
    expect(menuStep(at(6), 'left', s, caps).commands).toEqual([{ type: 'shader', preset: 'full' }]);
    // The Vector preset joins the cycle only once its theme is unlocked.
    const withVector = { ...s, save: { ...s.save, unlocked: [...s.save.unlocked, 'vector' as const] } };
    expect(menuStep(at(6), 'left', withVector, caps).commands).toEqual([{ type: 'shader', preset: 'vector' }]);
    expect(menuStep(at(6), 'confirm', s, caps).commands).toEqual([{ type: 'shader', preset: 'crt' }]);
    expect(menuStep(at(6), 'right', s, noShaders).commands).toEqual([]);
  });

  it('clamps a stale cursor to the rows that exist', () => {
    const title = { ...titleState(), paused: true };
    expect(menuStep(at(7), 'confirm', title, caps)).toMatchObject({ menu: { cursor: 5 } });
    expect(menuStep(at(7), 'confirm', title, caps).commands).toEqual([{ type: 'shader', preset: 'crt' }]);
  });
});

describe('menuStep with taps', () => {
  it('moves the cursor to the row and activates or adjusts it by side', () => {
    const s = playing();
    expect(menuStep(at(0), { row: 7, side: 0 }, s, caps)).toEqual({ menu: { cursor: 7 }, commands: [{ type: 'quit' }], mute: false });
    expect(menuStep(at(0), { row: 4, side: -1 }, s, caps).commands).toEqual([{ type: 'volume', bus: 'music', value: 0.5 }]);
    expect(menuStep(at(0), { row: 4, side: 1 }, s, caps).commands).toEqual([{ type: 'volume', bus: 'music', value: 0.7 }]);
    expect(menuStep(at(0), { row: 4, side: 0 }, s, caps).commands).toEqual([{ type: 'volume', bus: 'music', value: 0.7 }]);
    // An action row activates whatever side is tapped.
    expect(menuStep(at(0), { row: 1, side: -1 }, s, caps).commands).toEqual([{ type: 'restart' }]);
  });

  it('ignores a tap outside the rows', () => {
    expect(menuStep(at(2), { row: 9, side: 0 }, playing(), caps)).toEqual({ menu: { cursor: 2 }, commands: [], mute: false });
  });
});

describe('menu geometry', () => {
  it('fits inside the portrait window, so every row can be tapped on a phone', () => {
    expect(MENU_PANEL.x).toBeGreaterThanOrEqual(PLAY_X0);
    expect(MENU_PANEL.x + MENU_PANEL.w).toBeLessThanOrEqual(PLAY_X0 + PLAY_W);
    const last = menuRowRect(7);
    expect(last.y + last.h).toBeLessThanOrEqual(MENU_PANEL.y + MENU_PANEL.h);
  });

  it('shrinks the panel to its rows, never past its tallest', () => {
    expect(menuPanelRect(8)).toEqual(MENU_PANEL);
    const six = menuPanelRect(6);
    expect(six.h).toBe(MENU_PANEL.h - 2 * MENU_ROW_H);
    const lastRow = menuRowRect(5);
    expect(lastRow.y + lastRow.h).toBeLessThanOrEqual(six.y + six.h);
    expect(menuPanelRect(20).h).toBe(MENU_PANEL.h);
  });

  it('maps a point to its row and side', () => {
    const r = menuRowRect(3);
    expect(menuTapAt({ x: r.x + 1, y: r.y + 1 }, 8)).toEqual({ row: 3, side: -1 });
    expect(menuTapAt({ x: r.x + r.w / 2, y: r.y + MENU_ROW_H - 1 }, 8)).toEqual({ row: 3, side: 0 });
    expect(menuTapAt({ x: r.x + r.w - 1, y: r.y }, 8)).toEqual({ row: 3, side: 1 });
    expect(menuTapAt({ x: r.x + 1, y: r.y + 1 }, 3)).toBeNull();
    expect(menuTapAt({ x: 0, y: 0 }, 8)).toBeNull();
    expect(menuTapAt({ x: r.x - 1, y: r.y }, 8)).toBeNull();
  });
});
