/**
 * Render every music track and sound effect to WAV (and MP3 when ffmpeg is on
 * the PATH) using the real engine on an offline context.
 *
 *   npm run audio:render            → renders/*.wav + renders/*.mp3
 *   (sfx-fall-step is the miss as the player hears it: fall, grab, then life_lost)
 *   npm run audio:render -- --loops 1
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OfflineAudioContext } from 'node-web-audio-api';
import { encodeWav, renderSfx, renderSfxReel, renderSfxStep, renderSong } from '../src/audio/render';
import { SFX } from '../src/audio/sfx';
import { JINGLE_SONGS, THEME_SONGS } from '../src/audio/songs/index';
import { AUDIO_EVENTS } from '../src/audio/types';

const OUT = join(process.cwd(), 'renders');
const loopsArg = process.argv.indexOf('--loops');
const LOOPS = loopsArg > 0 ? Number(process.argv[loopsArg + 1]) : 2;
const SAMPLE_RATE = 44100;

const createContext = (lengthSec: number, sampleRate: number): OfflineAudioContext =>
  new OfflineAudioContext(1, Math.ceil(lengthSec * sampleRate), sampleRate);

function hasFfmpeg(): boolean {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function save(name: string, buffer: AudioBuffer, mp3: boolean): void {
  const wav = join(OUT, `${name}.wav`);
  writeFileSync(wav, Buffer.from(encodeWav(buffer)));
  let line = `${name}.wav  ${buffer.duration.toFixed(1)}s`;
  if (mp3) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-q:a', '3', join(OUT, `${name}.mp3`)]);
    line += '  + mp3';
  }
  console.log(line);
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const mp3 = hasFfmpeg();
  if (!mp3) console.log('ffmpeg not found: writing WAV only');

  for (const [id, song] of Object.entries(THEME_SONGS)) {
    save(`music-${id}`, await renderSong(createContext, song, { loops: LOOPS, sampleRate: SAMPLE_RATE }), mp3);
  }
  for (const [id, song] of Object.entries(JINGLE_SONGS)) {
    save(`jingle-${id}`, await renderSong(createContext, song, { sampleRate: SAMPLE_RATE, tailSec: 1.5 }), mp3);
  }
  for (const ev of AUDIO_EVENTS) {
    save(`sfx-${ev}`, await renderSfx(createContext, SFX[ev], { sampleRate: SAMPLE_RATE }), mp3);
  }
  save('sfx-reel', await renderSfxReel(createContext, AUDIO_EVENTS.map((e) => SFX[e]), 0.7, SAMPLE_RATE), mp3);
  save('sfx-fall-step', await renderSfxStep(createContext, [SFX.fall, SFX.grab, SFX.life_lost], { sampleRate: SAMPLE_RATE }), mp3);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
