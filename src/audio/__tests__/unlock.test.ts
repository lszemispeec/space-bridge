import { OfflineAudioContext } from 'node-web-audio-api';
import { describe, expect, it } from 'vitest';
import { GameAudio } from '../index';
import {
  ACTIVATION_EVENTS,
  AutoplayUnlock,
  isIOS,
  requestPlaybackSession,
  silentWavDataUri,
  type Playable,
  type UnlockableContext,
  type UnlockEnv,
} from '../unlock';

type Handler = () => void;

/** A window or document: listeners by event type, and a way to fire them. */
class FakeTarget {
  readonly listeners = new Map<string, Set<Handler>>();
  visibilityState = 'visible';

  addEventListener(type: string, listener: Handler): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: Handler): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string): void {
    for (const l of [...(this.listeners.get(type) ?? [])]) l();
  }

  count(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

/**
 * A context under autoplay rules. `resume()` works only once the page has
 * user activation; before that the promise stays pending, as in Chrome.
 */
class FakeContext extends FakeTarget {
  state = 'suspended';
  activated = false;
  resumeCalls = 0;

  resume(): Promise<void> {
    this.resumeCalls++;
    if (!this.activated) return new Promise<void>(() => undefined);
    this.setState('running');
    return Promise.resolve();
  }

  setState(state: string): void {
    this.state = state;
    this.dispatch('statechange');
  }

  as(): UnlockableContext {
    return this as unknown as UnlockableContext;
  }
}

class FakeElement implements Playable {
  plays = 0;
  play(): Promise<void> {
    this.plays++;
    return Promise.resolve();
  }
}

interface Page {
  env: UnlockEnv;
  window: FakeTarget;
  document: FakeTarget;
  element: FakeElement;
  navigator: UnlockEnv['navigator'];
}

function page(options: { ios?: boolean; audioSession?: boolean } = {}): Page {
  const window = new FakeTarget();
  const document = new FakeTarget();
  const element = new FakeElement();
  const navigator: UnlockEnv['navigator'] = options.ios
    ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', maxTouchPoints: 5 }
    : { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130', maxTouchPoints: 5 };
  if (options.audioSession) navigator.audioSession = { type: 'auto' };
  const env: UnlockEnv = {
    window,
    document,
    navigator,
    silentElement: () => (options.ios && !options.audioSession ? element : null),
  };
  return { env, window, document, element, navigator };
}

const armedCount = (window: FakeTarget): number => ACTIVATION_EVENTS.reduce((n, ev) => n + window.count(ev), 0);

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('AutoplayUnlock', () => {
  it('a touch pointerdown cannot start the context; the pointerup that ends the tap does', async () => {
    const p = page();
    const ctx = new FakeContext();
    let ran = 0;
    const unlock = new AutoplayUnlock(ctx.as(), p.env, () => ran++);

    // The game's first gesture: pointerdown on a touch screen. No activation yet.
    unlock.gesture();
    await flush();
    expect(ctx.state).toBe('suspended');
    expect(ran).toBe(0);
    expect(armedCount(p.window)).toBe(ACTIVATION_EVENTS.length);

    // The finger lifts: the browser now has activation, and the unlock is listening.
    ctx.activated = true;
    p.window.dispatch('pointerup');
    await flush();
    expect(ctx.state).toBe('running');
    expect(ran).toBe(1);
    expect(armedCount(p.window)).toBe(0);
  });

  it('re-arms when iOS interrupts the context and resumes on the next tap', async () => {
    const p = page({ ios: true, audioSession: true });
    const ctx = new FakeContext();
    ctx.activated = true;
    let ran = 0;
    const unlock = new AutoplayUnlock(ctx.as(), p.env, () => ran++);
    unlock.gesture();
    await flush();
    expect(ctx.state).toBe('running');

    // A phone call. iOS reports a non-standard state and does not always come back by itself.
    ctx.setState('interrupted');
    expect(armedCount(p.window)).toBe(ACTIVATION_EVENTS.length);
    p.window.dispatch('touchend');
    await flush();
    expect(ctx.state).toBe('running');
    expect(ran).toBe(2);
    expect(armedCount(p.window)).toBe(0);
  });

  it('resumes when the page is shown again, and restarts the scheduler', async () => {
    const p = page();
    const ctx = new FakeContext();
    ctx.activated = true;
    let ran = 0;
    const unlock = new AutoplayUnlock(ctx.as(), p.env, () => ran++);
    unlock.gesture();
    await flush();

    ctx.setState('suspended');
    p.document.visibilityState = 'hidden';
    p.document.dispatch('visibilitychange');
    await flush();
    expect(ctx.state).toBe('suspended');

    p.document.visibilityState = 'visible';
    p.document.dispatch('visibilitychange');
    await flush();
    expect(ctx.state).toBe('running');
    expect(ran).toBe(2);

    ctx.setState('suspended');
    p.window.dispatch('pageshow');
    await flush();
    expect(ctx.state).toBe('running');
    expect(ran).toBe(3);
  });

  it('asks iOS for a playback session so the silent switch does not mute the game', () => {
    const p = page({ ios: true, audioSession: true });
    new AutoplayUnlock(new FakeContext().as(), p.env, () => undefined);
    expect(p.navigator.audioSession?.type).toBe('playback');
    expect(requestPlaybackSession({})).toBe(false);
  });

  it('plays the silent element in the gesture on iOS without the audio session API, until the context runs', async () => {
    const p = page({ ios: true });
    const ctx = new FakeContext();
    const unlock = new AutoplayUnlock(ctx.as(), p.env, () => undefined);
    unlock.gesture();
    unlock.gesture();
    expect(p.element.plays).toBe(2);

    // The click that unlocks is still a gesture on a locked context: it plays too.
    ctx.activated = true;
    p.window.dispatch('click');
    await flush();
    expect(ctx.state).toBe('running');
    expect(p.element.plays).toBe(3);
    unlock.gesture();
    expect(p.element.plays).toBe(3);
  });

  it('leaves no listeners behind after dispose', () => {
    const p = page();
    const ctx = new FakeContext();
    const unlock = new AutoplayUnlock(ctx.as(), p.env, () => undefined);
    unlock.dispose();
    expect(armedCount(p.window)).toBe(0);
    expect(p.window.count('pageshow') + p.window.count('focus') + p.document.count('visibilitychange')).toBe(0);
    expect(ctx.count('statechange')).toBe(0);
  });
});

describe('unlock helpers', () => {
  it('recognises iPhones and iPads, including iPadOS posing as a Mac', () => {
    expect(isIOS({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })).toBe(true);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130', maxTouchPoints: 5 })).toBe(false);
  });

  it('builds a valid silent WAV', () => {
    const uri = silentWavDataUri();
    expect(uri.startsWith('data:audio/wav;base64,')).toBe(true);
    const bytes = Uint8Array.from(atob(uri.slice(uri.indexOf(',') + 1)), (c) => c.charCodeAt(0));
    const text = (from: number, to: number): string => String.fromCharCode(...bytes.slice(from, to));
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 16)).toBe('WAVEfmt ');
    expect(text(36, 40)).toBe('data');
    expect(bytes.length).toBe(44 + 400);
    expect(bytes.slice(44).every((b) => b === 128)).toBe(true);
  });
});

