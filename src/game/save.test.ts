import { describe, expect, it } from 'vitest';
import { defaultSave, parseSave, serializeSave } from './save';

describe('parseSave', () => {
  it('returns defaults for missing or corrupt data', () => {
    expect(parseSave(null)).toEqual(defaultSave());
    expect(parseSave('')).toEqual(defaultSave());
    expect(parseSave('{not json')).toEqual(defaultSave());
    expect(parseSave('42')).toEqual(defaultSave());
  });

  it('round-trips a valid save', () => {
    const save = defaultSave();
    save.highScores = { A: 120, B: 340 };
    save.unlocked = ['polar-signal', 'desert-expedition'];
    save.settings = { theme: 'desert-expedition', muted: true, mode: 'B' };
    expect(parseSave(serializeSave(save))).toEqual(save);
  });

  it('drops unknown themes and keeps the default unlocked', () => {
    const parsed = parseSave(JSON.stringify({ unlocked: ['neon-orbit', 'bogus'] }));
    expect(parsed.unlocked).toEqual(['polar-signal', 'neon-orbit']);
  });

  it('refuses a selected theme that is not unlocked', () => {
    const parsed = parseSave(JSON.stringify({ settings: { theme: 'neon-orbit' } }));
    expect(parsed.settings.theme).toBe('polar-signal');
  });

  it('sanitises high scores', () => {
    const parsed = parseSave(JSON.stringify({ highScores: { A: -3, B: '12' } }));
    expect(parsed.highScores).toEqual({ A: 0, B: 0 });
    expect(parseSave(JSON.stringify({ highScores: { A: 12.7 } })).highScores.A).toBe(12);
  });
});
