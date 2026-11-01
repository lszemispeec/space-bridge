# Space Bridge audio

Chiptune engine and content, all generated in code with the Web Audio API. There are no audio files.

## Use in the game

```ts
import { audio } from './audio';

createApp({ canvas, audio });  // `audio` implements AudioSink from src/audio/api.ts

// What the game calls through AudioSink:
audio.unlock();                // from the first user gesture
audio.music('polar-signal');   // loops; remembered until unlock
audio.play('jump');            // one of the AudioEvent names in api.ts
audio.setMuted(true);          // the game save owns and persists the flag
audio.setTempo(1.15);          // theme loop speed; the game sends the mode's tempo in a round

// Extras, for the demo page or an options screen:
audio.jingle('gameOver');      // interrupts the music; the theme loop resumes after
audio.setVolume('music', 0.4); // volumes persist in localStorage
audio.onSettings((s) => icon.textContent = s.muted ? 'off' : 'on');
```

Events and themes are the ones in `src/audio/api.ts` and `src/config/themes.ts`: `footstep`, `jump`, `bounce`, `plate_move`, `save`, `fall`, `grab`, `life_lost`, `unlock`, `game_over`; `polar-signal`, `desert-expedition`, `neon-orbit`, `vector`. `play('game_over')` plays the sting and the game-over jingle; the theme loop comes back when the jingle ends.

SFX calls before the first user gesture are dropped; a `music()` call is remembered and starts at unlock.

## Listen

- `npm run dev`, then open `/audio-demo.html`. Buttons or keys `1`–`9`, `0` (SFX), `F` (the miss: fall, grab and life_lost as one step), `Q` `W` `E` `R` (themes), `G` (jingle), `M` (mute), `S` (stop). The page can also render WAVs in the browser.
- `npm run audio:render` writes every track and effect, plus `sfx-fall-step` (the miss as heard in the game), to `renders/` as WAV and, when `ffmpeg` is on the PATH, MP3. It runs the same engine on an offline context in Node.

## How it is built

| File | Role |
|---|---|
| `chip.ts` | Wavetables (12.5 / 25 / 50 % pulse, 4-bit stepped triangle, 15-bit LFSR noise) and `ChipVoice`, one always-running channel driven by param automation. No allocation per note. |
| `song.ts` | Typed song format and the pattern compiler. Patterns are text: `C4` note, `-` hold, `.` rest, `@name` instrument switch, drum tokens by instrument name. |
| `sequencer.ts` | Look-ahead step sequencer with loop points and a tempo multiplier. |
| `mixer.ts`, `settings.ts` | Master, music and SFX buses; volumes persisted under `spaceBridge.audio`. Mute is applied, not stored: the game save owns it. |
| `sfx.ts` | The ten effects as data. An effect's `offset` orders the ones the game fires in one step: `life_lost` waits for the grab. |
| `songs/` | Four themes and the jingle. `motif.ts` holds the shared four-bar motif ("A A E, D C, D E A"); each theme transposes and re-dresses it. |
| `engine.ts` | Ties voices, sequencer and mixer together on any `BaseAudioContext`. |
| `render.ts` | Offline rendering and a WAV encoder, used by the demo page and the render script. |
| `index.ts` | The browser facade `audio`: the game's `AudioSink`, autoplay unlock and the scheduling timer. |

Every `setTargetAtTime` is preceded by a `setValueAtTime` with the analytically computed envelope level. Browsers do not need that, but the Node renderer (`node-web-audio-api`) computes a future target event backwards without it, and keeping the two identical is what makes the renders trustworthy.
