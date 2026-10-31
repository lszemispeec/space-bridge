/**
 * Keyboard and pointer input. Presses are collected between simulation steps
 * and handed over as one edge-triggered InputFrame per step.
 *
 * Touch: the left half of the viewport is the left button, the right half
 * is the right button. The drawn gutters are the visual hint; the hit area
 * is the whole side so thumbs never miss on a phone.
 */
import { NO_INPUT, type InputFrame } from '../game/types';

export interface HeldButtons {
  left: boolean;
  right: boolean;
}

export interface InputSource {
  /** Returns the presses since the last call and clears them. */
  consume(): InputFrame;
  /** Buttons currently held, for drawing pressed states. */
  held(): HeldButtons;
  dispose(): void;
}

const KEY_BINDINGS: Record<string, keyof InputFrame> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Enter: 'start',
  Space: 'start',
  KeyT: 'theme',
  KeyM: 'mute',
};

export function sideForPointer(clientX: number, viewportW: number): 'left' | 'right' {
  return clientX < viewportW / 2 ? 'left' : 'right';
}

export function createInput(onFirstGesture: () => void): InputSource {
  let pending: InputFrame = { ...NO_INPUT };
  const heldKeys = new Set<string>();
  const pointers = new Map<number, 'left' | 'right'>();
  let gestureSeen = false;

  const gesture = (): void => {
    if (gestureSeen) return;
    gestureSeen = true;
    onFirstGesture();
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    const action = KEY_BINDINGS[e.code];
    if (!action) return;
    e.preventDefault();
    gesture();
    if (e.repeat) return;
    heldKeys.add(e.code);
    pending = { ...pending, [action]: true };
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    heldKeys.delete(e.code);
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    gesture();
    const side = sideForPointer(e.clientX, window.innerWidth);
    pointers.set(e.pointerId, side);
    pending = { ...pending, [side]: true };
  };

  const onPointerEnd = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
  };

  const onBlur = (): void => {
    heldKeys.clear();
    pointers.clear();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerEnd);
  window.addEventListener('pointercancel', onPointerEnd);
  window.addEventListener('blur', onBlur);
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  const keyHeld = (action: 'left' | 'right'): boolean =>
    Object.entries(KEY_BINDINGS).some(([code, a]) => a === action && heldKeys.has(code));

  return {
    consume() {
      const frame = pending;
      pending = { ...NO_INPUT };
      return frame;
    },
    held() {
      const sides = new Set(pointers.values());
      return {
        left: keyHeld('left') || sides.has('left'),
        right: keyHeld('right') || sides.has('right'),
      };
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      window.removeEventListener('blur', onBlur);
    },
  };
}
