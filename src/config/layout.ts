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
export const PLAY_W = PLAY_X1 - PLAY_X0;

export const GROUND_Y = 175;

export const CRATER_SLOTS = [1, 2, 3, 4] as const;
export const ROCKET_SLOT = 0;
export const ROVER_SLOT = 5;
export const SLOT_COUNT = 6;

/** Landing x of each slot, left to right. */
export const SLOT_X: readonly number[] = [82, 106, 146, 186, 226, 252];

/** Vehicle hulls. The art anchors are their bottom-left corners. */
export const ROCKET = { x: 43, y: 80, w: 33, h: 89 } as const;
/**
 * Feet position of a cosmonaut on the ledge outside the hatch, about two
 * thirds of the way up the rocket. The atlas's `rocketLedge` socket gives the
 * same point from the art; this is the default when it has none.
 */
export const ROCKET_LEDGE = { x: 82, y: 110 } as const;
export const ROVER = { x: 248, y: 142, w: 33, h: 38 } as const;

/** Crater frames are centred here, so the back rim straddles the ground line. */
export const CRATER_Y = 177;
/** Bottom of the plate frame; its top surface meets the ground line. */
export const PLATE_Y = 181;
/** Nothing of a grabbed cosmonaut shows below this line; the crater's front lip covers the rest. */
export const CRATER_BOTTOM_Y = 180;

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

/**
 * The title's button row: both buttons and the gap between them. A tap in
 * the row that misses a button does nothing, so a thumb that lands in the
 * gap never starts a round.
 */
export const TITLE_BUTTON_ROW: Rect = union(TAP_TARGETS.titleTheme, TAP_TARGETS.titleMute);

/**
 * Portrait layout: the gutters move below the playfield as one strip.
 * `y`/`h` is the slice of each gutter column that holds its side button,
 * with a margin; `tileY` is a plain slice of the column, used to fill the
 * strip between the two buttons.
 */
export const PORTRAIT_STRIP = { y: 148, h: 56, tileY: 60 } as const;

/** Smallest comfortable thumb target on a touch screen, in CSS pixels. */
export const MIN_TAP_CSS_PX = 44;

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** Smallest rectangle that holds both. */
export function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
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

/**
 * Arc height of a jump between two neighbouring slots. The IM-09 throws its
 * cosmonauts high: the feet reach y 85 at the apex, the sprite top y 63, so
 * the arcs are tall and narrow and three or four are in the air at once.
 */
export const JUMP_HEIGHT = 90;
/**
 * Lift of the first arc, from the ledge down to crater 1. The ledge is already
 * high, so a small lift rises a little above it and then drops to the ground.
 */
export const DROP_HEIGHT = 36;
/** How far below the ground a fallen cosmonaut sinks. */
export const FALL_DEPTH = 18;
