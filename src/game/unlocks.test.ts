import { describe, expect, it } from 'vitest';
import { newlyUnlocked, nextUnlockedTheme } from './unlocks';

describe('unlocks', () => {
  it('unlocks desert at 250, neon at 575 and vector at 900', () => {
    expect(newlyUnlocked(0, ['polar-signal'])).toEqual([]);
    expect(newlyUnlocked(249, ['polar-signal'])).toEqual([]);
    expect(newlyUnlocked(250, ['polar-signal'])).toEqual(['desert-expedition']);
    expect(newlyUnlocked(574, ['polar-signal'])).toEqual(['desert-expedition']);
    expect(newlyUnlocked(575, ['polar-signal'])).toEqual(['desert-expedition', 'neon-orbit']);
    expect(newlyUnlocked(899, ['polar-signal'])).toEqual(['desert-expedition', 'neon-orbit']);
    expect(newlyUnlocked(900, ['polar-signal'])).toEqual(['desert-expedition', 'neon-orbit', 'vector']);
  });

  it('does not report themes that are already unlocked', () => {
    expect(newlyUnlocked(575, ['polar-signal', 'desert-expedition'])).toEqual(['neon-orbit']);
  });

  it('cycles through unlocked themes only', () => {
    expect(nextUnlockedTheme('polar-signal', ['polar-signal'])).toBe('polar-signal');
    expect(nextUnlockedTheme('polar-signal', ['polar-signal', 'neon-orbit'])).toBe('neon-orbit');
    expect(nextUnlockedTheme('neon-orbit', ['polar-signal', 'neon-orbit'])).toBe('polar-signal');
  });

  it('cycles all four themes in config order and wraps', () => {
    const all = ['polar-signal', 'desert-expedition', 'neon-orbit', 'vector'] as const;
    expect(nextUnlockedTheme('neon-orbit', all)).toBe('vector');
    expect(nextUnlockedTheme('vector', all)).toBe('polar-signal');
  });
});
