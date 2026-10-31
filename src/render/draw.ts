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
  ROCKET_LEDGE,
  ROCKET_SLOT,
  ROVER,
  SCREEN_H,
  SCREEN_W,
  SIDE_BUTTONS,
  TAP_TARGETS,
  type Rect,
} from '../config/layout';
import { getTheme, type Theme, type ThemePalette } from '../config/themes';
import { createCreatures, creatureAnimation, stepCreatures, type Creatures } from '../game/creatures';
import { tumbleFrame, type Point } from '../game/jump';
import { cosmonautView, progressOf, slotPoint, type CosmonautView } from '../game/positions';
import { bestScore, canLeaveGameOver } from '../game/rules';
import { nextLanding } from '../game/schedule';
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
/**
 * The tumble cycle: `cosmonaut.air.spin.0` upright, then 45° clockwise per
 * frame for a full turn. Its frames are anchored at the body centre, so the
 * renderer sets the bottom of the 20×22 cell on the arc and the body centre
 * tumbles 11 px above the feet position, as the atlas contract asks.
 */
const SPIN_ANIMATION = 'cosmonaut.air.spin';
const SPIN_FRAMES = 8;
/**
 * The flail: `cosmonaut.air.flail.0/1` swap on the clock, slower than the
 * sheet's 80 ms reference so the spread limbs read at 1×. A flail hop shows
 * it for the whole arc with no tumble; every crater fall shows it too, until
 * the fall pose takes over at `FALL_FLAIL_SHARE` of the drop.
 */
const FLAIL_ANIMATION = 'cosmonaut.air.flail';
const FLAIL_FRAMES = 2;
const FLAIL_SWAP_MS = 160;
const FALL_FLAIL_SHARE = 0.5;
/** Ambient loops drawn over the vehicles instead of behind them. */
const AMBIENT_FRONT = 'ambient.signal';
/**
 * The hatch high on the rocket and the poses on its ledge. Optional until the
 * art lands in every theme: without them the hull stays closed and the old
 * door poses play on the ledge.
 */
const HATCH_OPEN = 'rocket.hatch.open';
const HATCH_CLOSE = 'rocket.hatch.close';
const LEDGE_STAND = 'cosmonaut.ledge.stand';
const LEDGE_CROUCH = 'cosmonaut.ledge.crouch';
/** Longest real gap between two frames that the creatures advance by; a hidden tab does not fast-forward them. */
const MAX_CREATURE_STEP = 0.1;

export interface Renderer {
  render(ctx: CanvasRenderingContext2D, s: GameState, held: HeldButtons, art: Art | null, nowMs: number): void;
}

function pad(n: number, width = HUD.digits.count): string {
  return String(Math.min(n, 10 ** width - 1)).padStart(width, '0');
}

function flailFrame(atlas: Atlas, nowMs: number): AtlasFrame {
  return frameOf(atlas, `${FLAIL_ANIMATION}.${Math.floor(nowMs / FLAIL_SWAP_MS) % FLAIL_FRAMES}`);
}

/** The airborne frame: the flail on the clock, or the tumble step for the arc progress and the hop's spin. */
function airFrame(atlas: Atlas, view: CosmonautView, nowMs: number): AtlasFrame {
  if (view.flail) return flailFrame(atlas, nowMs);
  return frameOf(atlas, `${SPIN_ANIMATION}.${tumbleFrame(view.progress, view.spin, SPIN_FRAMES)}`);
}

