import { describe, expect, it } from 'vitest';
import polar from '../../assets/polar-signal/polar-signal.json';
import desert from '../../assets/desert-expedition/desert-expedition.json';
import neon from '../../assets/neon-orbit/neon-orbit.json';
import publishedPolar from '../../public/atlas/polar-signal.json';
import publishedDesert from '../../public/atlas/desert-expedition.json';
import publishedNeon from '../../public/atlas/neon-orbit.json';
import { validateAtlas } from './atlas';

const atlases = [polar, desert, neon];

describe('production art handoff', () => {
  for (const atlas of atlases) {
    it(`${atlas.meta.theme}: satisfies the unchanged engine contract`, () => {
      expect(validateAtlas(atlas)).toEqual([]);
      expect(atlas.meta.palette).toHaveLength(16);
      expect(new Set(atlas.meta.palette).size).toBe(16);
      for (const [name, frame] of Object.entries(atlas.frames)) {
        expect(frame.duration, name).toBeGreaterThan(0);
        if (name.startsWith('cosmonaut.') || name.startsWith('plate.')) {
          expect([frame.ax, frame.ay], name).toEqual([frame.w / 2, frame.h]);
          if (name.startsWith('cosmonaut.')) {
            expect([frame.w, frame.h, frame.ax, frame.ay], name).toEqual([20, 22, 10, 22]);
          }
        } else if (name.startsWith('rocket.') || name.startsWith('rover.')) {
          expect([frame.ax, frame.ay], name).toEqual([0, frame.h]);
        } else if (name.startsWith('hud.') || name.startsWith('button.')) {
          expect([frame.ax, frame.ay], name).toEqual([0, 0]);
        }
      }
      for (const [name, animation] of Object.entries(atlas.animations)) {
        const oneShot = new Set([
          'cosmonaut.emerge', 'cosmonaut.takeoff', 'cosmonaut.land',
          'cosmonaut.crater_fall', 'cosmonaut.board', 'plate.move',
          'plate.move_right', 'plate.dip', 'rocket.door_open', 'rover.door_open',
        ]);
        expect(animation.loop, name).toBe(!oneShot.has(name));
      }
    });
  }

  it('publishes matching metadata at the configured URLs', () => {
    expect([publishedPolar, publishedDesert, publishedNeon]).toEqual(atlases);
  });

  it('swaps themes without changing geometry, timing, animation names or placements', () => {
    for (const atlas of [desert, neon]) {
      expect(atlas.frames).toEqual(polar.frames);
      expect(atlas.animations).toEqual(polar.animations);
      expect(atlas.placements).toEqual(polar.placements);
    }
  });
});
