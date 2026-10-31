/**
 * How the fixed 320x240 scene is shown on a screen. Pure, so the choice is
 * testable; `canvas.ts` applies it.
 *
 * The visible canvas is the operator room (see `roomLayout` in layout.ts):
 * the scene shows through its window, the console with the HUD sits below.
 * Landscape and desktop show the whole scene, levers in the gutters at the
 * sides. Portrait shows the 256 px playfield and moves the levers into a
 * strip under the console; the room art draws that strip. The canvas is
 * scaled by a whole number of device pixels per room pixel, the largest
 * that fits, so pixels stay crisp on every screen.
 */
import { inRect, PLAY_W, PLAY_X0, roomLayout, SCREEN_H, SCREEN_W, type Orientation } from '../config/layout';
import type { Point } from '../game/jump';

export type { Orientation } from '../config/layout';

export interface Viewport {
  orientation: Orientation;
  /** Device pixels per room pixel. */
  scale: number;
  /** Size of the visible canvas in room pixels. */
  width: number;
  height: number;
  /** Size of the visible canvas in CSS pixels. */
  cssW: number;
  cssH: number;
}

/** The visible canvas size, in room pixels, of each orientation. */
export const CANVAS_SIZE: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: roomLayout('landscape').w, h: roomLayout('landscape').h },
  portrait: { w: roomLayout('portrait').w, h: roomLayout('portrait').h },
};

/** Largest whole number of device pixels per room pixel at which `w` x `h` room pixels fit the viewport. */
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
 * Maps a point on the visible canvas, in room pixels, to a point on the
 * 320x240 scene. Null outside the window: the console has its own targets,
 * and a tap on the frame or in the portrait lever strip is a plate press for
 * its half of the screen.
 */
export function canvasToFrame(x: number, y: number, v: Viewport): Point | null {
  if (x < 0 || y < 0 || x >= v.width || y >= v.height) return null;
  const { window: win, orientation } = roomLayout(v.orientation);
  if (!inRect(win, x, y)) return null;
  return { x: x - win.x + (orientation === 'portrait' ? PLAY_X0 : 0), y: y - win.y };
}

export interface Blit {
  /** Source rectangle on the scene. */
  sx: number;
  sy: number;
  w: number;
  h: number;
  /** Top-left corner on the visible canvas. */
  dx: number;
  dy: number;
}

/** The copy that puts the scene into the room's window on the visible canvas. */
export function composition(orientation: Orientation): Blit {
  const { x: dx, y: dy } = roomLayout(orientation).window;
  if (orientation === 'landscape') return { sx: 0, sy: 0, w: SCREEN_W, h: SCREEN_H, dx, dy };
  return { sx: PLAY_X0, sy: 0, w: PLAY_W, h: SCREEN_H, dx, dy };
}
