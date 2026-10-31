/**
 * Draws the pause menu over the scene in the console's style: a dark panel
 * with a light border, the bitmap font, and arrows around the settings. The
 * rows and their rectangles come from the pure menu model, so the renderer
 * and the taps agree on where everything is.
 */
import type { Rect } from '../config/layout';
import { getTheme, type ThemePalette } from '../config/themes';
import { MENU_PANEL, MENU_TITLE_Y, menuRowRect, menuRows, type MenuCaps, type MenuState } from '../game/menu';
import type { GameState } from '../game/types';
import { drawText, drawTextCentered, textWidth } from './font';

function fill(ctx: CanvasRenderingContext2D, r: Rect, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

/** A one-pixel border just inside the rectangle. */
function outline(ctx: CanvasRenderingContext2D, r: Rect, color: string): void {
  fill(ctx, { x: r.x, y: r.y, w: r.w, h: 1 }, color);
  fill(ctx, { x: r.x, y: r.y + r.h - 1, w: r.w, h: 1 }, color);
  fill(ctx, { x: r.x, y: r.y, w: 1, h: r.h }, color);
  fill(ctx, { x: r.x + r.w - 1, y: r.y, w: 1, h: r.h }, color);
}

/** A console-style box: dark fill, light border. */
export function drawPanel(ctx: CanvasRenderingContext2D, r: Rect, p: ThemePalette): void {
  fill(ctx, r, p.overlay);
  outline(ctx, r, p.text);
}

/** A small labelled button in the console style, inverted while pressed. */
export function drawConsoleButton(ctx: CanvasRenderingContext2D, r: Rect, label: string, p: ThemePalette, pressed: boolean): void {
  fill(ctx, r, pressed ? p.text : p.overlay);
  outline(ctx, r, p.text);
  drawTextCentered(ctx, label, r.x + r.w / 2, r.y + Math.floor((r.h - 5) / 2), pressed ? p.overlay : p.text, 1);
}

export function drawMenu(ctx: CanvasRenderingContext2D, s: GameState, menu: MenuState, caps: MenuCaps): void {
  const p = getTheme(s.save.settings.theme).palette;
  const rows = menuRows(s, caps);
  const cursor = Math.min(rows.length - 1, Math.max(0, menu.cursor));

  ctx.globalAlpha = 0.6;
  fill(ctx, { x: 0, y: 0, w: ctx.canvas.width, h: ctx.canvas.height }, p.overlay);
  ctx.globalAlpha = 1;
  drawPanel(ctx, MENU_PANEL, p);
  drawTextCentered(ctx, s.phase === 'title' ? 'MENU' : 'PAUSED', MENU_PANEL.x + MENU_PANEL.w / 2, MENU_TITLE_Y, p.text, 2);

  rows.forEach((row, i) => {
    const r = menuRowRect(i);
    const selected = i === cursor;
    if (selected) outline(ctx, r, p.accent);
    const color = !row.enabled ? p.accent : selected ? p.accent : p.text;
    const textY = r.y + Math.floor((r.h - 5) / 2);
    drawText(ctx, row.label, r.x + 6, textY, color, 1);
    if (row.value === null) return;
    const right = r.x + r.w - 6;
    const arrows = row.enabled;
    const valueW = textWidth(row.value, 1);
    drawText(ctx, row.value, right - 6 - valueW, textY, color, 1);
    if (arrows) {
      drawText(ctx, '<', right - 6 - valueW - 8, textY, color, 1);
      drawText(ctx, '>', right - 3, textY, color, 1);
    }
  });

  const hintY = MENU_PANEL.y + MENU_PANEL.h + 4;
  drawTextCentered(ctx, 'ARROWS MOVE  ENTER OK  ESC BACK', MENU_PANEL.x + MENU_PANEL.w / 2, hintY, p.text, 1);
}
