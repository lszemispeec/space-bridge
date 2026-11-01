import { describe, expect, it } from 'vitest';
import { availableShaderPresets, DEFAULT_SHADER, getShaderPreset, isShaderPresetId, needsShader, SHADER_PRESETS } from './display';

describe('display presets', () => {
  it('offers Off, CRT, CRT + Glow, Full and Vector, with Off as the default', () => {
    expect(SHADER_PRESETS.map((p) => p.id)).toEqual(['off', 'crt', 'crt-glow', 'full', 'vector']);
    expect(DEFAULT_SHADER).toBe('off');
    expect(needsShader('off')).toBe(false);
    for (const id of ['crt', 'crt-glow', 'full', 'vector'] as const) expect(needsShader(id)).toBe(true);
  });

  it('makes Vector a green phosphor tube: the CRT GLOW bloom, a longer afterglow than Full, no mask or fringe, hardly any scanlines or curve', () => {
    const vector = getShaderPreset('vector').params;
    const full = getShaderPreset('full').params;
    const glow = getShaderPreset('crt-glow').params;
    // More glow than CRT GLOW turns an airborne 1 px wireframe cosmonaut into a blob (DEIM-452).
    expect(vector.glow).toBe(glow.glow);
    expect(vector.persistence).toBeGreaterThan(full.persistence);
    // More than 0.6 smears half a hop behind the cosmonaut (DEIM-452).
    expect(vector.persistence).toBeLessThanOrEqual(0.6);
    expect(vector.mask).toBe(0);
    expect(vector.aberration).toBe(0);
    expect(vector.scanlines).toBeLessThanOrEqual(0.05);
    expect(vector.curvature).toBeLessThanOrEqual(0.01);
  });

  it('keeps Vector out of the menu until its theme is unlocked', () => {
    const ids = (unlocked: Parameters<typeof availableShaderPresets>[0]) => availableShaderPresets(unlocked).map((p) => p.id);
    expect(ids(['polar-signal'])).toEqual(['off', 'crt', 'crt-glow', 'full']);
    expect(ids(['polar-signal', 'desert-expedition', 'neon-orbit'])).toEqual(['off', 'crt', 'crt-glow', 'full']);
    expect(ids(['polar-signal', 'vector'])).toEqual(['off', 'crt', 'crt-glow', 'full', 'vector']);
    expect(SHADER_PRESETS.filter((p) => p.theme).map((p) => p.id)).toEqual(['vector']);
  });

  it('keeps Off flat, so the output is the renderer\'s own pixels', () => {
    expect(Object.values(getShaderPreset('off').params).every((v) => v === 0)).toBe(true);
  });

  it('adds effects preset by preset', () => {
    const crt = getShaderPreset('crt').params;
    const glow = getShaderPreset('crt-glow').params;
    const full = getShaderPreset('full').params;
    expect(crt.scanlines).toBeGreaterThan(0);
    expect(crt.curvature).toBeGreaterThan(0);
    expect(crt.vignette).toBeGreaterThan(0);
    expect([crt.glow, crt.aberration, crt.mask, crt.persistence]).toEqual([0, 0, 0, 0]);
    expect(glow).toMatchObject({ scanlines: crt.scanlines, curvature: crt.curvature, vignette: crt.vignette, mask: 0, persistence: 0 });
    expect(glow.glow).toBeGreaterThan(0);
    expect(glow.aberration).toBeGreaterThan(0);
    expect(full).toMatchObject({ glow: glow.glow, aberration: glow.aberration });
    expect(full.mask).toBeGreaterThan(0);
    expect(full.persistence).toBeGreaterThan(0);
    expect(full.persistence).toBeLessThan(1);
  });

  it('names presets in the bitmap font\'s character set and validates ids', () => {
    for (const p of SHADER_PRESETS) expect(p.name).toMatch(/^[A-Z0-9 ]+$/);
    expect(isShaderPresetId('crt')).toBe(true);
    expect(isShaderPresetId('plasma')).toBe(false);
    expect(() => getShaderPreset('plasma' as 'crt')).toThrow();
  });
});
