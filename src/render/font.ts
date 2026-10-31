/** A 3x5 pixel font for the HUD and menus, drawn as rectangles. */
const GLYPHS: Record<string, readonly string[]> = {
  '0': ['###', '# #', '# #', '# #', '###'],
  '1': [' # ', '## ', ' # ', ' # ', '###'],
  '2': ['###', '  #', '###', '#  ', '###'],
  '3': ['###', '  #', '###', '  #', '###'],
  '4': ['# #', '# #', '###', '  #', '  #'],
  '5': ['###', '#  ', '###', '  #', '###'],
  '6': ['###', '#  ', '###', '# #', '###'],
  '7': ['###', '  #', '  #', '  #', '  #'],
  '8': ['###', '# #', '###', '# #', '###'],
  '9': ['###', '# #', '###', '  #', '###'],
  A: [' # ', '# #', '###', '# #', '# #'],
  B: ['## ', '# #', '## ', '# #', '## '],
  C: ['###', '#  ', '#  ', '#  ', '###'],
  D: ['## ', '# #', '# #', '# #', '## '],
  E: ['###', '#  ', '## ', '#  ', '###'],
  F: ['###', '#  ', '## ', '#  ', '#  '],
  G: ['###', '#  ', '# #', '# #', '###'],
  H: ['# #', '# #', '###', '# #', '# #'],
  I: ['###', ' # ', ' # ', ' # ', '###'],
  J: ['  #', '  #', '  #', '# #', '###'],
  K: ['# #', '# #', '## ', '# #', '# #'],
  L: ['#  ', '#  ', '#  ', '#  ', '###'],
  M: ['# #', '###', '###', '# #', '# #'],
  N: ['## ', '# #', '# #', '# #', '# #'],
  O: ['###', '# #', '# #', '# #', '###'],
  P: ['###', '# #', '###', '#  ', '#  '],
  Q: ['###', '# #', '# #', '###', '  #'],
  R: ['###', '# #', '## ', '# #', '# #'],
  S: ['###', '#  ', '###', '  #', '###'],
  T: ['###', ' # ', ' # ', ' # ', ' # '],
  U: ['# #', '# #', '# #', '# #', '###'],
  V: ['# #', '# #', '# #', '# #', ' # '],
  W: ['# #', '# #', '###', '###', '# #'],
  X: ['# #', '# #', ' # ', '# #', '# #'],
  Y: ['# #', '# #', ' # ', ' # ', ' # '],
  Z: ['###', '  #', ' # ', '#  ', '###'],
  ' ': ['   ', '   ', '   ', '   ', '   '],
  ':': ['   ', ' # ', '   ', ' # ', '   '],
  '.': ['   ', '   ', '   ', '   ', ' # '],
  '-': ['   ', '   ', '###', '   ', '   '],
  '/': ['  #', '  #', ' # ', '#  ', '#  '],
  '<': ['  #', ' # ', '#  ', ' # ', '  #'],
  '>': ['#  ', ' # ', '  #', ' # ', '#  '],
  '!': [' # ', ' # ', ' # ', '   ', ' # '],
  '(': [' # ', '#  ', '#  ', '#  ', ' # '],
  ')': [' # ', '  #', '  #', '  #', ' # '],
  '?': ['###', '  #', ' ##', '   ', ' # '],
};

export const GLYPH_W = 3;
export const GLYPH_H = 5;
export const GLYPH_GAP = 1;

export function textWidth(text: string, scale = 1): number {
  if (text.length === 0) return 0;
  return (text.length * GLYPH_W + (text.length - 1) * GLYPH_GAP) * scale;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
): void {
  ctx.fillStyle = color;
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of text.toUpperCase()) {
    const glyph = GLYPHS[ch] ?? GLYPHS['?'];
    if (glyph) {
      glyph.forEach((row, ry) => {
        for (let rx = 0; rx < GLYPH_W; rx++) {
          if (row[rx] === '#') ctx.fillRect(cx + rx * scale, cy + ry * scale, scale, scale);
        }
      });
    }
    cx += (GLYPH_W + GLYPH_GAP) * scale;
  }
}

export function drawTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  color: string,
  scale = 1,
): void {
  drawText(ctx, text, centerX - textWidth(text, scale) / 2, y, color, scale);
}
