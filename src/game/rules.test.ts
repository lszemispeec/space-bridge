import { describe, expect, it } from 'vitest';
import { AUDIO_EVENTS } from '../audio/api';
import { DIFFICULTY } from '../config/difficulty';
import { ROCKET_SLOT } from '../config/layout';
import { STEP_SECONDS } from '../platform/loop';
import { bestScore, canLeaveGameOver, step } from './rules';
import { defaultSave } from './save';
import { instantBotOptions } from './bot';
import { move, playBot, press, run, runUntil, startGame, titleState, types } from './testing';
import { NO_INPUT, type GameState } from './types';

/** Lets the instant bot keep the plate under every landing. */
function followCosmonauts(state: GameState, seconds: number): { state: GameState; events: string[] } {
  const r = playBot(state, instantBotOptions(), seconds);
  return { state: r.state, events: types(r.events) };
}

describe('title screen', () => {
  it('starts Game A with left and Game B with right', () => {
    const a = startGame(titleState(), 'A');
    expect(a.phase).toBe('playing');
    expect(a.mode).toBe('A');
    const b = startGame(titleState(), 'B');
    expect(b.mode).toBe('B');
    expect(b.save.settings.mode).toBe('B');
  });

  it('starts the saved mode with start', () => {
    const save = defaultSave();
    save.settings.mode = 'B';
    const r = step(titleState(save), press({ start: true }), STEP_SECONDS);
    expect(r.state.mode).toBe('B');
    expect(types(r.events)).toContain('round_start');
  });

  it('resets score and lives on start', () => {
    const s = startGame(titleState());
    expect(s.score).toBe(0);
    expect(s.lives).toBe(DIFFICULTY.lives);
    expect(s.cosmonauts).toEqual([]);
  });

  it('cycles only unlocked themes with the theme key', () => {
    const locked = step(titleState(), press({ theme: true }), STEP_SECONDS);
    expect(locked.state.save.settings.theme).toBe('polar-signal');
    expect(types(locked.events)).not.toContain('theme_changed');

    const save = defaultSave();
    save.unlocked = ['polar-signal', 'neon-orbit'];
    const r = step(titleState(save), press({ theme: true }), STEP_SECONDS);
    expect(r.state.save.settings.theme).toBe('neon-orbit');
    expect(types(r.events)).toEqual(['theme_changed', 'save_changed']);
  });

  it('toggles mute in any phase and asks to persist', () => {
    const r = step(titleState(), press({ mute: true }), STEP_SECONDS);
    expect(r.state.save.settings.muted).toBe(true);
    expect(r.events).toContainEqual({ type: 'mute_changed', muted: true });
    expect(types(r.events)).toContain('save_changed');
  });
});

describe('spawning and jumping', () => {
  it('spawns the first cosmonaut at the rocket with a footstep', () => {
    const { state, events } = runUntil(startGame(titleState()), 'footstep');
    expect(state.cosmonauts).toHaveLength(1);
    expect(state.cosmonauts[0]?.slot).toBe(ROCKET_SLOT);
    expect(state.cosmonauts[0]?.state).toBe('crouch');
    expect(types(events)).toContain('footstep');
  });

  it('takes off after the crouch and lands one slot further', () => {
    const spawned = runUntil(startGame(titleState()), 'footstep').state;
    const jumped = runUntil(spawned, 'jump').state;
    expect(jumped.cosmonauts[0]?.state).toBe('air');
    expect(jumped.cosmonauts[0]?.slot).toBe(ROCKET_SLOT);
  });

  it('never has more cosmonauts than the mode allows', () => {
    let s = startGame(titleState(), 'B');
    for (let i = 0; i < 60 * 20; i++) {
      s = step(s, NO_INPUT, STEP_SECONDS).state;
      expect(s.cosmonauts.length).toBeLessThanOrEqual(DIFFICULTY.modes.B.maxOnScreen);
      if (s.phase === 'game_over') break;
    }
  });
});

