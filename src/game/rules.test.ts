import { describe, expect, it } from 'vitest';
import { AUDIO_EVENTS } from '../audio/api';
import { DIFFICULTY } from '../config/difficulty';
import { ROCKET_SLOT } from '../config/layout';
import { getTheme } from '../config/themes';
import { STEP_SECONDS } from '../platform/loop';
import { bestScore, canLeaveGameOver, currentDensity, musicTempo, step } from './rules';
import { defaultSave } from './save';
import { createBot, instantBotOptions } from './bot';
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
    const locked = step(titleState(), press({ theme: 1 }), STEP_SECONDS);
    expect(locked.state.save.settings.theme).toBe('polar-signal');
    expect(types(locked.events)).not.toContain('theme_changed');

    const save = defaultSave();
    save.unlocked = ['polar-signal', 'neon-orbit'];
    const r = step(titleState(save), press({ theme: 1 }), STEP_SECONDS);
    expect(r.state.save.settings.theme).toBe('neon-orbit');
    expect(types(r.events)).toEqual(['theme_changed', 'save_changed']);
  });

  it('toggles mute in any phase and asks to persist', () => {
    const r = step(titleState(), press({ mute: 1 }), STEP_SECONDS);
    expect(r.state.save.settings.muted).toBe(true);
    expect(r.events).toContainEqual({ type: 'mute_changed', muted: true });
    expect(types(r.events)).toContain('save_changed');
  });

  it('counts every theme and mute press in one step as its own toggle', () => {
    const save = defaultSave();
    save.unlocked = ['polar-signal', 'desert-expedition', 'neon-orbit'];
    const r = step(titleState(save), press({ theme: 2, mute: 2 }), STEP_SECONDS);
    expect(r.state.save.settings.theme).toBe('neon-orbit');
    expect(r.state.save.settings.muted).toBe(false);
    expect(r.events.filter((e) => e.type === 'theme_changed')).toHaveLength(2);
    expect(r.events.filter((e) => e.type === 'mute_changed')).toEqual([
      { type: 'mute_changed', muted: true },
      { type: 'mute_changed', muted: false },
    ]);
  });

  it('plays the music at the mode tempo in a round and at its own tempo on the title', () => {
    expect(musicTempo(titleState())).toBe(1);
    expect(musicTempo(startGame(titleState(), 'A'))).toBe(DIFFICULTY.modes.A.musicTempo);
    expect(musicTempo(startGame(titleState(), 'B'))).toBe(DIFFICULTY.modes.B.musicTempo);
    expect(DIFFICULTY.modes.B.musicTempo).toBeGreaterThan(DIFFICULTY.modes.A.musicTempo);
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

  it('rolls a fresh tumble or flail from the seeded RNG at every take-off', () => {
    let s = runUntil(startGame(titleState()), 'footstep').state;
    expect(s.cosmonauts[0]?.spin).toBe(0);
    expect(s.cosmonauts[0]?.flail).toBe(false);
    const bot = createBot(instantBotOptions());
    const hops: { spin: number; flail: boolean }[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 60 * 120 && hops.length < 40; i++) {
      const r = step(s, bot.input(s), STEP_SECONDS);
      s = r.state;
      for (const c of s.cosmonauts) {
        const key = `${c.id}:${c.slot}`;
        if (c.state === 'air' && !seen.has(key)) {
          seen.add(key);
          hops.push({ spin: c.spin, flail: c.flail });
        }
        if (c.state !== 'air') {
          expect(c.spin).toBe(0);
          expect(c.flail).toBe(false);
        }
      }
    }
    expect(hops.length).toBeGreaterThanOrEqual(40);
    const flails = hops.filter((h) => h.flail);
    const tumbles = hops.filter((h) => !h.flail);
    expect(flails.length).toBeGreaterThanOrEqual(3);
    expect(tumbles.length).toBeGreaterThan(flails.length);
    for (const h of flails) expect(h.spin).toBe(0);
    for (const h of tumbles) expect(Math.abs(h.spin)).toBeGreaterThanOrEqual(0.5);
    for (const h of tumbles) expect(Math.abs(h.spin)).toBeLessThanOrEqual(1.5);
    expect(new Set(tumbles.map((h) => h.spin)).size).toBeGreaterThan(1);
    expect(tumbles.some((h) => h.spin > 0) && tumbles.some((h) => h.spin < 0)).toBe(true);
  });

  it('never has more cosmonauts than the density ramp allows at the score', () => {
    for (const mode of ['A', 'B'] as const) {
      let s = startGame(titleState(), mode);
      const bot = createBot(instantBotOptions());
      let most = 0;
      for (let i = 0; i < 60 * 120; i++) {
        s = step(s, bot.input(s), STEP_SECONDS).state;
        expect(s.cosmonauts.length).toBeLessThanOrEqual(currentDensity(s).maxOnScreen);
        most = Math.max(most, s.cosmonauts.length);
        if (s.phase === 'game_over') break;
      }
      expect(most).toBeGreaterThanOrEqual(3);
    }
  });

  it('starts a round calm: at most two cosmonauts before the first hundred points', () => {
    let s = startGame(titleState(), 'B');
    const bot = createBot(instantBotOptions());
    while (s.score < 100 && s.phase === 'playing') {
      s = step(s, bot.input(s), STEP_SECONDS).state;
      expect(s.cosmonauts.length).toBeLessThanOrEqual(2);
    }
    expect(s.score).toBeGreaterThanOrEqual(100);
  });

  it('drops from the ledge to crater 1 in the drop time, then hops in the jump time', () => {
    const jumped = runUntil(startGame(titleState()), 'jump').state;
    expect(jumped.cosmonauts[0]?.duration).toBe(DIFFICULTY.timing.drop);
    const bounced = runUntil(jumped, 'bounce').state;
    const hopped = runUntil(bounced, 'jump').state;
    expect(hopped.cosmonauts[0]?.slot).toBe(1);
    expect(hopped.cosmonauts[0]?.duration).toBe(DIFFICULTY.timing.jump);
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
    const { state, events } = followCosmonauts(s, 8);
    expect(events).toContain('bounce');
    expect(events).not.toContain('fall');
    expect(state.lives).toBe(DIFFICULTY.lives);
    expect(state.score).toBeGreaterThan(0);
  });

  it('carries a cosmonaut all the way into the rover for rescue points', () => {
    const s = startGame(titleState());
    const { state, events } = followCosmonauts(s, 20);
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
  const desertAt = getTheme('desert-expedition').unlockAt;
  const neonAt = getTheme('neon-orbit').unlockAt;

  it('unlocks a theme the moment the score passes its target', () => {
    const s = { ...startGame(titleState()), score: desertAt - 1 };
    const frame = step(s, NO_INPUT, STEP_SECONDS).state;
    const next = { ...frame, score: desertAt - 1 };
    const { state, events } = followCosmonauts(next, 3);
    expect(state.score).toBeGreaterThanOrEqual(desertAt);
    expect(events).toContain('unlock');
    expect(state.save.unlocked).toContain('desert-expedition');
    expect(state.newUnlocks).toEqual(['desert-expedition']);
  });

  it('does not unlock twice', () => {
    const save = defaultSave();
    save.unlocked = ['polar-signal', 'desert-expedition'];
    const s = { ...startGame(titleState(save)), score: desertAt + 1 };
    const { state, events } = followCosmonauts(s, 3);
    expect(state.score).toBeLessThan(neonAt);
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
    const soundLike = ['footstep', 'jump', 'bounce', 'plate_move', 'save', 'fall', 'grab', 'life_lost', 'unlock', 'game_over'];
    for (const name of soundLike) expect(AUDIO_EVENTS).toContain(name);
  });
});
