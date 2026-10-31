import { describe, expect, it } from 'vitest';
import polar from '../../public/atlas/polar-signal.json';
import type { Atlas, AtlasFrame } from './atlas';
import { cosmonautFrame, soundState } from './draw';
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
    cosmonautFrame(real, { pos: { x: 0, y: 0 }, pose, progress }, 0);
  const named = (name: string) => real.frames[name];

  it('plays the one-shots by progress and the poses by time', () => {
    expect(at('emerge', 0)).toBe(named('cosmonaut.emerge.0'));
    expect(at('emerge', 0.49)).toBe(named('cosmonaut.emerge.2'));
    expect(at('crouch', 0.7)).toBe(named('cosmonaut.crouch.0'));
    expect(at('rise', 0.05)).toBe(named('cosmonaut.takeoff.0'));
    expect(at('rise', 0.2)).toBe(named('cosmonaut.rise.0'));
    expect(at('rise', 0.45)).toBe(named('cosmonaut.apex.0'));
    expect(at('descend', 0.55)).toBe(named('cosmonaut.apex.0'));
    expect(at('descend', 0.8)).toBe(named('cosmonaut.descend.0'));
    expect(at('land', 0.1)).toBe(named('cosmonaut.land.0'));
    expect(at('land', 0.9)).toBe(named('cosmonaut.land.1'));
    expect(at('crater_fall', 0.99)).toBe(named('cosmonaut.crater_fall.2'));
    expect(at('board', 0.6)).toBe(named('cosmonaut.board.1'));
  });

  it('falls back to rise and descend when a theme has no apex pose', () => {
    const animations = Object.fromEntries(Object.entries(real.animations).filter(([name]) => name !== 'cosmonaut.apex'));
    const noApex: Atlas = { ...real, animations };
    expect(cosmonautFrame(noApex, { pos: { x: 0, y: 0 }, pose: 'rise', progress: 0.45 }, 0)).toBe(named('cosmonaut.rise.0'));
    expect(cosmonautFrame(noApex, { pos: { x: 0, y: 0 }, pose: 'descend', progress: 0.55 }, 0)).toBe(named('cosmonaut.descend.0'));
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
