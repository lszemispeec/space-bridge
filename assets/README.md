# Space Bridge production art

Three interchangeable themes, derived from Astra's accepted `space-bridge-art-v1.zip`. Each theme has 118 frames, 54 animation entries, one 1024×1619 PNG and one contract-v1 JSON. Polar Signal is the default. The game owns unlocks.

The masters live in `assets/<theme>/`. Byte-identical sheet/JSON copies live in `public/atlas/` at the URLs configured by the engine. Existing flight art is integrated on `main`; the new hatch and creatures await the engine's next integration. This art change does not change game logic or layout config.

## Revision 5: elevated hatch, living craters, clear Polar sky

**Rocket:** eight full-hull hatch frames, **44×89, anchor (0,89)**, replace the
old hull when integrated. Opening and closing each have three 90ms frames;
closed/open are static holds. The gantry adds 11px of width without moving the
rocket base at (43,169). Its foot socket is **(39,30)** inside the frame:
**world (82,110)**. The old low red door is a sealed maintenance cover in the
new hull. `cosmonaut.ledge.stand.0` and `.crouch.0` use **20×22 / (10,22)** and a
braced forward arm. All hatch states keep the same ledge and hull registration.

**Craters:** four different 24×8 rims at the existing crater centres, with
matching front lips: rounded, broken boulder, slanted fissure and scalloped.
They retain anchor (12,4), plus a shared dark opening at local x5…18 / y3…5.
Three-frame peek, blink and hide sequences and left/right looks use **24×16 /
(12,12)**. Four-frame reach and five-frame grab use **24×32 / (12,28)**.
Every creature anchor sits at (slot x,177). The final eye-hide frame is blank.

**Grab integration:** frames include the captured flailing cosmonaut. Hide the
separate victim while playing the 660ms grab; draw the matching front lip above
it. The first visible feet register at y175. The suit sinks under the rim and
only a retreating tentacle remains in the final frame. Decorative reaches must
be suppressed where the plate sits; draw the plate last. The exact names,
frame counts and durations are in `docs/atlas-contract.md`.

Tentacle base/highlight/sucker inks: Polar **#C8493B / #E67B59 / #F1B683**;
Desert **#28606A / #47908D / #B8D4BC**; Neon **#9747A6 / #FF76CA / #FFF8CB**.
The dark contour is each palette's first colour. All original 16-colour
palettes are unchanged. Eyes use light suit ink and dark pupils for 1× clarity.

**Polar:** the curtain lived in `ambient.sky.0`…`.3`; these are now transparent
compatibility frames. `retiredAnimations: ["ambient.sky"]` lets the renderer
skip them. The separate green mark at (222,54) is also removed from the
background. A built-in imagegen deletion was palette-cleaned into the 24×28
`sky-repair.png` patch at (210,40), using only #FFFAE8. Every pixel outside that
patch is preserved. Desert and Neon retain their sky loops. Drift and signal
remain active in all themes.

The sheet gains 37 frames per theme. Existing rectangles and timings remain
fixed. The only changed old frame pixels are `crater.front.0` in every theme,
plus Polar's background patch and four retired sky frames. Each `revision-5.json`
lists the differences. Rebuild this revision with
`node assets/tools/export-environment.mjs`; it extends the existing native art
with integer pixel shapes, connected tentacle strokes and exact palette inks.

Preview rows in `creatures-1x.png` / `creatures-4x.png`: four rims, peek, blink,
look left, look right, hide, reach, grab. Native and 4× strips cover every new
animation; creature GIFs and `rocket.hatch-cycle-4x.gif` show motion. New full
screens show the elevated ledge, upper flight band and creatures. These are
offline art compositions, not engine captures. `jump-bounce.gif` now contains a
six-second creature/ledge study under its legacy filename. The unscaled airborne
crop now uses (122,58) with size 48×64. Current Polar previews contain no aurora.

## Revision 4: airborne rotation and flail

Each theme adds `cosmonaut.air.spin.0`…`.7` and `cosmonaut.air.flail.0/1`.
All ten frames use **20×22 cells and body-centre anchor (10,11)**. Spin starts
upright and advances clockwise through eight 45° key poses. Flails spread the
arms and legs, with one upright and one diagonal pose. Both animations loop
with **80ms reference frames**; the spin strip is a 640ms cycle. Gameplay should
select a spin index from hop progress, direction and turn count. Reverse the
order for counter-clockwise flight. The renderer must not rotate the bitmap.

