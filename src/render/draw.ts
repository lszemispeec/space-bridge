/**
 * Draws the game from the theme's atlas. Positions come from layout.ts and
 * frames from the atlas, so the simulation never knows about the sheet.
 * One-shot poses follow the simulation's progress; loops follow the clock.
 */
import { DIFFICULTY } from '../config/difficulty';
import {
  CRATER_BOTTOM_Y,
  CRATER_SLOTS,
  CRATER_Y,
  HUD,
  PLATE_Y,
  PLAY_X0,
  PLAY_X1,
  ROCKET,
  ROCKET_SLOT,
  ROVER,
  SCREEN_H,
  SCREEN_W,
  SIDE_BUTTONS,
  TAP_TARGETS,
  type Rect,
} from '../config/layout';
import { getTheme, type Theme, type ThemePalette } from '../config/themes';
import { tumbleFrame } from '../game/jump';
import { cosmonautView, progressOf, slotPoint, type CosmonautView } from '../game/positions';
import { bestScore, canLeaveGameOver } from '../game/rules';
import type { Cosmonaut, GameState } from '../game/types';
import type { HeldButtons } from '../platform/input';
import type { Atlas, AtlasFrame } from './atlas';
import { drawText, drawTextCentered } from './font';
import { drawFrame, frameAt, frameByProgress, frameOf, hasAnimation, type Art } from './sprites';

const CENTER_X = SCREEN_W / 2;
/** How long the plate shows its move frame after a press, in ms. */
const PLATE_MOVE_MS = 160;
/** Share of the arc, from the start, that shows the take-off pose. */
const TAKEOFF_SHARE = 0.03;
/** Share of the arc, around the apex, that shows the apex pose when a theme has no tumble. */
const APEX_SHARE = 0.24;
/**
 * The tumble cycle: `cosmonaut.air.spin.0` upright, then 45° per frame for a
 * full turn. Optional in the atlas; without it the rise / apex / descend
 * poses show. The frames may carry any anchor: the renderer sets the bottom
 * of the 20×22 cell on the arc, so the body centre tumbles 11 px above it.
 */
const SPIN_ANIMATION = 'cosmonaut.air.spin';
const SPIN_FRAMES = 8;
/** Ambient loops drawn over the vehicles instead of behind them. */
const AMBIENT_FRONT = 'ambient.signal';

export interface Renderer {
  render(ctx: CanvasRenderingContext2D, s: GameState, held: HeldButtons, art: Art | null, nowMs: number): void;
}

function pad(n: number, width = HUD.digits.count): string {
  return String(Math.min(n, 10 ** width - 1)).padStart(width, '0');
}

function nearApex(progress: number): boolean {
  return Math.abs(progress - 0.5) < APEX_SHARE / 2;
}

/** True when the atlas has the whole tumble cycle. */
export function hasTumble(atlas: Atlas): boolean {
  for (let i = 0; i < SPIN_FRAMES; i++) if (!(`${SPIN_ANIMATION}.${i}` in atlas.frames)) return false;
  return true;
}

/** The airborne frame: the tumble step for the arc progress, or the static pose. */
function airFrame(atlas: Atlas, view: CosmonautView, nowMs: number): AtlasFrame {
  const p = view.progress;
  if (hasTumble(atlas)) return frameOf(atlas, `${SPIN_ANIMATION}.${tumbleFrame(p, view.spin, SPIN_FRAMES)}`);
  const apex = hasAnimation(atlas, 'cosmonaut.apex') && nearApex(p);
  if (apex) return frameAt(atlas, 'cosmonaut.apex', nowMs);
  return frameAt(atlas, view.pose === 'rise' ? 'cosmonaut.rise' : 'cosmonaut.descend', nowMs);
}

