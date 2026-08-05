# Pixel Effect Generator

A growing collection of deterministic tools for generating pixel-art visual
effects. Each generator owns a focused parameter model and writes directly to
RGBA pixel buffers, keeping the rendering algorithms portable to C# or
WebAssembly without depending on Canvas drawing behavior.

Released under the MIT License by Minerva Game Studio.

## Features

- Deterministic, binary-alpha pixel rendering with per-frame transparency.
- Live preview with integer zoom (Fit / 1× / 2× / 4× / 8×), playback, frame
  scrubbing, and FPS control.
- Slash generator with shape, palette, motion, fragments, and breakup
  categories, built-in effect presets, and browser-local custom presets.
- Export center:
  - Project JSON save/load for the complete current effect state.
  - Horizontal and compact-grid transparent PNG sprite sheets.
  - Unity 6 package (atlas PNG + `.meta` + `manifest.json`) with configurable
    Pixels Per Unit and stable GUID.
  - GIF and APNG animations with loop control.
  - Per-frame transparent PNG ZIP.
  - Collapsible sprite-sheet preview that uses the exact same packing as the
    export.
- English and Simplified Chinese UI.

## Project vs Export

**Project** (the `Project ▾` menu in the parameter header) saves and restores
the complete current effect: generator parameters, random seed, playback FPS,
and Unity PPU/GUID. Importing renders the whole frame set once and replaces the
session atomically; failures never leave partial state.

**Export** (the Export panel) only produces finished assets from the
already-rendered frames: PNG sprite sheets, Unity 6 packages, GIF/APNG, and
frame ZIPs.

Custom presets are stored only in the current browser (localStorage) and are
never written into Project JSON. Project JSON migrates the current effect but
not the preset library, and Reset never deletes custom presets.

## Commands

- `npm run dev` starts the local Vite development server.
- `npm run test` runs renderer, preset, storage, and export tests.
- `npm run typecheck` validates TypeScript.
- `npm run build` creates the production web build.

## Architecture

Generators live as vertical slices under `src/generators/<id>/`. Each slice
owns its parameter model, rendering pipeline, controls, and tests. Shared
primitives (`PixelFrame`, colors, PRNG, sprite sheets, preview zoom) live under
`src/shared/`, and the generic workspace, preview, presets, and form controls
live under `src/components/`. `src/generators/registry.ts` is the single source
of truth for navigation and workspace modules, and per-generator sessions are
kept independently so switching generators preserves parameters and playback
state.

## Adding a generator

1. Create `src/generators/<id>/` with a `GeneratorModule` implementing the
   contract in `src/generators/contract.ts`: definition, categories, default
   parameters, `render`, frame-count read/write adapters, and a `Controls`
   component.
2. Optional capabilities on the module:
   - `projectCodec` — enables the Project save/load menu.
   - `presetCapability` — enables the preset toolbar (built-ins and custom
     presets).
   - `resize` / `minimumFrameSize` / `maximumFrameSize` — enables canvas
     resizing.
   - `PreviewTools` — extra controls under the preview timeline.
3. Register the module in `src/generators/registry.ts`; navigation and the
   workspace pick it up without changes.
4. Add tests under `src/generators/<id>/tests/` covering the model, rendering,
   and any pure helpers. Keep rendering deterministic and binary-alpha.

## Generator 01: Slash

Slash uses a guided five-category parameter menu for shape, palette, motion,
fragments, and breakup. It supports built-in effect presets (Clean Arc, Heavy
Cleave, Energy Sweep, Shattered Edge, Full Circle) and up to 32 browser-local
custom presets, editable 2–6 color bands, bidirectional sweeps, multiple
deterministic breakup and fragment modes, live playback with integer zoom,
frame scrubbing, and transparent PNG sprite-sheet, Unity 6, animation, and
frame-ZIP export.
