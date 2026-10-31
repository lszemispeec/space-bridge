import { describe, expect, it } from 'vitest';
import { newlyUnlocked, nextUnlockedTheme } from './unlocks';

describe('unlocks', () => {
  it('unlocks desert at 500 and neon at 1000', () => {
    expect(newlyUnlocked(0, ['polar-signal'])).toEqual([]);
    expect(newlyUnlocked(499, ['polar-signal'])).toEqual([]);
    expect(newlyUnlocked(500, ['polar-signal'])).toEqual(['desert-expedition']);
    expect(newlyUnlocked(1000, ['polar-signal'])).toEqual(['desert-expedition', 'neon-orbit']);
  });

  it('does not report themes that are already unlocked', () => {
    expect(newlyUnlocked(1000, ['polar-signal', 'desert-expedition'])).toEqual(['neon-orbit']);
  });

  it('cycles through unlocked themes only', () => {
    expect(nextUnlockedTheme('polar-signal', ['polar-signal'])).toBe('polar-signal');
    expect(nextUnlockedTheme('polar-signal', ['polar-signal', 'neon-orbit'])).toBe('neon-orbit');
    expect(nextUnlockedTheme('neon-orbit', ['polar-signal', 'neon-orbit'])).toBe('polar-signal');
  });
});
