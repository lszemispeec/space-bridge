/**
 * The side levers. Each plate press pulls its lever over the pull animation,
 * a held button keeps it pulled, and a short while after the last press it
 * eases back to idle over the same time. A press during the return starts
 * the pull again from where the handle is, so a quick run of presses rocks
 * the lever instead of restarting it from idle. Pure; the renderer steps it
 * on the real clock.
 */

export interface Lever {
  phase: 'idle' | 'pull' | 'release';
  /** The pull amount, 0 idle to 1 pulled, when the phase started. */
  from: number;
  /** Real ms when the phase started. */
  sinceMs: number;
}

export const LEVER_IDLE: Lever = { phase: 'idle', from: 0, sinceMs: -Infinity };

/** How long the handle stays pulled after a tap before it returns. */
export const LEVER_HOLD_MS = 90;

/** The pull amount, 0 idle to 1 pulled, at `nowMs`. `pullMs` is the time of a full pull. */
export function leverPull(l: Lever, nowMs: number, pullMs: number): number {
  const travel = pullMs > 0 ? (nowMs - l.sinceMs) / pullMs : 1;
  switch (l.phase) {
    case 'idle':
      return 0;
    case 'pull':
      return Math.min(1, l.from + travel);
    case 'release':
      return Math.max(0, l.from - travel);
  }
}

/** A plate press: pull the lever from where it is now. */
export function pullLever(l: Lever, nowMs: number, pullMs: number): Lever {
  return { phase: 'pull', from: leverPull(l, nowMs, pullMs), sinceMs: nowMs };
}

/**
 * Advances the lever on the clock. A full pull waits `LEVER_HOLD_MS` and then
 * returns, unless the button is still held; a finished return is idle.
 */
export function settleLever(l: Lever, held: boolean, nowMs: number, pullMs: number): Lever {
  const pull = leverPull(l, nowMs, pullMs);
  if (l.phase === 'idle') return held ? pullLever(l, nowMs, pullMs) : l;
  if (l.phase === 'release') return pull <= 0 ? LEVER_IDLE : l;
  if (pull < 1 || held) return l;
  const pulledAt = l.sinceMs + (1 - l.from) * pullMs;
  if (nowMs - pulledAt < LEVER_HOLD_MS) return l;
  return { phase: 'release', from: 1, sinceMs: nowMs };
}
