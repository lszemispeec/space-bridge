/** localStorage adapter. Falls back to memory when storage is blocked. */
import { SAVE_KEY, parseSave, serializeSave } from '../game/save';
import type { SaveData } from '../game/types';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
}

export function browserStore(): KeyValueStore {
  try {
    const probe = '__space_bridge_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return memoryStore();
  }
}

export function loadSave(store: KeyValueStore): SaveData {
  try {
    return parseSave(store.getItem(SAVE_KEY));
  } catch {
    return parseSave(null);
  }
}

export function writeSave(store: KeyValueStore, save: SaveData): void {
  try {
    store.setItem(SAVE_KEY, serializeSave(save));
  } catch {
    // Storage full or blocked. The game keeps running without persistence.
  }
}
