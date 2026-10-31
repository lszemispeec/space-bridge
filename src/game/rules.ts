/**
 * The whole game as a pure function: `step(state, input, dt)` returns the next
 * state and the events that happened. No DOM, no timers, no randomness other
 * than the seeded RNG inside the state.
 *
 * Cosmonauts and the spawn clock run on beat seconds (`dt * speed`), so the
 * difficulty curve speeds everything up together and the landing scheduler
 * can reason about gaps without knowing the speed.
 */
import { densityAt, DIFFICULTY, speedAt, type Density, type GameMode, type ModeConfig } from '../config/difficulty';
import { CRATER_SLOTS, ROCKET_SLOT, ROVER_SLOT } from '../config/layout';
import { rollHop } from './jump';
import { pick } from './rng';
import { spawnFits } from './schedule';
import { newlyUnlocked, nextUnlockedTheme } from './unlocks';
import type { ThemeId } from '../config/themes';
import type { Cosmonaut, GameCommand, GameEvent, GameState, InputFrame, PlateMove, SaveData, StepResult } from './types';

const FIRST_CRATER = CRATER_SLOTS[0];
const LAST_CRATER = CRATER_SLOTS[CRATER_SLOTS.length - 1] ?? FIRST_CRATER;
const START_PLATE_SLOT = FIRST_CRATER;
const FIRST_SPAWN_DELAY = 0.6;

export function createState(save: SaveData, seed = 1): GameState {
  return {
    phase: 'title',
    mode: save.settings.mode,
    score: 0,
    lives: DIFFICULTY.lives,
    plateSlot: START_PLATE_SLOT,
    cosmonauts: [],
    nextId: 1,
    spawnTimer: 0,
    phaseTimer: 0,
    time: 0,
    rng: { seed },
    save,
    newUnlocks: [],
    paused: false,
  };
}

function clone(state: GameState): GameState {
  return {
    ...state,
    cosmonauts: state.cosmonauts.map((c) => ({ ...c })),
    save: {
      ...state.save,
      highScores: { ...state.save.highScores },
      unlocked: [...state.save.unlocked],
      settings: { ...state.save.settings },
    },
    newUnlocks: [...state.newUnlocks],
  };
}

function modeConfig(mode: GameMode): ModeConfig {
  return DIFFICULTY.modes[mode];
}

/** Beat seconds per real second at the current score. */
export function currentSpeed(s: GameState): number {
  return speedAt(modeConfig(s.mode).curve, s.score);
}

/** How crowded the road may be at the current score. */
export function currentDensity(s: GameState): Density {
  return densityAt(modeConfig(s.mode).density, s.score);
}

export function bestScore(save: SaveData): number {
  return Math.max(save.highScores.A, save.highScores.B);
}

function startRound(s: GameState, mode: GameMode, events: GameEvent[]): void {
  s.phase = 'playing';
  s.mode = mode;
  s.score = 0;
  s.lives = DIFFICULTY.lives;
  s.plateSlot = START_PLATE_SLOT;
  s.cosmonauts = [];
  s.spawnTimer = FIRST_SPAWN_DELAY;
  s.phaseTimer = 0;
  s.time = 0;
  s.newUnlocks = [];
  if (s.save.settings.mode !== mode) {
    s.save.settings.mode = mode;
    events.push({ type: 'save_changed' });
  }
  events.push({ type: 'round_start', mode });
}

function addScore(s: GameState, points: number, events: GameEvent[]): void {
  s.score += points;
  const best = Math.max(s.score, bestScore(s.save));
  for (const theme of newlyUnlocked(best, s.save.unlocked)) {
    s.save.unlocked.push(theme);
    s.newUnlocks.push(theme);
    events.push({ type: 'unlock', theme });
    events.push({ type: 'save_changed' });
  }
}

function movePlate(s: GameState, move: PlateMove, events: GameEvent[]): void {
  const delta = move === 'left' ? -1 : 1;
  const next = Math.min(LAST_CRATER, Math.max(FIRST_CRATER, s.plateSlot + delta));
  if (next === s.plateSlot) return;
  s.plateSlot = next;
  events.push({ type: 'plate_move' });
}

function applyMoves(s: GameState, input: InputFrame, events: GameEvent[]): void {
  for (const move of input.moves) movePlate(s, move, events);
}

