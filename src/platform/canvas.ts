/**
 * The screen: a fixed 320x240 scene the renderer draws into, and the page
 * canvas, which is the operator room around it (see viewport.ts). The page
 * canvas keeps a whole number of room pixels; CSS scales it by a whole
 * number of device pixels, so every pixel is one crisp block.
 */
import { SCREEN_H, SCREEN_W } from '../config/layout';
import { chooseViewport, composition, type Viewport } from './viewport';

export interface Screen {
  /** Draw target for the scene: the 320x240 frame. */
  scene: CanvasRenderingContext2D;
  /** Draw target for the room: the page canvas, in room pixels. */
  room: CanvasRenderingContext2D;
  /** The viewport in use, for mapping taps. */
  viewport(): Viewport;
  /** Copies the scene into the room's window. Call once per rendered frame, before the room is drawn. */
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
  const scene = context2d(frame);
  const room = context2d(canvas);
  let viewport = chooseViewport(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);

  const resize = (): void => {
    viewport = chooseViewport(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    room.imageSmoothingEnabled = false;
    canvas.style.width = `${viewport.cssW}px`;
    canvas.style.height = `${viewport.cssH}px`;
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();

  return {
    scene,
    room,
    viewport: () => viewport,
    present() {
      const b = composition(viewport.orientation);
      room.drawImage(frame, b.sx, b.sy, b.w, b.h, b.dx, b.dy, b.w, b.h);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    },
  };
}
