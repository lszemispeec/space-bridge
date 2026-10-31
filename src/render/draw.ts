/**
 * Placeholder renderer. Every sprite is a rectangle in the theme palette.
 * When the atlases land, this file swaps rectangles for atlas frames and
 * nothing else changes.
 */
import { DIFFICULTY } from '../config/difficulty';
import {
  COSMONAUT,
  CRATER,
  CRATER_SLOTS,
  GROUND_Y,
  GUTTER_W,
  HUD,
  PLATE,
  PLAY_X0,
  PLAY_X1,
  ROCKET,
  ROVER,
  SCREEN_H,
  SCREEN_W,
  TAP_TARGETS,
  type Rect,
} from '../config/layout';
import { getTheme, type Theme, type ThemePalette } from '../config/themes';
import { cosmonautView, slotPoint } from '../game/positions';
import { bestScore, canLeaveGameOver } from '../game/rules';
import type { Cosmonaut, GameState } from '../game/types';
import type { HeldButtons } from '../platform/input';
import { drawText, drawTextCentered } from './font';

const CENTER_X = SCREEN_W / 2;

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** A framed label that is also a tap target. */
function drawButton(ctx: CanvasRenderingContext2D, r: Rect, label: string, color: string, fill: string): void {
  rect(ctx, r.x, r.y, r.w, r.h, color);
  rect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, fill);
  drawTextCentered(ctx, label, r.x + r.w / 2, r.y + Math.floor((r.h - 5) / 2), color, 1);
}

function pad(n: number, width = 4): string {
  return String(Math.min(n, 10 ** width - 1)).padStart(width, '0');
}

function drawBackground(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
  rect(ctx, 0, 0, SCREEN_W, SCREEN_H, p.sky);
  rect(ctx, 0, 118, SCREEN_W, 32, p.horizon);
  rect(ctx, 0, 150, SCREEN_W, SCREEN_H - 150, p.ground);
  rect(ctx, ROCKET.x + ROCKET.w, GROUND_Y - 6, ROVER.x - ROCKET.x - ROCKET.w, 12, p.road);
}

function drawGutters(ctx: CanvasRenderingContext2D, p: ThemePalette, held: HeldButtons): void {
  rect(ctx, 0, 0, GUTTER_W, SCREEN_H, held.left ? p.accent : p.gutter);
  rect(ctx, SCREEN_W - GUTTER_W, 0, GUTTER_W, SCREEN_H, held.right ? p.accent : p.gutter);
  drawArrow(ctx, GUTTER_W / 2, 178, -1, p.gutterArrow);
  drawArrow(ctx, SCREEN_W - GUTTER_W / 2, 178, 1, p.gutterArrow);
}

function drawArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, dir: -1 | 1, color: string): void {
  ctx.fillStyle = color;
  for (let i = 0; i < 8; i++) {
    const h = 1 + i * 2;
    ctx.fillRect(Math.round(cx - dir * (i - 4)), Math.round(cy - i), 1, h);
  }
}

function drawHud(ctx: CanvasRenderingContext2D, s: GameState, p: ThemePalette): void {
  drawText(ctx, `SCORE ${pad(s.score)}`, HUD.scoreX, HUD.y, p.hud, 2);
  drawText(ctx, 'LIVES', HUD.livesX, HUD.y, p.hud, 2);
  for (let i = 0; i < DIFFICULTY.lives; i++) {
    const x = HUD.livesX + 42 + i * 10;
    if (i < s.lives) {
      rect(ctx, x, HUD.y, 7, 8, p.cosmonaut);
      rect(ctx, x + 1, HUD.y + 2, 5, 3, p.cosmonautVisor);
    } else {
      rect(ctx, x, HUD.y + 7, 7, 1, p.hud);
    }
  }
  drawText(ctx, `GAME ${s.mode}`, HUD.scoreX, HUD.y + 12, p.hud, 1);
  drawButton(ctx, TAP_TARGETS.hudMute, s.save.settings.muted ? 'MUTE' : 'SND', s.save.settings.muted ? p.accent : p.hud, p.sky);
}

function drawVehicles(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
  rect(ctx, ROCKET.x, ROCKET.y, ROCKET.w, ROCKET.h, p.rocket);
  rect(ctx, ROCKET.x + 4, ROCKET.y + 30, ROCKET.w - 8, 6, p.accent);
  rect(ctx, ROCKET.x + ROCKET.w - 6, GROUND_Y - 18, 5, 18, p.crater);
  rect(ctx, ROVER.x, ROVER.y, ROVER.w, ROVER.h, p.rover);
  rect(ctx, ROVER.x + 1, GROUND_Y - 18, 5, 18, p.accent);
  rect(ctx, ROVER.x - 2, ROVER.y + ROVER.h - 6, ROVER.w + 4, 6, p.crater);
}

function drawCraters(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
  for (const slot of CRATER_SLOTS) {
    const { x } = slotPoint(slot);
    rect(ctx, x - CRATER.w / 2, GROUND_Y - 1, CRATER.w, CRATER.h, p.crater);
  }
}

function drawPlate(ctx: CanvasRenderingContext2D, s: GameState, p: ThemePalette): void {
  const { x } = slotPoint(s.plateSlot);
  rect(ctx, x - PLATE.w / 2, GROUND_Y - PLATE.h, PLATE.w, PLATE.h, p.plate);
}

