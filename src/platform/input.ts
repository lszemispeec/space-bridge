/**
 * Keyboard and pointer input. Presses are collected between simulation steps
 * and handed over as one InputFrame per step. Plate presses go into a queue,
 * so three presses in one frame are three moves, in order; theme and mute
 * presses are counted, so two presses in one frame are two toggles.
 *
 * Touch: a tap on one of the on-screen buttons is that button. Its hit area
 * is the drawn button grown to at least MIN_TAP_CSS_PX on the screen, so a
 * thumb near the button toggles it instead of moving the plate. A tap in the
 * title's button row that misses both buttons does nothing. Any other tap is
 * a plate press: the left half of the viewport is left, the right half is
 * right. The drawn levers are the visual hint; the hit area is the whole
 * side so thumbs never miss on a phone, and the letterbox counts too.
 */
import {
  CONSOLE_HUD,
  frameToRoom,
  hitRect,
  inRect,
  MIN_TAP_CSS_PX,
  roomLayout,
  TAP_TARGETS,
  TITLE_BUTTON_ROW,
  type Orientation,
  type Rect,
  type TapTargetId,
} from '../config/layout';
import type { Point } from '../game/jump';
import { NO_INPUT, type InputFrame, type Phase, type PlateMove, type Toggle } from '../game/types';
import type { Viewport } from './viewport';

/** Buttons currently held, for drawing their pressed states. */
export interface HeldButtons {
  left: boolean;
  right: boolean;
  theme: boolean;
  mute: boolean;
}

export interface InputSource {
  /** Returns the presses since the last call and clears them. */
  consume(): InputFrame;
  /** Buttons currently held, for drawing pressed states. */
  held(): HeldButtons;
  dispose(): void;
}

export interface InputOptions {
  /** Called once, on the first key or pointer press, to unlock audio. */
  onFirstGesture: () => void;
  /** The screen that is showing, to resolve taps on its buttons. */
  getPhase: () => Phase;
  /** The game canvas, to map taps to room pixels. */
  canvas: HTMLCanvasElement;
  /** How the canvas shows the room, to map taps to room pixels. */
  getViewport: () => Viewport;
}

/** `none` is a tap that is swallowed: inside the title's button row but on no button. */
type Action = 'start' | Toggle | PlateMove | 'none';

const KEY_BINDINGS: Record<string, Action> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Enter: 'start',
  Space: 'start',
  KeyT: 'theme',
  KeyM: 'mute',
};

export function sideForPointer(clientX: number, viewportW: number): PlateMove {
  return clientX < viewportW / 2 ? 'left' : 'right';
}

export interface CanvasBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Maps a page position to a point on the visible canvas, in room pixels, or null outside the canvas. */
export function toRoomPoint(clientX: number, clientY: number, box: CanvasBox, viewport: Viewport): Point | null {
  if (box.width <= 0 || box.height <= 0) return null;
  const x = ((clientX - box.left) / box.width) * viewport.width;
  const y = ((clientY - box.top) / box.height) * viewport.height;
  if (x < 0 || y < 0 || x >= viewport.width || y >= viewport.height) return null;
  return { x, y };
}

const TARGET_ACTIONS: Record<TapTargetId, Action> = {
  titleTheme: 'theme',
  titleMute: 'mute',
  hudMute: 'mute',
};

/** The buttons a tap can hit on a screen, with their rectangles in room pixels. */
export function tapTargets(phase: Phase, orientation: Orientation): { id: TapTargetId; rect: Rect }[] {
  const room = roomLayout(orientation);
  const targets: { id: TapTargetId; rect: Rect }[] = [{ id: 'hudMute', rect: CONSOLE_HUD.sound }];
  if (phase === 'title') {
    targets.push({ id: 'titleTheme', rect: frameToRoom(TAP_TARGETS.titleTheme, room) });
    targets.push({ id: 'titleMute', rect: frameToRoom(TAP_TARGETS.titleMute, room) });
  }
  return targets;
}

