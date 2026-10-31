/**
 * Integer-scaled, letterboxed canvas. The canvas keeps its internal size;
 * CSS scales it by the largest whole number that fits the viewport.
 */
import { SCREEN_H, SCREEN_W } from '../config/layout';

/**
 * Largest whole number of device pixels per game pixel that fits the
 * viewport. Working in device pixels lets a phone with a 3x screen show the
 * game at 4x or 5x while every game pixel still covers whole device pixels.
 */
export function fitScale(viewportW: number, viewportH: number, dpr = 1): number {
  const w = viewportW * dpr;
  const h = viewportH * dpr;
  return Math.max(1, Math.floor(Math.min(w / SCREEN_W, h / SCREEN_H)));
}

/** CSS size of the canvas for a device-pixel scale. */
export function cssSize(scale: number, dpr: number): { w: number; h: number } {
  return { w: (SCREEN_W * scale) / dpr, h: (SCREEN_H * scale) / dpr };
}

export function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.imageSmoothingEnabled = false;

  const resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const size = cssSize(fitScale(window.innerWidth, window.innerHeight, dpr), dpr);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();
  return ctx;
}
