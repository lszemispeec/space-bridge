# Space Bridge

A retro pixel-art browser game in TypeScript. It is inspired by the Elektronika IM-09 "Космический мост" handheld from the 1980s.

Cosmonauts jump from the rocket to the rover across a road with four craters. You move the bridge plate under each landing. If you miss, the cosmonaut falls into the crater. Three misses end the game.

## Play

- **Left / Right arrows** or **A / D**: move the plate. On the title screen, left starts Game A and right starts Game B.
- **Touch**: tap the left or right half of the screen.
- **T**: cycle unlocked themes (title screen). **M**: mute.
- Game A is slower. Game B starts faster and climbs higher. Each mode keeps its own high score.
- Themes unlock with your best score: Desert Expedition at 500, Neon Orbit at 1000.

## Run

Node 22 or newer (`.nvmrc` pins 22; `nvm use` picks it up).

```sh
npm install
npm run dev        # http://localhost:5173, also reachable on the LAN for phones
npm run check      # typecheck, lint, test, build
```

## Stack

- Vite, strict TypeScript, Canvas 2D. No game engine.
- 320×240 internal canvas, integer scaling, nearest-neighbour, letterboxed.
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
  render/     placeholder renderer, bitmap font, atlas contract
  audio/      audio event API (engine arrives on a separate issue)
  app.ts      wires everything together
docs/         contracts for art and audio
```

Art is placeholder rectangles until the sprite atlases land.
