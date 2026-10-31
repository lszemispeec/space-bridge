Astra's accepted art package used a different atlas schema, oversized and misregistered sprites, and the earlier playfield layout. This adapts all three themes to PR #1's unchanged contract and fixed 320×240 layout.

- Masters under `assets/<theme>/`: 61 frames and 29 animations per theme, identical geometry/anchors/timing, original 16-colour palettes and binary transparency. Byte-identical runtime copies at the existing `public/atlas/` URLs.
- Correct frame/animation names, required entries, loop flags, positive holds, feet/vehicle anchors, vehicle door registration, ambient placement and plate contact. Simplify noisy backgrounds and clean native sprites. The complete difference table is in `assets/README.md`; each theme's `changes.json` records every frame and both animation tables.
- Include native and exact 4× screens, every animation strip, six-second ambient/bounce GIFs, palette hex files, provenance and a read-only pixel audit.

Validation: `npm run check` passes (typecheck, lint, 69 tests, production build). `python3 assets/tools/verify-art.py` passes all 183 frames, preview palettes/alpha, bounds, non-overlap, protected regions, foot registration, strips, GIF timing, exact 4× enlargement and byte-identical runtime copies. Inspected all frames at 1× and integer enlargement.

No game logic or contract changes. The renderer still uses placeholders; loading/drawing the new atlas and device playtesting remain integration work. Measured landing-contact placement is documented for that handoff.

Based on the final DEIM-431 branch (`cc19594`), as requested. PR #1 merged while this art work was in progress; this PR retains its requested DEIM-431 base branch.
