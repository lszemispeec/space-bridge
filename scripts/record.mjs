/**
 * A short play recording with sound, from a built preview, in headless Chrome.
 *
 *   npm run build && npm run preview -- --port 4173 &
 *   npm run record       # or: node scripts/record.mjs http://localhost:4173/ shots/space-bridge.webm [A|B]
 *
 * Needs Google Chrome and, for the MP4 copy, ffmpeg on the PATH. Drives Chrome
 * over the DevTools protocol with Node's built-in WebSocket. The page records
 * itself: a hidden 4x canvas mirrors the game canvas (nearest neighbour), and
 * the game's AudioContext is tapped before the engine connects to it, so the
 * MediaRecorder gets the same mix the speakers would.
 *
 * The clip, 16-19.5 s: the title screen in Polar Signal, then a Game A round
 * (or Game B with the third argument) with a bot on the plate. Near the end
 * the bot stops, so one cosmonaut falls into a crater, and the clip ends on
 * the life-lost pause.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const [url = 'http://localhost:4173/', outFile = 'shots/space-bridge.webm', mode = 'A'] = process.argv.slice(2);
if (mode !== 'A' && mode !== 'B') throw new Error(`Mode must be A or B, not ${mode}`);
const THEMES = ['polar-signal', 'desert-expedition', 'neon-orbit'];
const CHROME =
  process.env.CHROME ??
  (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const PORT = 9334;
/** The 352x320 operator room at 4x; the mirror canvas records it at the same size. */
const WIDTH = 1408;
const HEIGHT = 1280;
const SCALE = 4;
/** Title screen time after the music starts. */
const TITLE_MS = 1_500;
/** How long the bot plays before it lets a cosmonaut fall. */
const PLAY_MS = 11_500;
/** Longest wait for the fall after the bot stops. */
const FALL_MAX_MS = 4_500;
/** Time after the fall, stretched or cut so the clip stays within the bounds. */
const OUTRO_MS = 2_000;
const CLIP_MIN_MS = 16_000;
const CLIP_MAX_MS = 19_500;

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--hide-scrollbars',
    '--no-first-run',
    '--autoplay-policy=no-user-gesture-required',
    `--window-size=${WIDTH},${HEIGHT}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (text) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${text}`);

async function waitForChrome() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  throw new Error('Chrome did not start');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.method === 'Inspector.targetCrashed') throw new Error('The page crashed');
    if (msg.method === 'Runtime.exceptionThrown') console.error('page exception:', JSON.stringify(msg.params.exceptionDetails));
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const open = new Promise((resolve) => ws.addEventListener('open', resolve));
  return { send, open, close: () => ws.close() };
}

const SAVE_KEY = 'space-bridge.save.v1';

/** Saved state plus the audio tap. Runs before the game script. */
function bootstrap(theme) {
  const save = {
    version: 1,
    highScores: { A: 0, B: 0 },
    unlocked: THEMES,
    settings: { theme, muted: false, mode },
  };
  return `
    localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(JSON.stringify(save))});
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(...args) {
        super(...args);
        const speakers = this.destination;
        const tap = this.createGain();
        const capture = this.createMediaStreamDestination();
        tap.connect(speakers);
        tap.connect(capture);
        Object.defineProperty(this, 'destination', { value: tap });
        window.__audioStream = capture.stream;
      }
    };
  `;
}

const START_RECORDING = `(() => {
  const game = document.getElementById('game');
  const mirror = document.createElement('canvas');
  mirror.width = game.width * ${SCALE};
  mirror.height = game.height * ${SCALE};
  const ctx = mirror.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const copy = () => {
    ctx.drawImage(game, 0, 0, mirror.width, mirror.height);
    if (window.__recording) requestAnimationFrame(copy);
  };
  window.__recording = true;
  copy();
  const stream = mirror.captureStream(30);
  const audio = window.__audioStream;
  if (!audio) throw new Error('No audio stream: the AudioContext was not created yet');
  for (const track of audio.getAudioTracks()) stream.addTrack(track);
  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 4_000_000 });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  window.__stopRecording = () => new Promise((resolve, reject) => {
    recorder.onstop = () => {
      window.__recording = false;
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' }));
    };
    recorder.stop();
  });
  recorder.start(500);
  return { tracks: stream.getTracks().map((t) => t.kind), state: recorder.state };
})()`;

