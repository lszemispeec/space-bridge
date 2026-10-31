# Sprite atlas contract

This document is the contract between the game code and the pixel art. The TypeScript type lives in `src/render/atlas.ts` (`Atlas`), together with `validateAtlas()`, which checks a JSON file against this contract. Run it on every atlas before you hand it over.

## Files

Each theme ships two files in `public/atlas/`:

| Theme | Sheet | Atlas |
|---|---|---|
| Polar Signal | `polar-signal.png` | `polar-signal.json` |
| Desert Expedition | `desert-expedition.png` | `desert-expedition.json` |
| Neon Orbit | `neon-orbit.png` | `neon-orbit.json` |

All three atlases must use the **same frame names, frame sizes and anchors**. The game swaps a theme by loading a different file. Nothing else changes.

## Rules

- Internal resolution is 320×240. One sheet pixel is one screen pixel. No scaling inside the sheet.
- Max 16 colours per theme, from the approved palette. Transparent pixels are allowed and do not count.
- Every frame is a rectangle on the sheet with integer position and size.
- The anchor is the point of the frame that the game places at the world position. Grounded cosmonaut poses and the plate use the bottom centre (the feet). The `cosmonaut.air.*` poses use the body centre (10,11) in a 20×22 cell. Vehicles use the bottom-left corner. HUD items and buttons use the top-left corner.
- Animations list frame names in play order. `loop` is `true` for idle and ambient loops and `false` for one-shot actions.
- `duration` is per frame, in milliseconds. The game may compress a one-shot animation to fit the gameplay timing (for example a shorter jump at high speed), so design poses that read well at any speed.

## JSON shape

```json
{
  "meta": {
    "contract": 1,
    "theme": "polar-signal",
    "image": "polar-signal.png",
    "size": { "w": 512, "h": 256 },
    "palette": ["#0A2227", "#163B3C", "..."]
  },
  "frames": {
    "cosmonaut.rise.0": { "x": 0, "y": 0, "w": 12, "h": 16, "ax": 6, "ay": 16, "duration": 80 }
  },
  "animations": {
    "cosmonaut.rise": { "frames": ["cosmonaut.rise.0", "cosmonaut.rise.1"], "loop": false }
  }
}
```

Frame names for animation frames follow the pattern `<animation>.<index>`. The game never reads those names directly; it only reads the `animations` table.

## Required animations

The game plays these by name. Each must exist in every theme.

### Cosmonaut (20×22 cells; existing poses anchor at bottom centre)

| Name | Loop | When |
|---|---|---|
| `cosmonaut.emerge` | no | Comes out of the rocket door. |
| `cosmonaut.crouch` | yes | Waits at the rocket door before the first jump. |
| `cosmonaut.takeoff` | no | Leaves the ground. Very short. |
| `cosmonaut.rise` | yes | First half of the arc. |
| `cosmonaut.descend` | yes | Second half of the arc. |
| `cosmonaut.land` | no | Squash on the plate. About 0.12 s at speed 1; the take-off follows at once, so there is no crouch on a crater. |
| `cosmonaut.crater_fall` | no | Falls into the crater. The game sinks the sprite about 18 px. |
| `cosmonaut.board` | no | Walks into the rover. |

### Airborne tumble and flail (20×22, body-centre anchor 10,11)

`cosmonaut.air.spin` contains exactly `cosmonaut.air.spin.0` through
`cosmonaut.air.spin.7`, ordered clockwise in screen coordinates:

| Index | Head direction | Angle from upright |
|---|---|---|
| 0 | Up | 0° |
| 1 | Upper right | 45° |
| 2 | Right | 90° |
| 3 | Lower right | 135° |
| 4 | Down | 180° |
| 5 | Lower left | 225° |
| 6 | Left | 270° |
| 7 | Upper left | 315° |

The 7→0 seam completes 360°. Every frame is hand-drawn on the native grid;
do not rotate, interpolate or resample the bitmap in the renderer.
`cosmonaut.air.flail` contains exactly `cosmonaut.air.flail.0` and
`cosmonaut.air.flail.1`, two spread-limb poses with the same cell and anchor.
Both animations loop; each frame has an **80ms reference duration**. Spin is
selected from arc progress and the seeded per-hop direction/turn count, not
the global animation clock. Reverse index order for counter-clockwise turns.

Place the body-centre anchor on the airborne body trajectory. Existing ground,
takeoff, landing and fall poses retain their foot anchor (10,22). If the
simulation position denotes feet, the renderer must place the body centre
11 pixels above that position when selecting an `air.*` frame. Do not change
grounded anchors or the plate squash. All three themes share these names,
geometry, timing and order. Flight/scheduler integration belongs to the engine.

### Bridge plate (anchor: bottom centre, about 26×4)

