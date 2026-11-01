/**
 * Sprite atlas contract shared with the artist. See docs/atlas-contract.md.
 * Every theme ships one PNG sheet and one JSON file in this shape. All themes
 * use the same frame names, sizes and anchors, so swapping a theme is swapping
 * the file.
 */
import type { ThemeId } from '../config/themes';

export interface AtlasFrame {
  /** Top-left corner of the frame on the sheet, in pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Anchor inside the frame, in pixels from the frame's top-left. */
  ax: number;
  ay: number;
  /** How long this frame shows when it is part of an animation, in ms. */
  duration: number;
}

export interface AtlasAnimation {
  /** Frame names in play order. */
  frames: string[];
  loop: boolean;
}

export interface AtlasMeta {
  theme: ThemeId;
  /** Sheet image path relative to the JSON file. */
  image: string;
  size: { w: number; h: number };
  /** Palette as hex strings. Max 16 entries. */
  palette: string[];
  /** Contract version this file follows. */
  contract: 1;
}

/** Screen position of an ambient loop's anchor. */
export interface Placement {
  x: number;
  y: number;
}

/** Attachment point measured from a named frame's top-left corner. */
export interface AtlasSocket {
  frame: string;
  x: number;
  y: number;
}

/** A vehicle model: its draw anchor, the hatch mouth inside the hull and the socket that names the mouth floor. */
export interface VehicleModel {
  anchor: Placement;
  mouth: string;
  hatch: Placement & { w: number; h: number };
}

/** Art layout in native output pixels; the simulation remains 320×240. */
export interface OperatorLayout {
  size: { w: number; h: number };
  frame: string;
  scene: { sx: number; sy: number; w: number; h: number; dx: number; dy: number };
  console: Placement & { w: number; h: number };
  levers: { l: Placement; r: Placement };
  /** Input geometry stays separate from the deck-mounted art. */
  leverTapZones: { l: Placement & { w: number; h: number }; r: Placement & { w: number; h: number } };
  windowCornerCut: number;
  controlStrip?: Placement & { w: number; h: number };
}

export interface OperatorHud {
  scoreIcon: Placement;
  digits: Placement & { pitch: number; count: number };
  modeLabel: Placement;
  lives: Placement & { pitch: number };
  sound: Placement & { w: number; h: number };
  lights: Placement;
}

/** The side room for short landscape screens: console panels left and right of the window, with their own HUD. */
export interface SideLayout {
  size: { w: number; h: number };
  frame: string;
  scene: { sx: number; sy: number; w: number; h: number; dx: number; dy: number };
  panels: { l: Placement & { w: number; h: number }; r: Placement & { w: number; h: number } };
  levers: { l: Placement; r: Placement };
  leverTapZones: { l: Placement & { w: number; h: number }; r: Placement & { w: number; h: number } };
  windowCornerCut: number;
  hud: OperatorHud;
  menu: Placement & { w: number; h: number };
  recesses: Record<string, Placement & { w: number; h: number }>;
}

export interface OperatorRoom {
  background: string;
  landscape: OperatorLayout;
  portrait: OperatorLayout;
  side?: SideLayout;
  hud: OperatorHud;
  /** The MENU button's rectangle; the renderer draws the button itself. */
  menu?: Placement & { w: number; h: number };
  /** The outer bezels the room plate draws around the readouts. */
  recesses?: Record<string, Placement & { w: number; h: number }>;
}

export interface Atlas {
  meta: AtlasMeta;
  frames: Record<string, AtlasFrame>;
  animations: Record<string, AtlasAnimation>;
  /** Where the game draws optional ambient animations, by animation name. */
  placements?: Record<string, Placement>;
  sockets?: Record<string, AtlasSocket>;
  /** Sockets kept for old readers that no longer mark anything visible. */
  retiredSockets?: string[];
  /** Compatibility animations with intentionally blank frames in this theme. */
  retiredAnimations?: string[];
  /** The complete vehicle models with built-in hatches, and the retired gantry. */
  vehicleModels?: Record<string, VehicleModel | 'retired'>;
  /** Expanded surround and console coordinates. See docs/atlas-contract.md. */
  operatorRoom?: OperatorRoom;
}

