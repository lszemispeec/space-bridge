import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, STORAGE_KEY, loadSettings, saveSettings } from '../settings';

function stubStorage(initial: Record<string, string> = {}): Record<string, string> {
  const store = { ...initial };
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
  });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('settings', () => {
  it('falls back to defaults without storage', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips the volumes and leaves mute to the game save', () => {
    const store = stubStorage();
    saveSettings({ muted: true, master: 0.5, music: 0.2, sfx: 0.9 });
    expect(JSON.parse(store[STORAGE_KEY] ?? 'null')).toEqual({ master: 0.5, music: 0.2, sfx: 0.9 });
    expect(loadSettings()).toEqual({ muted: false, master: 0.5, music: 0.2, sfx: 0.9 });
  });

  it('sanitises corrupt or out-of-range values', () => {
    stubStorage({ [STORAGE_KEY]: '{"muted":true,"master":7,"music":-1,"sfx":"x"}' });
    expect(loadSettings()).toEqual({ muted: false, master: 1, music: 0, sfx: DEFAULT_SETTINGS.sfx });
    stubStorage({ [STORAGE_KEY]: 'not json' });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
