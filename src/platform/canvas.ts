/**
 * The screen: a fixed 320x240 frame the renderer draws into, shown on the
 * page canvas through the current viewport (see viewport.ts). The page
 * canvas keeps a whole number of game pixels; CSS scales it by a whole
 * number of device pixels, so every game pixel is one crisp block.
 */
import { SCREEN_H, SCREEN_W } from '../config/layout';
import { chooseViewport, composition, type Viewport } from './viewport';

export interface Screen {
  /** Draw target: the 320x240 frame. */
  ctx: CanvasRenderingContext2D;
  /** The viewport in use, for mapping taps. */
  viewport(): Viewport;
  /** Copies the frame to the page canvas. Call once per rendered frame. */
  present(): void;
  dispose(): void;
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
  const ctx = context2d(frame);
  const out = context2d(canvas);
  let viewport = chooseViewport(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);

  const resize = (): void => {
    viewport = chooseViewport(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    out.imageSmoothingEnabled = false;
    canvas.style.width = `${viewport.cssW}px`;
    canvas.style.height = `${viewport.cssH}px`;
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();

  return {
    ctx,
    viewport: () => viewport,
    present() {
      for (const b of composition(viewport.orientation)) out.drawImage(frame, b.sx, b.sy, b.w, b.h, b.dx, b.dy, b.w, b.h);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    },
  };
}
