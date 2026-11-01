import { describe, expect, it } from 'vitest';
import polar from '../../public/atlas/polar-signal.json';
import type { Atlas, AtlasFrame } from './atlas';
import { cosmonautFrame, craterFrame, craterFrontFrame, hatchFrame, hatchPoints, soundState } from './draw';
import { ROCKET, ROCKET_HATCH, ROVER, ROVER_HATCH } from '../config/layout';
import { drawFrame, drawFrameScaled, frameAt, frameByProgress, frameOf, type Art } from './sprites';

function frame(x: number, duration: number): AtlasFrame {
  return { x, y: 0, w: 4, h: 4, ax: 2, ay: 4, duration };
}

const atlas: Atlas = {
  meta: { contract: 1, theme: 'polar-signal', image: 'x.png', size: { w: 64, h: 8 }, palette: [] },
  frames: { 'a.0': frame(0, 100), 'a.1': frame(4, 100), 'a.2': frame(8, 200), 'b.0': frame(12, 50), 'b.1': frame(16, 50) },
  animations: {
    loop: { frames: ['a.0', 'a.1', 'a.2'], loop: true },
    shot: { frames: ['b.0', 'b.1'], loop: false },
  },
};

describe('frameAt', () => {
  it('walks the frame durations and wraps a loop', () => {
    expect(frameAt(atlas, 'loop', 0).x).toBe(0);
    expect(frameAt(atlas, 'loop', 99).x).toBe(0);
    expect(frameAt(atlas, 'loop', 100).x).toBe(4);
    expect(frameAt(atlas, 'loop', 250).x).toBe(8);
    expect(frameAt(atlas, 'loop', 400).x).toBe(0);
    expect(frameAt(atlas, 'loop', 1000 * 400 + 150).x).toBe(4);
  });

  it('holds the last frame of a one-shot', () => {
    expect(frameAt(atlas, 'shot', 49).x).toBe(12);
    expect(frameAt(atlas, 'shot', 50).x).toBe(16);
    expect(frameAt(atlas, 'shot', 5000).x).toBe(16);
  });

  it('throws on unknown names, so a broken atlas is loud', () => {
    expect(() => frameAt(atlas, 'nope', 0)).toThrow(/no animation "nope"/);
    expect(() => frameOf(atlas, 'nope')).toThrow(/no frame "nope"/);
  });
});

describe('frameByProgress', () => {
  it('spreads the progress over the durations, so a long frame keeps its share', () => {
    expect(frameByProgress(atlas, 'loop', 0).x).toBe(0);
    expect(frameByProgress(atlas, 'loop', 0.49).x).toBe(4);
    expect(frameByProgress(atlas, 'loop', 0.5).x).toBe(8);
    expect(frameByProgress(atlas, 'loop', 1).x).toBe(8);
    expect(frameByProgress(atlas, 'loop', 7).x).toBe(8);
    expect(frameByProgress(atlas, 'shot', -1).x).toBe(12);
  });
});

describe('drawFrame', () => {
  it('places the anchor at the given point, on whole pixels', () => {
    const calls: unknown[][] = [];
    const ctx = { drawImage: (...args: unknown[]) => calls.push(args) } as unknown as CanvasRenderingContext2D;
    const art: Art = { atlas, image: {} as CanvasImageSource };
    drawFrame(ctx, art, frame(8, 100), 10.4, 20.6);
    expect(calls[0]).toEqual([art.image, 8, 0, 4, 4, 8, 17, 4, 4]);
  });

  it('scales to whole pixels around the anchor, and draws plain at scale 1', () => {
    const calls: unknown[][] = [];
    const ctx = { drawImage: (...args: unknown[]) => calls.push(args) } as unknown as CanvasRenderingContext2D;
    const art: Art = { atlas, image: {} as CanvasImageSource };
    const cell: AtlasFrame = { x: 0, y: 0, w: 20, h: 22, ax: 10, ay: 22, duration: 1 };
    drawFrameScaled(ctx, art, cell, 63, 112, 0.5);
    expect(calls[0]).toEqual([art.image, 0, 0, 20, 22, 58, 101, 10, 11]);
    drawFrameScaled(ctx, art, cell, 63, 112, 0.75);
    expect(calls[1]).toEqual([art.image, 0, 0, 20, 22, 56, 96, 15, 17]);
    drawFrameScaled(ctx, art, cell, 63, 112, 1);
    expect(calls[2]).toEqual([art.image, 0, 0, 20, 22, 53, 90, 20, 22]);
  });
});

