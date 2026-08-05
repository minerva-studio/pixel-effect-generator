# Pixel Effect Generator

A growing collection of deterministic tools for generating pixel-art visual effects. Each generator owns a focused parameter model and writes directly to RGBA pixel buffers, keeping the rendering algorithms portable to C# or WebAssembly without depending on Canvas drawing behavior.

The first generator is **Slash**, a parameter-driven animated weapon-trail effect.

Released under the MIT License by Minerva Game Studio.

## Commands

- `npm run dev` starts the local Vite development server.
- `npm run test` runs renderer and sprite-sheet tests.
- `npm run typecheck` validates TypeScript.
- `npm run build` creates the production web build.

## Architecture

Generators live as vertical slices under `src/generators/<id>/`. Each slice
owns its parameter model, rendering pipeline, controls, and tests. Shared pixel
primitives (`PixelFrame`, colors, PRNG, sprite sheets, math helpers) live under
`src/shared/pixel/`, and the generic workspace, preview, and form controls live
under `src/components/`. `src/generators/registry.ts` is the single source of
truth for navigation and workspace modules, and per-generator sessions are kept
independently so switching generators preserves parameters and playback state.

## Adding a generator

1. Create `src/generators/<id>/` with a `GeneratorModule` implementing the
   contract in `src/generators/contract.ts`: definition, categories, default
   parameters, `render`, frame-count read/write adapters, and a `Controls`
   component.
2. Register the module in `src/generators/registry.ts`; navigation and the
   workspace pick it up without changes.
3. Add tests under `src/generators/<id>/tests/` covering the model, rendering,
   and any pure helpers. Keep rendering deterministic and binary-alpha.

## Generator 01: Slash

Slash uses a guided five-category parameter menu for shape, palette, motion, fragments, and breakup. It supports preset and custom 16–512 px canvases, editable 2–6 color bands, bidirectional sweeps, multiple deterministic breakup and fragment modes, live playback, frame scrubbing, and horizontal transparent PNG sprite-sheet export.
