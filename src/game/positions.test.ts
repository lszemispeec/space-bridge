import { describe, expect, it } from 'vitest';
import { FALL_DEPTH, GROUND_Y, HOP_HEIGHT, JUMP_HEIGHT, ROCKET, ROCKET_HATCH, ROVER, ROVER_HATCH, SLOT_X } from '../config/layout';
import { cosmonautView, scaleIn, scaleOut, slotPoint } from './positions';
import type { Cosmonaut } from './types';

function c(partial: Partial<Cosmonaut>): Cosmonaut {
  return { id: 1, state: 'crouch', slot: 1, t: 0, duration: 1, spin: 0, flail: false, ...partial };
}

describe('cosmonautView', () => {
  it('squashes on the plate for the whole stand on a crater', () => {
    const v = cosmonautView(c({ slot: 2, t: 0.9 }));
    expect(v.pos).toEqual({ x: SLOT_X[2], y: GROUND_Y });
    expect(v.pose).toBe('land');
    expect(cosmonautView(c({ slot: 2, t: 0.1 })).pose).toBe('land');
  });

  it('emerges in the rocket\'s top hatch, then crouches there for the first jump', () => {
    const emerging = cosmonautView(c({ slot: 0, t: 0.2 }));
    expect(emerging.pose).toBe('emerge');
    expect(emerging.pos).toEqual(ROCKET_HATCH);
    expect(cosmonautView(c({ slot: 0, t: 0.7 })).pose).toBe('crouch');
    expect(ROCKET_HATCH.y).toBeLessThan(GROUND_Y - 40);
    // The mouth sits inside the hull, high up.
    expect(ROCKET_HATCH.x).toBeGreaterThan(ROCKET.x);
    expect(ROCKET_HATCH.x).toBeLessThan(ROCKET.x + ROCKET.w);
    expect(ROCKET_HATCH.y).toBeLessThan(ROCKET.y + ROCKET.h / 2);
  });

  it('grows from half size to full over the emerge and the crouch, in whole steps', () => {
    expect(cosmonautView(c({ slot: 0, t: 0 })).scale).toBe(0.5);
    expect(cosmonautView(c({ slot: 0, t: 0.3 })).scale).toBe(0.5);
    expect(cosmonautView(c({ slot: 0, t: 0.34 })).scale).toBe(0.75);
    expect(cosmonautView(c({ slot: 0, t: 0.66 })).scale).toBe(0.75);
    expect(cosmonautView(c({ slot: 0, t: 0.67 })).scale).toBe(1);
    expect(cosmonautView(c({ slot: 0, t: 1 })).scale).toBe(1);
    expect(cosmonautView(c({ state: 'air', slot: 0, t: 0 })).scale).toBe(1);
    expect(cosmonautView(c({ slot: 2, t: 0 })).scale).toBe(1);
    expect([0, 0.33, 0.34, 0.66, 0.67, 1].map(scaleIn)).toEqual([0.5, 0.5, 0.75, 0.75, 1, 1]);
    expect([0, 0.33, 0.34, 0.66, 0.67, 1].map(scaleOut)).toEqual([1, 1, 0.75, 0.75, 0.5, 0.5]);
  });

  it('takes the hatches from the caller, so the atlas can move them', () => {
    const hatches = { rocket: { x: 90, y: 100 }, rover: { x: 250, y: 170 } };
    expect(cosmonautView(c({ slot: 0, t: 0.7 }), hatches).pos).toEqual(hatches.rocket);
    expect(cosmonautView(c({ state: 'air', slot: 0, t: 0 }), hatches).pos).toEqual(hatches.rocket);
    expect(cosmonautView(c({ state: 'air', slot: 4, t: 1 }), hatches).pos).toEqual(hatches.rover);
    expect(cosmonautView(c({ state: 'board', slot: 5, t: 0.5 }), hatches).pos).toEqual(hatches.rover);
  });

  it('drops from the hatch to crater 1 on the first arc, never below the ground', () => {
    expect(cosmonautView(c({ state: 'air', slot: 0, t: 0 })).pos).toEqual(ROCKET_HATCH);
    expect(cosmonautView(c({ state: 'air', slot: 0, t: 1 })).pos).toEqual(slotPoint(1));
    let lowest = -Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const y = cosmonautView(c({ state: 'air', slot: 0, t })).pos.y;
      lowest = Math.max(lowest, y);
    }
    expect(lowest).toBeLessThanOrEqual(GROUND_Y);
  });

  it('follows the arc between slots in the air', () => {
    const mid = cosmonautView(c({ state: 'air', slot: 1, t: 0.5 }));
    expect(mid.pos.x).toBe((slotPoint(1).x + slotPoint(2).x) / 2);
    expect(mid.pos.y).toBe(GROUND_Y - JUMP_HEIGHT);
    expect(cosmonautView(c({ state: 'air', t: 0.2 })).pose).toBe('rise');
    expect(cosmonautView(c({ state: 'air', t: 0.8 })).pose).toBe('descend');
  });

  it('reaches the upper third of the playfield at the apex', () => {
    const apexFeet = cosmonautView(c({ state: 'air', slot: 2, t: 0.5 })).pos.y;
    expect(apexFeet).toBeLessThanOrEqual(90);
    expect(apexFeet).toBeGreaterThanOrEqual(60);
  });

  it('carries the hop\'s spin into the view only while airborne', () => {
    expect(cosmonautView(c({ state: 'air', t: 0.3, spin: -1.25 })).spin).toBe(-1.25);
    expect(cosmonautView(c({ state: 'crouch', slot: 2, spin: -1.25 })).spin).toBe(0);
    expect(cosmonautView(c({ state: 'fall', slot: 2, spin: -1.25 })).spin).toBe(0);
  });

  it('carries the flail into the view only while airborne', () => {
    expect(cosmonautView(c({ state: 'air', t: 0.3, flail: true })).flail).toBe(true);
    expect(cosmonautView(c({ state: 'air', t: 0.3 })).flail).toBe(false);
    expect(cosmonautView(c({ state: 'crouch', slot: 2, flail: true })).flail).toBe(false);
    expect(cosmonautView(c({ state: 'fall', slot: 2, flail: true })).flail).toBe(false);
  });

  it('sinks into the crater when falling', () => {
    const v = cosmonautView(c({ state: 'fall', slot: 3, t: 1 }));
    expect(v.pos).toEqual({ x: SLOT_X[3], y: GROUND_Y + FALL_DEPTH });
    expect(v.pose).toBe('crater_fall');
  });

  it('leaps low and short from crater 4 into the rover\'s hatch, with no tumble', () => {
    const start = cosmonautView(c({ state: 'air', slot: 4, t: 0, spin: 1, flail: true }));
    expect(start.pos).toEqual(slotPoint(4));
    expect(start.pose).toBe('hop');
    expect(start.spin).toBe(0);
    expect(start.flail).toBe(false);
    expect(cosmonautView(c({ state: 'air', slot: 4, t: 1 })).pos).toEqual(ROVER_HATCH);
    let highest = Infinity;
    for (let t = 0; t <= 1; t += 0.05) highest = Math.min(highest, cosmonautView(c({ state: 'air', slot: 4, t })).pos.y);
    expect(GROUND_Y - highest).toBeLessThanOrEqual(HOP_HEIGHT + 2);
    expect(GROUND_Y - highest).toBeGreaterThanOrEqual(20);
    expect(HOP_HEIGHT).toBeLessThan(JUMP_HEIGHT / 3);
    // The mouth sits inside the rover's hull.
    expect(ROVER_HATCH.x).toBeGreaterThan(ROVER.x);
    expect(ROVER_HATCH.x).toBeLessThan(ROVER.x + ROVER.w);
    expect(ROVER_HATCH.y).toBeLessThan(ROVER.y + ROVER.h);
  });

  it('shrinks into the rover\'s hatch when boarding', () => {
    const v = cosmonautView(c({ state: 'board', slot: 5, t: 1 }));
    expect(v.pos).toEqual(ROVER_HATCH);
    expect(v.pose).toBe('board');
    expect(cosmonautView(c({ state: 'board', slot: 5, t: 0 })).scale).toBe(1);
    expect(cosmonautView(c({ state: 'board', slot: 5, t: 0.5 })).scale).toBe(0.75);
    expect(cosmonautView(c({ state: 'board', slot: 5, t: 0.9 })).scale).toBe(0.5);
  });

  it('rejects unknown slots', () => {
    expect(() => slotPoint(9)).toThrow();
  });
});
