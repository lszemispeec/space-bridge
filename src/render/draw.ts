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
  PLATE_Y,
  PLAY_X0,
  PLAY_X1,
  ROCKET,
  ROCKET_LEDGE,
  ROCKET_SLOT,
  ROOM_BACKGROUND,
  ROVER,
  roomLayout,
  SCREEN_H,
  SCREEN_W,
  TAP_TARGETS,
  type PlateSide,
  type Rect,
} from '../config/layout';
import { getTheme, type Theme, type ThemePalette } from '../config/themes';
import { createCreatures, creatureAnimation, creatureAt, stepCreatures, type Creatures } from '../game/creatures';
import { tumbleFrame, type Point } from '../game/jump';
import { cosmonautView, progressOf, slotPoint, type CosmonautView } from '../game/positions';
import { bestScore, canLeaveGameOver } from '../game/rules';
import { nextLanding } from '../game/schedule';
import type { Cosmonaut, GameState } from '../game/types';
import type { HeldButtons } from '../platform/input';
import type { Viewport } from '../platform/viewport';
import type { Atlas, AtlasFrame } from './atlas';
import { drawTextCentered } from './font';
import { LEVER_IDLE, leverPull, pullLever, settleLever, type Lever } from './lever';
import { drawRoom, drawRoomLoading, leverPullMs, pad as padTo, soundState, type LeverPulls } from './room';
import { drawFrame, frameAt, frameByProgress, frameOf, hasAnimation, type Art } from './sprites';

export { soundState } from './room';

/** The score digits as the console shows them. */
const SCORE_DIGITS = 4;
const pad = (n: number): string => padTo(n, SCORE_DIGITS);

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
 * The rocket hull is one of four hatch states. It opens over the first half
 * of the wait on the ledge, stays open while the cosmonaut crouches, and
 * closes on the clock after the take-off.
 */
const HATCH = { closed: 'rocket.hatch.closed', opening: 'rocket.hatch.opening', open: 'rocket.hatch.open', closing: 'rocket.hatch.closing' } as const;
/** Share of the wait on the ledge during which the hatch opens and the cosmonaut stands. */
const HATCH_OPENING_SHARE = 0.5;
/** Real ms the closing plays after the take-off, then the closed hull shows. */
const HATCH_CLOSING_MS = 270;
const LEDGE_STAND = 'cosmonaut.ledge.stand';
const LEDGE_CROUCH = 'cosmonaut.ledge.crouch';
const GRAB = 'crater.tentacle.grab';
/** Longest real gap between two frames that the creatures advance by; a hidden tab does not fast-forward them. */
const MAX_CREATURE_STEP = 0.1;

/** Where the renderer draws: the scene, and the room on the page canvas around it. */
export interface RenderTarget {
  /** The 320x240 scene. */
  scene: CanvasRenderingContext2D;
  /** The page canvas, in room pixels. */
  room: CanvasRenderingContext2D;
  viewport: Viewport;
  /** Copies the scene into the room's window. */
  present(): void;
}

export interface Renderer {
  render(target: RenderTarget, s: GameState, held: HeldButtons, art: Art | null, nowMs: number): void;
  /** A plate press, so the lever on that side pulls. Queued presses pull in turn. */
  pull(side: PlateSide): void;
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
      return frameAt(atlas, LEDGE_STAND, nowMs);
    case 'crouch':
      return frameAt(atlas, LEDGE_CROUCH, nowMs);
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

/** The rim of the `index`-th crater, left to right. */
export function craterFrame(atlas: Atlas, index: number): AtlasFrame {
  return frameOf(atlas, `crater.${index}`);
}

/** The front lip of the `index`-th crater, drawn over its creature and over a grabbed cosmonaut. */
export function craterFrontFrame(atlas: Atlas, index: number): AtlasFrame {
  return frameOf(atlas, `crater.front.${index}`);
}

/**
 * The rocket hull for the hatch state. `onLedge` is the progress of the wait
 * on the ledge, or null when nobody is there; `sinceLeftMs` is the real time
 * since the last take-off from the ledge.
 */
export function hatchFrame(atlas: Atlas, onLedge: number | null, sinceLeftMs: number, nowMs: number): AtlasFrame {
  if (onLedge !== null) {
    if (onLedge < HATCH_OPENING_SHARE) return frameByProgress(atlas, HATCH.opening, onLedge / HATCH_OPENING_SHARE);
    return frameAt(atlas, HATCH.open, nowMs);
  }
  if (sinceLeftMs < HATCH_CLOSING_MS) return frameAt(atlas, HATCH.closing, sinceLeftMs);
  return frameAt(atlas, HATCH.closed, nowMs);
}

/**
 * Feet position on the ledge, from the atlas's `rocketLedge` socket: a point
 * inside the open-hatch hull, measured from that frame's top-left corner. The
 * layout's default stands in when the atlas has no socket.
 */
export function ledgePoint(atlas: Atlas): Point {
  const socket = atlas.sockets?.rocketLedge;
  const frame = socket ? atlas.frames[socket.frame] : undefined;
  if (!socket || !frame) return ROCKET_LEDGE;
  return { x: ROCKET.x - frame.ax + socket.x, y: ROCKET.y + ROCKET.h - frame.ay + socket.y };
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
  const levers: Record<PlateSide, Lever> = { left: LEVER_IDLE, right: LEVER_IDLE };
  const pendingPulls: PlateSide[] = [];

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

  const drawAmbient = (ctx: CanvasRenderingContext2D, art: Art, nowMs: number, front: boolean): void => {
    const placements = art.atlas.placements ?? {};
    const retired = art.atlas.retiredAnimations ?? [];
    for (const [name, at] of Object.entries(placements)) {
      if (!name.startsWith('ambient.') || (name === AMBIENT_FRONT) !== front || !hasAnimation(art.atlas, name)) continue;
      if (retired.includes(name)) continue;
      drawFrame(ctx, art, frameAt(art.atlas, name, nowMs), at.x, at.y);
    }
  };

  const drawVehicles = (ctx: CanvasRenderingContext2D, s: GameState, art: Art, nowMs: number): void => {
    const { atlas } = art;
    const onLedge = s.cosmonauts.find((c) => c.state === 'crouch' && c.slot === ROCKET_SLOT);
    if (ledgeBusy && !onLedge) hatchLeftAt = nowMs;
    ledgeBusy = onLedge !== undefined;
    const hull = hatchFrame(atlas, onLedge ? progressOf(onLedge) : null, nowMs - hatchLeftAt, nowMs);
    drawFrame(ctx, art, hull, ROCKET.x, ROCKET.y + ROCKET.h);

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
    if (view.pose === 'crater_fall') {
      drawGrab(ctx, c, art);
      return;
    }
    const frame = cosmonautFrame(art.atlas, view, nowMs);
    // Air frames are anchored at the body centre, the rest at the feet; keep the cell's bottom on the feet position.
    drawFrame(ctx, art, frame, view.pos.x, view.pos.y - (frame.h - frame.ay));
  };

  /**
   * The grab frames include the captured cosmonaut, so the fall shows the
   * tentacle pulling it down instead of the cosmonaut sprite: clipped at the
   * crater bottom, with the crater's own lip drawn back on top.
   */
  const drawGrab = (ctx: CanvasRenderingContext2D, c: Cosmonaut, art: Art): void => {
    const crater = slotPoint(c.slot);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SCREEN_W, CRATER_BOTTOM_Y);
    ctx.clip();
    drawFrame(ctx, art, frameByProgress(art.atlas, GRAB, progressOf(c)), crater.x, CRATER_Y);
    ctx.restore();
    drawFrame(ctx, art, craterFrontFrame(art.atlas, craterIndex(c.slot)), crater.x, CRATER_Y);
  };

