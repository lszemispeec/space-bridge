import type { AudioSettings } from './types';

export const STORAGE_KEY = 'spaceBridge.audio';

export const DEFAULT_SETTINGS: Readonly<AudioSettings> = {
  muted: false,
  master: 0.8,
  music: 0.6,
  sfx: 1,
};

function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Volumes from localStorage. `muted` always starts false: the game save owns that flag and applies it at start-up. */
export function loadSettings(): AudioSettings {
  const store = storage();
  if (!store) return { ...DEFAULT_SETTINGS };
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Record<keyof AudioSettings, unknown>>;
    return {
      muted: false,
      master: clamp01(parsed.master, DEFAULT_SETTINGS.master),
      music: clamp01(parsed.music, DEFAULT_SETTINGS.music),
      sfx: clamp01(parsed.sfx, DEFAULT_SETTINGS.sfx),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persists the volumes only. */
export function saveSettings(settings: AudioSettings): void {
  const store = storage();
  if (!store) return;
  try {
    const { master, music, sfx } = settings;
    store.setItem(STORAGE_KEY, JSON.stringify({ master, music, sfx }));
  } catch {
    // Private mode or a full quota: the in-memory settings still apply for this session.
  }
}