describe('plate', () => {
  it('moves one crater per press and clamps at the ends', () => {
    let s = startGame(titleState());
    expect(s.plateSlot).toBe(1);
    let r = step(s, move('right'), STEP_SECONDS);
    expect(r.state.plateSlot).toBe(2);
    expect(types(r.events)).toContain('plate_move');
    r = step(r.state, move('left'), STEP_SECONDS);
    expect(r.state.plateSlot).toBe(1);
    r = step(r.state, move('left'), STEP_SECONDS);
    expect(r.state.plateSlot).toBe(1);
    expect(types(r.events)).not.toContain('plate_move');
    s = r.state;
    for (let i = 0; i < 5; i++) s = step(s, move('right'), STEP_SECONDS).state;
    expect(s.plateSlot).toBe(4);
  });

  it('applies every press of one step in order', () => {
    const s = startGame(titleState());
    const three = step(s, press({ moves: ['right', 'right', 'right'] }), STEP_SECONDS);
    expect(three.state.plateSlot).toBe(4);
    expect(types(three.events).filter((e) => e === 'plate_move')).toHaveLength(3);

    const back = step(three.state, press({ moves: ['left', 'right'] }), STEP_SECONDS);
    expect(back.state.plateSlot).toBe(4);
    expect(types(back.events).filter((e) => e === 'plate_move')).toHaveLength(2);
  });
});

describe('bounce and fall', () => {
  it('bounces when the plate is under the landing and scores', () => {
    const s = startGame(titleState());
    const { state, events } = followCosmonauts(s, 4);
    expect(events).toContain('bounce');
    expect(events).not.toContain('fall');
    expect(state.lives).toBe(DIFFICULTY.lives);
    expect(state.score).toBeGreaterThan(0);
  });

  it('carries a cosmonaut all the way into the rover for rescue points', () => {
    const s = startGame(titleState());
    const { state, events } = followCosmonauts(s, 8);
    expect(events).toContain('save');
    const bounces = events.filter((e) => e === 'bounce').length;
    const saves = events.filter((e) => e === 'save').length;
    expect(state.score).toBe(
      bounces * DIFFICULTY.modes.A.bouncePoints + saves * DIFFICULTY.modes.A.rescuePoints,
    );
  });

  it('loses a life and freezes when the plate is elsewhere', () => {
    let s = startGame(titleState());
    s = step(s, move('right'), STEP_SECONDS).state;
    s = step(s, move('right'), STEP_SECONDS).state;
    expect(s.plateSlot).toBe(3);
    const { state, events } = runUntil(s, 'fall');
    expect(types(events)).toContain('life_lost');
    expect(state.lives).toBe(DIFFICULTY.lives - 1);
    expect(state.phase).toBe('life_lost');
    expect(state.cosmonauts.some((c) => c.state === 'fall')).toBe(true);
  });

  it('resumes play after the freeze and removes the fallen cosmonaut', () => {
    let s = startGame(titleState());
    s = step(s, move('right'), STEP_SECONDS).state;
    s = step(s, move('right'), STEP_SECONDS).state;
    s = runUntil(s, 'fall').state;
    const frozenTime = s.time;
    const after = run(s, DIFFICULTY.timing.lifeLostPause + STEP_SECONDS).state;
    expect(after.phase).toBe('playing');
    expect(after.cosmonauts.some((c) => c.state === 'fall')).toBe(false);
    expect(after.time - frozenTime).toBeLessThanOrEqual(STEP_SECONDS + 1e-9);
  });

  it('still lets the player move the plate during the freeze', () => {
    let s = startGame(titleState());
    s = step(s, move('right'), STEP_SECONDS).state;
    s = step(s, move('right'), STEP_SECONDS).state;
    s = runUntil(s, 'fall').state;
    const moved = step(s, move('left'), STEP_SECONDS).state;
    expect(moved.plateSlot).toBe(2);
  });
});