function spawn(s: GameState, events: GameEvent[]): void {
  const cosmonaut: Cosmonaut = {
    id: s.nextId,
    state: 'crouch',
    slot: ROCKET_SLOT,
    t: 0,
    duration: DIFFICULTY.timing.emerge,
    spin: 0,
    flail: false,
  };
  s.nextId += 1;
  s.cosmonauts.push(cosmonaut);
  events.push({ type: 'footstep' });

  const jitter = pick(s.rng, modeConfig(s.mode).spawnJitter);
  s.rng = jitter.rng;
  s.spawnTimer = currentDensity(s).spawnGap + jitter.value;
}

/**
 * A cosmonaut comes out of the hatch once the spawn clock has run out, the
 * road has room at the current density, and the landing scheduler finds a
 * slot for all its landings.
 */
function trySpawn(s: GameState, events: GameEvent[]): void {
  if (s.spawnTimer > 0) return;
  s.spawnTimer = 0;
  if (s.cosmonauts.length >= currentDensity(s).maxOnScreen) return;
  if (!spawnFits(s.cosmonauts, DIFFICULTY.timing, DIFFICULTY.scheduler)) return;
  spawn(s, events);
}

/** Advances one cosmonaut by `beat` and resolves its state change, if its timer ran out. */
function advanceCosmonaut(s: GameState, c: Cosmonaut, beat: number, events: GameEvent[]): void {
  c.t += beat;
  if (c.t < c.duration) return;
  const carry = c.t - c.duration;
  const cfg = modeConfig(s.mode);

  switch (c.state) {
    case 'crouch': {
      c.state = 'air';
      c.t = carry;
      if (c.slot === LAST_CRATER) {
        // The short leap home: no tumble, no flail, nothing for the player to catch.
        c.duration = DIFFICULTY.timing.hop;
        c.spin = 0;
        c.flail = false;
      } else {
        const hop = rollHop(s.rng);
        s.rng = hop.rng;
        c.duration = c.slot === ROCKET_SLOT ? DIFFICULTY.timing.drop : DIFFICULTY.timing.jump;
        c.spin = hop.value.spin;
        c.flail = hop.value.flail;
      }
      events.push({ type: 'jump' });
      return;
    }
    case 'air': {
      const landing = c.slot + 1;
      c.slot = landing;
      c.t = carry;
      c.spin = 0;
      c.flail = false;
      if (landing === ROVER_SLOT) {
        c.state = 'board';
        c.duration = DIFFICULTY.timing.board;
        addScore(s, cfg.rescuePoints, events);
        events.push({ type: 'save' });
      } else if (landing === s.plateSlot) {
        c.state = 'crouch';
        c.duration = DIFFICULTY.timing.squash;
        addScore(s, cfg.bouncePoints, events);
        events.push({ type: 'bounce' });
      } else {
        c.state = 'fall';
        c.t = 0;
        c.duration = DIFFICULTY.timing.fall;
        s.lives -= 1;
        s.phase = 'life_lost';
        s.phaseTimer = DIFFICULTY.timing.lifeLostPause;
        events.push({ type: 'fall' });
        events.push({ type: 'grab' });
        events.push({ type: 'life_lost' });
      }
      return;
    }
    case 'board':
      c.t = c.duration;
      return;
    case 'fall':
      c.t = c.duration;
      return;
  }
}

function stepPlaying(s: GameState, dt: number, events: GameEvent[]): void {
  s.time += dt;
  const beat = dt * currentSpeed(s);

  s.spawnTimer -= beat;
  trySpawn(s, events);

  for (const c of s.cosmonauts) {
    advanceCosmonaut(s, c, beat, events);
    if (s.phase !== 'playing') break;
  }
  s.cosmonauts = s.cosmonauts.filter((c) => !(c.state === 'board' && c.t >= c.duration));
}

function endRound(s: GameState, events: GameEvent[]): void {
  s.phase = 'game_over';
  s.phaseTimer = DIFFICULTY.timing.gameOverLock;
  if (s.score > s.save.highScores[s.mode]) {
    s.save.highScores[s.mode] = s.score;
    events.push({ type: 'save_changed' });
  }
  events.push({ type: 'game_over' });
}

