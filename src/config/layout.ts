/**
 * Fixed internal resolution and the positions of everything on the playfield.
 * All values are in internal pixels (320x240). The renderer scales the result.
 *
 * Slots are the stops on the cosmonaut's path:
 *   0 = the rocket's top hatch, 1..4 = craters, 5 = the rover's hatch.
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

/** Landing x of each slot, left to right. The vehicle slots are the hatch mouths; see `ROCKET_HATCH` and `ROVER_HATCH`. */
export const SLOT_X: readonly number[] = [63, 106, 146, 186, 226, 256];

/** Vehicle hulls. The art anchors are their bottom-left corners. */
export const ROCKET = { x: 43, y: 80, w: 33, h: 89 } as const;
export const ROVER = { x: 248, y: 142, w: 33, h: 38 } as const;
/**
 * Feet position of a cosmonaut standing in the rocket's top hatch, the floor
 * of the mouth about two thirds of the way up the hull. The atlas's
 * `rocketTopHatch` socket gives the same point from the art; this is the
 * default when it has none.
 */
export const ROCKET_HATCH = { x: 63, y: 112 } as const;
/** Feet position of a cosmonaut in the rover's hatch mouth, from the atlas's `roverHatch` socket. */
export const ROVER_HATCH = { x: 256, y: 172 } as const;

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

/** `hudMute` is the sound readout on the console (`RoomLayout.hud.sound`); `hudMenu` is the MENU button (`RoomLayout.menu`). */
export type TapTargetId = keyof typeof TAP_TARGETS | 'hudMute' | 'hudMenu';

/**
 * The operator room: the player looks at the scene through the windshield of
 * the bridge's control room. The window frame sits outside the 320x240 scene
 * and the console under it holds the HUD and the levers, so the visible
 * canvas is larger than the scene. `bezel` is the frame thickness: struts at
 * the sides and a lintel on top. `consoleH` is the height of the console
 * deck per orientation; in portrait the deck also holds the lever strip.
 * `windowCornerRadius` rounds all four glass corners in whole room pixels.
 * Only the quarter-circle corner fills cover the scene. The atlas carries the same
 * numbers in its `operatorRoom` table; the art test checks that the two agree.
 * `SIDE_ROOM` is the third layout, with the console beside the window.
 */
export const ROOM = {
  bezel: { side: 16, top: 12 },
  consoleH: { landscape: 68, portrait: 92 },
  windowCornerRadius: 20,
  /** The deck-mounted lever art: 24x40 frames, wholly on the console, `drop` pixels below the window's bottom edge. */
  lever: { w: 24, h: 40, inset: 8, drop: 18 },
  /** The lever tap zones keep the gutters' old 24x48 button rectangles. */
  leverTap: { w: 24, h: 48 },
} as const;

/**
 * The side room, for short landscape screens such as a phone in Safari: the
 * console is split into two panels left and right of the window, so the
 * room is 448x256 instead of 352x320 and a short screen shows the scene
 * larger. The panels hold the readouts at the top and the levers in the
 * lower half, with tap zones twice the lever's width. The atlas's
 * `operatorRoom.side` table carries the same numbers.
 */
export const SIDE_ROOM = {
  panelW: 64,
  top: 8,
  h: 256,
  levers: { left: { x: 14, y: 180 }, right: { x: 410, y: 180 } },
  leverTap: { w: 40, h: 80, y: 160, inset: 6 },
} as const;

/** The name of the atlas plate drawn through the window: it fills the glass edge to edge. */
export const ROOM_BACKGROUND = 'background.window';

export type Orientation = 'landscape' | 'portrait';

/**
 * The shape of the room on the canvas: `landscape` and `portrait` put the
 * console under the window; `side` puts it beside the window, for short
 * landscape screens. `side` shows the whole scene, like `landscape`.
 */
export type LayoutId = Orientation | 'side';

export const LAYOUTS: readonly LayoutId[] = ['landscape', 'portrait', 'side'];

export type PlateSide = 'left' | 'right';

/** The HUD readouts on the console, in room pixels. See `CONSOLE_HUD`. */
export interface ConsoleHud {
  scoreIcon: { x: number; y: number };
  digits: { x: number; y: number; pitch: number; count: number };
  modeLabel: { x: number; y: number };
  lives: { x: number; y: number; pitch: number };
  /** The sound readout, the `hudMute` tap target. */
  sound: Rect;
  /** The status lamp, a 6x6 loop. */
  lights: { x: number; y: number };
}

/** Where the parts of the room sit on the visible canvas, in room pixels. */
export interface RoomLayout {
  id: LayoutId;
  /** The screen orientation the layout is for; `side` is a landscape layout. */
  orientation: Orientation;
  w: number;
  h: number;
  /** The part of the scene that shows through the window: the whole frame in landscape and side, the playfield in portrait. */
  window: Rect;
  /** The console deck under the window, with the HUD readouts and the levers. Null in `side`, which has `panels`. */
  console: Rect | null;
  /** Side only: the two console panels beside the window. */
  panels: Record<PlateSide, Rect> | null;
  /** Top-left corners of the two lever frames on the deck. Art only; the taps are `leverTaps`. */
  levers: Record<PlateSide, { x: number; y: number }>;
  /** The lever tap zones: beside the window in landscape, in the strip in portrait, on the panels in side. */
  leverTaps: Record<PlateSide, Rect>;
  /** Portrait only: the strip at the bottom of the console that holds the lever taps. The room art draws it. */
  strip: Rect | null;
  /** The HUD readouts, in room pixels. */
  hud: ConsoleHud;
  /** The MENU button, the `hudMenu` tap target. */
  menu: Rect;
}

