import { ChipEngine } from './engine';
import type { SfxDef } from './sfx';
import { compileSong, songDuration, type Song } from './song';

/** Settings used for renders: nothing muted, buses at full, headroom left for normalisation. */
const RENDER_SETTINGS = { muted: false, master: 1, music: 1, sfx: 1 };

export type OfflineContextFactory = (lengthSec: number, sampleRate: number) => OfflineAudioContext;

export interface RenderOptions {
  sampleRate?: number;
  /** How many times a looping song plays. */
  loops?: number;
  /** Silence added after the last note so releases and decays finish. */
  tailSec?: number;
}

export async function renderSong(
  createContext: OfflineContextFactory,
  song: Song,
  opts: RenderOptions = {},
): Promise<AudioBuffer> {
  const sampleRate = opts.sampleRate ?? 44100;
  const compiled = compileSong(song);
  const loops = compiled.loop ? (opts.loops ?? 1) : 1;
  const musicSec = songDuration(compiled) * loops;
  const ctx = createContext(musicSec + (opts.tailSec ?? 1), sampleRate);
  const engine = new ChipEngine(ctx, RENDER_SETTINGS);
  engine.playSong(compiled, 0);
  engine.schedule(musicSec - 1e-6);
  return ctx.startRendering();
}

export async function renderSfx(
  createContext: OfflineContextFactory,
  def: SfxDef,
  opts: RenderOptions = {},
): Promise<AudioBuffer> {
  const sampleRate = opts.sampleRate ?? 44100;
  const ctx = createContext(def.length + (opts.tailSec ?? 0.3), sampleRate);
  const engine = new ChipEngine(ctx, RENDER_SETTINGS);
  engine.playSfx(def, 0.01);
  return ctx.startRendering();
}

/** Render several effects back to back with a gap, for one listening reel. */
export async function renderSfxReel(
  createContext: OfflineContextFactory,
  defs: readonly SfxDef[],
  gapSec = 0.7,
  sampleRate = 44100,
): Promise<AudioBuffer> {
  let total = 0.05;
  const starts = defs.map((d) => {
    const at = total;
    total += d.length + gapSec;
    return at;
  });
  const ctx = createContext(total, sampleRate);
  const engine = new ChipEngine(ctx, RENDER_SETTINGS);
  defs.forEach((d, i) => {
    engine.playSfx(d, starts[i] ?? 0);
  });
  return ctx.startRendering();
}

/** 16-bit PCM WAV. Peaks are normalised to -1 dBFS so every render sits at the same level. */
export function encodeWav(buffer: AudioBuffer, normalize = true): ArrayBuffer {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let peak = 0;
  if (normalize) {
    for (const ch of data) for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(ch[i] ?? 0));
  }
  const gain = normalize && peak > 0 ? 0.891 / peak : 1;

  const bytes = 44 + frames * channels * 2;
  const out = new ArrayBuffer(bytes);
  const view = new DataView(out);
  const ascii = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, bytes - 8, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, frames * channels * 2, true);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (const ch of data) {
      const v = Math.max(-1, Math.min(1, (ch[i] ?? 0) * gain));
      view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  return out;
}
