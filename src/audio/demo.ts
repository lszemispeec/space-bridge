/**
 * Debug page for auditioning every track and effect. Served by Vite at
 * `/audio-demo.html`; not part of the game bundle.
 */
import { audio } from './index';
import { encodeWav, renderSfxReel, renderSong } from './render';
import { SFX } from './sfx';
import { JINGLE_SONGS, THEME_SONGS } from './songs/index';
import { AUDIO_EVENTS, JINGLES, type AudioEvent, type JingleId, type ThemeId } from './types';

const THEMES = Object.keys(THEME_SONGS) as ThemeId[];

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
};
const logEl = $('log');
const stateEl = $('state');

function log(line: string): void {
  logEl.textContent = `${new Date().toISOString().slice(11, 23)}  ${line}\n${logEl.textContent}`;
}

function button(parent: HTMLElement, label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', onClick);
  parent.appendChild(b);
  return b;
}

function slider(parent: HTMLElement, label: string, value: number, onInput: (v: number) => void): void {
  const wrap = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '1';
  input.step = '0.01';
  input.value = String(value);
  input.addEventListener('input', () => { onInput(Number(input.value)); });
  wrap.append(label, input);
  parent.appendChild(wrap);
}

audio.init();

const sfxKeys: Record<string, AudioEvent> = {};
AUDIO_EVENTS.forEach((ev, i) => {
  sfxKeys[String(i + 1)] = ev;
  button($('sfx'), `${i + 1} ${ev}`, () => { play(ev); });
});

const themeButtons = new Map<ThemeId, HTMLButtonElement>();
const themeKeys: Record<string, ThemeId> = { q: 'polar-signal', w: 'desert-expedition', e: 'neon-orbit' };
THEMES.forEach((theme, i) => {
  themeButtons.set(theme, button($('music'), `${'QWE'[i]} ${THEME_SONGS[theme].name}`, () => { music(theme); }));
});
JINGLES.forEach((id) => button($('music'), `G jingle: ${JINGLE_SONGS[id].name}`, () => { jingle(id); }));
button($('music'), 'S stop', () => { music(null); });

const tempoWrap = document.createElement('label');
const tempo = document.createElement('input');
tempo.type = 'range';
tempo.min = '0.5';
tempo.max = '2';
tempo.step = '0.05';
tempo.value = '1';
tempo.addEventListener('input', () => {
  audio.setTempo(Number(tempo.value));
  log(`tempo ×${tempo.value}`);
});
tempoWrap.append('tempo', tempo);
$('music').appendChild(tempoWrap);

const muteBtn = button($('mixer'), 'M mute', () => { toggleMute(); });
const s = audio.getSettings();
slider($('mixer'), 'master', s.master, (v) => { audio.setVolume('master', v); });
slider($('mixer'), 'music', s.music, (v) => { audio.setVolume('music', v); });
slider($('mixer'), 'sfx', s.sfx, (v) => { audio.setVolume('sfx', v); });
audio.onSettings((st) => muteBtn.classList.toggle('on', st.muted));
muteBtn.classList.toggle('on', s.muted);

const offline = (lengthSec: number, sampleRate: number): OfflineAudioContext =>
  new OfflineAudioContext(1, Math.ceil(lengthSec * sampleRate), sampleRate);

function download(name: string, buffer: AudioBuffer): void {
  const blob = new Blob([encodeWav(buffer)], { type: 'audio/wav' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.wav`;
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); }, 1000);
  log(`rendered ${name}.wav (${buffer.duration.toFixed(1)} s)`);
}

for (const theme of THEMES) {
  button($('render'), `WAV ${THEME_SONGS[theme].name}`, () => {
    void renderSong(offline, THEME_SONGS[theme], { loops: 1 }).then((b) => { download(`music-${theme}`, b); });
  });
}
button($('render'), 'WAV jingle', () => {
  void renderSong(offline, JINGLE_SONGS.gameOver, { tailSec: 1.5 }).then((b) => { download('jingle-gameOver', b); });
});
button($('render'), 'WAV sfx reel', () => {
  void renderSfxReel(offline, AUDIO_EVENTS.map((e) => SFX[e])).then((b) => { download('sfx-reel', b); });
});

function play(ev: AudioEvent): void {
  audio.play(ev);
  log(`sfx ${ev}`);
}

function music(theme: ThemeId | null): void {
  audio.music(theme);
  for (const [t, b] of themeButtons) b.classList.toggle('on', t === theme);
  log(theme ? `music ${THEME_SONGS[theme].name}` : 'music stop');
}

function jingle(id: JingleId): void {
  audio.jingle(id);
  for (const b of themeButtons.values()) b.classList.remove('on');
  log(`jingle ${id}`);
}

function toggleMute(): void {
  log(audio.toggleMuted() ? 'muted' : 'unmuted');
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  const sfx = sfxKeys[k];
  const theme = themeKeys[k];
  if (sfx) play(sfx);
  else if (theme) music(theme);
  else if (k === 'g') jingle('gameOver');
  else if (k === 'm') toggleMute();
  else if (k === 's') music(null);
});

const refreshState = (): void => {
  stateEl.textContent = audio.ready ? 'running' : 'locked — press any key or tap';
};
window.addEventListener('pointerdown', () => setTimeout(refreshState, 50), { passive: true });
window.addEventListener('keydown', () => setTimeout(refreshState, 50));
refreshState();
