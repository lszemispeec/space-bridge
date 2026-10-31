import { THEMES, type ThemeId } from '../config/themes';

/** Themes that a best score unlocks but that are not yet in `unlocked`. */
export function newlyUnlocked(bestScore: number, unlocked: readonly ThemeId[]): ThemeId[] {
  return THEMES.filter((t) => bestScore >= t.unlockAt && !unlocked.includes(t.id)).map((t) => t.id);
}

/** The next unlocked theme after `current`, in config order. Wraps around. */
export function nextUnlockedTheme(current: ThemeId, unlocked: readonly ThemeId[]): ThemeId {
  const order = THEMES.map((t) => t.id).filter((id) => unlocked.includes(id));
  const index = order.indexOf(current);
  const next = order[(index + 1) % order.length];
  return next ?? current;
}
