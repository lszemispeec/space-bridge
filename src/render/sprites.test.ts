import { describe, expect, it } from 'vitest';
import polar from '../../public/atlas/polar-signal.json';
import type { Atlas, AtlasFrame } from './atlas';
import { cosmonautFrame, craterAnimation, craterFrontFrame, hatchPoint, ledgePoint, soundState } from './draw';
import { ROCKET, ROCKET_LEDGE } from '../config/layout';
import { drawFrame, frameAt, frameByProgress, frameOf, type Art } from './sprites';

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
});

describe('cosmonautFrame with the production atlas', () => {
  const real = polar as Atlas;
  const at = (pose: Parameters<typeof cosmonautFrame>[1]['pose'], progress: number) =>
    cosmonautFrame(real, { pos: { x: 0, y: 0 }, pose, progress, spin: 1, flail: false }, 0);
  const named = (name: string) => real.frames[name];

  it('plays the one-shots by progress and the poses by time', () => {
    expect(at('emerge', 0)).toBe(named('cosmonaut.emerge.0'));
    expect(at('emerge', 0.49)).toBe(named('cosmonaut.emerge.2'));
    expect(at('crouch', 0.7)).toBe(named('cosmonaut.crouch.0'));
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
      cosmonautFrame(real, { pos: { x: 0, y: 0 }, pose, progress, spin, flail: false }, 0);
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
      cosmonautFrame(real, { pos: { x: 0, y: 0 }, pose, progress, spin: 0, flail: true }, nowMs);
    expect(at('rise', 0.02, 0)).toBe(named('cosmonaut.takeoff.0'));
    expect(at('rise', 0.1, 0)).toBe(named('cosmonaut.air.flail.0'));
    expect(at('rise', 0.1, 159)).toBe(named('cosmonaut.air.flail.0'));
    expect(at('rise', 0.1, 160)).toBe(named('cosmonaut.air.flail.1'));
    expect(at('descend', 0.9, 320)).toBe(named('cosmonaut.air.flail.0'));
    expect(at('descend', 0.9, 480)).toBe(named('cosmonaut.air.flail.1'));
  });

  it('flails into the crater until the fall pose takes over', () => {
    const at = (progress: number, nowMs: number) =>
      cosmonautFrame(real, { pos: { x: 0, y: 0 }, pose: 'crater_fall', progress, spin: 0, flail: false }, nowMs);
    expect(at(0, 0)).toBe(named('cosmonaut.air.flail.0'));
    expect(at(0.49, 200)).toBe(named('cosmonaut.air.flail.1'));
    expect(at(0.5, 200)).toBe(named('cosmonaut.crater_fall.0'));
    expect(at(0.7, 0)).toBe(named('cosmonaut.crater_fall.1'));
    expect(at(0.99, 0)).toBe(named('cosmonaut.crater_fall.2'));
  });
});

describe('hatch, ledge and crater art', () => {
  const real = polar as Atlas;
  const view = (pose: 'emerge' | 'crouch', progress: number) => ({ pos: { x: 0, y: 0 }, pose, progress, spin: 0, flail: false });

  it('falls back to the door poses, the shared rim and the layout ledge until the art lands', () => {
    expect(cosmonautFrame(real, view('emerge', 0.2), 0)).toBe(real.frames['cosmonaut.emerge.1']);
    expect(cosmonautFrame(real, view('crouch', 0.7), 0)).toBe(real.frames['cosmonaut.crouch.0']);
    for (const i of [0, 1, 2, 3]) {
      expect(craterAnimation(real, i)).toBe('crater.idle');
      expect(craterFrontFrame(real, i)).toBe(real.frames['crater.front.0']);
    }
    expect(ledgePoint(real)).toEqual(ROCKET_LEDGE);
    expect(hatchPoint(real)).toEqual({ x: ROCKET.x, y: ROCKET.y + ROCKET.h });
  });

  it('prefers the ledge poses, the four rims, their lips and the placed anchors when the atlas has them', () => {
    const withArt: Atlas = {
      ...real,
      frames: {
        ...real.frames,
        'cosmonaut.ledge.stand.0': frame(0, 100),
        'cosmonaut.ledge.crouch.0': frame(4, 100),
        'crater.2.0': frame(8, 100),
        'crater.front.2': frame(12, 100),
      },
      animations: {
        ...real.animations,
        'cosmonaut.ledge.stand': { frames: ['cosmonaut.ledge.stand.0'], loop: false },
        'cosmonaut.ledge.crouch': { frames: ['cosmonaut.ledge.crouch.0'], loop: true },
        'crater.2': { frames: ['crater.2.0'], loop: true },
      },
      placements: { ...real.placements, 'rocket.ledge': { x: 84, y: 108 }, 'rocket.hatch': { x: 70, y: 112 } },
    };
    expect(cosmonautFrame(withArt, view('emerge', 0.2), 0)).toBe(withArt.frames['cosmonaut.ledge.stand.0']);
    expect(cosmonautFrame(withArt, view('crouch', 0.7), 0)).toBe(withArt.frames['cosmonaut.ledge.crouch.0']);
    expect(craterAnimation(withArt, 2)).toBe('crater.2');
    expect(craterAnimation(withArt, 1)).toBe('crater.idle');
    expect(craterFrontFrame(withArt, 2)).toBe(withArt.frames['crater.front.2']);
    expect(craterFrontFrame(withArt, 1)).toBe(withArt.frames['crater.front.0']);
    expect(ledgePoint(withArt)).toEqual({ x: 84, y: 108 });
    expect(hatchPoint(withArt)).toEqual({ x: 70, y: 112 });
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