describe('cosmonautFrame with the production atlas', () => {
  const real = polar as Atlas;
  const at = (pose: Parameters<typeof cosmonautFrame>[1]['pose'], progress: number) =>
    cosmonautFrame(real, { pos: { x: 0, y: 0 }, pose, progress, spin: 1, flail: false, scale: 1 }, 0);
  const named = (name: string) => real.frames[name];

  it('plays the one-shots by progress and the poses by time', () => {
    expect(at('hop', 0)).toBe(named('cosmonaut.takeoff.0'));
    expect(at('hop', 0.5)).toBe(named('cosmonaut.takeoff.0'));
    expect(at('hop', 0.99)).toBe(named('cosmonaut.takeoff.0'));
    expect(at('emerge', 0)).toBe(named('cosmonaut.ledge.stand.0'));
    expect(at('emerge', 0.49)).toBe(named('cosmonaut.ledge.stand.0'));
    expect(at('crouch', 0.7)).toBe(named('cosmonaut.ledge.crouch.0'));
    expect(at('rise', 0.02)).toBe(named('cosmonaut.takeoff.0'));
    expect(at('rise', 0.2)).toBe(named('cosmonaut.air.spin.1'));
    expect(at('descend', 0.8)).toBe(named('cosmonaut.air.spin.6'));
    expect(at('land', 0.1)).toBe(named('cosmonaut.land.0'));
    expect(at('land', 0.9)).toBe(named('cosmonaut.land.1'));
    expect(at('crater_fall', 0.5)).toBe(named('cosmonaut.crater_fall.0'));
    expect(at('crater_fall', 0.99)).toBe(named('cosmonaut.crater_fall.2'));
    expect(at('board', 0.6)).toBe(named('cosmonaut.board.1'));
  });

  it('tumbles through cosmonaut.air.spin.* with the arc progress and the hop\'s spin', () => {
    const at = (pose: 'rise' | 'descend', progress: number, spin: number) =>
      cosmonautFrame(real, { pos: { x: 0, y: 0 }, pose, progress, spin, flail: false, scale: 1 }, 0);
    expect(at('rise', 0.02, 1)).toBe(named('cosmonaut.takeoff.0'));
    expect(at('rise', 0.1, 1)).toBe(named('cosmonaut.air.spin.0'));
    expect(at('rise', 0.3, 1)).toBe(named('cosmonaut.air.spin.2'));
    expect(at('descend', 0.5, 1)).toBe(named('cosmonaut.air.spin.4'));
    expect(at('descend', 0.99, 1)).toBe(named('cosmonaut.air.spin.7'));
    expect(at('rise', 0.3, -1)).toBe(named('cosmonaut.air.spin.6'));
    expect(at('descend', 0.75, 1.5)).toBe(named('cosmonaut.air.spin.1'));
  });

  it('flails on the clock for the whole arc of a flail hop, after the take-off', () => {
    const at = (pose: 'rise' | 'descend', progress: number, nowMs: number) =>
      cosmonautFrame(real, { pos: { x: 0, y: 0 }, pose, progress, spin: 0, flail: true, scale: 1 }, nowMs);
    expect(at('rise', 0.02, 0)).toBe(named('cosmonaut.takeoff.0'));
    expect(at('rise', 0.1, 0)).toBe(named('cosmonaut.air.flail.0'));
    expect(at('rise', 0.1, 159)).toBe(named('cosmonaut.air.flail.0'));
    expect(at('rise', 0.1, 160)).toBe(named('cosmonaut.air.flail.1'));
    expect(at('descend', 0.9, 320)).toBe(named('cosmonaut.air.flail.0'));
    expect(at('descend', 0.9, 480)).toBe(named('cosmonaut.air.flail.1'));
  });

  it('flails into the crater until the fall pose takes over', () => {
    const at = (progress: number, nowMs: number) =>
      cosmonautFrame(real, { pos: { x: 0, y: 0 }, pose: 'crater_fall', progress, spin: 0, flail: false, scale: 1 }, nowMs);
    expect(at(0, 0)).toBe(named('cosmonaut.air.flail.0'));
    expect(at(0.49, 200)).toBe(named('cosmonaut.air.flail.1'));
    expect(at(0.5, 200)).toBe(named('cosmonaut.crater_fall.0'));
    expect(at(0.7, 0)).toBe(named('cosmonaut.crater_fall.1'));
    expect(at(0.99, 0)).toBe(named('cosmonaut.crater_fall.2'));
  });
});

