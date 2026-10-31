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
  ROCKET,
  ROCKET_HATCH,
  ROCKET_SLOT,
  ROOM_BACKGROUND,
  ROVER,
  ROVER_HATCH,
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
import { cosmonautView, progressOf, slotPoint, type CosmonautView, type Hatches } from '../game/positions';
import { bestScore, canLeaveGameOver } from '../game/rules';
import { nextLanding } from '../game/schedule';
import type { MenuCaps, MenuState } from '../game/menu';
import type { Cosmonaut, GameState } from '../game/types';
import type { HeldButtons } from '../platform/input';
import type { Viewport } from '../platform/viewport';
import type { Atlas, AtlasFrame } from './atlas';
import { drawTextCentered } from './font';
import { drawMenu } from './menu';
import { LEVER_IDLE, leverPull, pullLever, settleLever, type Lever } from './lever';
import { drawRoom, drawRoomLoading, leverPullMs, pad as padTo, soundState, type LeverPulls } from './room';
import { drawFrame, drawFrameScaled, frameAt, frameByProgress, frameOf, hasAnimation, type Art } from './sprites';

export { soundState } from './room';

/** The score digits as the console shows them. */
const SCORE_DIGITS = 4;
const pad = (n: number): string => padTo(n, SCORE_DIGITS);

const CENTER_X = SCREEN_W / 2;
const LAST_CRATER = CRATER_SLOTS[CRATER_SLOTS.length - 1] ?? ROCKET_SLOT;
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
 * Each vehicle is one complete model with a built-in hatch, drawn in one of
 * four states. The rocket's top hatch opens over the first half of the wait
 * in its mouth, stays open while the cosmonaut grows and crouches, and closes
 * on the clock after the take-off. The rover's hatch opens at the start of
 * the last hop, stays open while the cosmonaut shrinks in, and closes on the
 * clock once it is gone. The old door and gantry hulls are retired.
 */
export type Vehicle = 'rocket' | 'rover';
const HATCH: Record<Vehicle, string> = { rocket: 'rocket.tophatch', rover: 'rover.hatch' };
/** Share of the wait in the rocket's mouth during which the hatch opens. */
const HATCH_OPENING_SHARE = 0.5;
/** Share of the last hop during which the rover's hatch opens. */
const ROVER_OPENING_SHARE = 0.3;
/** Real ms the closing plays after the mouth empties, then the closed hull shows. */
const HATCH_CLOSING_MS = 180;
const LEDGE_STAND = 'cosmonaut.ledge.stand';
const LEDGE_CROUCH = 'cosmonaut.ledge.crouch';
const TAKEOFF = 'cosmonaut.takeoff';
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

/** The shell's part of what is on screen: the pause menu's cursor and what the shell can offer in it. */
export interface Overlay {
  menu: MenuState;
  caps: MenuCaps;
}

