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
 *
 * While the pause menu is open the same keys and taps drive the menu
 * instead: arrows and W/S/A/D move and adjust, Enter confirms, Esc and the
 * console's MENU button close it, and a tap lands on a menu row. Nothing
 * reaches the plate.
 */
import {
  frameToRoom,
  hitRect,
  inRect,
  MIN_TAP_CSS_PX,
  roomLayout,
  TAP_TARGETS,
  TITLE_BUTTON_ROW,
  type LayoutId,
  type Rect,
  type TapTargetId,
} from '../config/layout';
import type { Point } from '../game/jump';
import type { MenuKey } from '../game/menu';
import { NO_INPUT, type InputFrame, type Phase, type PlateMove, type Toggle } from '../game/types';
import { canvasToFrame, type Viewport } from './viewport';

/** Buttons currently held, for drawing their pressed states. */
export interface HeldButtons {
  left: boolean;
  right: boolean;
  theme: boolean;
  mute: boolean;
  menu: boolean;
}

/** A key for the open menu, or a tap at a scene point the shell maps to a row. */
export type MenuInput = MenuKey | { tap: Point };

export interface InputSource {
  /** Returns the presses since the last call and clears them. */
  consume(): { frame: InputFrame; menu: MenuInput[] };
  /** Buttons currently held, for drawing pressed states. */
  held(): HeldButtons;
  dispose(): void;
}

export interface InputOptions {
  /** Called once, on the first key or pointer press, to unlock audio. */
  onFirstGesture: () => void;
  /** The screen that is showing, to resolve taps on its buttons. */
  getPhase: () => Phase;
  /** True while the pause menu is open, so keys and taps drive the menu. */
  getPaused: () => boolean;
  /** Where the visible canvas sits on the page, to map taps to room pixels. */
  getBox: () => CanvasBox;
  /** How the canvas shows the room, to map taps to room pixels. */
  getViewport: () => Viewport;
}

/** `none` is a tap that is swallowed: inside the title's button row but on no button. */
type Action = 'start' | 'pause' | Toggle | PlateMove | 'none';

const KEY_BINDINGS: Record<string, Action> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Enter: 'start',
  Space: 'start',
  KeyT: 'theme',
  KeyM: 'mute',
  Escape: 'pause',
  KeyP: 'pause',
};

const MENU_KEY_BINDINGS: Record<string, MenuKey> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Enter: 'confirm',
  Space: 'confirm',
  Escape: 'back',
  KeyP: 'back',
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
  hudMenu: 'pause',
};

/** The buttons a tap can hit on a screen, with their rectangles in room pixels. */
export function tapTargets(phase: Phase, layout: LayoutId): { id: TapTargetId; rect: Rect }[] {
  const room = roomLayout(layout);
  const targets: { id: TapTargetId; rect: Rect }[] = [
    { id: 'hudMute', rect: room.hud.sound },
    { id: 'hudMenu', rect: room.menu },
  ];
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
export function tapTarget(phase: Phase, point: Point, layout: LayoutId, minHit = 0): TapTargetId | null {
  let best: TapTargetId | null = null;
  let bestDistance = Infinity;
  for (const { id, rect } of tapTargets(phase, layout)) {
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
export function tapAction(phase: Phase, point: Point | null, layout: LayoutId, side: PlateMove, minHit = 0): Action {
  if (!point) return side;
  const target = tapTarget(phase, point, layout, minHit);
  if (target) return TARGET_ACTIONS[target];
  const row = frameToRoom(TITLE_BUTTON_ROW, roomLayout(layout));
  if (phase === 'title' && inRect(hitRect(row, minHit), point.x, point.y)) return 'none';
  return side;
}

/**
 * What a tap at a room point means while the menu is open: the MENU button
 * closes it, a point in the window is handed to the menu, anything else
 * is swallowed.
 */
export function menuTapAction(point: Point | null, viewport: Viewport, minHit = 0): MenuInput | null {
  if (!point) return null;
  if (inRect(hitRect(roomLayout(viewport.layout).menu, minHit), point.x, point.y)) return 'back';
  const scene = canvasToFrame(point.x, point.y, viewport);
  return scene ? { tap: scene } : null;
}

function isMove(action: Action): action is PlateMove {
  return action === 'left' || action === 'right';
}

export function createInput(options: InputOptions): InputSource {
  let moves: PlateMove[] = [];
  let start = false;
  let pause = false;
  let toggles = { theme: 0, mute: 0 };
  let menu: MenuInput[] = [];
  const heldKeys = new Set<string>();
  const pointers = new Map<number, Action | 'menu'>();
  let gestureSeen = false;

  const gesture = (): void => {
    if (gestureSeen) return;
    gestureSeen = true;
    options.onFirstGesture();
  };

  const queue = (action: Action): void => {
    if (isMove(action)) moves.push(action);
    else if (action === 'start') start = true;
    else if (action === 'pause') pause = true;
    else if (action !== 'none') toggles = { ...toggles, [action]: toggles[action] + 1 };
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    const paused = options.getPaused();
    const menuKey = paused ? MENU_KEY_BINDINGS[e.code] : undefined;
    const action = KEY_BINDINGS[e.code];
    if (!menuKey && !action) return;
    e.preventDefault();
    gesture();
    if (e.repeat) return;
    heldKeys.add(e.code);
    if (menuKey) menu.push(menuKey);
    else if (action && (!paused || action === 'mute')) queue(action);
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    heldKeys.delete(e.code);
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    gesture();
    const box = options.getBox();
    const viewport = options.getViewport();
    const point = toRoomPoint(e.clientX, e.clientY, box, viewport);
    const minHit = minHitSize(box.width, viewport.width);
    if (options.getPaused()) {
      const input = menuTapAction(point, viewport, minHit);
      if (input) menu.push(input);
      pointers.set(e.pointerId, input === 'back' ? 'pause' : 'menu');
      return;
    }
    const side = sideForPointer(e.clientX, window.innerWidth);
    const action = tapAction(options.getPhase(), point, viewport.layout, side, minHit);
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
      const frame: InputFrame = { ...NO_INPUT, ...toggles, start, pause, moves };
      const menuInputs = menu;
      moves = [];
      start = false;
      pause = false;
      toggles = { theme: 0, mute: 0 };
      menu = [];
      return { frame, menu: menuInputs };
    },
    held() {
      return { left: isHeld('left'), right: isHeld('right'), theme: isHeld('theme'), mute: isHeld('mute'), menu: isHeld('pause') };
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
