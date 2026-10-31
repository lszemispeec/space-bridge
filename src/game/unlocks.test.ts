import { describe, expect, it } from 'vitest';
import { newlyUnlocked, nextUnlockedTheme } from './unlocks';

describe('unlocks', () => {
  it('unlocks desert at 250 and neon at 575', () => {
    expect(newlyUnlocked(0, ['polar-signal'])).toEqual([]);
    expect(newlyUnlocked(249, ['polar-signal'])).toEqual([]);
    expect(newlyUnlocked(250, ['polar-signal'])).toEqual(['desert-expedition']);
    expect(newlyUnlocked(574, ['polar-signal'])).toEqual(['desert-expedition']);
    expect(newlyUnlocked(575, ['polar-signal'])).toEqual(['desert-expedition', 'neon-orbit']);
  });

  it('does not report themes that are already unlocked', () => {
    expect(newlyUnlocked(575, ['polar-signal', 'desert-expedition'])).toEqual(['neon-orbit']);
  });

  it('cycles through unlocked themes only', () => {
    expect(nextUnlockedTheme('polar-signal', ['polar-signal'])).toBe('polar-signal');
    expect(nextUnlockedTheme('polar-signal', ['polar-signal', 'neon-orbit'])).toBe('neon-orbit');
    expect(nextUnlockedTheme('neon-orbit', ['polar-signal', 'neon-orbit'])).toBe('polar-signal');
  });
});