function stepLifeLost(s: GameState, dt: number, events: GameEvent[]): void {
  for (const c of s.cosmonauts) {
    if (c.state === 'fall') c.t = Math.min(c.duration, c.t + dt);
  }
  s.phaseTimer -= dt;
  if (s.phaseTimer > 0) return;
  s.cosmonauts = s.cosmonauts.filter((c) => c.state !== 'fall');
  if (s.lives <= 0) {
    endRound(s, events);
  } else {
    s.phase = 'playing';
    s.phaseTimer = 0;
  }
}

function setPaused(s: GameState, paused: boolean, events: GameEvent[]): void {
  if (s.paused === paused) return;
  s.paused = paused;
  events.push({ type: 'pause_changed', paused });
}

function setTheme(s: GameState, theme: ThemeId, events: GameEvent[]): void {
  if (theme === s.save.settings.theme || !s.save.unlocked.includes(theme)) return;
  s.save.settings.theme = theme;
  events.push({ type: 'theme_changed', theme });
  events.push({ type: 'save_changed' });
}

function quitToTitle(s: GameState): void {
  s.phase = 'title';
  s.cosmonauts = [];
  s.phaseTimer = 0;
}

/** Applies one menu command. Settings apply in any phase; the round commands only inside a round. */
function applyCommand(s: GameState, command: GameCommand, events: GameEvent[]): void {
  switch (command.type) {
    case 'pause':
      if (s.phase === 'playing' || s.phase === 'life_lost') setPaused(s, true, events);
      return;
    case 'resume':
      setPaused(s, false, events);
      return;
    case 'restart':
      if (s.phase === 'title') return;
      startRound(s, s.mode, events);
      setPaused(s, false, events);
      return;
    case 'quit':
      if (s.phase === 'title') return;
      quitToTitle(s);
      setPaused(s, false, events);
      return;
    case 'theme':
      setTheme(s, command.theme, events);
      return;
    case 'volume': {
      const value = Math.min(1, Math.max(0, command.value));
      if (s.save.settings[command.bus] === value) return;
      s.save.settings[command.bus] = value;
      events.push({ type: 'volume_changed', bus: command.bus, value });
      events.push({ type: 'save_changed' });
      return;
    }
    case 'shader':
      if (s.save.settings.shader === command.preset) return;
      s.save.settings.shader = command.preset;
      events.push({ type: 'shader_changed', preset: command.preset });
      events.push({ type: 'save_changed' });
      return;
  }
}

export function step(state: GameState, input: InputFrame, dt: number): StepResult {
  const s = clone(state);
  const events: GameEvent[] = [];

  for (let i = 0; i < input.mute; i++) {
    s.save.settings.muted = !s.save.settings.muted;
    events.push({ type: 'mute_changed', muted: s.save.settings.muted });
    events.push({ type: 'save_changed' });
  }
  if (input.pause) setPaused(s, !s.paused, events);
  for (const command of input.commands) applyCommand(s, command, events);

  // The pause menu freezes the round: no time passes, no plate moves, no start.
  if (s.paused) return { state: s, events };

  switch (s.phase) {
    case 'title': {
      for (let i = 0; i < input.theme; i++) setTheme(s, nextUnlockedTheme(s.save.settings.theme, s.save.unlocked), events);
      const first = input.moves[0];
      if (first === 'left') startRound(s, 'A', events);
      else if (first === 'right') startRound(s, 'B', events);
      else if (input.start) startRound(s, s.save.settings.mode, events);
      break;
    }

    case 'playing':
      applyMoves(s, input, events);
      stepPlaying(s, dt, events);
      break;

    case 'life_lost':
      applyMoves(s, input, events);
      stepLifeLost(s, dt, events);
      break;

    case 'game_over':
      s.phaseTimer -= dt;
      if (s.phaseTimer <= 0 && (input.moves.length > 0 || input.start)) quitToTitle(s);
      break;
  }

  return { state: s, events };
}

/** True when the game over screen accepts input. */
export function canLeaveGameOver(state: GameState): boolean {
  return state.phase === 'game_over' && state.phaseTimer <= 0;
}

/** Music speed for the screen that is showing: the mode's tempo in a round, the song's own on the title. */
export function musicTempo(state: GameState): number {
  return state.phase === 'title' ? 1 : DIFFICULTY.modes[state.mode].musicTempo;
}