function drawCosmonaut(ctx: CanvasRenderingContext2D, c: Cosmonaut, p: ThemePalette): void {
  const view = cosmonautView(c);
  let w: number = COSMONAUT.w;
  let h: number = COSMONAUT.h;
  let alpha = 1;
  switch (view.pose) {
    case 'land':
    case 'crouch':
      w = COSMONAUT.w + 2;
      h = COSMONAUT.h - 4;
      break;
    case 'emerge':
      alpha = Math.min(1, view.progress * 2);
      break;
    case 'crater_fall':
      h = Math.max(2, COSMONAUT.h * (1 - view.progress));
      break;
    case 'board':
      alpha = 1 - view.progress;
      break;
    case 'rise':
    case 'descend':
      break;
  }
  const x = view.pos.x - w / 2;
  const y = view.pos.y - h;
  ctx.save();
  if (view.pose === 'crater_fall') {
    ctx.beginPath();
    ctx.rect(0, 0, SCREEN_W, GROUND_Y + CRATER.h - 1);
    ctx.clip();
  }
  ctx.globalAlpha = alpha;
  rect(ctx, x, y, w, h, p.cosmonaut);
  if (h > 6) rect(ctx, x + w - 5, y + 2, 4, 3, p.cosmonautVisor);
  ctx.restore();
}

function drawOverlay(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
  ctx.globalAlpha = 0.8;
  rect(ctx, PLAY_X0, 30, PLAY_X1 - PLAY_X0, SCREEN_H - 30, p.overlay);
  ctx.globalAlpha = 1;
}

function drawTitle(ctx: CanvasRenderingContext2D, s: GameState, theme: Theme): void {
  const light = theme.palette.sky;
  const accent = theme.palette.plate;
  drawOverlay(ctx, theme.palette);
  drawTextCentered(ctx, 'SPACE BRIDGE', CENTER_X, 50, light, 3);
  drawTextCentered(ctx, `< GAME A     GAME B >`, CENTER_X, 82, light, 2);
  drawTextCentered(ctx, `HI A ${pad(s.save.highScores.A)}   HI B ${pad(s.save.highScores.B)}`, CENTER_X, 100, light, 1);
  drawTextCentered(ctx, `THEME: ${theme.name}`, CENTER_X, 118, accent, 1);
  const lockedNames = themeUnlockHints(s);
  if (lockedNames) drawTextCentered(ctx, lockedNames, CENTER_X, 128, light, 1);
  drawTextCentered(ctx, 'PRESS LEFT OR RIGHT TO START', CENTER_X, 160, light, 1);
  drawTextCentered(ctx, 'TAP THE SIDES ON TOUCH', CENTER_X, 170, light, 1);
  drawButton(ctx, TAP_TARGETS.titleTheme, 'THEME T', light, theme.palette.overlay);
  drawButton(ctx, TAP_TARGETS.titleMute, s.save.settings.muted ? 'MUTED M' : 'SOUND M', light, theme.palette.overlay);
}

function themeUnlockHints(s: GameState): string {
  const best = bestScore(s.save);
  const locked = ['desert-expedition', 'neon-orbit'] as const;
  const next = locked.map(getTheme).find((t) => !s.save.unlocked.includes(t.id));
  if (!next) return 'ALL THEMES UNLOCKED';
  return `NEXT: ${next.name} AT ${next.unlockAt} (BEST ${best})`;
}

function drawGameOver(ctx: CanvasRenderingContext2D, s: GameState, theme: Theme): void {
  const light = theme.palette.sky;
  const accent = theme.palette.plate;
  drawOverlay(ctx, theme.palette);
  drawTextCentered(ctx, 'GAME OVER', CENTER_X, 56, light, 3);
  drawTextCentered(ctx, `SCORE ${pad(s.score)}`, CENTER_X, 90, light, 2);
  const isRecord = s.score > 0 && s.score >= s.save.highScores[s.mode];
  drawTextCentered(ctx, isRecord ? `NEW HIGH SCORE GAME ${s.mode}` : `HI ${pad(s.save.highScores[s.mode])}`, CENTER_X, 110, accent, 1);
  s.newUnlocks.forEach((id, i) => {
    drawTextCentered(ctx, `UNLOCKED: ${getTheme(id).name}`, CENTER_X, 126 + i * 10, accent, 1);
  });
  if (canLeaveGameOver(s)) drawTextCentered(ctx, 'PRESS ANY BUTTON', CENTER_X, 176, light, 1);
}

export function render(ctx: CanvasRenderingContext2D, s: GameState, held: HeldButtons): void {
  const theme = getTheme(s.save.settings.theme);
  const p = theme.palette;
  drawBackground(ctx, p);
  drawVehicles(ctx, p);
  drawCraters(ctx, p);
  drawPlate(ctx, s, p);
  for (const c of s.cosmonauts) drawCosmonaut(ctx, c, p);
  drawGutters(ctx, p, held);
  drawHud(ctx, s, p);
  if (s.phase === 'title') drawTitle(ctx, s, theme);
  if (s.phase === 'game_over') drawGameOver(ctx, s, theme);
}
