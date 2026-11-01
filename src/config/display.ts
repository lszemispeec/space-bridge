/**
 * Display presets: the optional CRT post-process over the final frame. Each
 * preset is a set of shader parameters, so a new look is a new entry here,
 * not a new code branch. `off` is the plain crisp output; the shader pass
 * is skipped altogether and the pixels are the renderer's own.
 */
import type { ThemeId } from './themes';

export type ShaderPresetId = 'off' | 'crt' | 'crt-glow' | 'full' | 'vector';

export interface ShaderParams {
  /** Darkness of the line between two source rows, 0..1. */
  scanlines: number;
  /** Barrel distortion of the screen, 0 flat. 0.03 is a slight curve. */
  curvature: number;
  /** Darkening towards the corners, 0..1. */
  vignette: number;
  /** Bloom around bright pixels, 0..1. Scales the glow of the source shader. */
  glow: number;
  /** Chromatic aberration: horizontal split of the red and blue channels, in source pixels. */
  aberration: number;
  /** Strength of the dot-matrix mask, 0..1. */
  mask: number;
  /** Phosphor persistence: the share of the previous frame that survives into the next, 0..1. */
  persistence: number;
}

export interface ShaderPreset {
  id: ShaderPresetId;
  /** Label in the menu, in the bitmap font's character set. */
  name: string;
  params: ShaderParams;
  /** When set, the preset is in the menu only after this theme is unlocked. */
  theme?: ThemeId;
}

const FLAT: ShaderParams = { scanlines: 0, curvature: 0, vignette: 0, glow: 0, aberration: 0, mask: 0, persistence: 0 };

export const SHADER_PRESETS: readonly ShaderPreset[] = [
  { id: 'off', name: 'OFF', params: FLAT },
  { id: 'crt', name: 'CRT', params: { ...FLAT, scanlines: 0.25, curvature: 0.03, vignette: 0.3 } },
  { id: 'crt-glow', name: 'CRT GLOW', params: { ...FLAT, scanlines: 0.25, curvature: 0.03, vignette: 0.3, glow: 1, aberration: 0.35 } },
  { id: 'full', name: 'FULL', params: { scanlines: 0.25, curvature: 0.03, vignette: 0.3, glow: 1, aberration: 0.35, mask: 0.3, persistence: 0.55 } },
  // Green phosphor vector monitor: a flat tube with the CRT GLOW bloom (more turns a 1 px wireframe into a blob)
  // and an afterglow of about 5 frames, no mask, no colour fringe.
  { id: 'vector', name: 'VECTOR', params: { ...FLAT, curvature: 0.01, vignette: 0.2, glow: 1, persistence: 0.6 }, theme: 'vector' },
];

export const DEFAULT_SHADER: ShaderPresetId = 'off';

export function isShaderPresetId(value: unknown): value is ShaderPresetId {
  return typeof value === 'string' && SHADER_PRESETS.some((p) => p.id === value);
}

export function getShaderPreset(id: ShaderPresetId): ShaderPreset {
  const preset = SHADER_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown shader preset: ${id}`);
  return preset;
}

/** The presets the menu offers with these themes unlocked, in config order. */
export function availableShaderPresets(unlocked: readonly ThemeId[]): ShaderPreset[] {
  return SHADER_PRESETS.filter((p) => !p.theme || unlocked.includes(p.theme));
}

/** True when the preset needs the shader pass at all. */
export function needsShader(id: ShaderPresetId): boolean {
  return id !== 'off';
}
