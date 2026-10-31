/**
 * Fixed-timestep game loop. Simulation runs at a constant rate;
 * rendering happens once per animation frame.
 */
export const STEP_SECONDS = 1 / 60;
const MAX_FRAME_SECONDS = 0.25;

export interface LoopCallbacks {
  update(dt: number): void;
  render(): void;
}

export function accumulateSteps(accumulator: number, frameSeconds: number, stepSeconds: number): { steps: number; rest: number } {
  const total = accumulator + Math.min(frameSeconds, MAX_FRAME_SECONDS);
  const steps = Math.floor(total / stepSeconds);
  return { steps, rest: total - steps * stepSeconds };
}

export function startLoop(callbacks: LoopCallbacks): () => void {
  let last = performance.now();
  let accumulator = 0;
  let running = true;

  const frame = (now: number): void => {
    if (!running) return;
    const frameSeconds = (now - last) / 1000;
    last = now;
    const { steps, rest } = accumulateSteps(accumulator, frameSeconds, STEP_SECONDS);
    accumulator = rest;
    for (let i = 0; i < steps; i++) callbacks.update(STEP_SECONDS);
    callbacks.render();
    requestAnimationFrame(frame);
  };

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      last = performance.now();
      accumulator = 0;
    }
  });

  requestAnimationFrame(frame);
  return () => {
    running = false;
  };
}
