/**
 * How the fixed 320x240 frame is shown on a screen. Pure, so the choice is
 * testable; `canvas.ts` applies it.
 *
 * Landscape and desktop show the frame as it is, gutters at the sides.
 * Portrait shows the 256 px playfield on top and moves the gutters, with
 * their side buttons, into a strip below it. The canvas is scaled by a whole
 * number of device pixels per game pixel, the largest that fits, so pixels
 * stay crisp on every screen.
 */
import { GUTTER_W, PLAY_W, PLAY_X0, PORTRAIT_STRIP, SCREEN_H, SCREEN_W } from '../config/layout';
import type { Point } from '../game/jump';

export type Orientation = 'landscape' | 'portrait';

export interface Viewport {
  orientation: Orientation;
  /** Device pixels per game pixel. */
  scale: number;
  /** Size of the visible canvas in game pixels. */
  width: number;
  height: number;
  /** Size of the visible canvas in CSS pixels. */
  cssW: number;
  cssH: number;
}

/** The visible canvas size, in game pixels, of each orientation. */
export const CANVAS_SIZE: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: SCREEN_W, h: SCREEN_H },
  portrait: { w: PLAY_W, h: SCREEN_H + PORTRAIT_STRIP.h },
};

/** Largest whole number of device pixels per game pixel at which `w` x `h` game pixels fit the viewport. */
export function fitScale(viewportW: number, viewportH: number, dpr: number, w: number, h: number): number {
  return Math.max(1, Math.floor(Math.min((viewportW * dpr) / w, (viewportH * dpr) / h)));
}

export function orientationOf(viewportW: number, viewportH: number): Orientation {
  return viewportH > viewportW ? 'portrait' : 'landscape';
}

export function chooseViewport(viewportW: number, viewportH: number, dpr = 1): Viewport {
  const orientation = orientationOf(viewportW, viewportH);
  const { w, h } = CANVAS_SIZE[orientation];
  const scale = fitScale(viewportW, viewportH, dpr, w, h);
  return { orientation, scale, width: w, height: h, cssW: (w * scale) / dpr, cssH: (h * scale) / dpr };
}

/**
 * Maps a point on the visible canvas, in canvas pixels, to a point on the
 * 320x240 frame. Null for the portrait strip: it holds only the side
 * buttons, and a tap there is a plate press for its half of the screen.
 */
export function canvasToFrame(x: number, y: number, v: Viewport): Point | null {
  if (x < 0 || y < 0 || x >= v.width || y >= v.height) return null;
  if (v.orientation === 'landscape') return { x, y };
  if (y >= SCREEN_H) return null;
  return { x: x + PLAY_X0, y };
}

export interface Blit {
  /** Source rectangle on the frame. */
  sx: number;
  sy: number;
  w: number;
  h: number;
  /** Top-left corner on the visible canvas. */
  dx: number;
  dy: number;
}

/** The copies, in draw order, that compose the visible canvas from the frame. */
export function composition(orientation: Orientation): Blit[] {
  if (orientation === 'landscape') return [{ sx: 0, sy: 0, w: SCREEN_W, h: SCREEN_H, dx: 0, dy: 0 }];
  const strip = PORTRAIT_STRIP;
  const blits: Blit[] = [{ sx: PLAY_X0, sy: 0, w: PLAY_W, h: SCREEN_H, dx: 0, dy: 0 }];
  for (let x = 0; x < PLAY_W; x += GUTTER_W) {
    blits.push({ sx: 0, sy: strip.tileY, w: GUTTER_W, h: strip.h, dx: x, dy: SCREEN_H });
  }
  blits.push({ sx: 0, sy: strip.y, w: GUTTER_W, h: strip.h, dx: 0, dy: SCREEN_H });
  blits.push({ sx: PLAY_X0 + PLAY_W, sy: strip.y, w: GUTTER_W, h: strip.h, dx: PLAY_W - GUTTER_W, dy: SCREEN_H });
  return blits;
}
