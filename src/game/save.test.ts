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
    save.settings = { theme: 'desert-expedition', muted: true, mode: 'B', music: 0.3, sfx: 0.8, shader: 'crt-glow' };
    expect(parseSave(serializeSave(save))).toEqual(save);
  });

  it('gives a save from before the menu existed the default volumes and display', () => {
    const old = JSON.stringify({ version: 1, highScores: { A: 12, B: 0 }, unlocked: ['polar-signal'], settings: { theme: 'polar-signal', muted: true, mode: 'A' } });
    const parsed = parseSave(old);
    expect(parsed.highScores.A).toBe(12);
    expect(parsed.settings).toMatchObject({ muted: true, music: 0.6, sfx: 1, shader: 'off' });
  });

  it('clamps the volumes and refuses an unknown display preset', () => {
    const parsed = parseSave(JSON.stringify({ settings: { music: 7, sfx: -1, shader: 'plasma' } }));
    expect(parsed.settings).toMatchObject({ music: 1, sfx: 0, shader: 'off' });
    expect(parseSave(JSON.stringify({ settings: { music: 'loud' } })).settings.music).toBe(0.6);
  });

  it('refuses the Vector preset until its theme is unlocked', () => {
    expect(parseSave(JSON.stringify({ settings: { shader: 'vector' } })).settings.shader).toBe('off');
    expect(parseSave(JSON.stringify({ unlocked: ['vector'], settings: { shader: 'vector' } })).settings.shader).toBe('vector');
  });

  it('keeps the record of the one-time display switches, known themes only', () => {
    expect(parseSave(JSON.stringify({ unlocked: ['vector'] })).displaySwitched).toEqual([]);
    expect(parseSave(JSON.stringify({ displaySwitched: ['vector', 'bogus', 'vector'] })).displaySwitched).toEqual(['vector']);
    const save = defaultSave();
    save.unlocked = ['polar-signal', 'vector'];
    save.displaySwitched = ['vector'];
    save.settings.theme = 'vector';
    save.settings.shader = 'vector';
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
