/**
 * Screenshots of every theme, title and play, at 4x, from a built preview,
 * plus the title and play on a portrait and a landscape phone.
 *
 *   npm run build && npm run preview -- --port 4173 &
 *   npm run shots        # or: node scripts/screenshot.mjs http://localhost:4173/ shots
 *
 * Needs Google Chrome. Drives it over the DevTools protocol with Node's
 * built-in WebSocket, so there is nothing to install. A tiny in-page bot
 * keeps the plate under the cosmonauts; the capture waits for a cosmonaut
 * near the top of a jump over the craters.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [url = 'http://localhost:4173/', outDir = 'shots'] = process.argv.slice(2);
const THEMES = ['polar-signal', 'desert-expedition', 'neon-orbit'];
const CHROME =
  process.env.CHROME ??
  (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const PORT = 9333;
/** The 352x320 operator room at 4x. */
const WIDTH = 1408;
const HEIGHT = 1280;
const DESKTOP = { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false };
/** A 390x844 phone at 3x: 4x in both orientations since the portrait layout. */
const PHONES = {
  'phone-portrait': { width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
  'phone-landscape': { width: 844, height: 390, deviceScaleFactor: 3, mobile: true },
};

const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${PORT}`, '--headless=new', '--hide-scrollbars', '--no-first-run', `--window-size=${WIDTH},${HEIGHT}`, 'about:blank'],
  { stdio: 'ignore' },
);

async function waitForChrome() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Chrome did not start');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      events.push(msg);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const open = new Promise((resolve) => ws.addEventListener('open', resolve));
  return { send, open, close: () => ws.close(), events };
}

const SAVE_KEY = 'space-bridge.save.v1';

function bootstrap(theme) {
  const save = {
    version: 1,
    highScores: { A: 0, B: 0 },
    unlocked: THEMES,
    settings: { theme, muted: false, mode: 'A' },
  };
  return `localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(JSON.stringify(save))});`;
}

/** Starts Game A, follows the cosmonauts, resolves near the apex of a jump over a crater. */
const PLAY = `new Promise((resolve, reject) => {
  const key = (code) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
  };
  const app = window.spaceBridge;
  if (!app) return reject(new Error('window.spaceBridge is not ready'));
  const started = performance.now();
  key('ArrowLeft');
  const tick = () => {
    try {
      const s = app.getState();
      const elapsed = performance.now() - started;
      if (s.phase === 'playing') {
        const flying = s.cosmonauts.find((c) => c.state === 'air' && c.slot <= 3);
        if (flying && flying.slot + 1 !== s.plateSlot) key(flying.slot + 1 < s.plateSlot ? 'ArrowLeft' : 'ArrowRight');
        const p = flying ? flying.t / flying.duration : 0;
        if (flying && flying.slot >= 1 && elapsed > 6000 && p > 0.4 && p < 0.6) return resolve(s.score);
      }
      if (elapsed > 20000) return resolve(-1);
      requestAnimationFrame(tick);
    } catch (error) {
      reject(error);
    }
  };
  requestAnimationFrame(tick);
})`;

async function capture(cdp, file, note = '') {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(file, Buffer.from(shot.data, 'base64'));
  console.log(note ? `${file} (${note})` : file);
}

async function shoot(theme, device = DESKTOP, name = `${theme}-{shot}-4x`) {
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const cdp = connect(target.webSocketDebuggerUrl);
  await cdp.open;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', device);
  if (device.mobile) await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: bootstrap(theme) });
  await cdp.send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 2000));
  await capture(cdp, join(outDir, `${name.replace('{shot}', 'title')}.png`));
  const score = await cdp.send('Runtime.evaluate', { expression: PLAY, awaitPromise: true, returnByValue: true });
  if (score.exceptionDetails) throw new Error(score.exceptionDetails.text + ' ' + JSON.stringify(score.exceptionDetails.exception));
  await capture(cdp, join(outDir, `${name.replace('{shot}', 'play')}.png`), `score ${score.result.value}`);
  cdp.close();
  await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
}

const watchdog = setTimeout(() => {
  console.error('Gave up after 120 s');
  chrome.kill();
  process.exit(2);
}, 120_000);

try {
  await mkdir(outDir, { recursive: true });
  await waitForChrome();
  for (const theme of THEMES) await shoot(theme);
  for (const [name, device] of Object.entries(PHONES)) await shoot(THEMES[0], device, `${name}-{shot}`);
} finally {
  clearTimeout(watchdog);
  chrome.kill();
}
