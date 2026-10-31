# Space Bridge production art

Three interchangeable themes, derived from Astra's accepted `space-bridge-art-v1.zip`. Each theme has 61 frames, 29 animation entries, one 1024×1452 PNG and one contract-v1 JSON. Polar Signal is the default. The game owns unlocks.

The masters live in `assets/<theme>/`. Byte-identical sheet/JSON copies live in `public/atlas/` at the URLs already configured by the engine. The renderer in PR #1 still draws placeholders; loading and drawing these assets remains the engineer's integration work. No game logic, layout config or atlas contract changed.

## Review and use

- `previews/screen-1x.png` and `screen-4x.png`: composed 320×240 scene and exact nearest-neighbour enlargement.
- `previews/jump-bounce.gif`: six-second, native-resolution bounce study with all ambient loops. This is an offline motion reference, not a gameplay recording.
- `previews/*-strip.png`: every animation in playback order. `strips.json` supplies durations and loop flags.
- `previews/frames-1x.png`, `frames-4x.png`, and `frame-index.json`: all atlas rectangles on a palette-only checkerboard. For native inspection of small objects, use the individual strips; large sheet viewers may shrink the full contact sheet.
- `changes.json`: exhaustive source-to-production mapping for all 61 frames, including rectangle sizes, anchors, durations, pixel operations, and before/after animation tables.
- `palette.hex`: the exact 16 allowed opaque colours. Transparency is binary and does not count as a colour.

One exported pixel is one game pixel. Draw only at integer coordinates. Do not filter, rotate or scale individual sprites. Light comes from upper left; silhouettes use a selective dark lower/right outline and pale upper/left highlights. Tiny disconnected snow, stars, antenna lights and aurora sparks are intentional effects. Other isolated sprite fragments were removed during native export.

## Changes from Astra v1

The contract is `docs/atlas-contract.md` and `src/render/atlas.ts` from PR #1 at `ba9d78d` (unchanged in its final `cc19594` revision).

| Difference | Production correction |
|---|---|
| `meta.schema` custom identifier | `meta.contract: 1`; retain theme, relative image, size and accepted source palette. Drop redundant canvas/scale/alpha/unit/unlock metadata. |
| Nested `anchor: {x,y}` | Integer `ax`, `ay` on every frame; remove redundant `name`. |
| Underscore frame identifiers | Dot-separated `<animation>.<index>`; digits become `hud.digit.0`…`9`; `background` remains unchanged. All 61 exact mappings are in each `changes.json`. |
| `cosmonaut.airborne_rising`, `.airborne_falling`, `.fall` | `cosmonaut.rise`, `.descend`, `.crater_fall`. Keep optional apex and idle poses. |
| `bridge.idle`, `.move_left`, `.move_right`, `.bounce` | `plate.idle`, `.move`, `.move_right` (optional), `.dip`. |
| `rocket.closed`, `.open`; `rover.closed_idle`, `.open_idle` | `rocket.door_closed`, `.door_open`; `rover.idle`, `.door_open`. |
| Missing required animation entries | Add `crater.idle`, HUD score/life and all four button state entries. Keep optional empty-life icon. |
| Incorrect loop flags | Crouch loops; rocket/rover opening are one-shots. All ambient, idle and HUD/button states loop. |
| Landing sequence included crouch and takeoff | Landing contains squash and recovery only; takeoff remains its own animation. |
| Zero-duration static frames | Positive 1000ms hold frames; no zero-duration animation clock. Other source timings preserved. |
| Actors 24×32, feet (12,30) | Common fixed-window resample to 12×16, feet (6,16). Preserve relative anticipation/stretch/squash heights, register every pose at the same floor. |
| Plate 32×12, near-top anchor (16,2), source `contactOffsetY` | Clean native 26×6 plate with bottom-centre anchor (13,6). Flat/tilt/dip/recovery silhouettes use one pixel grid. Remove the unsupported per-frame field. |
| Craters 32×16, anchor (16,6) | 24×8, centre anchor (12,4). Keep optional front lip as a separate frame for falling-actor occlusion. |
| Rocket 48×96, centre anchor; door-open hull visibly shrank | Both states use the same 33×89 hull and bottom-left (0,89), with a fixed door aperture. |
| Rover 48×40, centre anchor; inconsistent doors/body registration | Both states share a 33×38 hull and bottom-left (0,38). One-pixel antenna change supplies idle motion without moving the wheels. |
| Digits 8×12 | 8×10; remove unused bottom padding. HUD/button top-left anchors and other frame sizes retained. |
| No contract `placements` | Place all three full-screen ambient overlays at (0,0). Re-register Polar beacon and Neon rover lights to the fixed vehicle positions. |
| Source `layout` used 24px gutters, road near y184, crater x104/144/184/224 | Remove stale layout/draw-order objects. Export a 32px gutter, 30px blank HUD band and a clear strip at y175. Preview uses slot x106/146/186/226 and contract vehicle bounds. |
| Ambient effects used source safety bounds | Clip every phase outside x32…287 / y30…239 and outside the central jump region x76…247 / y130…198. Intentional drift rest remains transparent. |
| Dense speckling and irregular source background texture | Imagegen cleanup retains the three compositions; quantize without dithering to each original 16-colour palette at native resolution, then consolidate residual tiny colour islands. Counts: Polar 1142, Desert 2026, Neon 2423 pixels after sampling. |
| 2048×1024 source packing | Repack to 1024×1452 with transparent gutters. Identical rectangles across all themes. No rotated frames. |

