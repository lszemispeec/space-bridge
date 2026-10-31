import { DEFAULT_THEME, THEMES, type ThemeId } from '../config/themes';
import type { SaveData } from './types';

export const SAVE_KEY = 'space-bridge.save.v1';

export function defaultSave(): SaveData {
  return {
    version: 1,
    highScores: { A: 0, B: 0 },
    unlocked: [DEFAULT_THEME],
    settings: { theme: DEFAULT_THEME, muted: false, mode: 'A' },
  };
}

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some((t) => t.id === value);
}

function asNonNegativeInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

/**
 * Parses a stored JSON string into valid save data.
 * Unknown or corrupt input falls back to defaults field by field, so a bad
 * save never breaks the game. New versions add a migration branch here.
 */
export function parseSave(raw: string | null | undefined): SaveData {
  const base = defaultSave();
  if (!raw) return base;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return base;
  }
  if (typeof data !== 'object' || data === null) return base;
  const obj = data as Record<string, unknown>;

  const hs = (obj.highScores ?? {}) as Record<string, unknown>;
  base.highScores = { A: asNonNegativeInt(hs.A), B: asNonNegativeInt(hs.B) };

  if (Array.isArray(obj.unlocked)) {
    const ids = obj.unlocked.filter(isThemeId);
    base.unlocked = Array.from(new Set([DEFAULT_THEME, ...ids]));
  }

  const settings = (obj.settings ?? {}) as Record<string, unknown>;
  if (isThemeId(settings.theme) && base.unlocked.includes(settings.theme)) {
    base.settings.theme = settings.theme;
  }
  if (typeof settings.muted === 'boolean') base.settings.muted = settings.muted;
  if (settings.mode === 'A' || settings.mode === 'B') base.settings.mode = settings.mode;

  return base;
}

export function serializeSave(save: SaveData): string {
  return JSON.stringify(save);
}
