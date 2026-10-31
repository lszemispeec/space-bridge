import { describe, expect, it } from 'vitest';
import { REQUIRED_ANIMATIONS, REQUIRED_FRAMES, validateAtlas, type Atlas } from './atlas';

function validAtlas(): Atlas {
  const frames: Atlas['frames'] = {};
  const animations: Atlas['animations'] = {};
  let x = 0;
  for (const name of REQUIRED_FRAMES) {
    frames[name] = { x, y: 0, w: 8, h: 8, ax: 4, ay: 8, duration: 100 };
    x += 8;
  }
  for (const name of REQUIRED_ANIMATIONS) {
    const frame = `${name}.0`;
    frames[frame] = { x, y: 8, w: 8, h: 8, ax: 4, ay: 8, duration: 100 };
    x += 8;
    animations[name] = { frames: [frame], loop: true };
  }
  return {
    meta: {
      theme: 'polar-signal',
      image: 'polar-signal.png',
      size: { w: 1024, h: 64 },
      palette: ['#000000', '#ffffff'],
      contract: 1,
    },
    frames,
    animations,
  };
}

describe('validateAtlas', () => {
  it('accepts a complete atlas', () => {
    expect(validateAtlas(validAtlas())).toEqual([]);
  });

  it('rejects non-objects', () => {
    expect(validateAtlas(null)).toEqual(['atlas is not an object']);
    expect(validateAtlas('x')).toEqual(['atlas is not an object']);
  });

  it('reports missing required frames and animations', () => {
    const atlas = validAtlas();
    delete atlas.frames['hud.digit.7'];
    delete atlas.animations['plate.dip'];
    const problems = validateAtlas(atlas);
    expect(problems).toContain('required frame "hud.digit.7" is missing');
    expect(problems).toContain('required animation "plate.dip" is missing');
  });

  it('reports frames outside the sheet and non-integer values', () => {
    const atlas = validAtlas();
    atlas.frames.background = { x: 1020, y: 0, w: 8, h: 8, ax: 4, ay: 8, duration: 100 };
    atlas.frames['hud.digit.0'] = { x: 0, y: 0, w: 8.5, h: 8, ax: 4, ay: 8, duration: 100 };
    const problems = validateAtlas(atlas);
    expect(problems).toContain('frame "background" lies outside the sheet');
    expect(problems).toContain('frame "hud.digit.0".w must be an integer');
  });

  it('reports animations that use unknown frames', () => {
    const atlas = validAtlas();
    atlas.animations['plate.idle'] = { frames: ['nope'], loop: true };
    expect(validateAtlas(atlas)).toContain('animation "plate.idle" refers to unknown frame "nope"');
  });

  it('rejects palettes above 16 colours and a wrong contract version', () => {
    const atlas = validAtlas();
    atlas.meta.palette = new Array<string>(17).fill('#000');
    (atlas.meta as { contract: number }).contract = 2;
    const problems = validateAtlas(atlas);
    expect(problems).toContain('meta.palette must be a list of at most 16 colours');
    expect(problems).toContain('meta.contract must be 1');
  });
});