/** Keeps the plate under the next landing while window.__follow is true. */
const BOT = `(() => {
  const key = (code) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
  };
  const app = window.spaceBridge;
  if (!app) throw new Error('window.spaceBridge is not ready');
  window.__follow = true;
  const tick = () => {
    const s = app.getState();
    if (s.phase === 'playing' && window.__follow) {
      const flying = s.cosmonauts
        .filter((c) => c.state === 'air' && c.slot <= 3)
        .sort((a, b) => (a.duration - a.t) - (b.duration - b.t))[0];
      if (flying && flying.slot + 1 !== s.plateSlot) key(flying.slot + 1 < s.plateSlot ? 'ArrowLeft' : 'ArrowRight');
    }
    if (s.phase !== 'game_over') requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return true;
})()`;

/** Resolves with the score at the next life lost, or -1 if none comes in time. */
const WAIT_LIFE_LOST = `new Promise((resolve) => {
  const app = window.spaceBridge;
  const off = app.onEvent((event, state) => {
    if (event.type === 'life_lost') { off(); resolve(state.score); }
  });
  setTimeout(() => { off(); resolve(-1); }, ${FALL_MAX_MS});
})`;

const KEYS = {
  KeyT: { key: 't', code: 'KeyT', windowsVirtualKeyCode: 84 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
};

async function press(cdp, name) {
  const k = KEYS[name];
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...k });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...k });
}

async function evaluate(cdp, expression, awaitPromise = false) {
  const res = await cdp.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.text + ' ' + JSON.stringify(res.exceptionDetails.exception));
  }
  return res.result.value;
}

async function record() {
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const cdp = connect(target.webSocketDebuggerUrl);
  await cdp.open;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Inspector.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  // The save starts on the last theme, so the first gesture cycles to the first.
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: bootstrap(THEMES[THEMES.length - 1]) });
  await cdp.send('Page.navigate', { url });
  await sleep(2000);

  // First gesture: creates the AudioContext, starts the music, cycles to Polar Signal.
  await press(cdp, 'KeyT');
  await sleep(400);
  const started = await evaluate(cdp, START_RECORDING);
  const recordingSince = Date.now();
  log(`recording: tracks ${started.tracks.join('+')}, ${started.state}`);
  await sleep(TITLE_MS);

  // Left starts Game A, right starts Game B.
  await press(cdp, mode === 'A' ? 'ArrowLeft' : 'ArrowRight');
  await evaluate(cdp, BOT);
  log(`game ${mode} started, phase ${await evaluate(cdp, 'window.spaceBridge.getState().phase')}`);
  await sleep(PLAY_MS);
  await evaluate(cdp, 'window.__follow = false');
  log('bot stopped');
  const score = await evaluate(cdp, WAIT_LIFE_LOST, true);
  log(score < 0 ? 'no fall in time; the clip ends here' : `life lost at score ${score}`);
  const elapsed = Date.now() - recordingSince;
  await sleep(Math.max(0, Math.min(Math.max(OUTRO_MS, CLIP_MIN_MS - elapsed), CLIP_MAX_MS - elapsed)));

  const data = await evaluate(cdp, 'window.__stopRecording()', true);
  log('recording stopped');
  await writeFile(outFile, Buffer.from(data, 'base64'));
  console.log(outFile);
  cdp.close();
  await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
}

function toMp4(webm) {
  const mp4 = webm.replace(/\.webm$/, '') + '.mp4';
  const result = spawnSync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', mp4],
    { stdio: 'inherit' },
  );
  if (result.error || result.status !== 0) {
    console.log('ffmpeg not available or failed; keeping the WebM only');
    return;
  }
  console.log(mp4);
}

const watchdog = setTimeout(() => {
  console.error('Gave up after 180 s');
  chrome.kill();
  process.exit(2);
}, 180_000);

try {
  await mkdir(dirname(outFile), { recursive: true });
  await waitForChrome();
  await record();
  toMp4(outFile);
} finally {
  clearTimeout(watchdog);
  chrome.kill();
}