describe('hatch and crater art', () => {
  const real = polar as Atlas;
  const named = (name: string) => real.frames[name];
  const view = (pose: 'emerge' | 'crouch', progress: number) => ({ pos: { x: 0, y: 0 }, pose, progress, spin: 0, flail: false, scale: 1 });

  it('stands, then crouches in the hatch mouth', () => {
    expect(cosmonautFrame(real, view('emerge', 0.2), 0)).toBe(named('cosmonaut.ledge.stand.0'));
    expect(cosmonautFrame(real, view('crouch', 0.7), 0)).toBe(named('cosmonaut.ledge.crouch.0'));
  });

  it('opens a hatch over the opening progress, holds it open, then closes it on the clock', () => {
    expect(hatchFrame(real, 'rocket', 0, 0, 0)).toBe(named('rocket.tophatch.opening.0'));
    expect(hatchFrame(real, 'rocket', 0.9, 0, 0)).toBe(named('rocket.tophatch.opening.0'));
    expect(hatchFrame(real, 'rocket', 1, 0, 0)).toBe(named('rocket.tophatch.open.0'));
    expect(hatchFrame(real, 'rocket', 1, 0, 500)).toBe(named('rocket.tophatch.open.0'));
    expect(hatchFrame(real, 'rocket', null, 0, 0)).toBe(named('rocket.tophatch.opening.0'));
    expect(hatchFrame(real, 'rocket', null, 179, 0)).toBe(named('rocket.tophatch.opening.0'));
    expect(hatchFrame(real, 'rocket', null, 180, 0)).toBe(named('rocket.tophatch.closed.0'));
    expect(hatchFrame(real, 'rocket', null, Infinity, 0)).toBe(named('rocket.tophatch.closed.0'));
    expect(hatchFrame(real, 'rover', 0.5, 0, 0)).toBe(named('rover.hatch.opening.0'));
    expect(hatchFrame(real, 'rover', 1, 0, 0)).toBe(named('rover.hatch.open.0'));
    expect(hatchFrame(real, 'rover', null, 0, 0)).toBe(named('rover.hatch.opening.0'));
    expect(hatchFrame(real, 'rover', null, 1000, 0)).toBe(named('rover.hatch.closed.0'));
  });

  it('never shows a retired door, gantry or ground-hatch frame', () => {
    const retired = new Set(real.retiredAnimations ?? []);
    const shown = new Set<string>();
    for (const vehicle of ['rocket', 'rover'] as const) {
      for (const opening of [0, 0.5, 1, null]) {
        for (const ms of [0, 100, 1000]) {
          const f = hatchFrame(real, vehicle, opening, ms, ms);
          shown.add(`${f.x}:${f.y}`);
        }
      }
    }
    const retiredCells = new Set(
      [...retired].flatMap((name) => real.animations[name]?.frames.map((f) => `${real.frames[f]?.x}:${real.frames[f]?.y}`) ?? []),
    );
    for (const cell of shown) expect(retiredCells.has(cell), cell).toBe(false);
    expect(retired.has('rocket.hatch.open')).toBe(true);
    expect(retired.has('rover.door_open')).toBe(true);
  });

  it('reads the hatch mouths from the rocketTopHatch and roverHatch sockets and lands on the layout defaults', () => {
    expect(hatchPoints(real)).toEqual({ rocket: ROCKET_HATCH, rover: ROVER_HATCH });
    expect(hatchPoints({ ...real, sockets: {} })).toEqual({ rocket: ROCKET_HATCH, rover: ROVER_HATCH });
    const moved: Atlas = {
      ...real,
      sockets: {
        rocketTopHatch: { frame: 'rocket.tophatch.open.0', x: 21, y: 28 },
        roverHatch: { frame: 'rover.hatch.open.0', x: 9, y: 20 },
      },
    };
    expect(hatchPoints(moved)).toEqual({ rocket: { x: ROCKET.x + 21, y: ROCKET.y + 28 }, rover: { x: ROVER.x + 9, y: ROVER.y + 20 } });
    const retired: Atlas = { ...moved, retiredSockets: ['rocketTopHatch'] };
    expect(hatchPoints(retired).rocket).toEqual(ROCKET_HATCH);
  });

  it('gives every crater its own rim and lip', () => {
    for (const i of [0, 1, 2, 3]) {
      expect(craterFrame(real, i)).toBe(named(`crater.${i}`));
      expect(craterFrontFrame(real, i)).toBe(named(`crater.front.${i}`));
    }
    expect(new Set([0, 1, 2, 3].map((i) => craterFrame(real, i))).size).toBe(4);
  });
});

describe('soundState', () => {
  it('names the four ui.*_sound states', () => {
    expect(soundState(false, false)).toBe('idle');
    expect(soundState(false, true)).toBe('pressed');
    expect(soundState(true, false)).toBe('muted');
    expect(soundState(true, true)).toBe('muted_pressed');
  });
});
