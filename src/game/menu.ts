/**
 * The pause menu as a pure model: which rows show for the game's state,
 * where they sit on the scene, and what a key or a tap does to the cursor
 * and to the game. The renderer draws the rows; the rules apply the
 * commands. The model never touches the game state itself.
 *
 * Rows are one flat list, so arrows and taps reach every setting without
 * sub-menus: Resume, Restart, Theme, Sound, Music, SFX, Display, Quit.
 * On the title screen the round rows (Restart, Quit) are left out and
 * Resume reads Close.
 */
import { getShaderPreset, SHADER_PRESETS, type ShaderPresetId } from '../config/display';
import { PLAY_W, PLAY_X0, type Rect } from '../config/layout';
import { getTheme, type ThemeId } from '../config/themes';
import type { Point } from './jump';
import type { GameCommand, GameState, VolumeBus } from './types';

export type MenuRowId = 'resume' | 'restart' | 'theme' | 'sound' | 'music' | 'sfx' | 'display' | 'quit';

export interface MenuRow {
  id: MenuRowId;
  label: string;
  /** The current value of a setting row, shown between the arrows. Null on an action row. */
  value: string | null;
  /** False when the row shows but cannot change: the display without WebGL2. */
  enabled: boolean;
}

export interface MenuState {
  cursor: number;
}

export const MENU_CLOSED: MenuState = { cursor: 0 };

/** What the shell can do, which decides what the menu offers. */
export interface MenuCaps {
  /** WebGL2 is available, so display presets can be chosen. */
  shaders: boolean;
}

export type MenuKey = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

/** A tap on a row: `side` is -1 on its left part, 1 on its right, 0 in the middle. */
export interface MenuTap {
  row: number;
  side: -1 | 0 | 1;
}

export type MenuInput = MenuKey | MenuTap;

export interface MenuResult {
  menu: MenuState;
  commands: GameCommand[];
  /** True when the input toggled the sound; the shell counts it as a mute press. */
  mute: boolean;
}

/** Volume rows step in tenths. */
export const VOLUME_STEPS = 10;

/** The menu panel on the scene. It fits inside the portrait window, so every row is reachable on a phone. */
export const MENU_PANEL: Rect = { x: PLAY_X0 + 24, y: 36, w: PLAY_W - 48, h: 156 };
export const MENU_TITLE_Y = MENU_PANEL.y + 6;
export const MENU_ROW_H = 14;
export const MENU_FIRST_ROW_Y = MENU_PANEL.y + 24;
/** Share of a row's width at each end that counts as its arrow when tapped. */
const SIDE_SHARE = 0.3;

export function menuRowRect(index: number): Rect {
  return { x: MENU_PANEL.x + 4, y: MENU_FIRST_ROW_Y + index * MENU_ROW_H, w: MENU_PANEL.w - 8, h: MENU_ROW_H };
}

function volumeLabel(value: number): string {
  return String(Math.round(value * VOLUME_STEPS));
}

export function menuRows(s: GameState, caps: MenuCaps): MenuRow[] {
  const onTitle = s.phase === 'title';
  const { settings } = s.save;
  const rows: MenuRow[] = [{ id: 'resume', label: onTitle ? 'CLOSE' : 'RESUME', value: null, enabled: true }];
  if (!onTitle) rows.push({ id: 'restart', label: 'RESTART', value: null, enabled: true });
  rows.push(
    { id: 'theme', label: 'THEME', value: getTheme(settings.theme).name, enabled: s.save.unlocked.length > 1 },
    { id: 'sound', label: 'SOUND', value: settings.muted ? 'OFF' : 'ON', enabled: true },
    { id: 'music', label: 'MUSIC', value: volumeLabel(settings.music), enabled: true },
    { id: 'sfx', label: 'SFX', value: volumeLabel(settings.sfx), enabled: true },
    { id: 'display', label: 'DISPLAY', value: caps.shaders ? getShaderPreset(settings.shader).name : 'N/A', enabled: caps.shaders },
  );
  if (!onTitle) rows.push({ id: 'quit', label: 'QUIT TO TITLE', value: null, enabled: true });
  return rows;
}

