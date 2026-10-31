import { describe, expect, it } from 'vitest';
import { FALL_DEPTH, GROUND_Y, JUMP_HEIGHT, ROCKET_LEDGE, ROVER, SLOT_X } from '../config/layout';
import { cosmonautView, slotPoint } from './positions';
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

  it('emerges on the ledge outside the hatch, then crouches there for the first jump', () => {
    const emerging = cosmonautView(c({ slot: 0, t: 0.2 }));
    expect(emerging.pose).toBe('emerge');
    expect(emerging.pos).toEqual(ROCKET_LEDGE);
    expect(cosmonautView(c({ slot: 0, t: 0.7 })).pose).toBe('crouch');
    expect(ROCKET_LEDGE.y).toBeLessThan(GROUND_Y - 40);
  });

  it('takes the ledge from the caller, so the atlas can move it', () => {
    const ledge = { x: 90, y: 100 };
    expect(cosmonautView(c({ slot: 0, t: 0.7 }), ledge).pos).toEqual(ledge);
    expect(cosmonautView(c({ state: 'air', slot: 0, t: 0 }), ledge).pos).toEqual(ledge);
  });

  it('drops from the ledge to crater 1 on the first arc, never below the ground', () => {
    expect(cosmonautView(c({ state: 'air', slot: 0, t: 0 })).pos).toEqual(ROCKET_LEDGE);
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

  it('walks into the rover when boarding', () => {
    const v = cosmonautView(c({ state: 'board', slot: 5, t: 1 }));
    expect(v.pos.x).toBe(ROVER.x + ROVER.w / 2);
    expect(v.pose).toBe('board');
  });

  it('rejects unknown slots', () => {
    expect(() => slotPoint(9)).toThrow();
  });
});