| Name | Loop |
|---|---|
| `plate.idle` | yes |
| `plate.move` | no |
| `plate.dip` | no |

### Scenery

| Name | Loop | Notes |
|---|---|---|
| `crater.idle` | yes | About 24×8. Drawn at the four crater slots. |
| `rocket.door_closed` | yes | Retired transparent compatibility frame. |
| `rocket.door_open` | no | Retired transparent compatibility frame. |
| `rover.idle` | yes | Fits inside x 248–280, y 142–179. |
| `rover.door_open` | no | Retired transparent compatibility frames. |

### HUD and buttons (anchor: top left)

| Name | Loop |
|---|---|
| `hud.icon.score` | yes |
| `hud.icon.life` | yes |
| `button.left.idle`, `button.left.pressed` | yes |
| `button.right.idle`, `button.right.pressed` | yes |

### Title and sound controls (anchor: top left)

These required `ui.*` animations replace PR #4's placeholder buttons. Each state
contains one frame named `<animation>.0`, with `duration: 1000` and `loop: true`.
The duration is a static hold; input chooses the state, not an animation timer.
All frames have anchor **(0,0)**. Draw at native size without scaling or padding.

| Animation prefix | Required states | Frame size | Screen position / tap target |
|---|---|---|---|
| `ui.title_theme` | `idle`, `pressed` | 56×16 | (100,190), `titleTheme` |
| `ui.title_sound` | `idle`, `pressed`, `muted`, `muted_pressed` | 56×16 | (164,190), `titleMute` |
| `ui.hud_sound` | `idle`, `pressed`, `muted`, `muted_pressed` | 36×16 | (142,4), `hudMute` |

Combine prefix and state with a dot: for example `ui.hud_sound.muted` references
`ui.hud_sound.muted.0`. `pressed` means sound on + pointer down;
`muted_pressed` means sound off + pointer down. Both muted frames retain a crossed
speaker. The HUD label reads SND when on and MUTE when off. Title labels remain
THEME and SOUND. Keyboard shortcut hints can be drawn separately by the renderer.

Geometry is copied exactly from PR #4 `src/config/layout.ts` at `3621b0d`.
These are additional names within contract v1; all previously required names,
sizes, anchors and animation sequences remain unchanged. Art supplies the
states; renderer/input integration remains with Forge.

## Required single frames

- `background`: the full 320×240 scene without sprites, craters, plate or HUD text. The 32 px gutters on both sides are part of it.
- `background.window`: full-bleed 320×240 scenery for the operator room, without the old HUD band or gutters.
- `hud.digit.0` … `hud.digit.9`: all the same size, about 8×10.
- `crater.0` … `crater.3` and `crater.front.0` … `.3`: see the creature contract below.

## Operator room and lever extension

The simulation and its source scene remain **320×240**. All room/lever frames
use top-left anchor **(0,0)** and the same geometry in all themes. Do not stretch
the scene. This revision supersedes the first room draft's box-shaped window,
24×48 lever cells and 352×288 landscape output.

Use **`operatorRoom.background` (`background.window`)** instead of `background`
when rendering the room. It extends the old x0…31 / x288…319 gutters and
y0…29 HUD band with scenery. The accepted centre **x32…287 / y30…239** is
pixel-identical to the old plate. Vehicle, crater and actor coordinates do not
change. `background` remains untouched for legacy renderers; drawing it in the
new room would reintroduce the rejected dark band.

| Frame / animation | Cell | Sequence / timing | Loop |
|---|---|---|---|
| `frame.room.landscape.0` / `frame.room.landscape` | 352×320 | one frame, 1000ms | yes |
| `frame.room.portrait.0` / `frame.room.portrait` | 288×344 | one frame, 1000ms | yes |
| `frame.lights.0`…`.3` / `frame.lights` | 20×6 | four frames, 300ms each | yes |
| `ui.lever.l.idle.0`, `ui.lever.r.idle.0` / corresponding idle animations | 40×64 | one frame, 1000ms | yes |
| `ui.lever.l.pull.0`…`.3`, `ui.lever.r.pull.0`…`.3` / corresponding pull animations | 40×64 | four frames, 50ms each | no |
| `ui.lever.l.release`, `ui.lever.r.release` (animations only) | 40×64 | pull `.2`, `.1`, `.0`, then idle `.0` | no |

Hold pull `.3` while pressed or queued. Release returns through the authored
poses; the idle frame's 1000ms is a static terminal hold, not a required delay.
The engine may compress the 50ms transitions to match plate travel. Left and
right handles lean in their respective directions. Existing `button.*` frames
remain available for compatibility; replace them with the levers, not both.

### Layout coordinates (all native pixels)

Every atlas supplies `operatorRoom` metadata with these values. The screen
coordinates below refer to the **expanded output**, not simulation positions.

