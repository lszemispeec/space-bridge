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
| `rocket.door_closed` | yes | Fits inside x 43–75, y 80–168. |
| `rocket.door_open` | no | Plays while a cosmonaut emerges. |
| `rover.idle` | yes | Fits inside x 248–280, y 142–179. |
| `rover.door_open` | no | Plays while a cosmonaut boards. |

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
- `hud.digit.0` … `hud.digit.9`: all the same size, about 8×10.
- `crater.0` … `crater.3` and `crater.front.0` … `.3`: see the creature contract below.

## Elevated hatch and crater creatures

All additions below share names, geometry and timing across themes. This is an
art contract; the engine owns spawn timing, creature RNG and plate safety.

### Rocket hatch and ledge

Replace the old rocket hull with one `rocket.hatch.*` full-hull frame, drawn at
bottom-left **(43,169)**. New cells are **44×89**, anchor **(0,89)**; the extra
width contains the right-hand gantry. The ledge foot point is local **(39,30)**,
world **(82,110)**. It is about two thirds of the rocket height above the base.
Every atlas supplies `sockets.rocketLedge = {frame: "rocket.hatch.open.0",
x:39, y:30}`. The socket is measured from the frame's top-left, not its anchor.

| Animation | Frames | Duration per frame | Loop |
|---|---|---|---|
| `rocket.hatch.closed` | `.0` | 1000ms | yes |
| `rocket.hatch.opening` | `.0`, `.1`, `.2` | 90ms | no |
| `rocket.hatch.open` | `.0` | 1000ms | yes |
| `rocket.hatch.closing` | `.0`, `.1`, `.2` | 90ms | no |
| `cosmonaut.ledge.stand` | `.0` | 1000ms | yes |
| `cosmonaut.ledge.crouch` | `.0` | 1000ms | yes |

Cosmonaut ledge poses retain **20×22, feet anchor (10,22)**. Place their feet
at (82,110); the first flight starts there. Draw the hatch hull, then the actor.
Do not also draw the old `rocket.door_*` hull. Its frames remain for compatibility.

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
| Jump apex | 26 px above the ground |

The slot positions come from `src/config/layout.ts`. If art needs them moved, say so on the issue and we change the config, not the art.