describe('game over and restart', () => {
  function playToGameOver(): { state: GameState; events: string[] } {
    let s = startGame(titleState());
    s = step(s, move('right'), STEP_SECONDS).state;
    s = step(s, move('right'), STEP_SECONDS).state;
    const events: string[] = [];
    for (let i = 0; i < 60 * 60; i++) {
      const r = step(s, NO_INPUT, STEP_SECONDS);
      s = r.state;
      events.push(...types(r.events));
      if (s.phase === 'game_over') return { state: s, events };
    }
    throw new Error('never reached game over');
  }

  it('ends after three misses', () => {
    const { state, events } = playToGameOver();
    expect(state.lives).toBe(0);
    expect(events.filter((e) => e === 'life_lost')).toHaveLength(3);
    expect(events).toContain('game_over');
  });

  it('ignores input until the lock passes, then returns to the title', () => {
    const { state } = playToGameOver();
    expect(canLeaveGameOver(state)).toBe(false);
    const tooEarly = step(state, press({ start: true }), STEP_SECONDS).state;
    expect(tooEarly.phase).toBe('game_over');
    const waited = run(state, DIFFICULTY.timing.gameOverLock + STEP_SECONDS).state;
    expect(canLeaveGameOver(waited)).toBe(true);
    const back = step(waited, press({ start: true }), STEP_SECONDS).state;
    expect(back.phase).toBe('title');
    const viaMove = step(waited, move('left'), STEP_SECONDS).state;
    expect(viaMove.phase).toBe('title');
    expect(back.cosmonauts).toEqual([]);
  });

  it('records a high score for the mode that was played', () => {
    const save = defaultSave();
    const s = startGame(titleState(save), 'B');
    const played = followCosmonauts(s, 6).state;
    expect(played.score).toBeGreaterThan(0);
    const forced: GameState = { ...played, lives: 0, phase: 'life_lost', phaseTimer: 0 };
    const r = step(forced, NO_INPUT, STEP_SECONDS);
    expect(r.state.phase).toBe('game_over');
    expect(r.state.save.highScores.B).toBe(played.score);
    expect(r.state.save.highScores.A).toBe(0);
    expect(types(r.events)).toContain('save_changed');
    expect(bestScore(r.state.save)).toBe(played.score);
  });
});

describe('unlocks', () => {
  it('unlocks a theme the moment the score passes its target', () => {
    const s = { ...startGame(titleState()), score: 499 };
    const frame = step(s, NO_INPUT, STEP_SECONDS).state;
    const next = { ...frame, score: 499 };
    const { state, events } = followCosmonauts(next, 3);
    expect(state.score).toBeGreaterThanOrEqual(500);
    expect(events).toContain('unlock');
    expect(state.save.unlocked).toContain('desert-expedition');
    expect(state.newUnlocks).toEqual(['desert-expedition']);
  });

  it('does not unlock twice', () => {
    const save = defaultSave();
    save.unlocked = ['polar-signal', 'desert-expedition'];
    const s = { ...startGame(titleState(save)), score: 600 };
    const { events } = followCosmonauts(s, 3);
    expect(events).not.toContain('unlock');
  });
});

describe('purity', () => {
  it('does not mutate the input state', () => {
    const s = startGame(titleState());
    const snapshot = JSON.stringify(s);
    run(s, 3, move('right'));
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('is deterministic for a seed', () => {
    const a = run(startGame(titleState(defaultSave(), 11)), 10);
    const b = run(startGame(titleState(defaultSave(), 11)), 10);
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
  });

  it('only emits sound events that the audio API knows', () => {
    const soundLike = ['footstep', 'jump', 'bounce', 'plate_move', 'save', 'fall', 'life_lost', 'unlock', 'game_over'];
    for (const name of soundLike) expect(AUDIO_EVENTS).toContain(name);
  });
});
