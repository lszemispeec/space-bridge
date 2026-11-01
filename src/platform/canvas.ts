/**
 * The screen: a fixed 320x240 scene the renderer draws into, and the page
 * canvas, which is the operator room around it (see viewport.ts). The page
 * canvas keeps a whole number of room pixels; CSS scales it to the viewport
 * inside the safe area, by a whole number of device pixels on a dpr 1 screen.
 *
 * The layout follows the screen: a rotation, or Safari's toolbar coming and
 * going, re-chooses the viewport. The room canvas is only reallocated when
 * the room changes size, and the owner redraws at once through `onResize`,
 * so neither case shows a blank frame.
 *
 * With a display preset on, a second canvas takes the page: the room canvas
 * is drawn through the WebGL2 CRT pass at device resolution (see crt.ts).
 * The 2D path is untouched, so "Off" shows exactly the room canvas, and a
 * lost context or a missing WebGL2 shows it too.
 */
import { getShaderPreset, needsShader, type ShaderPresetId } from '../config/display';
import { SCREEN_H, SCREEN_W } from '../config/layout';
import { createCrtPass, type CrtPass } from './crt';
import { chooseViewport, composition, NO_INSETS, type Insets, type Viewport } from './viewport';

export interface Screen {
  /** Draw target for the scene: the 320x240 frame. */
  scene: CanvasRenderingContext2D;
  /** Draw target for the room: the page canvas, in room pixels. */
  room: CanvasRenderingContext2D;
  /** The viewport in use, for mapping taps. */
  viewport(): Viewport;
  /** Where the visible canvas sits on the page, for mapping taps. */
  box(): DOMRect;
  /** Copies the scene into the room's window. Call once per rendered frame, before the room is drawn. */
  present(): void;
  /** Runs the display preset over the finished room canvas. Call once per frame, after the room is drawn. */
  flush(timeMs: number): void;
  /** True when the display presets can be shown: WebGL2 exists. */
  shaders(): boolean;
  /** Chooses the display preset. Takes effect from the next frame. */
  setShader(preset: ShaderPresetId): void;
  /** Called after the viewport changed, so the owner can redraw before the next paint. */
  onResize(callback: () => void): void;
  dispose(): void;
}

/** The safe-area insets, from the custom properties index.html sets from `env(safe-area-inset-*)`. */
export function readInsets(style: { getPropertyValue(name: string): string }): Insets {
  const px = (name: string): number => {
    const value = Number.parseFloat(style.getPropertyValue(`--safe-${name}`));
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  return { top: px('top'), right: px('right'), bottom: px('bottom'), left: px('left') };
}

/** The viewport size in CSS pixels: the visual viewport when the browser has one, else the window. */
function viewportSize(): { w: number; h: number } {
  const visual = window.visualViewport;
  if (visual && visual.width > 0 && visual.height > 0) return { w: visual.width, h: visual.height };
  return { w: window.innerWidth, h: window.innerHeight };
}

function currentViewport(): Viewport {
  const { w, h } = viewportSize();
  const insets = typeof getComputedStyle === 'function' ? readInsets(getComputedStyle(document.documentElement)) : NO_INSETS;
  return chooseViewport(w, h, window.devicePixelRatio || 1, insets);
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

export function setupScreen(canvas: HTMLCanvasElement): Screen {
  const frame = document.createElement('canvas');
  frame.width = SCREEN_W;
  frame.height = SCREEN_H;
  const scene = context2d(frame);
  const room = context2d(canvas);
  let viewport = currentViewport();
  let onResize: () => void = () => undefined;

  // The CRT canvas sits beside the room canvas; only one of them shows.
  const crtCanvas = document.createElement('canvas');
  crtCanvas.id = 'crt';
  crtCanvas.style.display = 'none';
  canvas.insertAdjacentElement('afterend', crtCanvas);
  let preset: ShaderPresetId = 'off';
  let active = false;
  const apply = (): void => {
    active = crt !== null && !crt.lost && needsShader(preset);
    canvas.style.display = active ? 'none' : '';
    crtCanvas.style.display = active ? '' : 'none';
  };
  const crt: CrtPass | null = createCrtPass(crtCanvas, { onLost: apply, onRestored: apply });
  if (!crt) crtCanvas.remove();

  const resize = (): void => {
    viewport = currentViewport();
    // Assigning a canvas size clears it, so only do it when the room changed.
    if (canvas.width !== viewport.width || canvas.height !== viewport.height) {
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      room.imageSmoothingEnabled = false;
    }
    canvas.style.width = `${viewport.cssW}px`;
    canvas.style.height = `${viewport.cssH}px`;
    crt?.resize(Math.round(viewport.width * viewport.scale), Math.round(viewport.height * viewport.scale));
    crtCanvas.style.width = canvas.style.width;
    crtCanvas.style.height = canvas.style.height;
    onResize();
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  window.visualViewport?.addEventListener('resize', resize);
  resize();

  return {
    scene,
    room,
    viewport: () => viewport,
    box: () => (active ? crtCanvas : canvas).getBoundingClientRect(),
    present() {
      const b = composition(viewport.orientation);
      room.drawImage(frame, b.sx, b.sy, b.w, b.h, b.dx, b.dy, b.w, b.h);
    },
    flush(timeMs) {
      if (!active || !crt) return;
      if (!crt.render(canvas, getShaderPreset(preset).params, timeMs / 1000)) apply();
    },
    shaders: () => crt !== null,
    setShader(next) {
      preset = next;
      apply();
    },
    onResize(callback) {
      onResize = callback;
    },
    dispose() {
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      crt?.dispose();
      crtCanvas.remove();
    },
  };
}
