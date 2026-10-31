/**
 * Theme content is data, not code. Every theme ships one atlas (see
 * docs/atlas-contract.md); the game swaps a theme by loading another file.
 * The few colours here are for text the renderer draws over the art, taken
 * from that theme's 16-colour palette. Unlocks are driven by the best score
 * of any mode.
 */
export type ThemeId = 'polar-signal' | 'desert-expedition' | 'neon-orbit';

export interface ThemePalette {
  /** Menu and HUD text. */
  text: string;
  /** Records, unlocks and hints. */
  accent: string;
  /** Dim fill behind the title and game over text, and the loading screen. */
  overlay: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  /** Best score needed to unlock. 0 means available from the start. */
  unlockAt: number;
  /** Path of the atlas JSON, relative to the page. The sheet path is inside it. */
  atlas: string;
  /** Music track id for the audio engine. */
  music: string;
  palette: ThemePalette;
}

export const THEMES: readonly Theme[] = [
  {
    id: 'polar-signal',
    name: 'POLAR SIGNAL',
    unlockAt: 0,
    atlas: 'atlas/polar-signal.json',
    music: 'polar-signal',
    palette: { text: '#FFFAE8', accent: '#E67B59', overlay: '#173B3A' },
  },
  {
    id: 'desert-expedition',
    name: 'DESERT EXPEDITION',
    unlockAt: 500,
    atlas: 'atlas/desert-expedition.json',
    music: 'desert-expedition',
    palette: { text: '#FFF4DA', accent: '#F16A42', overlay: '#251C29' },
  },
  {
    id: 'neon-orbit',
    name: 'NEON ORBIT',
    unlockAt: 1000,
    atlas: 'atlas/neon-orbit.json',
    music: 'neon-orbit',
    palette: { text: '#FFF8CB', accent: '#55E7DE', overlay: '#080C24' },
  },
];

export const DEFAULT_THEME: ThemeId = 'polar-signal';

export function getTheme(id: ThemeId): Theme {
  const theme = THEMES.find((t) => t.id === id);
  if (!theme) throw new Error(`Unknown theme: ${id}`);
  return theme;
}
