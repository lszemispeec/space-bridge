import type { Song } from '../song';
import type { JingleId, ThemeId } from '../types';
import { desertExpedition } from './desertExpedition';
import { gameOverJingle } from './gameOverJingle';
import { neonOrbit } from './neonOrbit';
import { polarSignal } from './polarSignal';

export const THEME_SONGS: Readonly<Record<ThemeId, Song>> = {
  'polar-signal': polarSignal,
  'desert-expedition': desertExpedition,
  'neon-orbit': neonOrbit,
};

export const JINGLE_SONGS: Readonly<Record<JingleId, Song>> = {
  gameOver: gameOverJingle,
};
