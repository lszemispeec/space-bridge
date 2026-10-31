import { describe, expect, it } from 'vitest';
import { FALL_DEPTH, GROUND_Y, JUMP_HEIGHT, ROVER, SLOT_X } from '../config/layout';
import { cosmonautView, slotPoint } from './positions';
import type { Cosmonaut } from './types';

function c(partial: Partial<Cosmonaut>): Cosmonaut {
  return { id: 1, state: 'crouch', slot: 1, t: 0, duration: 1, ...partial };
}

describe('cosmonautView', () => {
  it('stands on the slot while crouching', () => {
    const v = cosmonautView(c({ slot: 2, t: 0.9 }));
    expect(v.pos).toEqual({ x: SLOT_X[2], y: GROUND_Y });
    expect(v.pose).toBe('crouch');
  });

  it('squashes right after landing', () => {
    expect(cosmonautView(c({ slot: 2, t: 0.1 })).pose).toBe('land');
  });

  it('emerges from the rocket on slot 0', () => {
    expect(cosmonautView(c({ slot: 0 })).pose).toBe('emerge');
  });

  it('follows the arc between slots in the air', () => {
    const mid = cosmonautView(c({ state: 'air', slot: 1, t: 0.5 }));
    expect(mid.pos.x).toBe((slotPoint(1).x + slotPoint(2).x) / 2);
    expect(mid.pos.y).toBe(GROUND_Y - JUMP_HEIGHT);
    expect(cosmonautView(c({ state: 'air', t: 0.2 })).pose).toBe('rise');
    expect(cosmonautView(c({ state: 'air', t: 0.8 })).pose).toBe('descend');
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