export interface Renderer {
  /** Draws one frame. `nowMs` is the scene clock: it stops while the game is paused, so every loop freezes with it. */
  render(target: RenderTarget, s: GameState, held: HeldButtons, art: Art | null, nowMs: number, overlay: Overlay): void;
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
      if (p < TAKEOFF_SHARE) return frameByProgress(atlas, TAKEOFF, p / TAKEOFF_SHARE);
      return airFrame(atlas, view, nowMs);
    case 'hop':
      return frameAt(atlas, TAKEOFF, 0);
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
 * A vehicle's hull for its hatch state. `opening` is the progress of the
 * opening, 0..1, or null when the mouth is empty: the hatch opens over it and
 * then holds open. `sinceEmptyMs` is the real time since the mouth emptied,
 * for the closing.
 */
export function hatchFrame(atlas: Atlas, vehicle: Vehicle, opening: number | null, sinceEmptyMs: number, nowMs: number): AtlasFrame {
  const hatch = HATCH[vehicle];
  if (opening !== null) {
    if (opening < 1) return frameByProgress(atlas, `${hatch}.opening`, opening);
    return frameAt(atlas, `${hatch}.open`, nowMs);
  }
  if (sinceEmptyMs < HATCH_CLOSING_MS) return frameAt(atlas, `${hatch}.closing`, sinceEmptyMs);
  return frameAt(atlas, `${hatch}.closed`, nowMs);
}

function socketPoint(atlas: Atlas, name: string, anchor: Point, fallback: Point): Point {
  const socket = atlas.sockets?.[name];
  const frame = socket ? atlas.frames[socket.frame] : undefined;
  if (!socket || !frame || atlas.retiredSockets?.includes(name)) return fallback;
  return { x: anchor.x - frame.ax + socket.x, y: anchor.y - frame.ay + socket.y };
}

/**
 * The hatch mouths, from the atlas's `rocketTopHatch` and `roverHatch`
 * sockets: points inside the open-hatch hulls, measured from those frames'
 * top-left corners. The layout's defaults stand in when a socket is missing
 * or retired.
 */
export function hatchPoints(atlas: Atlas): Hatches {
  return {
    rocket: socketPoint(atlas, 'rocketTopHatch', { x: ROCKET.x, y: ROCKET.y + ROCKET.h }, ROCKET_HATCH),
    rover: socketPoint(atlas, 'roverHatch', { x: ROVER.x, y: ROVER.y + ROVER.h }, ROVER_HATCH),
  };
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

/** Dims the whole scene under the title and game-over text: the window shows the scene edge to edge. */
function drawOverlay(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
  ctx.globalAlpha = 0.8;
  fill(ctx, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H }, p.overlay);
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
  const mouthBusy: Record<Vehicle, boolean> = { rocket: false, rover: false };
  const mouthEmptiedAt: Record<Vehicle, number> = { rocket: -Infinity, rover: -Infinity };
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

  /** The hull for a mouth's state, and the clock for its closing. `opening` is null while the mouth is empty. */
  const hull = (vehicle: Vehicle, opening: number | null, atlas: Atlas, nowMs: number): AtlasFrame => {
    if (mouthBusy[vehicle] && opening === null) mouthEmptiedAt[vehicle] = nowMs;
    mouthBusy[vehicle] = opening !== null;
    return hatchFrame(atlas, vehicle, opening, nowMs - mouthEmptiedAt[vehicle], nowMs);
  };

  /** The rover's mouth is busy from the take-off of the last hop until the boarder is gone. */
  const roverOpening = (s: GameState): number | null => {
    if (s.cosmonauts.some((c) => c.state === 'board')) return 1;
    const hopping = s.cosmonauts.find((c) => c.state === 'air' && c.slot === LAST_CRATER);
    return hopping ? Math.min(1, progressOf(hopping) / ROVER_OPENING_SHARE) : null;
  };

  const drawVehicles = (ctx: CanvasRenderingContext2D, s: GameState, art: Art, nowMs: number): void => {
    const { atlas } = art;
    const inMouth = s.cosmonauts.find((c) => c.state === 'crouch' && c.slot === ROCKET_SLOT);
    const rocketOpening = inMouth ? Math.min(1, progressOf(inMouth) / HATCH_OPENING_SHARE) : null;
    drawFrame(ctx, art, hull('rocket', rocketOpening, atlas, nowMs), ROCKET.x, ROCKET.y + ROCKET.h);
    drawFrame(ctx, art, hull('rover', roverOpening(s), atlas, nowMs), ROVER.x, ROVER.y + ROVER.h);
  };

  const drawCosmonaut = (ctx: CanvasRenderingContext2D, c: Cosmonaut, art: Art, nowMs: number): void => {
    const view = cosmonautView(c, hatchPoints(art.atlas));
    if (view.pose === 'crater_fall') {
      drawGrab(ctx, c, art);
      return;
    }
    const frame = cosmonautFrame(art.atlas, view, nowMs);
    // Air frames are anchored at the body centre, the rest at the feet; keep the cell's bottom on the feet position.
    drawFrameScaled(ctx, art, frame, view.pos.x, view.pos.y - (frame.h - frame.ay) * view.scale, view.scale);
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
    render(target, s, held, art, nowMs, overlay) {
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
      for (const c of s.cosmonauts) drawCosmonaut(ctx, c, art, nowMs);

      if (s.phase === 'title') drawTitle(ctx, s, held, art, nowMs);
      if (s.phase === 'game_over') drawGameOver(ctx, s);
      if (s.paused) drawMenu(ctx, s, overlay.menu, overlay.caps);

      target.present();
      drawRoom(target.room, room, s, held, stepLevers(held, atlas, nowMs), art, nowMs);
    },
  };
}