The source's final production palettes differ from the earlier concept colours used by the placeholder renderer. The accepted source palettes are retained here. The renderer's config was not edited.

## Placement and contact reference

For the supplied composition, rocket bottom-left is (43,169), rover bottom-left (248,180); both stay inside the contract bounds. Crater centres are (106/146/186/226,177), so the back rim straddles the y175 road. Buttons begin at (4,152) and (292,152), entirely inside the gutters. Score begins at (40,8); life icons at x212,228,244 / y8.

The plate frame is 6px high with a bottom anchor. Place its bottom at y181 for its top surface to meet the y175 ground. Measured centre surface positions inside the frame are y0 idle, y2 dip, y1 recovery; corresponding cosmonaut foot positions in the bounce preview are 175,177,176. These are measured art contacts, not changes to simulation positions. The renderer can align visual landing poses with the surface while the game keeps its fixed collision coordinates.

All ambient overlays have anchor (0,0). Draw sky/drift over the background and behind vehicles; draw signal over vehicles. Sky loops in 2000ms; drift in 3000ms, with its transparent rest; signal in 1000ms. All coincide every six seconds. Draw the optional crater front lip only when it should cover a falling actor.

## Palettes

**Polar Signal:** `#173B3A #285552 #3F7068 #5E8D7A #83A792 #ABC3A6 #D1DCC0 #F0EED5 #FFFAE8 #233A46 #426573 #6C929A #9BB8B7 #C8493B #E67B59 #F1B683`

**Desert Expedition:** `#251C29 #49313B #704348 #9C5549 #C97550 #E89B61 #F5C781 #FFE6B0 #FFF4DA #173F49 #28606A #47908D #80B8A5 #B8D4BC #BD3C38 #F16A42`

**Neon Orbit:** `#080C24 #141B42 #252457 #3C2871 #64358C #9747A6 #D454BB #FF76CA #103C58 #15687A #27A6AE #55E7DE #B7FFF0 #A6B846 #E3EE72 #FFF8CB`

## Validation

`npm run check` exercises the unmodified `validateAtlas()` against all real atlases, checks shared frame geometry/timing/animations/placements, checks anchors and loop flags, then runs the existing tests and production build.

`python3 assets/tools/verify-art.py` needs Pillow. It audits every pixel for palette and binary alpha, sheet bounds and nonoverlapping rectangles, transparent unused space, actor feet, ambient exclusions, runtime-copy parity, all animation strips, the six-second GIFs and exact 4× enlargement.

Visual review covers all 183 frames at native resolution and integer enlargement. Background texture was simplified; intentionally isolated ambient particles are not treated as stray pixels. These checks do not replace renderer integration or desktop/mobile playtesting.
