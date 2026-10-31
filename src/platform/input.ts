/**
 * Keyboard and pointer input. Presses are collected between simulation steps
 * and handed over as one InputFrame per step. Plate presses go into a queue,
 * so three presses in one frame are three moves, in order.
 *
 * Touch: a tap on one of the on-screen buttons is that button. Its hit area
 * is the drawn button grown to at least MIN_TAP_CSS_PX on the screen, so a
 * thumb near the button toggles it instead of moving the plate. Any other
 * tap is a plate press: the left half of the viewport is left, the right
 * half is right. The drawn gutters are the visual hint; the hit area is the
 * whole side so thumbs never miss on a phone, and the letterbox counts too.
 */
import {
  hitRect,
  inRect,
  MIN_TAP_CSS_PX,
  SCREEN_H,
  SCREEN_W,
  TAP_TARGETS,
  type TapTargetId,
} from '../config/layout';
import type { Point } from '../game/jump';
import { NO_INPUT, type InputFrame, type Phase, type PlateMove } from '../game/types';

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
  /** The game canvas, to map taps to game pixels. */
  canvas: HTMLCanvasElement;
}

type Action = keyof Omit<InputFrame, 'moves'> | PlateMove;

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

/** Maps a viewport position to game pixels, or null outside the canvas. */
export function toGamePoint(clientX: number, clientY: number, box: CanvasBox): Point | null {
  if (box.width <= 0 || box.height <= 0) return null;
  const x = ((clientX - box.left) / box.width) * SCREEN_W;
  const y = ((clientY - box.top) / box.height) * SCREEN_H;
  if (x < 0 || y < 0 || x >= SCREEN_W || y >= SCREEN_H) return null;
  return { x, y };
}

const TARGET_ACTIONS: Record<TapTargetId, Action> = {
  titleTheme: 'theme',
  titleMute: 'mute',
  hudMute: 'mute',
};

function targetsOn(phase: Phase): TapTargetId[] {
  return phase === 'title' ? ['hudMute', 'titleTheme', 'titleMute'] : ['hudMute'];
}

/** Game pixels per CSS pixel, from the canvas box on the page. */
export function minHitSize(canvasCssWidth: number): number {
  if (canvasCssWidth <= 0) return 0;
  return (MIN_TAP_CSS_PX * SCREEN_W) / canvasCssWidth;
}

/**
 * The button a tap hits, or null. Hit areas are grown to `minHit` game
 * pixels; when grown areas overlap, the button whose centre is nearest wins.
 */
export function tapTarget(phase: Phase, point: Point, minHit = 0): TapTargetId | null {
  let best: TapTargetId | null = null;
  let bestDistance = Infinity;
  for (const id of targetsOn(phase)) {
    const r = TAP_TARGETS[id];
    if (!inRect(hitRect(r, minHit), point.x, point.y)) continue;
    const distance = Math.hypot(point.x - (r.x + r.w / 2), point.y - (r.y + r.h / 2));
    if (distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }
  return best;
}

/** What a tap means on the current screen. */
export function tapAction(phase: Phase, point: Point | null, side: PlateMove, minHit = 0): Action {
  const target = point ? tapTarget(phase, point, minHit) : null;
  return target ? TARGET_ACTIONS[target] : side;
}

function isMove(action: Action): action is PlateMove {
  return action === 'left' || action === 'right';
}

export function createInput(options: InputOptions): InputSource {
  let moves: PlateMove[] = [];
  let pending = { start: false, theme: false, mute: false };
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
    else pending = { ...pending, [action]: true };
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
    const point = toGamePoint(e.clientX, e.clientY, box);
    const side = sideForPointer(e.clientX, window.innerWidth);
    const action = tapAction(options.getPhase(), point, side, minHitSize(box.width));
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
      const frame: InputFrame = { ...NO_INPUT, ...pending, moves };
      moves = [];
      pending = { start: false, theme: false, mute: false };
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
