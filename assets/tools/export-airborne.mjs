/** Export hand-drawn native ink maps. Requires Node and ImageMagick. */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const source = JSON.parse(fs.readFileSync(path.join(root, 'assets/airborne-pixels.json')));
const json = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const blank = (w, h, color = [0, 0, 0, 0]) => ({ w, h, data: Buffer.from(Array(w * h).fill(color).flat()) });
function pixel(im, x, y, color) { im.data.set(color, (y * im.w + x) * 4); }
function read(file) {
  const [w, h] = execFileSync('magick', ['identify', '-format', '%w %h', file]).toString().split(' ').map(Number);
  return { w, h, data: execFileSync('magick', [file, '-depth', '8', 'RGBA:-'], { maxBuffer: 128e6 }) };
}
function save(im, file, scale = 1) {
  execFileSync('magick', ['-size', `${im.w}x${im.h}`, '-depth', '8', 'RGBA:-', '-scale', `${scale * 100}%`, '-define', 'png:color-type=6', file], { input: im.data, maxBuffer: 128e6 });
}
function blit(dst, src, x, y) {
  for (let yy = 0; yy < src.h; yy++) for (let xx = 0; xx < src.w; xx++) {
    const offset = (yy * src.w + xx) * 4;
    if (src.data[offset + 3]) pixel(dst, x + xx, y + yy, src.data.subarray(offset, offset + 4));
  }
}
function crop(im, x, y, w, h) {
  const out = blank(w, h);
  for (let yy = 0; yy < h; yy++) im.data.copy(out.data, yy * w * 4, ((y + yy) * im.w + x) * 4, ((y + yy) * im.w + x + w) * 4);
  return out;
}
for (const [theme, indices] of Object.entries(source.themeIndices)) {
  const dir = path.join(root, 'assets', theme), previews = path.join(dir, 'previews');
  const atlas = JSON.parse(fs.readFileSync(path.join(dir, `${theme}.json`)));
  const palette = atlas.meta.palette.map(hex => [...Buffer.from(hex.slice(1), 'hex'), 255]);
  const original = read(path.join(dir, `${theme}.png`));
  const oldFrames = Object.entries(atlas.frames).filter(([name]) => !name.startsWith('cosmonaut.air.'));
  const baseHeight = Math.max(...oldFrames.map(([, f]) => f.y + f.h)) + 1;
  const sheet = blank(original.w, baseHeight + 24);
  blit(sheet, crop(original, 0, 0, original.w, baseHeight), 0, 0);
  const images = source.frames.map(({ name, rows }, index) => {
    if (rows.length !== 22 || rows.some(row => row.length !== 20)) throw Error(`Invalid map: ${name}`);
    const im = blank(20, 22);
    // Outline is one native pixel around the authored ink. No rotation/mirroring.
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === '.') return;
      if (x < 1 || x > 18 || y < 1 || y > 20) throw Error(`Contour margin: ${name}`);
      for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) pixel(im, x + dx, y + dy, palette[0]);
    }));
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c !== '.') {
        if (!(c in indices)) throw Error(`Unknown ink ${c}: ${name}`);
        pixel(im, x, y, palette[indices[c]]);
      }
    }));
    atlas.frames[name] = { x: 1 + index * 22, y: baseHeight + 1, w: 20, h: 22, ax: 10, ay: 11, duration: 80 };
    blit(sheet, im, 1 + index * 22, baseHeight + 1);
    return im;
  });
  const strips = JSON.parse(fs.readFileSync(path.join(previews, 'strips.json'))).filter(s => !s.animation.startsWith('cosmonaut.air.'));
  for (const [kind, start, count] of [['spin', 0, 8], ['flail', 8, 2]]) {
    const animation = `cosmonaut.air.${kind}`;
    atlas.animations[animation] = { frames: source.frames.slice(start, start + count).map(f => f.name), loop: true };
    const strip = blank(20 * count, 22);
    images.slice(start, start + count).forEach((im, i) => blit(strip, im, i * 20, 0));
    save(strip, path.join(previews, `${animation}-strip.png`));
    save(strip, path.join(previews, `${animation}-strip-4x.png`), 4);
    strips.push({ animation, file: `${animation}-strip.png`, loop: true, durations: Array(count).fill(80) });
    const args = ['-delay', '8', '-dispose', 'background'];
    const temp = path.join(root, '.scratch', theme);
    fs.mkdirSync(temp, { recursive: true });
    images.slice(start, start + count).forEach((im, i) => {
      const file = path.join(temp, `${kind}-${i}.png`); save(im, file, 4); args.push(file);
    });
    execFileSync('magick', [...args, '-loop', '0', path.join(previews, `${animation}-4x.gif`)]);
  }
  atlas.meta.size = { w: sheet.w, h: sheet.h };
  save(sheet, path.join(dir, `${theme}.png`)); json(path.join(dir, `${theme}.json`), atlas);
  json(path.join(previews, 'strips.json'), strips);
  for (const ext of ['png', 'json']) fs.copyFileSync(path.join(dir, `${theme}.${ext}`), path.join(root, 'public/atlas', `${theme}.${ext}`));
  const contactIndex = []; let x = 2, y = 2, rowHeight = 0;
  for (const [name, f] of Object.entries(atlas.frames)) {
    if (x + f.w + 2 > 640) { x = 2; y += rowHeight + 4; rowHeight = 0; }
    contactIndex.push({ name, x, y, w: f.w, h: f.h });
    x += f.w + 4; rowHeight = Math.max(rowHeight, f.h);
  }
  const contact = blank(640, y + rowHeight + 2, palette[0]);
  for (const c of contactIndex) { const f = atlas.frames[c.name]; blit(contact, crop(sheet, f.x, f.y, f.w, f.h), c.x, c.y); }
  json(path.join(previews, 'frame-index.json'), contactIndex);
  save(contact, path.join(previews, 'frames-1x.png')); save(contact, path.join(previews, 'frames-4x.png'), 4);
  // High-flight contrast study only. It does not simulate flight or a scheduler.
  const scene = read(path.join(previews, 'screen-1x.png'));
  const bg = atlas.frames.background;
  blit(scene, crop(sheet, bg.x + 136, bg.y + 127, 20, 22), 136, 127);
  [[0,106,75],[3,146,90],[6,186,65],[8,226,110]].forEach(([i,cx,cy]) => blit(scene, images[i], cx-10, cy-11));
  save(scene, path.join(previews, 'airborne-contrast-1x.png')); save(scene, path.join(previews, 'airborne-contrast-4x.png'), 4);
  json(path.join(dir, 'revision-4.json'), {
    source: '../airborne-pixels.json', oldSize: [original.w, baseHeight], newSize: [sheet.w, sheet.h],
    addedFrames: source.frames.map(f => ({ name: f.name, ...atlas.frames[f.name] })),
    preserved: 'All prior frame pixels, rectangles, anchors, durations and animation sequences.',
    spinOrder: 'Clockwise, upright at 0, eight independent 45-degree keys. Reverse for counter-clockwise.',
  });
}
const reportPath = path.join(root, 'assets/export-report.json');
const report = JSON.parse(fs.readFileSync(reportPath)); report.revision = 4;
for (const t of Object.values(report.themes)) Object.assign(t, { frames: 81, animations: 41, size: [1024,1494], airCell: [20,22], airAnchor: [10,11] });
json(reportPath, report);
