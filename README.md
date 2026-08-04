# Pixel Effect Generator

A growing collection of deterministic tools for generating pixel-art visual effects. Each generator owns a focused parameter model and writes directly to RGBA pixel buffers, keeping the rendering algorithms portable to C# or WebAssembly without depending on Canvas drawing behavior.

The first generator is **Slash**, a parameter-driven animated weapon-trail effect.

Released under the MIT License by Minerva Game Studio.

## Commands

- `npm run dev` starts the local Vite development server.
- `npm run test` runs renderer and sprite-sheet tests.
- `npm run typecheck` validates TypeScript.
- `npm run build` creates the production web build.

## Generator 01: Slash

Slash uses a guided four-category parameter menu for shape, palette, motion, and breakup. Breakup settings are grouped by arc breakup, fragments, and deterministic pattern controls. It supports a fixed 128×128 canvas, editable 2–6 color bands, bidirectional sweeps, ordered pixel dissolve, deterministic edge breakup and fragments, live playback, frame scrubbing, and horizontal transparent PNG sprite-sheet export.
