import type { AudioSettings } from './types';

const RAMP = 0.02;

/** Short exponential glide to `target`, pinned at the current value so the curve is continuous. */
function ramp(param: AudioParam, target: number, t: number): void {
  param.cancelScheduledValues(t);
  param.setValueAtTime(param.value, t);
  param.setTargetAtTime(target, t, RAMP);
}

/** Master → destination, with separate music and SFX buses feeding it. */
export class Mixer {
  readonly master: GainNode;
  readonly music: GainNode;
  readonly sfx: GainNode;

  constructor(private readonly ctx: BaseAudioContext, settings: AudioSettings) {
    this.master = ctx.createGain();
    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.master.connect(ctx.destination);
    this.master.gain.value = settings.muted ? 0 : settings.master;
    this.music.gain.value = settings.music;
    this.sfx.gain.value = settings.sfx;
  }

  apply(settings: AudioSettings): void {
    const t = this.ctx.currentTime;
    ramp(this.master.gain, settings.muted ? 0 : settings.master, t);
    ramp(this.music.gain, settings.music, t);
    ramp(this.sfx.gain, settings.sfx, t);
  }
}