`airborne-pixels.json` holds ten independently hand-drawn 20×22 ink maps.
The chest equipment pixel stays at (10,11) in every pose. The exporter adds a
one-native-pixel dark outline, then maps the same ink into each theme palette.
There is no image generation, bitmap rotation, mirroring or interpolation in
this revision. Rebuild with `node assets/tools/export-airborne.mjs` (ImageMagick
required). The three-theme atlas geometry remains identical.

The new body pivot is **11px above the existing foot pivot**. Existing grounded,
takeoff, landing and fall frames retain (10,22). For a feet-based trajectory,
place the new anchor at `(worldX, worldY - 11)`; for a body-based trajectory,
place it directly. This keeps anchor conversion explicit during the engine's
flight rework and preserves the plate squash. No existing frame is moved or
redrawn. The sheet grows from 1024×1470 to 1024×1494. `revision-4.json` lists all
ten added rectangles and their timing.

Suit / outline colours: Polar `#FFFAE8` / `#173B3A`, Desert `#FFF4DA` / `#251C29`,
Neon `#B7FFF0` / `#080C24`. All other inks also come from the unchanged 16-colour
palettes below. Large suit clusters and a continuous dark silhouette keep the
actor readable against both light mountains and dark space.

`previews/cosmonaut.air.spin-strip.png` is the native 160×22 sequence;
`cosmonaut.air.spin-strip-4x.png` is its exact 640×88 nearest-neighbour enlargement.
Flail strips are 40×22 / 160×88. Each animation also has a 4× looping GIF.
`airborne-contrast-1x.png` / `airborne-contrast-4x.png` show four new poses over
the upper playfield. These are offline contrast studies, not gameplay captures
or evidence of the new flight/scheduler behavior. Existing movement studies
retain their earlier poses and short arc.

## Revision 3: title and sound controls

Ten new `ui.*` frames per theme match the exact tap targets in PR #4's `src/config/layout.ts` at `3621b0d`:

| Animation prefix | States | Size | Screen top-left |
|---|---|---|---|
| `ui.title_theme` | `idle`, `pressed` | 56×16 | (100,190) |
| `ui.title_sound` | `idle`, `pressed`, `muted`, `muted_pressed` | 56×16 | (164,190) |
| `ui.hud_sound` | `idle`, `pressed`, `muted`, `muted_pressed` | 36×16 | (142,4) |

Append `.<state>.0` for the frame name. Anchors are (0,0); each state is a single 1000ms looping hold selected by input. Muted-pressed variants preserve the crossed speaker while the button is held. Title text stays THEME / SOUND; the HUD switches SND / MUTE. Keyboard shortcut hints are separate renderer text.

The native 3×5 menu font and simple pixel rectangles form the new controls. Upper-left highlight, lower-right shadow and a one-pixel downward press offset are shared across themes. All colours come from the unchanged palettes below. Editable `ui-controls.svg` sources and `ui-controls.json` strip coordinates accompany the raster frames. SVGs contain only integer pixel rectangles; render at exactly 500×16 with no filtering.

The sheet grows by 18 rows to 1024×1470. All previous 61 rectangles, pixels, anchors, timing and animation lists are preserved. `revision-3.json` lists every addition and its screen target. `changes.json` and `revision-2.json` document the earlier 61-frame source conversion and readability pass.

`previews/ui-states-1x.png` / `ui-states-4x.png` show all ten states (rows: theme, title sound, HUD sound; columns: idle, pressed, muted, muted-pressed). Every new animation also has a native strip. `title-controls-1x.png` / `title-controls-4x.png` are offline placement studies showing the title controls over the playfield, not screenshots of the title overlay or integrated gameplay. The regular screen previews include the HUD control. The existing jump GIF remains the revision-2 movement study.

## Revision 2: readability review

