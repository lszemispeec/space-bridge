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

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** On-screen buttons drawn on the scene. Taps inside them do not count as plate presses. */
export const TAP_TARGETS = {
  /** Cycles the theme. Title screen only. */
  titleTheme: { x: 100, y: 190, w: 56, h: 16 },
  /** Toggles mute. Title screen only. */
  titleMute: { x: 164, y: 190, w: 56, h: 16 },
} as const satisfies Record<string, Rect>;

/** `hudMute` is the sound readout on the console; see `CONSOLE_HUD`. */
export type TapTargetId = keyof typeof TAP_TARGETS | 'hudMute';

/**
 * The operator room: the player looks at the scene through the windshield of
 * the bridge's control room. The window frame sits outside the 320x240 scene
 * and the console under it holds the HUD and the levers, so the visible
 * canvas is larger than the scene. `bezel` is the frame thickness: struts at
 * the sides and a lintel on top. `consoleH` is the height of the console
 * deck per orientation; in portrait the deck also holds the lever strip.
 * `cornerCut` is the size of the slanted upper mullions, which cover the
 * scene's top corners where x + y < cornerCut. The atlas carries the same
 * numbers in its `operatorRoom` table; the art test checks that the two agree.
 */
export const ROOM = {
  bezel: { side: 16, top: 12 },
  consoleH: { landscape: 68, portrait: 92 },
  cornerCut: 20,
  /** The deck-mounted lever art: 40x64 frames, their bases on the console, overlapping the window's bottom edge. */
  lever: { w: 40, h: 64, inset: 8, overlap: 12 },
  /** The lever tap zones keep the gutters' old 24x48 button rectangles. */
  leverTap: { w: 24, h: 48 },
} as const;

/** The name of the atlas plate drawn through the window: it fills the glass edge to edge. */
export const ROOM_BACKGROUND = 'background.window';

export type Orientation = 'landscape' | 'portrait';

export type PlateSide = 'left' | 'right';

/** Where the parts of the room sit on the visible canvas, in room pixels. */
export interface RoomLayout {
  orientation: Orientation;
  w: number;
  h: number;
  /** The part of the scene that shows through the window: the whole frame in landscape, the playfield in portrait. */
  window: Rect;
  /** The console deck under the window, with the HUD readouts and the levers. */
  console: Rect;
  /** Top-left corners of the two lever frames on the deck. Art only; the taps are `leverTaps`. */
  levers: Record<PlateSide, { x: number; y: number }>;
  /** The lever tap zones: beside the window in landscape, in the strip in portrait. */
  leverTaps: Record<PlateSide, Rect>;
  /** Portrait only: the strip at the bottom of the console that holds the lever taps. The room art draws it. */
  strip: Rect | null;
}

export function roomLayout(orientation: Orientation): RoomLayout {
  const { side, top } = ROOM.bezel;
  const consoleH = ROOM.consoleH[orientation];
  const sceneW = orientation === 'landscape' ? SCREEN_W : PLAY_W;
  const w = sceneW + 2 * side;
  const consoleY = top + SCREEN_H;
  const h = consoleY + consoleH;
  const strip = orientation === 'portrait' ? { x: side, y: h - PORTRAIT_STRIP.h, w: sceneW, h: PORTRAIT_STRIP.h } : null;
  const tapY = strip ? strip.y + SIDE_BUTTONS.left.y - PORTRAIT_STRIP.y : top + SIDE_BUTTONS.left.y;
  const leverY = consoleY - ROOM.lever.overlap;
  const tap = ROOM.leverTap;
  return {
    orientation,
    w,
    h,
    window: { x: side, y: top, w: sceneW, h: SCREEN_H },
    console: { x: 0, y: consoleY, w, h: consoleH },
    levers: {
      left: { x: ROOM.lever.inset, y: leverY },
      right: { x: w - ROOM.lever.inset - ROOM.lever.w, y: leverY },
    },
    leverTaps: {
      left: { x: side + SIDE_BUTTONS.left.x, y: tapY, ...tap },
      right: { x: side + sceneW - GUTTER_W + SIDE_BUTTONS.left.x, y: tapY, ...tap },
    },
    strip,
  };
}

/** A rectangle on the scene, moved to where the window shows it on the room canvas. */
export function frameToRoom(r: Rect, room: RoomLayout): Rect {
  const shift = room.orientation === 'portrait' ? PLAY_X0 : 0;
  return { x: r.x - shift + room.window.x, y: r.y + room.window.y, w: r.w, h: r.h };
}

/**
 * The HUD readouts on the console, in room pixels. The same in both
 * orientations: the score row and the lives row fit the narrower portrait
 * console. `sound` is the `hudMute` tap target; `lights` is where the console
 * light loop blinks.
 */
export const CONSOLE_HUD = {
  scoreIcon: { x: 56, y: 262 },
  digits: { x: 72, y: 262, pitch: 8, count: 4 },
  modeLabel: { x: 112, y: 266 },
  lives: { x: 80, y: 290, pitch: 20 },
  sound: { x: 188, y: 260, w: 36, h: 16 },
  lights: { x: 152, y: 298 },
} as const;

/**
 * The title's button row: both buttons and the gap between them. A tap in
 * the row that misses a button does nothing, so a thumb that lands in the
 * gap never starts a round.
 */
export const TITLE_BUTTON_ROW: Rect = union(TAP_TARGETS.titleTheme, TAP_TARGETS.titleMute);

/**
 * Portrait layout: the levers move below the console into a strip of height
 * `h`. `y` is the top of the slice of the gutter the levers come from, so a
 * lever keeps its margin inside the strip.
 */
export const PORTRAIT_STRIP = { y: 148, h: 56 } as const;

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