/** Animations the game plays by name. Every theme atlas must define these. */
export const REQUIRED_ANIMATIONS = [
  'frame.room.landscape',
  'frame.room.portrait',
  'frame.room.side',
  'frame.lights',
  'ui.lever.l.idle',
  'ui.lever.l.pull',
  'ui.lever.l.release',
  'ui.lever.r.idle',
  'ui.lever.r.pull',
  'ui.lever.r.release',
  'cosmonaut.emerge',
  'cosmonaut.crouch',
  'cosmonaut.takeoff',
  'cosmonaut.rise',
  'cosmonaut.descend',
  'cosmonaut.land',
  'cosmonaut.crater_fall',
  'cosmonaut.board',
  'cosmonaut.air.spin',
  'cosmonaut.air.flail',
  'cosmonaut.ledge.stand',
  'cosmonaut.ledge.crouch',
  'rocket.hatch.closed',
  'rocket.hatch.opening',
  'rocket.hatch.open',
  'rocket.hatch.closing',
  'crater.eyes.peek',
  'crater.eyes.blink',
  'crater.eyes.look.l',
  'crater.eyes.look.r',
  'crater.eyes.hide',
  'crater.tentacle.reach',
  'crater.tentacle.grab',
  'plate.idle',
  'plate.move',
  'plate.dip',
  'crater.idle',
  'rocket.door_closed',
  'rocket.door_open',
  'rover.idle',
  'rover.door_open',
  'button.left.idle',
  'button.left.pressed',
  'button.right.idle',
  'button.right.pressed',
  'hud.icon.score',
  'hud.icon.life',
  'ui.title_theme.idle',
  'ui.title_theme.pressed',
  'ui.title_sound.idle',
  'ui.title_sound.pressed',
  'ui.title_sound.muted',
  'ui.title_sound.muted_pressed',
  'ui.hud_sound.idle',
  'ui.hud_sound.pressed',
  'ui.hud_sound.muted',
  'ui.hud_sound.muted_pressed',
] as const;

/** Single frames the game draws by name. */
export const REQUIRED_FRAMES = [
  'background.window',
  'background',
  'crater.0',
  'crater.1',
  'crater.2',
  'crater.3',
  'crater.front.0',
  'crater.front.1',
  'crater.front.2',
  'crater.front.3',
  'cosmonaut.air.spin.0',
  'cosmonaut.air.spin.1',
  'cosmonaut.air.spin.2',
  'cosmonaut.air.spin.3',
  'cosmonaut.air.spin.4',
  'cosmonaut.air.spin.5',
  'cosmonaut.air.spin.6',
  'cosmonaut.air.spin.7',
  'cosmonaut.air.flail.0',
  'cosmonaut.air.flail.1',
  'hud.digit.0',
  'hud.digit.1',
  'hud.digit.2',
  'hud.digit.3',
  'hud.digit.4',
  'hud.digit.5',
  'hud.digit.6',
  'hud.digit.7',
  'hud.digit.8',
  'hud.digit.9',
] as const;

export type RequiredAnimation = (typeof REQUIRED_ANIMATIONS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function checkFrame(name: string, frame: unknown, sheet: { w: number; h: number }, problems: string[]): void {
  if (!isRecord(frame)) {
    problems.push(`frame "${name}" is not an object`);
    return;
  }
  for (const key of ['x', 'y', 'w', 'h', 'ax', 'ay', 'duration'] as const) {
    if (!isInt(frame[key])) problems.push(`frame "${name}".${key} must be an integer`);
  }
  const { x, y, w, h } = frame;
  if (isInt(x) && isInt(y) && isInt(w) && isInt(h)) {
    if (w <= 0 || h <= 0) problems.push(`frame "${name}" has an empty size`);
    if (x < 0 || y < 0 || x + w > sheet.w || y + h > sheet.h) {
      problems.push(`frame "${name}" lies outside the sheet`);
    }
  }
}

/**
 * Checks a parsed atlas JSON against the contract.
 * Returns a list of problems. An empty list means the atlas is valid.
 */
export function validateAtlas(data: unknown): string[] {
  const problems: string[] = [];
  if (!isRecord(data)) return ['atlas is not an object'];

  const meta = data.meta;
  let sheet = { w: 0, h: 0 };
  if (!isRecord(meta)) {
    problems.push('meta is missing');
  } else {
    if (meta.contract !== 1) problems.push('meta.contract must be 1');
    if (typeof meta.theme !== 'string') problems.push('meta.theme must be a string');
    if (typeof meta.image !== 'string') problems.push('meta.image must be a string');
    if (!isRecord(meta.size) || !isInt(meta.size.w) || !isInt(meta.size.h)) {
      problems.push('meta.size must have integer w and h');
    } else {
      sheet = { w: meta.size.w, h: meta.size.h };
    }
    if (!Array.isArray(meta.palette) || meta.palette.length > 16) {
      problems.push('meta.palette must be a list of at most 16 colours');
    }
  }

  const frames = data.frames;
  if (!isRecord(frames)) {
    problems.push('frames is missing');
    return problems;
  }
  for (const [name, frame] of Object.entries(frames)) checkFrame(name, frame, sheet, problems);
  for (const name of REQUIRED_FRAMES) {
    if (!(name in frames)) problems.push(`required frame "${name}" is missing`);
  }

  const animations = data.animations;
  if (!isRecord(animations)) {
    problems.push('animations is missing');
    return problems;
  }
  for (const [name, anim] of Object.entries(animations)) {
    if (!isRecord(anim) || !Array.isArray(anim.frames) || typeof anim.loop !== 'boolean') {
      problems.push(`animation "${name}" must have frames[] and loop`);
      continue;
    }
    if (anim.frames.length === 0) problems.push(`animation "${name}" has no frames`);
    for (const ref of anim.frames) {
      if (typeof ref !== 'string' || !(ref in frames)) {
        problems.push(`animation "${name}" refers to unknown frame "${String(ref)}"`);
      }
    }
  }
  for (const name of REQUIRED_ANIMATIONS) {
    if (!(name in animations)) problems.push(`required animation "${name}" is missing`);
  }

  return problems;
}
