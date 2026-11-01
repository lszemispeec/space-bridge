/** Native-pixel quarter circles; pixel centres decide coverage, with no antialiasing. */
export const WINDOW_CORNER_RADIUS = 20;

export function roundViewport(im, scene, palette, metal) {
  const { dx, dy, w, h } = scene;
  const dot = (x, y, ink) => im.data.set(ink, (y * im.w + x) * 4);
  const inside = (x, y, inset) => {
    const radius = WINDOW_CORNER_RADIUS + inset;
    const left = dx - inset, top = dy - inset;
    const right = dx + w + inset, bottom = dy + h + inset;
    if (x < left || x >= right || y < top || y >= bottom) return false;
    const cx = Math.max(left + radius, Math.min(x + 0.5, right - radius));
    const cy = Math.max(top + radius, Math.min(y + 0.5, bottom - radius));
    return (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= radius ** 2;
  };
  // Repaint the inner rim only. The surrounding hull and all controls stay fixed.
  for (let y = Math.max(2, dy - 5); y < Math.min(im.h - 2, dy + h + 2); y++) {
    for (let x = dx - 8; x < dx + w + 8; x++) {
      const topLeft = y < dy + h / 2 || x < dx + w / 2;
      let ink = palette[metal[1]];
      if (inside(x, y, 6)) ink = palette[0];
      if (inside(x, y, 5)) ink = palette[metal[0]];
      if (inside(x, y, 4)) ink = palette[metal[topLeft ? 3 : 2]];
      if (inside(x, y, 2)) ink = palette[metal[0]];
      if (inside(x, y, 1)) ink = palette[0];
      if (inside(x, y, 0)) ink = [0, 0, 0, 0];
      // Short glints follow the curve, wholly on the rim.
      const localX = Math.min(x - dx, dx + w - 1 - x);
      const localY = Math.min(y - dy, dy + h - 1 - y);
      if (!inside(x, y, 2) && inside(x, y, 3) && localX >= 3 && localX <= 6 && localY >= 3) {
        ink = palette[metal[topLeft ? 4 : 3]];
      }
      dot(x, y, ink);
    }
  }
}
