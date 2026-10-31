SPACE BRIDGE — PRODUCTION ART PACKAGE v1

FILES
polar-signal.png + polar-signal.json: main theme, unlocked initially.
desert-expedition.png + desert-expedition.json: best-score target 500.
neon-orbit.png + neon-orbit.json: best-score target 1000.
polar-signal-jump-bounce.gif: 320x240, 70 frames, 6-second looping storyboard.
desert-expedition-jump-bounce.gif and neon-orbit-jump-bounce.gif: theme previews.
previews/: composed gameplay screens at 1x/4x and a 3x GIF.
validation-report.json: export checks and their limits.
generation-prompts.txt: artwork prompts and tool provenance.

Each sheet is a 2048x1024 RGBA PNG with 16 opaque colors plus transparency.
Each JSON contains 61 named frames. All three have IDENTICAL frame names,
rectangles, anchors, durations, animation sequences and scene coordinates.
The PNG can therefore be swapped while retaining the same frame lookup.
The image filename, theme name, palette and unlock metadata differ.
No game code is included. Unlock persistence and score logic belong to the game.

FRAME INVENTORY
16 cosmonaut frames, all 24x32, anchor (12,30):
emerge_0/1/2, crouch, takeoff, rise, apex, descend, land_squash,
land_recover, fall_0/1/2, board_0/1, idle. Names have the cosmonaut_ prefix.
5 bridge frames, 32x12, anchor (16,2):
bridge_idle, bridge_move_left, bridge_move_right, bridge_dip, bridge_recover.
2 crater layers, 32x16, anchor (16,6): crater_back and crater_front.
2 rocket frames, 48x96, anchor (24,92): rocket_closed, rocket_open.
4 rover frames, 48x40, anchor (24,36): rover_closed_0/1, rover_open_0/1.
3 HUD icons, 12x12: hud_score_icon, hud_life, hud_life_empty.
10 digits, 8x12: hud_digit_0 through hud_digit_9.
2 labels, 36x10: hud_score_label and hud_lives_label.
4 buttons, 24x48: touch_left_idle/pressed, touch_right_idle/pressed.
1 opaque background, 320x240. It contains scenery, the continuous road,
blank HUD band and blank side gutters, with no gameplay objects baked in.
12 transparent ambient layers, each 320x240 with anchor (0,0):
ambient.sky_0/1/2/3, ambient.drift_0/1/2/3, ambient.signal_0/1/2/3.

ATLAS CONVENTIONS
Frame x/y/w/h are integer source pixels in the sheet. Frames are not rotated
or trimmed at runtime. Transparent padding is part of the frame rectangle.
Anchor x/y are PIXELS relative to that rectangle's top-left, not fractions.
Draw top-left = desired world anchor position minus the frame anchor.
Durations are milliseconds. A duration of 0 means hold until a state change.
The animations object lists frame names in order and gives loop behavior.
Use nearest-neighbor sampling, integer destination coordinates and no mipmaps.
Transparent gutters separate frames. PNG alpha is straight, binary 0 or 255.
The palette in each JSON is the production palette, refined from the concepts.

LAYOUT AT 320x240
HUD: y0..23. Landscape: x24..295, y24..239.
Rocket anchor (50,180); rover anchor (272,180).
Four crater anchors: (104,184), (144,184), (184,184), (224,184).
Bridge anchor: selected crater x, y182. Only ONE bridge is drawn.
Touch rectangles: left (0,152,24,48), right (296,152,24,48).
The JSON layout includes the score, digits, life icons and other placements.
Mobile hit areas should follow the displayed viewport scale; logical pixels
here do not specify a minimum physical touch target size.

JUMP / BOUNCE HANDOFF
The sprites provide poses; they do not contain a trajectory.
The game owns position, speed, collision timing, successful landings and misses.
Use crouch -> takeoff -> rise -> apex -> descend for each arc.
On successful contact: land_squash -> land_recover -> crouch -> takeoff.
Trigger bridge_dip -> bridge_recover -> bridge_idle at that contact.
Keep the cosmonaut's foot anchor attached to the visible plate center while
the landing pose holds. The bridge frames give contactOffsetY:
idle 0; move left/right 1; dip 3; recovery 2 pixels below the bridge anchor.
For the default y182 bridge, dip contact is y185 and recovery contact is y184.
These offsets were measured from the exported center-column artwork.
The 6-second GIF is an offline motion reference, not a gameplay speed target.

On a miss, play fall_0 -> fall_1 -> fall_2 while the game moves the foot anchor
down into the crater. Draw crater_front over the falling actor, then remove
the actor when the fall finishes. The front lip has transparent space above it.
Do not use the bridge landing squash on a missed landing.
Draw the crater back first, vehicles, bridge, actors, and then the front lip
for a falling actor. Draw HUD and controls last.
Emergence and boarding poses are right-facing. Position and doorway clipping
are controlled by the game; remove the actor after board_1 and close the door.
Rover idle alternates the matching open or closed door pair at 420 ms/frame.

AMBIENT LOOPS
All ambient frames are full-screen transparent overlays, placed at (0,0).
Their art is already registered to the shared layout, so a PNG-only theme swap
also changes the effects without needing different placement instructions.

Group             Polar Signal       Desert Expedition       Neon Orbit
ambient.sky       Aurora shimmer     Foreground heat waves   Variable-rate stars
ambient.drift     Passing snow       Rising rocket smoke     Shooting star
ambient.signal    Antenna beacon     Small dust devil        Rover light pulse

ambient.sky cycles four 500 ms phases (2 seconds).
ambient.drift cycles 120, 120, 240, 2520 ms phases (3 seconds).
Its fourth frame is intentionally transparent: a quiet rest after dispersal.
ambient.signal cycles four 250 ms phases (1 second).
The loops return together every 6 seconds, matching the preview duration.
Drive their clocks independently of cosmonaut movement. Different star pixels
blink on different phases within the same sky layer. Effects stay outside
the HUD, side-control gutters and central jump corridor (x72..242, y132..198).
The rocket and rover indicators sit on the vehicles outside that corridor.
Draw sky/drift over the scenery and behind vehicles; draw signal over vehicles.
All effects use only the theme palette. There are no additional mechanics.

VALIDATION
Checked: all atlas bounds; no intersecting frame rectangles; identical
cross-theme metadata; nonempty frames; binary transparency; 16 opaque colors;
all animation references; distinct door, idle, landing and pressed states;
bridge contact offsets; GIF frame count, positive delays and duration.
Also checked every opaque ambient pixel stays out of the protected regions.
Inspected: assembled views for all themes and Polar jump/landing contact frames.
Not tested: integration in the game, collisions, input, mobile devices,
theme unlocking or saved progress. Those require the game implementation.

Artwork: built-in imagegen. Export and offline compositing: ImageMagick.
