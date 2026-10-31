# Space Bridge

A retro pixel-art browser game in TypeScript. It is inspired by the Elektronika IM-09 "Космический мост" handheld from the 1980s.

Cosmonauts climb out of a hatch high on the rocket, drop from its ledge to the first crater, and hop on to the rover across a road with four craters. You move the bridge plate under each landing. If you miss, the cosmonaut falls into the crater, and whatever lives in there grabs it. Three misses end the game.

## Play

- **Left / Right arrows** or **A / D**: move the plate; the levers on the console deck pull with each press. On the title screen, left starts Game A and right starts Game B.
- **Touch**: tap the left or right half of the screen. Every press moves the plate one crater, in order.
- **T**: cycle unlocked themes (title screen). **M**: mute. On touch, tap the THEME and SOUND buttons on the title screen, or the SND / MUTE readout on the console.
- Game A is slower. Game B starts faster and climbs higher. Each mode keeps its own high score.
- Cosmonauts leave the rocket only when the plate can reach every landing in time. The promise (a reaction margin, then one press interval per extra crater) is in `src/config/difficulty.ts`. It shrinks with the speed curve, and the curve is tuned so a good player (0.22 s reaction, 0.15 s per press) can follow the longest trip, from crater 4 back to crater 1, at the top speed of both modes, and still has the reaction margin at the top of Game B.
- A round starts calm, with one or two cosmonauts, and fills up with the score: the density ramp in `src/config/difficulty.ts` raises the cap and shortens the spawn gaps until four or five are on screen at the top of the curve. The scheduler promise holds all the way up.
- The crater creatures are cosmetic: one pair of eyes at a time peeks out of a random crater, blinks and looks around, and now and then a tentacle reaches up; a miss is a grab. `src/game/creatures.ts`, stepped by the renderer with its own seeded RNG.
- Themes unlock with your best score: Desert Expedition at 250, Neon Orbit at 575.

## Run

Node 22 or newer (`.nvmrc` pins 22; `nvm use` picks it up).

```sh
npm install
npm run dev        # http://localhost:5173, also reachable on the LAN for phones
npm run check      # typecheck, lint, test, build
npm run measure    # how far bots of different skill get, for tuning unlock targets
npm run shots      # 4x screenshots of every theme, title and play, plus portrait and landscape phone shots, from a running preview (needs Chrome)
npm run record     # a 16-19.5 s Game A clip with sound from a running preview (needs Chrome; ffmpeg for the MP4)
```

For `npm run shots`, build and start the preview first: `npm run build && npm run preview -- --port 4173`. The images land in `shots/`.

## Stack

- Vite, strict TypeScript, Canvas 2D. No game engine.
- 320×240 internal scene, shown through the windshield of the operator room: a 352×320 canvas with the frame around the scene and the console deck with the HUD and the levers below it. The scene is drawn with the atlas's full-bleed `background.window` plate, so the sky and the terrain reach the glass. Integer scaling in device pixels, nearest-neighbour, letterboxed; a 1080p desktop shows the room at 3×. On a portrait screen the room is 288×344: the 256 px playfield is scaled to the width, and the lever taps move into a strip at the bottom of the console (`src/config/layout.ts`, `src/platform/viewport.ts`).
- Fixed-timestep simulation at 60 Hz, rendering once per frame.
- Game rules are pure modules in `src/game/` with Vitest tests. `src/platform/` and `src/render/` are thin adapters.
- Content is config: `src/config/layout.ts`, `src/config/themes.ts`, `src/config/difficulty.ts`.
- Save data lives in `localStorage` under a versioned key.

## Contracts

- Sprites: [docs/atlas-contract.md](docs/atlas-contract.md) and `src/render/atlas.ts`.
- Audio: [docs/audio-events.md](docs/audio-events.md) and `src/audio/api.ts`.

## Layout

```
src/
  config/     layout, themes, difficulty (data)
  game/       pure rules: step(), positions, save, unlocks, rng
  platform/   loop, input, canvas scaling, storage
  render/     atlas renderer and playback, bitmap font, atlas contract
  audio/      chiptune engine, SFX, theme music and the audio event API
  app.ts      wires everything together
assets/       art masters per theme, with previews and change reports
public/atlas/ the sheets and atlases the game loads
scripts/      screenshot and recording tools
docs/         contracts for art and audio
```

The renderer draws everything from the theme's atlas. A theme's sheet loads when it is unlocked or selected; the title screen shows LOADING until the first sheet is decoded.