  /** Rim, creature, then the front lip, per crater. The grab is drawn with the falling cosmonaut instead. */
  const drawCraters = (ctx: CanvasRenderingContext2D, s: GameState, art: Art, nowMs: number): void => {
    const { atlas } = art;
    const scene = stepScene(s, nowMs);
    for (const slot of CRATER_SLOTS) {
      const index = craterIndex(slot);
      const at = slotPoint(slot);
      drawFrame(ctx, art, craterFrame(atlas, index), at.x, CRATER_Y);
      const creature = creatureAt(scene, slot);
      if (creature && creature.act !== 'grab') {
        const animation = creatureAnimation(creature);
        drawFrame(ctx, art, frameByProgress(atlas, animation.name, animation.progress), at.x, CRATER_Y);
      }
      drawFrame(ctx, art, craterFrontFrame(atlas, index), at.x, CRATER_Y);
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

  /** Pulls the levers for the presses since the last frame, lets them settle on the clock, and reads them. */
  const stepLevers = (held: HeldButtons, atlas: Atlas, nowMs: number): LeverPulls => {
    const pulls = {} as LeverPulls;
    for (const side of ['left', 'right'] as const) {
      const pullMs = leverPullMs(atlas, side);
      let lever = levers[side];
      for (const pressed of pendingPulls) if (pressed === side) lever = pullLever(lever, nowMs, pullMs);
      lever = settleLever(lever, held[side], nowMs, pullMs);
      levers[side] = lever;
      pulls[side] = { pull: leverPull(lever, nowMs, pullMs), releasing: lever.phase === 'release' };
    }
    pendingPulls.length = 0;
    return pulls;
  };

  return {
    pull(side) {
      pendingPulls.push(side);
    },
    render(target, s, held, art, nowMs) {
      const ctx = target.scene;
      const room = roomLayout(target.viewport.orientation);
      if (!art) {
        drawLoading(ctx, getTheme(s.save.settings.theme));
        drawRoomLoading(target.room, room, getTheme(s.save.settings.theme).palette);
        target.present();
        return;
      }
      const { atlas } = art;
      trackPlate(s, atlas, nowMs);

      drawFrame(ctx, art, frameOf(atlas, ROOM_BACKGROUND), 0, 0);
      drawAmbient(ctx, art, nowMs, false);
      drawVehicles(ctx, s, art, nowMs);
      drawAmbient(ctx, art, nowMs, true);
      drawCraters(ctx, s, art, nowMs);
      drawFrame(ctx, art, plateFrame(s, atlas, nowMs), slotPoint(s.plateSlot).x, PLATE_Y);
      for (const c of s.cosmonauts) if (c.state !== 'board') drawCosmonaut(ctx, c, art, nowMs);

      if (s.phase === 'title') drawTitle(ctx, s, held, art, nowMs);
      if (s.phase === 'game_over') drawGameOver(ctx, s);

      target.present();
      drawRoom(target.room, room, s, held, stepLevers(held, atlas, nowMs), art, nowMs);
    },
  };
}

