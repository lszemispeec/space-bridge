/**
 * How the fixed 320x240 scene is shown on a screen. Pure, so the choice is
 * testable; `canvas.ts` applies it.
 *
 * The visible canvas is the operator room (see `roomLayout` in layout.ts):
 * the scene shows through its window, the console with the HUD sits below
 * or beside it. Desktop and tall landscape screens show the whole scene
 * with the console below. Short landscape screens, a phone in Safari, use
 * the `side` room: the console is split into panels left and right of the
 * window, so the scene comes out larger. Portrait shows the 256 px playfield
 * and moves the levers into a strip under the console; the room art draws
 * that strip.
 *
 * On a dpr 1 screen the canvas is scaled by a whole number of device pixels
 * per room pixel, the largest that fits, so pixels stay crisp. On a dense
 * screen (dpr 2 and up) it fills the viewport instead: uneven pixel columns
 * are not visible at that density, and a whole-number step would waste up
 * to a third of a phone's screen.
 */
import { inRect, LAYOUTS, PLAY_W, PLAY_X0, roomLayout, SCREEN_H, SCREEN_W, type LayoutId, type Orientation } from '../config/layout';
import type { Point } from '../game/jump';

export type { LayoutId, Orientation } from '../config/layout';

export interface Viewport {
  orientation: Orientation;
  /** The room layout on the canvas. */
  layout: LayoutId;
  /** Device pixels per room pixel: a whole number at dpr 1, any number above. */
  scale: number;
  /** Size of the visible canvas in room pixels. */
  width: number;
  height: number;
  /** Size of the visible canvas in CSS pixels. */
  cssW: number;
  cssH: number;
}

/** The parts of the viewport under the notch, the rounded corners and the home bar, in CSS pixels. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** The visible canvas size, in room pixels, of each layout. */
export const CANVAS_SIZE: Record<LayoutId, { w: number; h: number }> = Object.fromEntries(
  LAYOUTS.map((id) => [id, { w: roomLayout(id).w, h: roomLayout(id).h }]),
) as Record<LayoutId, { w: number; h: number }>;

/** Dense screens fill the viewport; below this ratio the scale stays a whole number. */
export const FILL_MIN_DPR = 2;

/** Largest whole number of device pixels per room pixel at which `w` x `h` room pixels fit the viewport. */
export function fitScale(viewportW: number, viewportH: number, dpr: number, w: number, h: number): number {
  return Math.max(1, Math.floor(fillScale(viewportW, viewportH, dpr, w, h)));
}

/** Device pixels per room pixel at which `w` x `h` room pixels exactly fit the viewport, at least 1. */
export function fillScale(viewportW: number, viewportH: number, dpr: number, w: number, h: number): number {
  return Math.max(1, Math.min((viewportW * dpr) / w, (viewportH * dpr) / h));
}

/** The scale in use on a screen: whole numbers on a dpr 1 screen, a fill on a dense one. */
export function screenScale(viewportW: number, viewportH: number, dpr: number, w: number, h: number): number {
  const pick = dpr >= FILL_MIN_DPR ? fillScale : fitScale;
  return pick(viewportW, viewportH, dpr, w, h);
}

export function orientationOf(viewportW: number, viewportH: number): Orientation {
  return viewportH > viewportW ? 'portrait' : 'landscape';
}

/**
 * The layout for a screen: portrait on a tall one; on a wide one, the side
 * room when it shows the scene larger than the console-under-window room,
 * otherwise the landscape room. A tie keeps the landscape room.
 */
export function chooseLayout(viewportW: number, viewportH: number, dpr: number): LayoutId {
  if (orientationOf(viewportW, viewportH) === 'portrait') return 'portrait';
  const scaleOf = (id: LayoutId): number => screenScale(viewportW, viewportH, dpr, CANVAS_SIZE[id].w, CANVAS_SIZE[id].h);
  return scaleOf('side') > scaleOf('landscape') ? 'side' : 'landscape';
}

export function chooseViewport(viewportW: number, viewportH: number, dpr = 1, insets: Insets = NO_INSETS): Viewport {
  const safeW = Math.max(1, viewportW - insets.left - insets.right);
  const safeH = Math.max(1, viewportH - insets.top - insets.bottom);
  const orientation = orientationOf(safeW, safeH);
  const layout = chooseLayout(safeW, safeH, dpr);
  const { w, h } = CANVAS_SIZE[layout];
  const scale = screenScale(safeW, safeH, dpr, w, h);
  return { orientation, layout, scale, width: w, height: h, cssW: (w * scale) / dpr, cssH: (h * scale) / dpr };
}

/**
 * Maps a point on the visible canvas, in room pixels, to a point on the
 * 320x240 scene. Null outside the window: the console has its own targets,
 * and a tap on the frame or in the portrait lever strip is a plate press for
 * its half of the screen.
 */
export function canvasToFrame(x: number, y: number, v: Viewport): Point | null {
  if (x < 0 || y < 0 || x >= v.width || y >= v.height) return null;
  const { window: win, orientation } = roomLayout(v.layout);
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
export function composition(layout: LayoutId): Blit {
  const room = roomLayout(layout);
  const { x: dx, y: dy } = room.window;
  if (room.orientation === 'landscape') return { sx: 0, sy: 0, w: SCREEN_W, h: SCREEN_H, dx, dy };
  return { sx: PLAY_X0, sy: 0, w: PLAY_W, h: SCREEN_H, dx, dy };
}
