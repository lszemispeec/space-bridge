/**
 * Theme content is data, not code. The palettes come from the approved
 * art directions. Unlocks are driven by the best score of any mode.
 */
export type ThemeId = 'polar-signal' | 'desert-expedition' | 'neon-orbit';

export interface ThemePalette {
  sky: string;
  horizon: string;
  ground: string;
  road: string;
  crater: string;
  gutter: string;
  gutterArrow: string;
  hud: string;
  rocket: string;
  rover: string;
  plate: string;
  cosmonaut: string;
  cosmonautVisor: string;
  accent: string;
  text: string;
  overlay: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  /** Best score needed to unlock. 0 means available from the start. */
  unlockAt: number;
  /** Path of the atlas JSON, relative to the public root. Not yet wired. */
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
    palette: {
      sky: '#F6F1D6',
      horizon: '#9FBBA1',
      ground: '#85AA96',
      road: '#BFCFAF',
      crater: '#0A2227',
      gutter: '#163B3C',
      gutterArrow: '#FBF6E2',
      hud: '#163B3C',
      rocket: '#FCFCF3',
      rover: '#FCFCF3',
      plate: '#CF6444',
      cosmonaut: '#FCFCF3',
      cosmonautVisor: '#0A2227',
      accent: '#CF6444',
      text: '#163B3C',
      overlay: '#0A2227',
    },
  },
  {
    id: 'desert-expedition',
    name: 'DESERT EXPEDITION',
    unlockAt: 500,
    atlas: 'atlas/desert-expedition.json',
    music: 'desert-expedition',
    palette: {
      sky: '#66BAC3',
      horizon: '#9E565D',
      ground: '#DDA86B',
      road: '#F69961',
      crater: '#2B1D2A',
      gutter: '#2C1C2A',
      gutterArrow: '#D1C9AE',
      hud: '#2B1D2A',
      rocket: '#D1C9AE',
      rover: '#D1C9AE',
      plate: '#F4914E',
      cosmonaut: '#D1C9AE',
      cosmonautVisor: '#2B1D2A',
      accent: '#DA5E39',
      text: '#2B1D2A',
      overlay: '#2B1D2A',
    },
  },
  {
    id: 'neon-orbit',
    name: 'NEON ORBIT',
    unlockAt: 1000,
    atlas: 'atlas/neon-orbit.json',
    music: 'neon-orbit',
    palette: {
      sky: '#040718',
      horizon: '#2C258D',
      ground: '#152369',
      road: '#5723A2',
      crater: '#03040B',
      gutter: '#060C28',
      gutterArrow: '#27CEE5',
      hud: '#27CEE5',
      rocket: '#27CEE5',
      rover: '#C92ED5',
      plate: '#D6D43D',
      cosmonaut: '#DDEED5',
      cosmonautVisor: '#D6D43D',
      accent: '#C92ED5',
      text: '#DDEED5',
      overlay: '#03040B',
    },
  },
];

export const DEFAULT_THEME: ThemeId = 'polar-signal';

export function getTheme(id: ThemeId): Theme {
  const theme = THEMES.find((t) => t.id === id);
  if (!theme) throw new Error(`Unknown theme: ${id}`);
  return theme;
}
