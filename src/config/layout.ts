/**
 * Fixed internal resolution and the positions of everything on the playfield.
 * All values are in internal pixels (320x240). The renderer scales the result.
 *
 * Slots are the stops on the cosmonaut's path:
 *   0 = rocket door, 1..4 = craters, 5 = rover door.
 * The bridge plate can only sit on a crater slot (1..4).
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

export const ROCKET = { x: 43, y: 80, w: 33, h: 89 } as const;
export const ROVER = { x: 248, y: 142, w: 33, h: 38 } as const;
export const CRATER = { w: 24, h: 8 } as const;
export const PLATE = { w: 26, h: 3 } as const;
export const COSMONAUT = { w: 10, h: 14 } as const;

export const HUD = { y: 8, scoreX: 40, livesX: 212 } as const;

/** Arc height of a jump between two neighbouring slots. */
export const JUMP_HEIGHT = 26;
/** How far below the ground a fallen cosmonaut sinks. */
export const FALL_DEPTH = 18;
