/**
 * Atlas playback and loading. The pure helpers pick a frame for a point in
 * time or for a share of an animation's progress. `loadArt` is the only
 * browser code: it fetches the JSON, checks the contract and decodes the sheet.
 */
import type { Theme } from '../config/themes';
import { validateAtlas, type Atlas, type AtlasAnimation, type AtlasFrame } from './atlas';

export interface Art {
  atlas: Atlas;
  image: CanvasImageSource;
}

export function frameOf(atlas: Atlas, name: string): AtlasFrame {
  const frame = atlas.frames[name];
  if (!frame) throw new Error(`Atlas ${atlas.meta.theme} has no frame "${name}"`);
  return frame;
}

function animationOf(atlas: Atlas, name: string): AtlasAnimation {
  const animation = atlas.animations[name];
  if (!animation) throw new Error(`Atlas ${atlas.meta.theme} has no animation "${name}"`);
  return animation;
}

export function hasAnimation(atlas: Atlas, name: string): boolean {
  return name in atlas.animations;
}

/** The frame names of an animation, in order. */
export function animationFrames(atlas: Atlas, name: string): readonly string[] {
  return animationOf(atlas, name).frames;
}

function totalDuration(atlas: Atlas, animation: AtlasAnimation): number {
  return animation.frames.reduce((sum, name) => sum + frameOf(atlas, name).duration, 0);
}

/** The length of an animation in ms: the sum of its frame durations. */
export function animationMs(atlas: Atlas, name: string): number {
  return totalDuration(atlas, animationOf(atlas, name));
}

/**
 * The frame of an animation `elapsedMs` after it started. A loop wraps
 * around; a one-shot holds its last frame.
 */
export function frameAt(atlas: Atlas, name: string, elapsedMs: number): AtlasFrame {
  const animation = animationOf(atlas, name);
  const total = totalDuration(atlas, animation);
  let t = elapsedMs;
  if (animation.loop && total > 0) t = ((t % total) + total) % total;
  let last: AtlasFrame | undefined;
  for (const frameName of animation.frames) {
    last = frameOf(atlas, frameName);
    if (t < last.duration) return last;
    t -= last.duration;
  }
  if (!last) throw new Error(`Animation "${name}" has no frames`);
  return last;
}

/**
 * The frame of a one-shot at `progress` 0..1 of its whole length, so the
 * animation compresses to the gameplay timing and keeps the artist's
 * proportions between frames.
 */
export function frameByProgress(atlas: Atlas, name: string, progress: number): AtlasFrame {
  const animation = animationOf(atlas, name);
  const total = totalDuration(atlas, animation);
  const p = Math.min(1, Math.max(0, progress));
  return frameAt(atlas, name, Math.min(p * total, total - 1));
}

/** Draws a frame with its anchor at (x, y), on whole pixels. */
export function drawFrame(ctx: CanvasRenderingContext2D, art: Art, frame: AtlasFrame, x: number, y: number): void {
  ctx.drawImage(
    art.image,
    frame.x,
    frame.y,
    frame.w,
    frame.h,
    Math.round(x - frame.ax),
    Math.round(y - frame.ay),
    frame.w,
    frame.h,
  );
}

/**
 * Draws a frame scaled by `scale` with its anchor at (x, y), on whole pixels.
 * Nearest-neighbour: the context keeps image smoothing off, and the
 * destination size is rounded to whole pixels, so the pixels stay crisp.
 */
export function drawFrameScaled(ctx: CanvasRenderingContext2D, art: Art, frame: AtlasFrame, x: number, y: number, scale: number): void {
  if (scale === 1) {
    drawFrame(ctx, art, frame, x, y);
    return;
  }
  const w = Math.max(1, Math.round(frame.w * scale));
  const h = Math.max(1, Math.round(frame.h * scale));
  ctx.drawImage(art.image, frame.x, frame.y, frame.w, frame.h, Math.round(x - frame.ax * scale), Math.round(y - frame.ay * scale), w, h);
}

/** Fetches and checks a theme's atlas, then decodes its sheet. */
export async function loadArt(theme: Theme): Promise<Art> {
  const url = new URL(theme.atlas, document.baseURI);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load ${url.href}: HTTP ${response.status}`);
  const data: unknown = await response.json();
  const problems = validateAtlas(data);
  if (problems.length > 0) throw new Error(`Atlas ${theme.id} breaks the contract: ${problems.join('; ')}`);
  const atlas = data as Atlas;
  const image = new Image();
  image.src = new URL(atlas.meta.image, url).href;
  await image.decode();
  return { atlas, image };
}