| Item | Landscape | Portrait |
|---|---|---|
| Output size | 352×320 | 288×344 |
| Source scene crop | (0,0,320,240) | (32,0,256,240) |
| Scene destination | (16,12) | (16,12) |
| Console | (0,252,352,68) | (0,252,288,92) |
| Left lever ART top-left | (8,240) | (8,240) |
| Right lever ART top-left | (304,240) | (240,240) |
| Left lever TAP zone | (20,164,24,48) | (20,292,24,48) |
| Right lever TAP zone | (308,164,24,48) | (244,292,24,48) |
| Existing portrait input strip | — | (16,288,256,56) |

Landscape shows the full 320×240 plate; portrait keeps the existing 256×240
centre crop. Both now show sky to the top edge. Two **20px upper chamfers**
(`windowCornerCut`) form slanted mullions. Their pixels satisfy x+y<20 in each
upper window corner. Rivets sit inside the mullions. Ten pale diagonal glint
pixels enter the glass near its upper-left corner, at local window coordinates
(26+i,8+i), i=0…5 and (24+i,13+i), i=0…3. The rest of the glass is transparent.
These details stay above all flight paths. Idle handles can overlap the bottom
window edge slightly; their bases are on the deck.

**Art and input are separate:** `levers` are drawing positions;
`leverTapZones` preserve the preceding draft's exact input rectangles. Do not
derive hit areas from the enlarged 40×64 sprites or relocate them to the deck.
Keep the existing portrait strip input handling and the 44 CSS pixel minimum
touch target. Keep integer output scaling. Title theme/sound buttons retain
their scene positions. Only the HUD sound target follows its readout below.

Both layouts use the same console readout positions: score icon **(56,262)**,
four digits **(72,262)** with pitch 8, mode label **(112,266)**, life icons
**(80,290)** with pitch 20, and the existing 36×16 `ui.hud_sound.*` at
**(188,260)**. Draw `frame.lights` at **(152,298)**. Room art provides the panel
recesses; the renderer supplies these readouts and removes the old sky HUD.
Draw the full-bleed scene, room, levers, readouts, lights. Do not copy old gutter
or arrow-button rasters into the room. Vehicle placement uses the revision-8 models and mouth sockets below.

Engine notes on this section (`src/render/room.ts`, `src/render/lever.ts`,
`src/config/layout.ts`): the room geometry lives in `layout.ts` and the art
test checks that every atlas's `operatorRoom` table, including `background`,
`levers`, `leverTapZones` and `hud`, matches it. The renderer draws
`operatorRoom.background` through the glass and never the legacy plate. A full
lever pull or return is compressed to at most 120 ms, so presses 150 ms apart
read as separate pulls; a press during the return pulls again from the current
pose. The engine shows one pair of eyes at a time: the creature director picks
a random crater, other than the last one, from its seeded RNG.

Eyes keep their existing names, cells, anchors and durations. Their whites are
round stepped circles with moving pupils; the blink compresses that circle,
and the hidden terminal frame stays transparent. Polar suits become dark teal
with pale visors across every pose, life icon and captured victim. No actor
silhouette, animation timing or collision geometry changes.

## Elevated hatch and crater creatures

All additions below share names, geometry and timing across themes. This is an
art contract; the engine owns spawn timing, creature RNG and plate safety.

### Built-in rocket and rover hatches (revision 8)

Draw **one complete model** per vehicle. The three unique poses are closed,
partly open and open; only the shutter pixels change. The hatch stays inside
the hull outline. Light comes from upper left; silhouettes use a one-pixel
darkest-palette contour with flat shade clusters. No ground door remains on
the rocket. Vehicle cells, anchors, durations and socket coordinates match
across all three themes.

| Prefix | Cell / anchor | World anchor | Mouth rectangle (local) | Mouth-floor socket / world |
|---|---|---|---|---|
| `rocket.tophatch` | 33×89 / (0,89) | (43,169) | x16,y20,w8,h12 | `rocketTopHatch` (20,32) / **(63,112)** |
| `rover.hatch` | 33×38 / (0,38) | (248,180) | x4,y12,w8,h18 | `roverHatch` (8,30) / **(256,172)** |

Both prefixes expose these animations:

| Suffix | Frame | Duration | Loop |
|---|---|---|---|
| `.closed` | `.closed.0` | 1000ms | yes |
| `.opening` | `.opening.0` | 90ms | no |
| `.open` | `.open.0` | 1000ms | yes |
| `.closing` | reuses `.opening.0` | 90ms | no |

Hold closed → play opening → hold open. For closing, play closing → hold closed.
Sockets are measured from the full frame's top-left: world = draw anchor minus
frame anchor plus socket. `vehicleModels` records draw anchors, mouth rectangles
and socket keys. `rover.idle` remains as a compatibility alias in pixels to the
closed model; do not layer it under another rover frame.