/** The cosmonaut frame for a pose. Pure, so the choice is testable. */
export function cosmonautFrame(atlas: Atlas, view: CosmonautView, nowMs: number): AtlasFrame {
  const p = view.progress;
  switch (view.pose) {
    case 'emerge':
      return frameByProgress(atlas, 'cosmonaut.emerge', p * 2);
    case 'crouch':
      return frameAt(atlas, 'cosmonaut.crouch', nowMs);
    case 'rise':
      if (p < TAKEOFF_SHARE) return frameByProgress(atlas, 'cosmonaut.takeoff', p / TAKEOFF_SHARE);
      return airFrame(atlas, view, nowMs);
    case 'descend':
      return airFrame(atlas, view, nowMs);
    case 'land':
      return frameByProgress(atlas, 'cosmonaut.land', p);
    case 'crater_fall':
      return frameByProgress(atlas, 'cosmonaut.crater_fall', p);
    case 'board':
      return frameByProgress(atlas, 'cosmonaut.board', p);
  }
}

/** The sound button state for the saved flag and the pointer. */
export function soundState(muted: boolean, pressed: boolean): string {
  if (muted) return pressed ? 'muted_pressed' : 'muted';
  return pressed ? 'pressed' : 'idle';
}

function fill(ctx: CanvasRenderingContext2D, r: Rect, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

function drawLoading(ctx: CanvasRenderingContext2D, theme: Theme): void {
  fill(ctx, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H }, theme.palette.overlay);
  drawTextCentered(ctx, 'LOADING', CENTER_X, 116, theme.palette.text, 2);
}

function drawOverlay(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
  ctx.globalAlpha = 0.8;
  fill(ctx, { x: PLAY_X0, y: 30, w: PLAY_X1 - PLAY_X0, h: SCREEN_H - 30 }, p.overlay);
  ctx.globalAlpha = 1;
}

function themeUnlockHints(s: GameState): string {
  const best = bestScore(s.save);
  const locked = ['desert-expedition', 'neon-orbit'] as const;
  const next = locked.map(getTheme).find((t) => !s.save.unlocked.includes(t.id));
  if (!next) return 'ALL THEMES UNLOCKED';
  return `NEXT: ${next.name} AT ${next.unlockAt} (BEST ${best})`;
}

