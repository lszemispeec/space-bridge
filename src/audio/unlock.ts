/**
 * The autoplay unlock on phones.
 *
 * Browsers let an AudioContext run only after user activation. On a touch
 * screen `pointerdown` and `touchstart` are not activation: the tap has to
 * end first (`pointerup`, `touchend`, `click`). The game's first gesture
 * arrives on `pointerdown`, so the context it creates stays suspended, and a
 * one-shot unlock never gets a second chance. `AutoplayUnlock` keeps trying:
 * while the context is not running it listens for every activation event on
 * the window and resumes from there, and it re-arms whenever the context
 * stops again, as it does on iOS for a phone call (the non-standard
 * `interrupted` state) or a backgrounded tab. Page visibility and `pageshow` also try a resume.
 *
 * iOS also mutes Web Audio under the ring/silent switch. `audioSession.type
 * = 'playback'` lifts that where the API exists; older iOS gets a silent
 * `<audio>` element played in the gesture, which switches the page's audio
 * session to playback the same way.
 */

/**
 * Events that count as user activation. `pointerdown` counts for a mouse
 * only; on a touch screen the tap must end first.
 */
export const ACTIVATION_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;

type Handler = () => void;

export interface Listenable {
  addEventListener(type: string, listener: Handler, options?: AddEventListenerOptions): void;
  removeEventListener(type: string, listener: Handler, options?: EventListenerOptions): void;
}

export interface NavigatorLike {
  audioSession?: { type: string };
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
}

export interface Playable {
  play(): Promise<void> | undefined;
}

export interface UnlockEnv {
  window: Listenable;
  document: Listenable & { visibilityState: string };
  navigator: NavigatorLike;
  /** The silent element for the iOS fallback, or null where it is not needed. */
  silentElement: () => Playable | null;
}

/** The part of AudioContext the unlock drives. */
export type UnlockableContext = Pick<AudioContext, 'state' | 'resume'> & Listenable;

const LISTEN: AddEventListenerOptions = { capture: true, passive: true };

/**
 * Asks iOS to play Web Audio under the silent switch. Returns true when the
 * API exists; the caller then does not need the `<audio>` fallback.
 */
export function requestPlaybackSession(nav: NavigatorLike): boolean {
  const session = nav.audioSession;
  if (!session) return false;
  try {
    session.type = 'playback';
    return true;
  } catch {
    return false;
  }
}

/** iPhone, iPod, iPad, including iPadOS reporting itself as a Mac with a touch screen. */
export function isIOS(nav: NavigatorLike): boolean {
  const ua = nav.userAgent ?? '';
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
}

/** A WAV of silence as a data URI: 8-bit mono at 8 kHz, 50 ms. */
export function silentWavDataUri(): string {
  const rate = 8000;
  const samples = rate / 20;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(128, 44);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/** The real page. Built once, at the first unlock, so this module loads in Node too. */
export function browserEnv(): UnlockEnv {
  const nav: NavigatorLike = navigator;
  let element: HTMLAudioElement | null = null;
  return {
    window,
    document,
    navigator: nav,
    silentElement: () => {
      if (!isIOS(nav) || nav.audioSession) return null;
      if (!element) {
        element = document.createElement('audio');
        element.src = silentWavDataUri();
        element.setAttribute('playsinline', '');
        element.preload = 'auto';
      }
      return element;
    },
  };
}

/**
 * Keeps one AudioContext running. `gesture()` is for calls made inside a
 * user gesture; the unlock also arms itself on the window and needs no
 * further calls once the context exists.
 */
export class AutoplayUnlock {
  private armed = false;
  private everRan = false;
  /** Our last reading of the state, so a resume reported twice (statechange and the promise) counts once. */
  private wasRunning = false;

  constructor(
    private readonly ctx: UnlockableContext,
    private readonly env: UnlockEnv,
    private readonly onRunning: Handler,
  ) {
    requestPlaybackSession(env.navigator);
    ctx.addEventListener('statechange', this.onStateChange);
    env.document.addEventListener('visibilitychange', this.onVisible);
    env.window.addEventListener('pageshow', this.resume);
    env.window.addEventListener('focus', this.resume);
    if (ctx.state === 'running') this.ran();
    else this.arm();
  }

  get running(): boolean {
    return this.ctx.state === 'running';
  }

  /** Called inside a user gesture: the one moment a locked context may start. */
  gesture(): void {
    if (this.running) return;
    if (!this.everRan) this.env.silentElement()?.play()?.catch(noop);
    this.resume();
  }

  /** Tries a resume outside a gesture. Harmless when the browser refuses; the next gesture tries again. */
  readonly resume = (): void => {
    if (this.running) return;
    this.arm();
    void this.ctx.resume().then(this.check, noop);
  };

  dispose(): void {
    this.disarm();
    this.ctx.removeEventListener('statechange', this.onStateChange);
    this.env.document.removeEventListener('visibilitychange', this.onVisible);
    this.env.window.removeEventListener('pageshow', this.resume);
    this.env.window.removeEventListener('focus', this.resume);
  }

  private readonly onGesture = (): void => {
    this.gesture();
  };

  private readonly onVisible = (): void => {
    if (this.env.document.visibilityState === 'visible') this.resume();
  };

  /** Suspended or interrupted: the next tap, or the page coming back, starts it again. */
  private readonly onStateChange = (): void => {
    if (this.running) {
      this.ran();
      return;
    }
    this.wasRunning = false;
    this.arm();
  };

  private readonly check = (): void => {
    if (this.running) this.ran();
  };

  private ran(): void {
    if (this.wasRunning) return;
    this.wasRunning = true;
    this.everRan = true;
    this.disarm();
    this.onRunning();
  }

  private arm(): void {
    if (this.armed) return;
    this.armed = true;
    for (const ev of ACTIVATION_EVENTS) this.env.window.addEventListener(ev, this.onGesture, LISTEN);
  }

  private disarm(): void {
    if (!this.armed) return;
    this.armed = false;
    for (const ev of ACTIVATION_EVENTS) this.env.window.removeEventListener(ev, this.onGesture, LISTEN);
  }
}

function noop(): void {
  // Rejections from resume() and play() are expected while the page has no activation yet.
}