/** The cosmonaut frame for a pose. Pure, so the choice is testable. */
export function cosmonautFrame(atlas: Atlas, view: CosmonautView, nowMs: number): AtlasFrame {
  const p = view.progress;
  switch (view.pose) {
    case 'emerge':
      return frameByProgress(atlas, hasAnimation(atlas, LEDGE_STAND) ? LEDGE_STAND : 'cosmonaut.emerge', p * 2);
    case 'crouch':
      return frameAt(atlas, hasAnimation(atlas, LEDGE_CROUCH) ? LEDGE_CROUCH : 'cosmonaut.crouch', nowMs);
    case 'rise':
      if (p < TAKEOFF_SHARE) return frameByProgress(atlas, 'cosmonaut.takeoff', p / TAKEOFF_SHARE);
      return airFrame(atlas, view, nowMs);
    case 'descend':
      return airFrame(atlas, view, nowMs);
    case 'land':
      return frameByProgress(atlas, 'cosmonaut.land', p);
    case 'crater_fall':
      if (p < FALL_FLAIL_SHARE) return flailFrame(atlas, nowMs);
      return frameByProgress(atlas, 'cosmonaut.crater_fall', (p - FALL_FLAIL_SHARE) / (1 - FALL_FLAIL_SHARE));
    case 'board':
      return frameByProgress(atlas, 'cosmonaut.board', p);
  }
}

/** The sound button state for the saved flag and the pointer. */
export function soundState(muted: boolean, pressed: boolean): string {
  if (muted) return pressed ? 'muted_pressed' : 'muted';
  return pressed ? 'pressed' : 'idle';
}

/** The rim of the `index`-th crater: its own shape when the atlas has one, else the shared rim. */
export function craterAnimation(atlas: Atlas, index: number): string {
  const own = `crater.${index}`;
  return hasAnimation(atlas, own) ? own : 'crater.idle';
}

/** The front lip that covers a fallen cosmonaut, or null when the atlas has none. */
export function craterFrontFrame(atlas: Atlas, index: number): AtlasFrame | null {
  for (const name of [`crater.front.${index}`, 'crater.front.0']) {
    const frame = atlas.frames[name];
    if (frame) return frame;
  }
  return null;
}

/** Feet position on the ledge: the atlas's `rocket.ledge` placement, else the layout's. */
export function ledgePoint(atlas: Atlas): Point {
  return atlas.placements?.['rocket.ledge'] ?? ROCKET_LEDGE;
}

/** Where the hatch frames are drawn: the atlas's `rocket.hatch` placement, else the rocket's own anchor. */
export function hatchPoint(atlas: Atlas): Point {
  return atlas.placements?.['rocket.hatch'] ?? { x: ROCKET.x, y: ROCKET.y + ROCKET.h };
}

