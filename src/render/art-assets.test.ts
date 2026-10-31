import { describe, expect, it } from 'vitest';
import polar from '../../assets/polar-signal/polar-signal.json';
import desert from '../../assets/desert-expedition/desert-expedition.json';
import neon from '../../assets/neon-orbit/neon-orbit.json';
import publishedPolar from '../../public/atlas/polar-signal.json';
import publishedDesert from '../../public/atlas/desert-expedition.json';
import publishedNeon from '../../public/atlas/neon-orbit.json';
import { CONSOLE_HUD, roomLayout } from '../config/layout';
import { validateAtlas } from './atlas';

const atlases = [polar, desert, neon];

describe('production art handoff', () => {
  for (const atlas of atlases) {
    it(`${atlas.meta.theme}: satisfies the engine contract`, () => {
      expect(validateAtlas(atlas)).toEqual([]);
      expect(atlas.meta.palette).toHaveLength(16);
      expect(new Set(atlas.meta.palette).size).toBe(16);
      for (const [name, frame] of Object.entries(atlas.frames)) {
        expect(frame.duration, name).toBeGreaterThan(0);
        if (name.startsWith('cosmonaut.air.')) {
          expect([frame.w, frame.h, frame.ax, frame.ay, frame.duration], name).toEqual([20, 22, 10, 11, 80]);
        } else if (name.startsWith('cosmonaut.') || name.startsWith('plate.')) {
          expect([frame.ax, frame.ay], name).toEqual([frame.w / 2, frame.h]);
          if (name.startsWith('cosmonaut.')) {
            expect([frame.w, frame.h, frame.ax, frame.ay], name).toEqual([20, 22, 10, 22]);
          }
        } else if (name.startsWith('rocket.') || name.startsWith('rover.')) {
          expect([frame.ax, frame.ay], name).toEqual([0, frame.h]);
        } else if (name.startsWith('hud.') || name.startsWith('button.') || name.startsWith('ui.')) {
          expect([frame.ax, frame.ay], name).toEqual([0, 0]);
        }
        // PR #4 TAP_TARGETS at 3621b0d; independent of gameplay integration.
        if (name.startsWith('ui.lever.')) {
          expect([frame.w, frame.h], name).toEqual([24, 48]);
        } else if (name.startsWith('ui.')) {
          expect([frame.w, frame.h], name).toEqual([name.startsWith('ui.hud_sound.') ? 36 : 56, 16]);
        }
      }
      for (const [kind, count] of [['spin', 8], ['flail', 2]] as const) {
        expect(atlas.animations[`cosmonaut.air.${kind}`]).toEqual({
          frames: Array.from({ length: count }, (_, i) => `cosmonaut.air.${kind}.${i}`),
          loop: true,
        });
      }
      for (const [name, animation] of Object.entries(atlas.animations)) {
        const oneShot = new Set([
          'cosmonaut.emerge', 'cosmonaut.takeoff', 'cosmonaut.land',
          'cosmonaut.crater_fall', 'cosmonaut.board', 'plate.move',
          'plate.move_right', 'plate.dip', 'rocket.door_open', 'rover.door_open',
          'rocket.hatch.opening', 'rocket.hatch.closing', 'crater.eyes.peek',
          'crater.eyes.blink', 'crater.eyes.hide', 'crater.tentacle.reach', 'crater.tentacle.grab',
          'ui.lever.l.pull', 'ui.lever.l.release', 'ui.lever.r.pull', 'ui.lever.r.release',
        ]);
        expect(animation.loop, name).toBe(!oneShot.has(name));
      }
      expect(atlas.sockets.rocketLedge).toEqual({ frame: 'rocket.hatch.open.0', x: 39, y: 30 });
      const hatch = atlas.frames['rocket.hatch.open.0'];
      expect([hatch.w, hatch.h, hatch.ax, hatch.ay]).toEqual([44, 89, 0, 89]);
      expect([43 + atlas.sockets.rocketLedge.x, 169 - hatch.ay + atlas.sockets.rocketLedge.y]).toEqual([82, 110]);
      expect(atlas.animations['crater.tentacle.grab'].frames).toHaveLength(5);
      expect(atlas.animations['crater.tentacle.reach'].frames).toHaveLength(4);
      expect(atlas.retiredAnimations).toEqual(atlas.meta.theme === 'polar-signal' ? ['ambient.sky'] : []);
      for (const [name, frame] of Object.entries(atlas.frames)) {
        if (name.startsWith('crater.eyes.')) expect([frame.w, frame.h, frame.ax, frame.ay]).toEqual([24, 16, 12, 12]);
        if (name.startsWith('crater.tentacle.')) expect([frame.w, frame.h, frame.ax, frame.ay]).toEqual([24, 32, 12, 28]);
      }
      for (const side of ['l', 'r'] as const) {
        const pull = atlas.animations[`ui.lever.${side}.pull`].frames;
        expect(pull).toHaveLength(4);
        expect(atlas.animations[`ui.lever.${side}.release`].frames).toEqual([
          ...pull.slice(0, 3).reverse(), `ui.lever.${side}.idle.0`,
        ]);
      }
      // The atlas's room table and the code's layout must agree, or the art and the taps drift apart.
      expect(atlas.operatorRoom.hud).toEqual(CONSOLE_HUD);
      for (const orientation of ['landscape', 'portrait'] as const) {
        const layout = atlas.operatorRoom[orientation];
        const expected = roomLayout(orientation);
        expect(layout.size).toEqual({ w: expected.w, h: expected.h });
        expect([layout.scene.dx, layout.scene.dy, layout.scene.w, layout.scene.h]).toEqual([expected.window.x, expected.window.y, expected.window.w, expected.window.h]);
        expect(layout.console).toEqual(expected.console);
        expect(layout.levers).toEqual({ l: expected.levers.left, r: expected.levers.right });
        expect('controlStrip' in layout ? layout.controlStrip : null).toEqual(expected.strip);
        const room = atlas.frames[layout.frame as 'frame.room.landscape.0' | 'frame.room.portrait.0'];
        expect([room.w, room.h, room.ax, room.ay]).toEqual([layout.size.w, layout.size.h, 0, 0]);
        expect(layout.scene.dy + layout.scene.h).toBe(layout.console.y);
        expect(layout.scene.w + 32).toBe(layout.size.w);
        expect(layout.scene.h).toBe(240);
        expect(layout.scene.dx).toBe(16);
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
      expect(atlas.sockets).toEqual(polar.sockets);
      expect(atlas.operatorRoom).toEqual(polar.operatorRoom);
    }
  });
});
