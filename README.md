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
- `npm run desktop:start` starts the Electron development environment.
- `npm run test` runs renderer, preset, storage, and export tests.
- `npm run typecheck` validates TypeScript.
- `npm run build` creates the production web build.
- `npm run desktop:package` creates an unpacked desktop build for local checks.
- `npm run desktop:make` creates the Windows x64 portable ZIP plus SHA-256.

## Desktop app (Electron)

The desktop build wraps the same React/Vite renderer in Electron Forge. The
main process owns the window lifecycle and native file dialogs; a sandboxed
preload exposes only a minimal `window.pixelEffectDesktop` bridge. The renderer
keeps no Node.js, filesystem, or generic IPC access.

Portable usage:

1. Run `npm run desktop:make` (or download the release ZIP) and extract
   `PixelEffectGenerator-<version>-win32-x64.zip` anywhere.
2. Launch `PixelEffectGenerator.exe`. No installation, registry writes, or
   administrator rights are required.

Notes:

- The first release is **not code-signed**, so Windows SmartScreen may show a
  warning; this is expected until signing is added.
- The portable ZIP does not mean the configuration is fully portable: UI
  preferences and custom presets live in the Electron user-data directory.
  Project JSON files are the portable project format and can be moved freely.
- In the desktop app every export and Project open uses the native Windows
  file dialog; in the browser the existing download links and hidden file
  inputs are used unchanged.

Publishing:

- Pushing a `v*` tag runs the `desktop-release` workflow: it verifies the tag
  equals `v${package.json.version}`, runs tests, typecheck, and the web build,
  then builds the Windows x64 ZIP, uploads it as a CI artifact, and creates a
  GitHub Release with the ZIP and SHA-256. A `workflow_dispatch` run only
  uploads the artifact and never creates a Release. Releasing an existing tag
  fails instead of overwriting it.

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
