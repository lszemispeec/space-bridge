/**
 * The operator room around the scene: the windshield frame, the levers on
 * the console deck, the HUD readouts, and the blinking console lights. Drawn
 * on the page canvas after the scene is in the window, in the contract's
 * order: room plate, levers, readouts, lights. The MENU button beside the
 * sound readout is the engine's own, drawn with the bitmap font. The scene itself is drawn with
 * the atlas's `operatorRoom.background` plate, which fills the glass edge to
 * edge; the old `background` plate would show its HUD band and gutters.
 */
import { DIFFICULTY } from '../config/difficulty';
import { CONSOLE_HUD, CONSOLE_MENU_BUTTON, type PlateSide, type Rect, type RoomLayout } from '../config/layout';
import { getTheme, type ThemePalette } from '../config/themes';
import type { GameState } from '../game/types';
import type { HeldButtons } from '../platform/input';
import type { Atlas, AtlasFrame } from './atlas';
import { drawText } from './font';
import { drawConsoleButton } from './menu';
import { animationMs, drawFrame, frameAt, frameByProgress, frameOf, hasAnimation, type Art } from './sprites';

/** The full-room plate per orientation, with the window left transparent. */
const ROOM_PLATE = { landscape: 'frame.room.landscape', portrait: 'frame.room.portrait' } as const;
const LIGHTS = 'frame.lights';
const LEVER = { left: 'ui.lever.l', right: 'ui.lever.r' } as const;
/**
 * Longest real ms of a full pull or return. The art's pull is 200 ms; the
 * contract lets the engine compress it, and a press every 150 ms at the top
 * of Game B must still read as separate pulls.
 */
export const LEVER_PULL_MAX_MS = 120;

export function pad(n: number, width: number): string {
  return String(Math.min(n, 10 ** width - 1)).padStart(width, '0');
}

/** The sound button state for the saved flag and the pointer. */
export function soundState(muted: boolean, pressed: boolean): string {
  if (muted) return pressed ? 'muted_pressed' : 'muted';
  return pressed ? 'pressed' : 'idle';
}

/** Real ms of a full lever pull: the pull animation's length, compressed to the cap. */
export function leverPullMs(atlas: Atlas, side: PlateSide): number {
  return Math.min(LEVER_PULL_MAX_MS, animationMs(atlas, `${LEVER[side]}.pull`));
}

/**
 * The lever frame for a pull amount 0..1: the idle loop at rest, the pull
 * one-shot on the way out, and the authored release sequence on the way back.
 */
export function leverFrame(atlas: Atlas, side: PlateSide, pull: number, releasing: boolean, nowMs: number): AtlasFrame {
  const lever = LEVER[side];
  if (pull <= 0) return frameAt(atlas, `${lever}.idle`, nowMs);
  if (releasing && hasAnimation(atlas, `${lever}.release`)) return frameByProgress(atlas, `${lever}.release`, 1 - pull);
  return frameByProgress(atlas, `${lever}.pull`, pull);
}

/** How far each lever is pulled, 0..1, and whether it is on its way back. */
export type LeverPulls = Record<PlateSide, { pull: number; releasing: boolean }>;

function fill(ctx: CanvasRenderingContext2D, r: Rect, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

function drawReadouts(ctx: CanvasRenderingContext2D, s: GameState, held: HeldButtons, art: Art, nowMs: number): void {
  const { atlas } = art;
  const hud = CONSOLE_HUD;
  const p = getTheme(s.save.settings.theme).palette;
  drawFrame(ctx, art, frameAt(atlas, 'hud.icon.score', nowMs), hud.scoreIcon.x, hud.scoreIcon.y);
  const digits = pad(s.score, hud.digits.count);
  for (let i = 0; i < digits.length; i++) {
    drawFrame(ctx, art, frameOf(atlas, `hud.digit.${digits.charAt(i)}`), hud.digits.x + i * hud.digits.pitch, hud.digits.y);
  }
  drawText(ctx, `GAME ${s.mode}`, hud.modeLabel.x, hud.modeLabel.y, p.text, 1);
  for (let i = 0; i < DIFFICULTY.lives; i++) {
    const name = i < s.lives ? 'hud.icon.life' : 'hud.icon.life_empty';
    if (!hasAnimation(atlas, name)) continue;
    drawFrame(ctx, art, frameAt(atlas, name, nowMs), hud.lives.x + i * hud.lives.pitch, hud.lives.y);
  }
  const sound = frameAt(atlas, `ui.hud_sound.${soundState(s.save.settings.muted, held.mute)}`, nowMs);
  drawFrame(ctx, art, sound, hud.sound.x, hud.sound.y);
  drawConsoleButton(ctx, CONSOLE_MENU_BUTTON, 'MENU', p, held.menu || s.paused);
}

/** Draws the room over the page canvas, after the scene is in the window. */
export function drawRoom(ctx: CanvasRenderingContext2D, room: RoomLayout, s: GameState, held: HeldButtons, levers: LeverPulls, art: Art, nowMs: number): void {
  const { atlas } = art;
  drawFrame(ctx, art, frameAt(atlas, ROOM_PLATE[room.orientation], nowMs), 0, 0);
  for (const side of ['left', 'right'] as const) {
    const at = room.levers[side];
    drawFrame(ctx, art, leverFrame(atlas, side, levers[side].pull, levers[side].releasing, nowMs), at.x, at.y);
  }
  drawReadouts(ctx, s, held, art, nowMs);
  drawFrame(ctx, art, frameAt(atlas, LIGHTS, nowMs), CONSOLE_HUD.lights.x, CONSOLE_HUD.lights.y);
}

/** The room while the art loads: a flat fill, so the page never shows a blank canvas. */
export function drawRoomLoading(ctx: CanvasRenderingContext2D, room: RoomLayout, p: ThemePalette): void {
  fill(ctx, { x: 0, y: 0, w: room.w, h: room.h }, p.overlay);
}
