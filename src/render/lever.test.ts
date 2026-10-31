import { describe, expect, it } from 'vitest';
import { LEVER_HOLD_MS, LEVER_IDLE, leverPull, pullLever, settleLever, type Lever } from './lever';

const PULL_MS = 120;

/** Runs the lever on a clock: presses at the given times, held between `holdFrom` and `holdTo`. */
function run(presses: number[], until: number, held: (t: number) => boolean = () => false): { t: number; pull: number }[] {
  let lever: Lever = LEVER_IDLE;
  const trace: { t: number; pull: number }[] = [];
  for (let t = 0; t <= until; t += 10) {
    if (presses.includes(t)) lever = pullLever(lever, t, PULL_MS);
    lever = settleLever(lever, held(t), t, PULL_MS);
    trace.push({ t, pull: leverPull(lever, t, PULL_MS) });
  }
  return trace;
}

const at = (trace: { t: number; pull: number }[], t: number) => trace.find((p) => p.t === t)?.pull;

describe('lever', () => {
  it('rests at idle', () => {
    expect(leverPull(LEVER_IDLE, 1000, PULL_MS)).toBe(0);
    expect(settleLever(LEVER_IDLE, false, 1000, PULL_MS)).toBe(LEVER_IDLE);
  });

  it('pulls over the pull time, holds, then returns over the same time', () => {
    const trace = run([100], 600);
    expect(at(trace, 100)).toBe(0);
    expect(at(trace, 160)).toBeCloseTo(0.5);
    expect(at(trace, 220)).toBe(1);
    expect(at(trace, 220 + LEVER_HOLD_MS - 10)).toBe(1);
    expect(at(trace, 220 + LEVER_HOLD_MS + 60)).toBeCloseTo(0.5);
    expect(at(trace, 220 + LEVER_HOLD_MS + 120)).toBe(0);
    expect(at(trace, 600)).toBe(0);
  });

  it('stays pulled while the button is held, and returns when it is let go', () => {
    const trace = run([100], 1000, (t) => t >= 100 && t < 700);
    expect(at(trace, 400)).toBe(1);
    expect(at(trace, 690)).toBe(1);
    expect(at(trace, 760)).toBeCloseTo(0.5);
    expect(at(trace, 820)).toBe(0);
  });

  it('pulls again from where the handle is when a press lands during the return', () => {
    const release = 220 + LEVER_HOLD_MS;
    const trace = run([100, release + 60], 1000);
    expect(at(trace, release + 60)).toBeCloseTo(0.5);
    expect(at(trace, release + 90)).toBeCloseTo(0.75);
    expect(at(trace, release + 120)).toBe(1);
  });

  it('starts a pull from a held button that never pressed', () => {
    expect(settleLever(LEVER_IDLE, true, 50, PULL_MS)).toEqual({ phase: 'pull', from: 0, sinceMs: 50 });
  });

  it('treats a zero pull time as an instant pull', () => {
    const lever = pullLever(LEVER_IDLE, 10, 0);
    expect(leverPull(lever, 10, 0)).toBe(1);
  });
});