/** The row under a scene point, as a tap, or null outside the rows. */
export function menuTapAt(point: Point, rowCount: number): MenuTap | null {
  for (let row = 0; row < rowCount; row++) {
    const r = menuRowRect(row);
    if (point.x < r.x || point.x >= r.x + r.w || point.y < r.y || point.y >= r.y + r.h) continue;
    const share = (point.x - r.x) / r.w;
    return { row, side: share < SIDE_SHARE ? -1 : share >= 1 - SIDE_SHARE ? 1 : 0 };
  }
  return null;
}

function cycle<T>(list: readonly T[], current: T, dir: number): T {
  const i = list.indexOf(current);
  const n = list.length;
  return list[(((i < 0 ? 0 : i) + dir) % n + n) % n] ?? current;
}

function stepVolume(value: number, dir: number): number {
  const steps = Math.min(VOLUME_STEPS, Math.max(0, Math.round(value * VOLUME_STEPS) + dir));
  return steps / VOLUME_STEPS;
}

/** The command for moving a setting row by `dir` (-1 or 1), or a mute toggle for the sound row. */
function adjust(row: MenuRow, s: GameState, dir: 1 | -1): Pick<MenuResult, 'commands' | 'mute'> {
  const { settings } = s.save;
  if (!row.enabled) return { commands: [], mute: false };
  switch (row.id) {
    case 'theme':
      return { commands: [{ type: 'theme', theme: cycle<ThemeId>(s.save.unlocked, settings.theme, dir) }], mute: false };
    case 'sound':
      return { commands: [], mute: true };
    case 'music':
    case 'sfx': {
      const bus: VolumeBus = row.id;
      return { commands: [{ type: 'volume', bus, value: stepVolume(settings[bus], dir) }], mute: false };
    }
    case 'display': {
      const ids = SHADER_PRESETS.map((p) => p.id);
      return { commands: [{ type: 'shader', preset: cycle<ShaderPresetId>(ids, settings.shader, dir) }], mute: false };
    }
    case 'resume':
    case 'restart':
    case 'quit':
      return { commands: [], mute: false };
  }
}

/** The command for activating a row: the action, or the next value of a setting. */
function activate(row: MenuRow, s: GameState): Pick<MenuResult, 'commands' | 'mute'> {
  switch (row.id) {
    case 'resume':
      return { commands: [{ type: 'resume' }], mute: false };
    case 'restart':
      return { commands: [{ type: 'restart' }], mute: false };
    case 'quit':
      return { commands: [{ type: 'quit' }], mute: false };
    default:
      return adjust(row, s, 1);
  }
}

/** Applies one key or tap to the open menu. */
export function menuStep(menu: MenuState, input: MenuInput, s: GameState, caps: MenuCaps): MenuResult {
  const rows = menuRows(s, caps);
  const count = rows.length;
  const cursor = Math.min(count - 1, Math.max(0, menu.cursor));
  const none = { commands: [], mute: false };
  if (typeof input !== 'string') {
    if (input.row < 0 || input.row >= count) return { menu: { cursor }, ...none };
    const row = rows[input.row];
    if (!row) return { menu: { cursor }, ...none };
    const result = input.side === 0 || row.value === null ? activate(row, s) : adjust(row, s, input.side);
    return { menu: { cursor: input.row }, ...result };
  }
  const row = rows[cursor];
  if (!row) return { menu: { cursor }, ...none };
  switch (input) {
    case 'up':
      return { menu: { cursor: (cursor + count - 1) % count }, ...none };
    case 'down':
      return { menu: { cursor: (cursor + 1) % count }, ...none };
    case 'left':
      return { menu: { cursor }, ...adjust(row, s, -1) };
    case 'right':
      return { menu: { cursor }, ...adjust(row, s, 1) };
    case 'confirm':
      return { menu: { cursor }, ...activate(row, s) };
    case 'back':
      return { menu: { cursor }, commands: [{ type: 'resume' }], mute: false };
  }
}
