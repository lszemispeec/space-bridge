import type { Song } from '../song';
import type { JingleId, MusicId } from '../types';
import { desertExpedition } from './desertExpedition';
import { gameOverJingle } from './gameOverJingle';
import { neonOrbit } from './neonOrbit';
import { polarSignal } from './polarSignal';
import { vector } from './vector';

export const THEME_SONGS: Readonly<Record<MusicId, Song>> = {
  'polar-signal': polarSignal,
  'desert-expedition': desertExpedition,
  'neon-orbit': neonOrbit,
  vector,
};

export const JINGLE_SONGS: Readonly<Record<JingleId, Song>> = {
  gameOver: gameOverJingle,
};
