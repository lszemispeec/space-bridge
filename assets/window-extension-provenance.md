# Window plate extension

The built-in imagegen tool edited each theme's background raster separately.
The edit target was the native 320×240 `background` crop from the pre-revision
atlas, including its flat HUD band and gutters. No CLI/API fallback was used.

The selected generated extension was sampled to 320×240 on a point grid and
mapped to the original 16-colour palette without dithering. Every accepted
centre pixel at x32…287/y30…239 was restored byte-for-byte. The ground/road
bands continue at their original heights. Two edge columns match the old crop
seams. Polar flecks above the mountains were removed; its sky stays clear.
Neon's new top sky has three intentional single-pixel stars. The final PNGs
are fully opaque and use the same palette as their matching atlas.

Production outputs: `assets/polar-signal/window-plate.png`,
`assets/desert-expedition/window-plate.png`, `assets/neon-orbit/window-plate.png`.
`tools/clean-window-plates.mjs` records the cleanup procedure; the current atlas
export reads the committed native outputs and does not need regeneration.

Exact prompt template (one call per theme, substituting the theme ID):

> Use case: precise-object-edit. Edit target: the supplied {theme} native pixel-art background, logically 320x240. Remove ONLY the flat dark UI bars at x0..31 and x288..319, plus y0..29. Replace those bars with seamless sky / mountain / ground / foreground continuation all the way to image edges. Preserve the central scene x32..287,y30..239 exactly in position, scale, composition, colour and pixel grid. Do NOT enlarge or crop the central scene. Continue the flat ground bands at y125..167 and y168..189 horizontally; extend foreground rock shapes at y190..239 and distant mountains at the sides. Top becomes existing sky colour (Polar cream, Desert turquoise, Neon dark navy with just a few tiny stars). No frame, UI, text, sprites, doors, aurora, gradients, blur or antialiasing. Keep one logical pixel scale, clean flat colours from the reference palette. Output one full-bleed 4:3 pixel-art plate. This is a surgical outpaint of the old flat bars inside the same canvas, not a redesigned scene.
