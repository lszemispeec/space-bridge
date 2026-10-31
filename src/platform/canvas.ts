/**
 * The screen: a fixed 320x240 scene the renderer draws into, and the page
 * canvas, which is the operator room around it (see viewport.ts). The page
 * canvas keeps a whole number of room pixels; CSS scales it by a whole
 * number of device pixels, so every pixel is one crisp block.
 *
 * With a display preset on, a second canvas takes the page: the room canvas
 * is drawn through the WebGL2 CRT pass at device resolution (see crt.ts).
 * The 2D path is untouched, so "Off" shows exactly the room canvas, and a
 * lost context or a missing WebGL2 shows it too.
 */
import { getShaderPreset, needsShader, type ShaderPresetId } from '../config/display';
import { SCREEN_H, SCREEN_W } from '../config/layout';
import { createCrtPass, type CrtPass } from './crt';
import { chooseViewport, composition, type Viewport } from './viewport';

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
    viewport = chooseViewport(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    room.imageSmoothingEnabled = false;
    canvas.style.width = `${viewport.cssW}px`;
    canvas.style.height = `${viewport.cssH}px`;
    crt?.resize(viewport.width * viewport.scale, viewport.height * viewport.scale);
    crtCanvas.style.width = canvas.style.width;
    crtCanvas.style.height = canvas.style.height;
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
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
    dispose() {
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      crt?.dispose();
      crtCanvas.remove();
    },
  };
}
