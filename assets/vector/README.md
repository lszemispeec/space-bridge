# VECTOR

Green wireframe atlas for Space Bridge. 138 frames and 72 animations match the
other themes exactly: names, rectangles, anchors, durations, sequence order,
placements, sockets and all three operator-room layouts. The sheet is
1024×2638; the gameplay scene remains 320×240.

`vector.png` and `vector.json` are the production pair. Identical published
copies live in `public/atlas/`. Every JSON frame has `x`, `y`, `w`, `h`, `ax`,
`ay` and `duration` in milliseconds. Transparent retired frames stay retired.

## Drawing rules

One-pixel green contours on black. Black interiors occlude the scenery behind
sprites. There are no shaded material fills, antialiasing, baked glow or
fractional pixels. Bright upper-left contour segments give the same light
direction to every object. Dim lines mark scenery, cockpit and inset details.
The display preset can supply the glow.

Actor poses trace the accepted native suit material, including visor and limb
gaps, while retaining the existing opaque silhouettes and registration. No
pose is rotated or interpolated. The scenery, hull seams, inset shutters,
seven-segment digits and cockpit recesses use native one-pixel paths. Eye
pupils retain their left/right look states. Controls retain pressed and muted
states; lever bases stay fixed.

## Palette and integration handoff

Only four entries are painted; the contract still carries 16 unique colours.

| Slot | Hex | Use |
|---|---|---|
| 0 | `#000000` | Interior / background / overlay |
| 1 | `#28E060` | Line / accent |
| 2 | `#A0FFB0` | Bright line / text |
| 3 | `#126832` | Dim detail |
| 4–15 | `#001408`, `#002010`, `#003018`, `#004020`, `#005028`, `#087038`, `#108040`, `#189048`, `#20A050`, `#38B860`, `#60D880`, `#C0FFD0` | Reserved; unused in art |

`theme.json` supplies `id: "vector"`, `name: "VECTOR"`,
`atlas: "atlas/vector.json"` and these values for `src/config/themes.ts`:

```ts
palette: { text: '#A0FFB0', accent: '#28E060', overlay: '#000000' }
```

This is an art handoff. Theme registration, unlock threshold, music selection
and runtime integration belong to the engineer. No game logic changes here.

## Previews

`previews/operator-{landscape,portrait,side}-{1,4}x.png` shows the full rooms.
The `operator-*-cycle-4x.gif` files show the levers in those layouts. These are
offline compositions at the atlas coordinates, not integrated-game captures.

Every animation has a native strip and a 4× nearest-neighbour strip, indexed
by `strips.json` with durations and loop flags. Airborne, eye, tentacle, lamp
and lever sets also have timed GIFs. Action GIF previews repeat for inspection;
the atlas's one-shot flags remain unchanged.

The set also includes native and 4× screen, title-control, UI-state, suit,
creature, vehicle and full-sheet contact previews; a six-second pose loop;
hatch cycles; and a hatch-exit study. `frame-index.json` locates contact-sheet
cells. `rocket.hatch-cycle-4x.gif` is the existing preview naming convention for
the current inset hatch; the retired gantry frames remain blank. Historical
`console-before-*` comparisons are not applicable to this new theme.

## Rebuild and verify

Requires Python 3 with Pillow and the repository's Node dependencies.

```sh
python3 assets/tools/export-vector.py
python3 assets/tools/verify-vector.py
python3 assets/tools/verify-art.py
npx vitest run src/render/art-assets.test.ts src/render/atlas.test.ts
npm run check
```

The exporter reads the accepted Neon Orbit frame contract and silhouettes.
The shared TypeScript art tests exercise VECTOR with the same assertions as
the other themes. The dedicated pixel audit checks the three-green limit,
binary alpha, empty retired frames, actor registration, shutter-only changes,
distinct controls, clear rounded glass, absence of solid 3×3 green blocks,
strip/GIF source fidelity, timing, exact integer enlargements and loop seams.
The older pixel audit keeps its original themes' historical preservation and
shaded-palette checks intact.