All 16 cosmonaut frames in each theme now use **20×22 cells, anchor (10,22)**, replacing 12×16 / (6,16). Upright and airborne silhouettes are 18–20 pixels tall; crouch, landing squash and the final tucked fall are 16 pixels tall. The entire silhouette has a continuous one-native-pixel dark contour. Large light suit areas replace the small, fragmented highlights. Frame names, animation lists, loop flags and durations are unchanged.

Full and empty HUD life icons are **14×16, anchor (0,0)**, replacing 12×12. They use the revised helmet, with a muted suit for the empty state. All other frame sizes and anchors are unchanged. Atlas rectangles are repacked identically across themes; the sheets remain 1024×1452. `revision-2.json` records every changed rectangle and every visible character size.

For Forge's arc check: the foot anchor stays on the simulation position. With ground y175 and the existing 26px arc, the apex foot is y149; the 18px apex pose starts at y131. A 20px silhouette at the same apex would start at y129. No arc, collision, timing or scheduler code changed. Integration remains after the scheduler fix, under Chief of Staff's coordination.

The terrain behind the actor at x76…247 / y130…167 is now one quiet colour per theme. A low, stepped horizon preserves the landscape above it. Polar uses sage `#83A792`, Desert muted ochre `#C97550`, Neon deep violet `#252457`. Main suit colours are respectively `#FFFAE8`, `#FFF4DA`, `#B7FFF0`; contours are `#173B3A`, `#251C29`, `#080C24`. The complete 16-colour palettes below are unchanged.

Polar's aurora is now a vertical mint curtain using `#5E8D7A`, `#83A792`, `#ABC3A6`, with a four-phase shimmer. Idle button backgrounds now match their dark gutters in all themes: no rectangular panel. Pressed feedback remains visible with the same shape in every theme.

New review files: `previews/cosmonaut-air-1x.png` is an **unscaled 48×64 crop** of the full screen at (122,118). `cosmonauts-1x.png` and `cosmonauts-4x.png` show all 16 poses. All screens, strips, contact sheets and GIFs have been regenerated from the revised atlas.

## Review and use

- `previews/screen-1x.png` and `screen-4x.png`: composed 320×240 scene and exact nearest-neighbour enlargement.
- `previews/jump-bounce.gif`: six-second, native-resolution bounce study with all ambient loops. This is an offline motion reference, not a gameplay recording.
- `previews/*-strip.png`: every animation in playback order. `strips.json` supplies durations and loop flags.
- `previews/frames-1x.png`, `frames-4x.png`, and `frame-index.json`: all atlas rectangles on a palette-only checkerboard. For native inspection of small objects, use the individual strips; large sheet viewers may shrink the full contact sheet.
- `changes.json`: exhaustive source-to-current-production mapping for all 61 frames, including rectangle sizes, anchors, durations, pixel operations, and before/after animation tables. `revision-2.json` isolates the review changes from PR #3's first delivery.
- `palette.hex`: the exact 16 allowed opaque colours. Transparency is binary and does not count as a colour.

One exported pixel is one game pixel. Draw only at integer coordinates. Do not filter, rotate or scale individual sprites. Light comes from upper left. Cosmonauts use a continuous dark contour; props retain selective dark lower/right outlines and pale upper/left highlights. Tiny disconnected snow, stars and antenna lights are intentional effects. Other isolated sprite fragments were removed during native export.

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
| Actors 24×32, feet (12,30) | Revised readable poses in 20×22 cells, feet (10,22). Visible silhouettes 16–20px, continuous dark contour, common floor. This supersedes the first delivery's 12×16 resample. |
| Plate 32×12, near-top anchor (16,2), source `contactOffsetY` | Clean native 26×6 plate with bottom-centre anchor (13,6). Flat/tilt/dip/recovery silhouettes use one pixel grid. Remove the unsupported per-frame field. |
| Craters 32×16, anchor (16,6) | 24×8, centre anchor (12,4). Keep optional front lip as a separate frame for falling-actor occlusion. |
| Rocket 48×96, centre anchor; door-open hull visibly shrank | Both states use the same 33×89 hull and bottom-left (0,89), with a fixed door aperture. |
| Rover 48×40, centre anchor; inconsistent doors/body registration | Both states share a 33×38 hull and bottom-left (0,38). One-pixel antenna change supplies idle motion without moving the wheels. |
| Digits 8×12 | 8×10; remove unused bottom padding. HUD/button top-left anchors and other frame sizes retained. |
| Life icons 12×12 | Revised helmet in 14×16, top-left anchor retained; full and muted empty states. |
| No contract `placements` | Place all three full-screen ambient overlays at (0,0). Re-register Polar beacon and Neon rover lights to the fixed vehicle positions. |
| Source `layout` used 24px gutters, road near y184, crater x104/144/184/224 | Remove stale layout/draw-order objects. Export a 32px gutter, 30px blank HUD band and a clear strip at y175. Preview uses slot x106/146/186/226 and contract vehicle bounds. |
| Ambient effects used source safety bounds | Clip every phase outside x32…287 / y30…239 and outside the central jump region x76…247 / y130…198. Intentional drift rest remains transparent. |
| Dense speckling and irregular source background texture | Imagegen cleanup retains the three compositions; quantize without dithering to each original 16-colour palette at native resolution, then consolidate residual tiny colour islands. Counts: Polar 1142, Desert 2026, Neon 2423 pixels after sampling. |
| 2048×1024 source packing | Repack to 1024×1452 with transparent gutters. Identical rectangles across all themes. No rotated frames. |