export function createRenderer(): Renderer {
  let lastPlateSlot: number | null = null;
  let plateMovedAt = -Infinity;
  let plateMoveAnimation = 'plate.move';

  const trackPlate = (s: GameState, atlas: Atlas, nowMs: number): void => {
    if (lastPlateSlot !== null && s.plateSlot !== lastPlateSlot && s.phase !== 'title') {
      plateMovedAt = nowMs;
      const right = s.plateSlot > lastPlateSlot && hasAnimation(atlas, 'plate.move_right');
      plateMoveAnimation = right ? 'plate.move_right' : 'plate.move';
    }
    lastPlateSlot = s.plateSlot;
  };

  const plateFrame = (s: GameState, atlas: Atlas, nowMs: number): AtlasFrame => {
    const standing = s.cosmonauts.find((c) => c.state === 'crouch' && c.slot === s.plateSlot);
    if (standing) return frameByProgress(atlas, 'plate.dip', progressOf(standing));
    if (nowMs - plateMovedAt < PLATE_MOVE_MS) return frameAt(atlas, plateMoveAnimation, nowMs - plateMovedAt);
    return frameAt(atlas, 'plate.idle', nowMs);
  };

  const drawAmbient = (ctx: CanvasRenderingContext2D, art: Art, nowMs: number, front: boolean): void => {
    const placements = art.atlas.placements ?? {};
    for (const [name, at] of Object.entries(placements)) {
      if (!name.startsWith('ambient.') || (name === AMBIENT_FRONT) !== front || !hasAnimation(art.atlas, name)) continue;
      drawFrame(ctx, art, frameAt(art.atlas, name, nowMs), at.x, at.y);
    }
  };

  const drawVehicles = (ctx: CanvasRenderingContext2D, s: GameState, art: Art, nowMs: number): void => {
    const { atlas } = art;
    const emerging = s.cosmonauts.find((c) => c.state === 'crouch' && c.slot === ROCKET_SLOT);
    const rocket = emerging
      ? frameByProgress(atlas, 'rocket.door_open', progressOf(emerging))
      : frameAt(atlas, 'rocket.door_closed', nowMs);
    drawFrame(ctx, art, rocket, ROCKET.x, ROCKET.y + ROCKET.h);

    // Boarding cosmonauts walk into the rover, so the hull covers them.
    for (const c of s.cosmonauts) if (c.state === 'board') drawCosmonaut(ctx, c, art, nowMs);
    const boarding = s.cosmonauts.find((c) => c.state === 'board');
    const rover = boarding
      ? frameByProgress(atlas, 'rover.door_open', progressOf(boarding))
      : frameAt(atlas, 'rover.idle', nowMs);
    drawFrame(ctx, art, rover, ROVER.x, ROVER.y + ROVER.h);
  };

  const drawCosmonaut = (ctx: CanvasRenderingContext2D, c: Cosmonaut, art: Art, nowMs: number): void => {
    const view = cosmonautView(c);
    const frame = cosmonautFrame(art.atlas, view, nowMs);
    if (view.pose === 'rise' || view.pose === 'descend') {
      // Tumble frames are anchored at the body centre; keep the cell's bottom on the arc.
      drawFrame(ctx, art, frame, view.pos.x, view.pos.y - (frame.h - frame.ay));
      return;
    }
    if (view.pose !== 'crater_fall') {
      drawFrame(ctx, art, frame, view.pos.x, view.pos.y);
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SCREEN_W, CRATER_BOTTOM_Y);
    ctx.clip();
    drawFrame(ctx, art, frame, view.pos.x, view.pos.y);
    ctx.restore();
    if ('crater.front.0' in art.atlas.frames) {
      drawFrame(ctx, art, frameOf(art.atlas, 'crater.front.0'), slotPoint(c.slot).x, CRATER_Y);
    }
  };

  const drawHud = (ctx: CanvasRenderingContext2D, s: GameState, held: HeldButtons, art: Art, nowMs: number): void => {
    const { atlas } = art;
    const p = getTheme(s.save.settings.theme).palette;
    drawFrame(ctx, art, frameAt(atlas, 'hud.icon.score', nowMs), HUD.scoreIcon.x, HUD.scoreIcon.y);
    const digits = pad(s.score);
    for (let i = 0; i < digits.length; i++) {
      const frame = frameOf(atlas, `hud.digit.${digits.charAt(i)}`);
      drawFrame(ctx, art, frame, HUD.digits.x + i * HUD.digits.pitch, HUD.digits.y);
    }
    drawText(ctx, `GAME ${s.mode}`, HUD.modeLabel.x, HUD.modeLabel.y, p.text, 1);
    const sound = frameAt(atlas, `ui.hud_sound.${soundState(s.save.settings.muted, held.mute)}`, nowMs);
    drawFrame(ctx, art, sound, TAP_TARGETS.hudMute.x, TAP_TARGETS.hudMute.y);
    for (let i = 0; i < DIFFICULTY.lives; i++) {
      const name = i < s.lives ? 'hud.icon.life' : 'hud.icon.life_empty';
      if (!hasAnimation(atlas, name)) continue;
      drawFrame(ctx, art, frameAt(atlas, name, nowMs), HUD.lives.x + i * HUD.lives.pitch, HUD.lives.y);
    }
  };

  const drawTitle = (ctx: CanvasRenderingContext2D, s: GameState, held: HeldButtons, art: Art, nowMs: number): void => {
    const theme = getTheme(s.save.settings.theme);
    const { text, accent } = theme.palette;
    drawOverlay(ctx, theme.palette);
    drawTextCentered(ctx, 'SPACE BRIDGE', CENTER_X, 50, text, 3);
    drawTextCentered(ctx, '< GAME A     GAME B >', CENTER_X, 82, text, 2);
    drawTextCentered(ctx, `HI A ${pad(s.save.highScores.A)}   HI B ${pad(s.save.highScores.B)}`, CENTER_X, 100, text, 1);
    drawTextCentered(ctx, `THEME: ${theme.name}`, CENTER_X, 118, accent, 1);
    drawTextCentered(ctx, themeUnlockHints(s), CENTER_X, 128, text, 1);
    drawTextCentered(ctx, 'PRESS LEFT OR RIGHT TO START', CENTER_X, 160, text, 1);
    drawTextCentered(ctx, 'TAP THE SIDES ON TOUCH', CENTER_X, 170, text, 1);
    const themeButton = TAP_TARGETS.titleTheme;
    const soundButton = TAP_TARGETS.titleMute;
    const themeFrame = frameAt(art.atlas, `ui.title_theme.${held.theme ? 'pressed' : 'idle'}`, nowMs);
    const soundFrame = frameAt(art.atlas, `ui.title_sound.${soundState(s.save.settings.muted, held.mute)}`, nowMs);
    drawFrame(ctx, art, themeFrame, themeButton.x, themeButton.y);
    drawFrame(ctx, art, soundFrame, soundButton.x, soundButton.y);
    drawTextCentered(ctx, 'T', themeButton.x + themeButton.w / 2, themeButton.y + themeButton.h + 3, text, 1);
    drawTextCentered(ctx, 'M', soundButton.x + soundButton.w / 2, soundButton.y + soundButton.h + 3, text, 1);
  };

  const drawGameOver = (ctx: CanvasRenderingContext2D, s: GameState): void => {
    const theme = getTheme(s.save.settings.theme);
    const { text, accent } = theme.palette;
    drawOverlay(ctx, theme.palette);
    drawTextCentered(ctx, 'GAME OVER', CENTER_X, 56, text, 3);
    drawTextCentered(ctx, `SCORE ${pad(s.score)}`, CENTER_X, 90, text, 2);
    const isRecord = s.score > 0 && s.score >= s.save.highScores[s.mode];
    const line = isRecord ? `NEW HIGH SCORE GAME ${s.mode}` : `HI ${pad(s.save.highScores[s.mode])}`;
    drawTextCentered(ctx, line, CENTER_X, 110, accent, 1);
    s.newUnlocks.forEach((id, i) => {
      drawTextCentered(ctx, `UNLOCKED: ${getTheme(id).name}`, CENTER_X, 126 + i * 10, accent, 1);
    });
    if (canLeaveGameOver(s)) drawTextCentered(ctx, 'PRESS ANY BUTTON', CENTER_X, 176, text, 1);
  };

  return {
    render(ctx, s, held, art, nowMs) {
      if (!art) {
        drawLoading(ctx, getTheme(s.save.settings.theme));
        return;
      }
      const { atlas } = art;
      trackPlate(s, atlas, nowMs);

      drawFrame(ctx, art, frameOf(atlas, 'background'), 0, 0);
      drawAmbient(ctx, art, nowMs, false);
      drawVehicles(ctx, s, art, nowMs);
      drawAmbient(ctx, art, nowMs, true);
      for (const slot of CRATER_SLOTS) {
        drawFrame(ctx, art, frameAt(atlas, 'crater.idle', nowMs), slotPoint(slot).x, CRATER_Y);
      }
      drawFrame(ctx, art, plateFrame(s, atlas, nowMs), slotPoint(s.plateSlot).x, PLATE_Y);
      for (const c of s.cosmonauts) if (c.state !== 'board') drawCosmonaut(ctx, c, art, nowMs);

      drawFrame(ctx, art, frameAt(atlas, `button.left.${held.left ? 'pressed' : 'idle'}`, nowMs), SIDE_BUTTONS.left.x, SIDE_BUTTONS.left.y);
      drawFrame(ctx, art, frameAt(atlas, `button.right.${held.right ? 'pressed' : 'idle'}`, nowMs), SIDE_BUTTONS.right.x, SIDE_BUTTONS.right.y);
      drawHud(ctx, s, held, art, nowMs);

      if (s.phase === 'title') drawTitle(ctx, s, held, art, nowMs);
      if (s.phase === 'game_over') drawGameOver(ctx, s);
    },
  };
}