/**
 * An offline context behind the autoplay gate: node-web-audio-api builds the
 * real graph, the fake owns `state`, `resume()` and `statechange`.
 */
function gatedContext(): { ctx: AudioContext; gate: FakeContext } {
  const offline = new OfflineAudioContext(1, 22050, 22050);
  const gate = new FakeContext();
  const bound = (owner: object, prop: string | symbol): unknown => {
    const value: unknown = Reflect.get(owner, prop);
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(owner) : value;
  };
  const ctx = new Proxy(offline, {
    get(target, prop): unknown {
      const gated = prop === 'state' || prop === 'resume' || prop === 'addEventListener' || prop === 'removeEventListener';
      return bound(gated ? gate : target, prop);
    },
  });
  return { ctx: ctx as unknown as AudioContext, gate };
}

describe('GameAudio.unlock on a phone', () => {
  it('starts the remembered music once the tap ends, not at pointerdown', async () => {
    const p = page();
    const { ctx, gate } = gatedContext();
    const audio = new GameAudio(
      () => p.env,
      () => ctx,
    );
    audio.music('polar-signal');
    audio.unlock();
    await flush();
    expect(audio.ready).toBe(false);

    gate.activated = true;
    p.window.dispatch('touchend');
    await flush();
    expect(audio.ready).toBe(true);
    expect(gate.resumeCalls).toBeGreaterThanOrEqual(2);
    audio.stopMusic();
  });
});