The source's final production palettes differ from the earlier concept colours used by the placeholder renderer. The accepted source palettes are retained here. The renderer's config was not edited.

## Placement and contact reference

For the supplied composition, rocket bottom-left is (43,169), rover bottom-left (248,180); both stay inside the contract bounds. Crater centres are (106/146/186/226,177), so the back rim straddles the y175 road. Buttons begin at (4,152) and (292,152), entirely inside the gutters. Score begins at (40,8); life icons at x212,232,252 / y7.

The plate frame is 6px high with a bottom anchor. Place its bottom at y181 for its top surface to meet the y175 ground. Measured centre surface positions inside the frame are y0 idle, y2 dip, y1 recovery; corresponding cosmonaut foot positions in the bounce preview are 175,177,176. These are measured art contacts, not changes to simulation positions. The renderer can align visual landing poses with the surface while the game keeps its fixed collision coordinates.

All ambient overlays have anchor (0,0). Draw sky/drift over the background and behind vehicles; draw signal over vehicles. Sky loops in 2000ms; drift in 3000ms, with its transparent rest; signal in 1000ms. All coincide every six seconds. Draw the optional crater front lip only when it should cover a falling actor.

## Palettes

**Polar Signal:** `#173B3A #285552 #3F7068 #5E8D7A #83A792 #ABC3A6 #D1DCC0 #F0EED5 #FFFAE8 #233A46 #426573 #6C929A #9BB8B7 #C8493B #E67B59 #F1B683`

**Desert Expedition:** `#251C29 #49313B #704348 #9C5549 #C97550 #E89B61 #F5C781 #FFE6B0 #FFF4DA #173F49 #28606A #47908D #80B8A5 #B8D4BC #BD3C38 #F16A42`

**Neon Orbit:** `#080C24 #141B42 #252457 #3C2871 #64358C #9747A6 #D454BB #FF76CA #103C58 #15687A #27A6AE #55E7DE #B7FFF0 #A6B846 #E3EE72 #FFF8CB`

## Validation

`npm run check` exercises `validateAtlas()` and its extended required UI names against all real atlases, checks shared frame geometry/timing/animations/placements, checks anchors, exact PR #4 button dimensions and loop flags, then runs the existing tests and production build.

`python3 assets/tools/verify-art.py` needs Pillow. It audits every pixel for palette and binary alpha, sheet bounds and nonoverlapping rectangles, transparent unused space, actor feet and visible height, continuous dark actor contours, quiet corridors, panel-free gutters, life icon dimensions, ambient exclusions, runtime-copy parity, all animation strips, six-second GIFs, unscaled airborne crops and exact 4× enlargement.

Visual review covers the new frames at native resolution and integer enlargement; the pixel audit covers all 354 frames. It checks silhouette contours, body/foot pivots, the ledge socket, distinct crater rims, the shared mouth, Polar retirement, strip/GIF pixels and timing, and exact 4× previews. Intentional eyes and ambient particles are not stray pixels. These checks do not replace renderer integration or desktop/mobile playtesting.
