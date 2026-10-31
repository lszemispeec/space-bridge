/**
 * Fixed internal resolution and the positions of everything on the playfield.
 * All values are in internal pixels (320x240). The renderer scales the result.
 *
 * Slots are the stops on the cosmonaut's path:
 *   0 = rocket door, 1..4 = craters, 5 = rover door.
 * The bridge plate can only sit on a crater slot (1..4).
 *
 * Sprite positions follow docs/atlas-contract.md and assets/README.md: the
 * art is drawn at these anchors and the simulation keeps its own collision
 * coordinates (the ground line and the slot x values).
 */
export const SCREEN_W = 320;
export const SCREEN_H = 240;

export const GUTTER_W = 32;
export const PLAY_X0 = GUTTER_W;
export const PLAY_X1 = SCREEN_W - GUTTER_W;

export const GROUND_Y = 175;

export const CRATER_SLOTS = [1, 2, 3, 4] as const;
export const ROCKET_SLOT = 0;
export const ROVER_SLOT = 5;
export const SLOT_COUNT = 6;

/** Landing x of each slot, left to right. */
export const SLOT_X: readonly number[] = [82, 106, 146, 186, 226, 252];

/** Vehicle hulls. The art anchors are their bottom-left corners. */
export const ROCKET = { x: 43, y: 80, w: 33, h: 89 } as const;
export const ROVER = { x: 248, y: 142, w: 33, h: 38 } as const;

/** Crater frames are centred here, so the back rim straddles the ground line. */
export const CRATER_Y = 177;
/** Bottom of the plate frame; its top surface meets the ground line. */
export const PLATE_Y = 181;
/** Nothing of a fallen cosmonaut shows below this line. */
export const CRATER_BOTTOM_Y = 181;

/** Top-left corners of the on-screen plate buttons inside the gutters. */
export const SIDE_BUTTONS = {
  left: { x: 4, y: 152 },
  right: { x: 292, y: 152 },
} as const;

export const HUD = {
  scoreIcon: { x: 40, y: 8 },
  digits: { x: 56, y: 8, pitch: 8, count: 4 },
  modeLabel: { x: 40, y: 22 },
  lives: { x: 212, y: 7, pitch: 20 },
} as const;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** On-screen buttons. Taps inside them do not count as plate presses. */
export const TAP_TARGETS = {
  /** Cycles the theme. Title screen only. */
  titleTheme: { x: 100, y: 190, w: 56, h: 16 },
  /** Toggles mute. Title screen only. */
  titleMute: { x: 164, y: 190, w: 56, h: 16 },
  /** Toggles mute. Every screen, in the HUD. */
  hudMute: { x: 142, y: 4, w: 36, h: 16 },
} as const satisfies Record<string, Rect>;

export type TapTargetId = keyof typeof TAP_TARGETS;

/** Smallest comfortable thumb target on a touch screen, in CSS pixels. */
export const MIN_TAP_CSS_PX = 44;

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/**
 * The hit area of a drawn button: the art rectangle, grown around its centre
 * to at least `minSize` game pixels in each direction. The art keeps its size.
 */
export function hitRect(r: Rect, minSize: number): Rect {
  const w = Math.max(r.w, minSize);
  const h = Math.max(r.h, minSize);
  return { x: r.x - (w - r.w) / 2, y: r.y - (h - r.h) / 2, w, h };
}

/** Arc height of a jump between two neighbouring slots. */
export const JUMP_HEIGHT = 26;
/** How far below the ground a fallen cosmonaut sinks. */
export const FALL_DEPTH = 18;
