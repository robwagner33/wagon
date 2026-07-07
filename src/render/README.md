# wagon/render

Canvas/browser drawing helpers — the **only** DOM-coupled module. Anything touching
`CanvasRenderingContext2D`, images, the viewport transform, or the animation-frame loop lives here.

## What belongs here

Game-agnostic draw + view utilities. No game art or entity-specific drawing (a game draws its own
skaters/tiles/effects on top of these).

## Files

- `index.ts` — `drawAtlasCell`: blit one atlas cell (optionally mirrored).
- `view.ts` — camera/viewport transform (`setViewport`, `screenToWorld`, `tilePx`, …).
- `sprite.ts` — `loadImage`.
- `spritesheet.ts` — named-sprite drawing (`SpriteSheet`, rotation/pivot draw opts).
- `loop.ts` — `createGameLoop`: a fixed-step + render animation-frame loop.