/** The smallest tap target in room pixels, from the canvas size on the page and in room pixels. */
export function minHitSize(canvasCssWidth: number, canvasWidth: number): number {
  if (canvasCssWidth <= 0) return 0;
  return (MIN_TAP_CSS_PX * canvasWidth) / canvasCssWidth;
}

/**
 * The button a tap hits, or null. Hit areas are grown to `minHit` room
 * pixels; when grown areas overlap, the button whose centre is nearest wins.
 */
export function tapTarget(phase: Phase, point: Point, orientation: Orientation, minHit = 0): TapTargetId | null {
  let best: TapTargetId | null = null;
  let bestDistance = Infinity;
  for (const { id, rect } of tapTargets(phase, orientation)) {
    if (!inRect(hitRect(rect, minHit), point.x, point.y)) continue;
    const distance = Math.hypot(point.x - (rect.x + rect.w / 2), point.y - (rect.y + rect.h / 2));
    if (distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }
  return best;
}

/** What a tap at a room point means on the current screen. */
export function tapAction(phase: Phase, point: Point | null, orientation: Orientation, side: PlateMove, minHit = 0): Action {
  if (!point) return side;
  const target = tapTarget(phase, point, orientation, minHit);
  if (target) return TARGET_ACTIONS[target];
  const row = frameToRoom(TITLE_BUTTON_ROW, roomLayout(orientation));
  if (phase === 'title' && inRect(hitRect(row, minHit), point.x, point.y)) return 'none';
  return side;
}

function isMove(action: Action): action is PlateMove {
  return action === 'left' || action === 'right';
}

export function createInput(options: InputOptions): InputSource {
  let moves: PlateMove[] = [];
  let start = false;
  let toggles = { theme: 0, mute: 0 };
  const heldKeys = new Set<string>();
  const pointers = new Map<number, Action>();
  let gestureSeen = false;

  const gesture = (): void => {
    if (gestureSeen) return;
    gestureSeen = true;
    options.onFirstGesture();
  };

  const queue = (action: Action): void => {
    if (isMove(action)) moves.push(action);
    else if (action === 'start') start = true;
    else if (action !== 'none') toggles = { ...toggles, [action]: toggles[action] + 1 };
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    const action = KEY_BINDINGS[e.code];
    if (!action) return;
    e.preventDefault();
    gesture();
    if (e.repeat) return;
    heldKeys.add(e.code);
    queue(action);
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    heldKeys.delete(e.code);
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    gesture();
    const box = options.canvas.getBoundingClientRect();
    const viewport = options.getViewport();
    const point = toRoomPoint(e.clientX, e.clientY, box, viewport);
    const side = sideForPointer(e.clientX, window.innerWidth);
    const action = tapAction(options.getPhase(), point, viewport.orientation, side, minHitSize(box.width, viewport.width));
    pointers.set(e.pointerId, action);
    queue(action);
  };

  const onPointerEnd = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
  };

  const onBlur = (): void => {
    heldKeys.clear();
    pointers.clear();
  };

  const onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerEnd);
  window.addEventListener('pointercancel', onPointerEnd);
  window.addEventListener('blur', onBlur);
  window.addEventListener('contextmenu', onContextMenu);

  const keyHeld = (action: Action): boolean =>
    Object.entries(KEY_BINDINGS).some(([code, a]) => a === action && heldKeys.has(code));
  const isHeld = (action: Action): boolean => keyHeld(action) || [...pointers.values()].includes(action);

  return {
    consume() {
      const frame: InputFrame = { ...NO_INPUT, ...toggles, start, moves };
      moves = [];
      start = false;
      toggles = { theme: 0, mute: 0 };
      return frame;
    },
    held() {
      return { left: isHeld('left'), right: isHeld('right'), theme: isHeld('theme'), mute: isHeld('mute') };
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('contextmenu', onContextMenu);
    },
  };
}