The gantry is **retired**. It no longer makes sense beside a small hull hatch.
`retiredSockets: ["rocketLedge"]` marks the historical (82,110) ledge point as
unusable. Its metadata and the old cosmonaut ledge poses remain for old readers,
but there is no visible platform at that point. Use the new mouth socket for
spawn/exit; the engineer must update the departure trajectory and boarding
alignment. The crater slots, collision geometry and game code are unchanged.

Every `rocket.door_*`, `rocket.hatch.*` and `rover.door_*` animation is listed in
`retiredAnimations`; all corresponding pixels are fully transparent. Their old
frame names, rectangles, anchors, durations and animation sequences remain.
This also covers any future dotted door names selected by the exporter prefix.
Polar additionally keeps `ambient.sky` retired.

`previews/tophatch-exit-4x.gif` is an **offline mock**, not implemented gameplay.
It shows a 6×7 → 20×22 nearest-neighbour scale-in from (63,112), then departure
toward crater 1, with integer positions and a closed-to-closed loop seam.
Production actor cells stay 20×22 and unchanged. The renderer owns reveal,
clipping, animation timing, and the new path. Each animation has native and 4×
strip previews. Full operator screens are exported in both orientations.

### Four crater rims and their occupants

The four single frames **`crater.0`…`crater.3`** are **24×8**, anchor **(12,4)**.
Draw them at (106/146/186/226,177). Their matching foreground lips are
`crater.front.0`…`.3`, with identical geometry. All four shapes share a usable
mouth at local x5…18 / y3…5. Draw rim, creature, foreground lip, then plate.

| Animation | Frames | Cell / anchor | Durations | Loop |
|---|---|---|---|---|
| `crater.eyes.peek` | `.0`…`.2` | 24×16 / (12,12) | 120,120,300ms | no |
| `crater.eyes.blink` | `.0`…`.2` | 24×16 / (12,12) | 80,80,160ms | no |
| `crater.eyes.look.l` | `.0` | 24×16 / (12,12) | 400ms | yes |
| `crater.eyes.look.r` | `.0` | 24×16 / (12,12) | 400ms | yes |
| `crater.eyes.hide` | `.0`…`.2` | 24×16 / (12,12) | 100,100,160ms | no |
| `crater.tentacle.reach` | `.0`…`.3` | 24×32 / (12,28) | 120,160,240,160ms | no |
| `crater.tentacle.grab` | `.0`…`.4` | 24×32 / (12,28) | 100,120,140,140,160ms | no |

All creature anchors use the same crater centre (slot x,177). Eyes rise inside
the shared mouth; the final hide frame is intentionally transparent. Reaches
are decorative: suppress them on a crater occupied by the plate and draw the
plate last. They do not change collision geometry.

Grab frames **include the captured cosmonaut**. Hide the separate victim sprite
while this sequence plays, or it will appear twice. The first frame registers
the victim's feet at y175. The coil wraps the suit and pulls it beneath the
front lip; the final frame contains only a retreating tentacle. Clip at y180
and draw the matching foreground lip above the grab. Continue the life-lost
sequence after the 660ms reference sequence; do not replay a visible fall from
above the rim. Keep the existing fall sprites for other engine transitions.

### Polar aurora retirement

Polar's background no longer includes the aurora. Its four `ambient.sky.*`
frames become transparent compatibility no-ops, and `retiredAnimations`
contains `ambient.sky`. The frame names and rectangles remain identical across
themes. The other two themes keep their sky loops. Polar drift and signal
remain active. A renderer may skip animations listed in `retiredAnimations`.

## Ambient animations (optional)

Name them `ambient.<name>`, loop `true`. Add an `ambient` entry per animation with the screen position in a top-level `"placements"` table if you want the game to place them:

```json
"placements": { "ambient.beacon": { "x": 60, "y": 84 } }
```

The renderer draws every `ambient.*` animation that has a placement, so you can add them freely. All of them are drawn over the background and behind the vehicles, except `ambient.signal`, which is drawn over the vehicles (rocket beacon, rover lights). Keep them out of the jump path (y 130–180 between the rocket and the rover) and out of the HUD (y 0–30).

## Playfield reference

| Item | Position |
|---|---|
| Gutters | x 0–31 and x 288–319, full height |
| HUD | y 8–25 |
| Ground line | y 175 |
| Slot x (rocket door, 4 craters, rover door) | 82, 106, 146, 186, 226, 252 |
| Rocket mouth floor | (63,112), from `rocketTopHatch`; old ledge (82,110) retired |
| Jump apex | 90 px above the ground (feet at y 85) |
| Rover mouth floor | (256,172), from `roverHatch` |

The slot positions come from `src/config/layout.ts`. If art needs them moved, say so on the issue and we change the config, not the art.
