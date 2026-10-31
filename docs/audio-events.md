# Audio event API

The game emits named events. The audio engine plays them. The names are the contract. The TypeScript side lives in `src/audio/api.ts`.

## Interface

```ts
interface AudioSink {
  play(event: AudioEvent): void;          // one sound effect
  music(theme: ThemeId | null): void;      // start a theme loop, or stop with null
  setMuted(muted: boolean): void;
  unlock(): void;                          // called from the first user gesture
}
```

The engine is `audio` in `src/audio/index.ts`. `src/main.ts` installs it with `createApp({ canvas, audio })`; `app.setAudio(engine)` swaps it at run time. Without an engine, `nullAudio` keeps the app silent, which the tests use.

## Events

| Event | Fires when |
|---|---|
| `footstep` | A cosmonaut leaves the rocket. |
| `jump` | A cosmonaut takes off from a slot. |
| `bounce` | A cosmonaut lands on the plate. |
| `plate_move` | The player moves the plate one slot. Not fired at the ends. |
| `save` | A cosmonaut boards the rover. |
| `fall` | A cosmonaut misses the plate and falls. |
| `life_lost` | Right after `fall`, in the same step. |
| `unlock` | The score passes a theme's unlock target. |
| `game_over` | The last life is gone. |

`fall` and `life_lost` arrive together. Play one of them, or layer them. The game never fires `game_over` in the same step as `fall`; it waits for the freeze to end.

## Music

- `music(themeId)` is called on the first user gesture with the saved theme, on every `round_start`, and on `theme_changed`. Asking for the theme that is already playing is a no-op, so the loop does not restart between rounds. After `game_over`, the engine plays a jingle and returns to the loop by itself; the `round_start` call cuts the jingle short if the player restarts at once.
- Theme ids: `polar-signal`, `desert-expedition`, `neon-orbit`. The config in `src/config/themes.ts` also carries a `music` field per theme for the engine's own track names.
- `setMuted` is called on start-up with the saved value and whenever the player toggles mute (key `M`). Persisting the flag is the game's job; the engine only applies it.

## Other game events

The game emits more events than the sound list: `round_start`, `theme_changed`, `mute_changed`, `save_changed`. Subscribe to everything with `app.onEvent((event, state) => ...)`. `window.spaceBridge` exposes the app in the browser for debugging and playtests.

## Timing

Events come from the fixed-timestep simulation at 60 Hz. The audio engine should schedule sounds with its own look-ahead and must not block.