function craterIndex(slot: number): number {
  return Math.max(0, (CRATER_SLOTS as readonly number[]).indexOf(slot));
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
  let ledgeBusy = false;
  let hatchLeftAt = -Infinity;
  let creatures: Creatures | null = null;
  let creaturesSteppedAt = 0;

  const stepScene = (s: GameState, nowMs: number): Creatures => {
    if (!creatures) {
      creatures = createCreatures(s.rng.seed);
      creaturesSteppedAt = nowMs;
    }
    const dt = Math.min(MAX_CREATURE_STEP, Math.max(0, (nowMs - creaturesSteppedAt) / 1000));
    creaturesSteppedAt = nowMs;
    creatures = stepCreatures(creatures, dt, {
      plateSlot: s.plateSlot,
      nextLandingSlot: nextLanding(s.cosmonauts, DIFFICULTY.timing)?.slot ?? null,
      falls: s.cosmonauts.filter((c) => c.state === 'fall').map((c) => ({ slot: c.slot, progress: progressOf(c) })),
    });
    return creatures;
  };

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

  const drawAmbient = (ctx: CanvasRenderingContext2D, art: Art, nowMs: number, front: boolean, hidden: readonly string[]): void => {
    const placements = art.atlas.placements ?? {};
    for (const [name, at] of Object.entries(placements)) {
      if (!name.startsWith('ambient.') || (name === AMBIENT_FRONT) !== front || !hasAnimation(art.atlas, name)) continue;
      if (hidden.includes(name)) continue;
      drawFrame(ctx, art, frameAt(art.atlas, name, nowMs), at.x, at.y);
    }
  };

  const drawVehicles = (ctx: CanvasRenderingContext2D, s: GameState, art: Art, nowMs: number): void => {
    const { atlas } = art;
    drawFrame(ctx, art, frameAt(atlas, 'rocket.door_closed', nowMs), ROCKET.x, ROCKET.y + ROCKET.h);
    // The hatch opens while a cosmonaut is on the ledge and closes on the clock after the take-off.
    const onLedge = s.cosmonauts.find((c) => c.state === 'crouch' && c.slot === ROCKET_SLOT);
    if (ledgeBusy && !onLedge) hatchLeftAt = nowMs;
    ledgeBusy = onLedge !== undefined;
    if (hasAnimation(atlas, HATCH_OPEN) && hasAnimation(atlas, HATCH_CLOSE)) {
      const hatch = onLedge ? frameByProgress(atlas, HATCH_OPEN, progressOf(onLedge) * 2) : frameAt(atlas, HATCH_CLOSE, nowMs - hatchLeftAt);
      const at = hatchPoint(atlas);
      drawFrame(ctx, art, hatch, at.x, at.y);
    }

    // Boarding cosmonauts walk into the rover, so the hull covers them.
    for (const c of s.cosmonauts) if (c.state === 'board') drawCosmonaut(ctx, c, art, nowMs);
    const boarding = s.cosmonauts.find((c) => c.state === 'board');
    const rover = boarding
      ? frameByProgress(atlas, 'rover.door_open', progressOf(boarding))
      : frameAt(atlas, 'rover.idle', nowMs);
    drawFrame(ctx, art, rover, ROVER.x, ROVER.y + ROVER.h);
  };

  const drawCosmonaut = (ctx: CanvasRenderingContext2D, c: Cosmonaut, art: Art, nowMs: number): void => {
    const view = cosmonautView(c, ledgePoint(art.atlas));
    const frame = cosmonautFrame(art.atlas, view, nowMs);
    // Air frames are anchored at the body centre, the rest at the feet; keep the cell's bottom on the feet position.
    const y = view.pos.y - (frame.h - frame.ay);
    if (view.pose !== 'crater_fall') {
      drawFrame(ctx, art, frame, view.pos.x, y);
      return;
    }
    // The tentacle wraps the cosmonaut, so the grab is drawn over it, under the same clip.
    const crater = slotPoint(c.slot);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SCREEN_W, CRATER_BOTTOM_Y);
    ctx.clip();
    drawFrame(ctx, art, frame, view.pos.x, y);
    const grab = creatures?.creatures.find((k) => k.slot === c.slot && k.act === 'grab');
    const grabAnimation = grab ? creatureAnimation(grab) : null;
    if (grabAnimation && hasAnimation(art.atlas, grabAnimation.name)) {
      drawFrame(ctx, art, frameByProgress(art.atlas, grabAnimation.name, grabAnimation.progress), crater.x, CRATER_Y);
    }
    ctx.restore();
    const front = craterFrontFrame(art.atlas, craterIndex(c.slot));
    if (front) drawFrame(ctx, art, front, crater.x, CRATER_Y);
  };

  /** The rims, then whatever peeks out of them. The grab is drawn with the falling cosmonaut instead. */
  const drawCraters = (ctx: CanvasRenderingContext2D, s: GameState, art: Art, nowMs: number): void => {
    const { atlas } = art;
    const scene = stepScene(s, nowMs);
    for (const slot of CRATER_SLOTS) {
      const index = craterIndex(slot);
      drawFrame(ctx, art, frameAt(atlas, craterAnimation(atlas, index), nowMs), slotPoint(slot).x, CRATER_Y);
    }
    for (const creature of scene.creatures) {
      const animation = creatureAnimation(creature);
      if (!animation || creature.act === 'grab' || !hasAnimation(atlas, animation.name)) continue;
      drawFrame(ctx, art, frameByProgress(atlas, animation.name, animation.progress), slotPoint(creature.slot).x, CRATER_Y);
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

      const hidden = getTheme(s.save.settings.theme).hiddenAmbient ?? [];
      drawFrame(ctx, art, frameOf(atlas, 'background'), 0, 0);
      drawAmbient(ctx, art, nowMs, false, hidden);
      drawVehicles(ctx, s, art, nowMs);
      drawAmbient(ctx, art, nowMs, true, hidden);
      drawCraters(ctx, s, art, nowMs);
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

