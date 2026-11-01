import { describe, expect, it } from 'vitest';
import polar from '../../assets/polar-signal/polar-signal.json';
import desert from '../../assets/desert-expedition/desert-expedition.json';
import neon from '../../assets/neon-orbit/neon-orbit.json';
import publishedPolar from '../../public/atlas/polar-signal.json';
import publishedDesert from '../../public/atlas/desert-expedition.json';
import publishedNeon from '../../public/atlas/neon-orbit.json';
import { CONSOLE_HUD, CONSOLE_MENU_BUTTON, ROCKET, ROCKET_HATCH, ROOM, ROOM_BACKGROUND, ROVER, ROVER_HATCH, roomLayout, SCREEN_H, SCREEN_W, type Rect } from '../config/layout';
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
          expect([frame.w, frame.h], name).toEqual([ROOM.lever.w, ROOM.lever.h]);
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
          'rocket.tophatch.opening', 'rocket.tophatch.closing', 'rover.hatch.opening', 'rover.hatch.closing',
        ]);
        expect(animation.loop, name).toBe(!oneShot.has(name));
      }
      expect(atlas.sockets.rocketLedge).toEqual({ frame: 'rocket.hatch.open.0', x: 39, y: 30 });
      const hatch = atlas.frames['rocket.hatch.open.0'];
      expect([hatch.w, hatch.h, hatch.ax, hatch.ay]).toEqual([44, 89, 0, 89]);
      expect([43 + atlas.sockets.rocketLedge.x, 169 - hatch.ay + atlas.sockets.rocketLedge.y]).toEqual([82, 110]);
      expect(atlas.animations['crater.tentacle.grab'].frames).toHaveLength(5);
      expect(atlas.animations['crater.tentacle.reach'].frames).toHaveLength(4);
      const retiredVehicles = Object.keys(atlas.animations).filter(name =>
        name.startsWith('rocket.door') || name.startsWith('rocket.hatch.') || name.startsWith('rover.door'));
      expect(atlas.retiredAnimations).toEqual([
        ...(atlas.meta.theme === 'polar-signal' ? ['ambient.sky'] : []), ...retiredVehicles,
      ]);
      expect(atlas.retiredSockets).toEqual(['rocketLedge']);
      expect(atlas.sockets.rocketTopHatch).toEqual({ frame: 'rocket.tophatch.open.0', x: 20, y: 32 });
      expect(atlas.sockets.roverHatch).toEqual({ frame: 'rover.hatch.open.0', x: 8, y: 30 });
      expect(atlas.vehicleModels.gantry).toBe('retired');
      // The hatch mouths the engine spawns from and boards into must be where the code expects them.
      const top = atlas.frames['rocket.tophatch.open.0'];
      expect([top.w, top.h, top.ax, top.ay]).toEqual([ROCKET.w, ROCKET.h, 0, ROCKET.h]);
      expect(atlas.vehicleModels.rocket.anchor).toEqual({ x: ROCKET.x, y: ROCKET.y + ROCKET.h });
      expect({ x: ROCKET.x + atlas.sockets.rocketTopHatch.x, y: ROCKET.y + atlas.sockets.rocketTopHatch.y }).toEqual(ROCKET_HATCH);
      const mouth = atlas.vehicleModels.rocket.hatch;
      expect(ROCKET_HATCH.x).toBeGreaterThanOrEqual(ROCKET.x + mouth.x);
      expect(ROCKET_HATCH.x).toBeLessThanOrEqual(ROCKET.x + mouth.x + mouth.w);
      expect(ROCKET_HATCH.y).toBe(ROCKET.y + mouth.y + mouth.h);
      const side = atlas.frames['rover.hatch.open.0'];
      expect([side.w, side.h, side.ax, side.ay]).toEqual([ROVER.w, ROVER.h, 0, ROVER.h]);
      expect(atlas.vehicleModels.rover.anchor).toEqual({ x: ROVER.x, y: ROVER.y + ROVER.h });
      expect({ x: ROVER.x + atlas.sockets.roverHatch.x, y: ROVER.y + atlas.sockets.roverHatch.y }).toEqual(ROVER_HATCH);
      for (const prefix of ['rocket.tophatch', 'rover.hatch']) {
        for (const state of ['closed', 'opening', 'open', 'closing']) expect(`${prefix}.${state}` in atlas.animations, `${prefix}.${state}`).toBe(true);
      }
      for (const [name, frame] of Object.entries(atlas.frames)) {
        if (name.startsWith('crater.eyes.')) expect([frame.w, frame.h, frame.ax, frame.ay]).toEqual([24, 16, 12, 12]);
        if (name.startsWith('crater.tentacle.')) expect([frame.w, frame.h, frame.ax, frame.ay]).toEqual([24, 32, 12, 28]);
      }
      // Two pull poses and a release back through the intermediate one; the engine owns the timing.
      for (const side of ['l', 'r'] as const) {
        const pull = atlas.animations[`ui.lever.${side}.pull`].frames;
        expect(pull).toEqual([`ui.lever.${side}.pull.0`, `ui.lever.${side}.pull.1`]);
        expect(atlas.animations[`ui.lever.${side}.release`].frames).toEqual([pull[0], `ui.lever.${side}.idle.0`]);
        for (const name of [...pull, `ui.lever.${side}.idle.0`]) expect(atlas.frames[name as 'ui.lever.l.idle.0'].duration, name).toBeLessThanOrEqual(1000);
      }
      expect(atlas.animations['frame.lights'].frames).toHaveLength(4);
      expect([atlas.frames['frame.lights.0'].w, atlas.frames['frame.lights.0'].h]).toEqual([6, 6]);
      // The atlas's room table and the code's layout must agree, or the art and the taps drift apart.
      expect(atlas.operatorRoom.hud).toEqual(CONSOLE_HUD);
      expect(atlas.operatorRoom.menu).toEqual(CONSOLE_MENU_BUTTON);
      expect(atlas.operatorRoom.background).toBe(ROOM_BACKGROUND);
      // Every readout sits inside its recess, and no two recesses touch.
      const recesses = atlas.operatorRoom.recesses;
      const hud = CONSOLE_HUD;
      const inside = (inner: Rect, outer: Rect) => inner.x > outer.x && inner.y > outer.y && inner.x + inner.w < outer.x + outer.w && inner.y + inner.h < outer.y + outer.h;
      expect(inside({ ...hud.scoreIcon, w: 12, h: 12 }, recesses.scoreMode)).toBe(true);
      expect(inside({ x: hud.digits.x, y: hud.digits.y, w: hud.digits.pitch * hud.digits.count, h: 10 }, recesses.scoreMode)).toBe(true);
      expect(inside({ ...hud.modeLabel, w: 6 * 4 - 1, h: 5 }, recesses.scoreMode)).toBe(true);
      expect(inside({ x: hud.lives.x, y: hud.lives.y, w: hud.lives.pitch * 2 + 14, h: 16 }, recesses.lives)).toBe(true);
      expect(inside(hud.sound, recesses.sound)).toBe(true);
      expect(inside(CONSOLE_MENU_BUTTON, recesses.menu)).toBe(true);
      expect(inside({ ...hud.lights, w: 6, h: 6 }, recesses.status)).toBe(true);
      const boxes = Object.values(recesses);
      for (const a of boxes) for (const b of boxes) {
        if (a === b) continue;
        const apart = a.x + a.w + 4 <= b.x || b.x + b.w + 4 <= a.x || a.y + a.h + 4 <= b.y || b.y + b.h + 4 <= a.y;
        expect(apart, JSON.stringify([a, b])).toBe(true);
      }
      for (const orientation of ['landscape', 'portrait'] as const) {
        const layout = atlas.operatorRoom[orientation];
        const expected = roomLayout(orientation);
        expect(layout.size).toEqual({ w: expected.w, h: expected.h });
        expect([layout.scene.dx, layout.scene.dy, layout.scene.w, layout.scene.h]).toEqual([expected.window.x, expected.window.y, expected.window.w, expected.window.h]);
        expect(layout.console).toEqual(expected.console);
        expect(layout.levers).toEqual({ l: expected.levers.left, r: expected.levers.right });
        expect(layout.leverTapZones).toEqual({ l: expected.leverTaps.left, r: expected.leverTaps.right });
        expect('controlStrip' in layout ? layout.controlStrip : null).toEqual(expected.strip);
        const room = atlas.frames[layout.frame as 'frame.room.landscape.0' | 'frame.room.portrait.0'];
        expect([room.w, room.h, room.ax, room.ay]).toEqual([layout.size.w, layout.size.h, 0, 0]);
        expect(layout.scene.dy + layout.scene.h).toBe(layout.console.y);
        expect(layout.scene.w + 32).toBe(layout.size.w);
        expect(layout.scene.h).toBe(240);
        expect(layout.scene.dx).toBe(16);
        expect(layout.windowCornerRadius).toBe(ROOM.windowCornerRadius);
        expect(layout.leverTapZones).toEqual(orientation === 'landscape'
          ? { l: { x: 20, y: 164, w: 24, h: 48 }, r: { x: 308, y: 164, w: 24, h: 48 } }
          : { l: { x: 20, y: 292, w: 24, h: 48 }, r: { x: 244, y: 292, w: 24, h: 48 } });
        // Both levers sit wholly on the deck, and the MENU recess clears the right lever.
        expect(layout.levers.l.y).toBe(270);
        expect(layout.levers.r.y).toBe(270);
        expect(layout.levers.l.y).toBeGreaterThanOrEqual(layout.console.y);
        expect(layout.levers.r.y + ROOM.lever.h).toBeLessThanOrEqual(layout.console.y + layout.console.h);
        expect(layout.levers.r.x + ROOM.lever.w).toBeLessThanOrEqual(layout.size.w);
        expect(recesses.menu.x + recesses.menu.w + 8).toBeLessThanOrEqual(layout.levers.r.x);
      }
      // The side room: the whole scene between two panels, each with its own readouts.
      const sideArt = atlas.operatorRoom.side;
      const sideRoom = roomLayout('side');
      expect(sideArt.size).toEqual({ w: sideRoom.w, h: sideRoom.h });
      expect(sideArt.scene).toEqual({ sx: 0, sy: 0, w: SCREEN_W, h: SCREEN_H, dx: sideRoom.window.x, dy: sideRoom.window.y });
      expect(sideArt.panels).toEqual({ l: sideRoom.panels?.left, r: sideRoom.panels?.right });
      expect(sideArt.levers).toEqual({ l: sideRoom.levers.left, r: sideRoom.levers.right });
      expect(sideArt.leverTapZones).toEqual({ l: sideRoom.leverTaps.left, r: sideRoom.leverTaps.right });
      expect(sideArt.windowCornerRadius).toBe(ROOM.windowCornerRadius);
      expect(sideArt.hud).toEqual(sideRoom.hud);
      expect(sideArt.menu).toEqual(sideRoom.menu);
      const sidePlate = atlas.frames[sideArt.frame as 'frame.room.side.0'];
      expect([sidePlate.w, sidePlate.h, sidePlate.ax, sidePlate.ay]).toEqual([sideRoom.w, sideRoom.h, 0, 0]);
      expect(atlas.animations['frame.room.side'].frames).toEqual([sideArt.frame]);
      const sideHud = sideRoom.hud;
      const sideRecesses = sideArt.recesses;
      expect(inside({ ...sideHud.scoreIcon, w: 12, h: 12 }, sideRecesses.scoreMode)).toBe(true);
      expect(inside({ x: sideHud.digits.x, y: sideHud.digits.y, w: sideHud.digits.pitch * sideHud.digits.count, h: 10 }, sideRecesses.scoreMode)).toBe(true);
      expect(inside({ ...sideHud.modeLabel, w: 6 * 4 - 1, h: 5 }, sideRecesses.scoreMode)).toBe(true);
      expect(inside({ x: sideHud.lives.x, y: sideHud.lives.y, w: sideHud.lives.pitch * 2 + 14, h: 16 }, sideRecesses.lives)).toBe(true);
      expect(inside(sideHud.sound, sideRecesses.sound)).toBe(true);
      expect(inside(sideRoom.menu, sideRecesses.menu)).toBe(true);
      expect(inside({ ...sideHud.lights, w: 6, h: 6 }, sideRecesses.status)).toBe(true);
      for (const a of Object.values(sideRecesses)) for (const b of Object.values(sideRecesses)) {
        if (a === b) continue;
        const apart = a.x + a.w + 4 <= b.x || b.x + b.w + 4 <= a.x || a.y + a.h + 4 <= b.y || b.y + b.h + 4 <= a.y;
        expect(apart, JSON.stringify([a, b])).toBe(true);
      }
      // Nothing on a panel reaches the window, and the recesses clear the levers.
      for (const r of [...Object.values(sideRecesses), sideArt.leverTapZones.l, sideArt.leverTapZones.r]) {
        expect(r.x + r.w <= sideRoom.window.x || r.x >= sideRoom.window.x + sideRoom.window.w, JSON.stringify(r)).toBe(true);
      }
      expect(sideRecesses.lives.y + sideRecesses.lives.h).toBeLessThanOrEqual(sideArt.leverTapZones.l.y);
      expect(sideRecesses.status.y + sideRecesses.status.h).toBeLessThanOrEqual(sideArt.leverTapZones.r.y);
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
      expect(atlas.vehicleModels).toEqual(polar.vehicleModels);
      expect(atlas.retiredSockets).toEqual(polar.retiredSockets);
      expect(atlas.operatorRoom).toEqual(polar.operatorRoom);
    }
  });
});
