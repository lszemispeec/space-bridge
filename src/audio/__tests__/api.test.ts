import { describe, expect, it } from 'vitest';
import { AUDIO_EVENTS } from '../api';
import { THEMES } from '../../config/themes';
import { SFX } from '../sfx';
import { THEME_SONGS } from '../songs/index';

describe('audio content matches the game contract', () => {
  it('has one effect for every event in api.ts', () => {
    expect(Object.keys(SFX).sort()).toEqual([...AUDIO_EVENTS].sort());
  });

  it('has one track for every theme in config/themes.ts', () => {
    expect(Object.keys(THEME_SONGS).sort()).toEqual(THEMES.map((t) => t.id).sort());
  });
});