export function roomLayout(id: LayoutId): RoomLayout {
  if (id === 'side') return sideLayout();
  const orientation = id;
  const { side, top } = ROOM.bezel;
  const consoleH = ROOM.consoleH[orientation];
  const sceneW = orientation === 'landscape' ? SCREEN_W : PLAY_W;
  const w = sceneW + 2 * side;
  const consoleY = top + SCREEN_H;
  const h = consoleY + consoleH;
  const strip = orientation === 'portrait' ? { x: side, y: h - PORTRAIT_STRIP.h, w: sceneW, h: PORTRAIT_STRIP.h } : null;
  const tapY = strip ? strip.y + SIDE_BUTTONS.left.y - PORTRAIT_STRIP.y : top + SIDE_BUTTONS.left.y;
  const leverY = consoleY + ROOM.lever.drop;
  const tap = ROOM.leverTap;
  return {
    id,
    orientation,
    w,
    h,
    window: { x: side, y: top, w: sceneW, h: SCREEN_H },
    console: { x: 0, y: consoleY, w, h: consoleH },
    panels: null,
    levers: {
      left: { x: ROOM.lever.inset, y: leverY },
      right: { x: w - ROOM.lever.inset - ROOM.lever.w, y: leverY },
    },
    leverTaps: {
      left: { x: side + SIDE_BUTTONS.left.x, y: tapY, ...tap },
      right: { x: side + sceneW - GUTTER_W + SIDE_BUTTONS.left.x, y: tapY, ...tap },
    },
    strip,
    hud: CONSOLE_HUD,
    menu: CONSOLE_MENU_BUTTON,
  };
}

function sideLayout(): RoomLayout {
  const { panelW, top, h } = SIDE_ROOM;
  const w = SCREEN_W + 2 * panelW;
  const tap = SIDE_ROOM.leverTap;
  return {
    id: 'side',
    orientation: 'landscape',
    w,
    h,
    window: { x: panelW, y: top, w: SCREEN_W, h: SCREEN_H },
    console: null,
    panels: {
      left: { x: 0, y: 0, w: panelW, h },
      right: { x: w - panelW, y: 0, w: panelW, h },
    },
    levers: SIDE_ROOM.levers,
    leverTaps: {
      left: { x: tap.inset, y: tap.y, w: tap.w, h: tap.h },
      right: { x: w - tap.inset - tap.w, y: tap.y, w: tap.w, h: tap.h },
    },
    strip: null,
    hud: SIDE_HUD,
    menu: SIDE_MENU_BUTTON,
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
 * console. The room art draws a recess around each readout; the score and
 * the mode label share one. `sound` is the `hudMute` tap target; `lights` is
 * the status lamp, a 6x6 loop next to the lives. The atlas's `operatorRoom.hud`
 * table carries the same numbers.
 */
export const CONSOLE_HUD = {
  scoreIcon: { x: 52, y: 265 },
  digits: { x: 68, y: 265, pitch: 8, count: 4 },
  modeLabel: { x: 116, y: 268 },
  lives: { x: 52, y: 289, pitch: 20 },
  sound: { x: 166, y: 263, w: 36, h: 16 },
  lights: { x: 122, y: 288 },
} as const satisfies ConsoleHud;

/**
 * The HUD readouts of the side room: the score, the mode and the lives on
 * the left panel, the sound readout, the MENU button and the lamp on the
 * right one. The lives sit closer together, at the life icon's own width,
 * so three fit the 64 px panel. The atlas's `operatorRoom.side.hud` table
 * carries the same numbers.
 */
export const SIDE_HUD = {
  scoreIcon: { x: 7, y: 22 },
  digits: { x: 10, y: 40, pitch: 8, count: 4 },
  modeLabel: { x: 21, y: 26 },
  lives: { x: 5, y: 61, pitch: 14 },
  sound: { x: 404, y: 21, w: 36, h: 16 },
  lights: { x: 419, y: 72 },
} as const satisfies ConsoleHud;

/**
 * The MENU button on the console, in room pixels, in its own recess right of
 * the sound readout. The renderer draws it with the bitmap font in the
 * console style; the atlas's `operatorRoom.menu` carries the same rectangle.
 * It opens the pause menu, and closes it while the menu is open.
 */
export const CONSOLE_MENU_BUTTON: Rect = { x: 210, y: 263, w: 36, h: 16 };

/** The MENU button of the side room, under the sound readout on the right panel; `operatorRoom.side.menu` in the atlas. */
export const SIDE_MENU_BUTTON: Rect = { x: 404, y: 47, w: 36, h: 16 };

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
 * Lift of the first arc, from the rocket's hatch down to crater 1. The hatch
 * is already high, so a small lift rises a little above it and then drops to
 * the ground.
 */
export const DROP_HEIGHT = 36;
/**
 * Lift of the last hop, from crater 4 into the rover's hatch. Low and short
 * on purpose: a full arc would read as one more landing to catch, and this
 * one needs no plate.
 */
export const HOP_HEIGHT = 24;
/** How far below the ground a fallen cosmonaut sinks. */
export const FALL_DEPTH = 18;
