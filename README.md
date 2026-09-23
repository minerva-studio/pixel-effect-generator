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
- Flame generator with candle, torch, and campfire silhouettes, connected
  layered pixel flames, optional rising sparks, seamless loops, presets,
  and Project JSON save/load. Its 3–6 palette colors are always opaque.

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
- `npm run tauri:dev` starts the Tauri desktop development environment.
- `npm run test` runs renderer, preset, storage, and export tests.
- `npm run typecheck` validates TypeScript.
- `npm run build` creates the production web build.
- `npm run tauri:build` creates the Windows x64 NSIS installer.

## Desktop app (Tauri)

The Tauri desktop app uses the same React/Vite renderer as the web build.
Project open/save, recent projects, unsaved-change confirmation, and asset
exports use native Windows dialogs through the shared `DesktopProvider` API.
The web app continues to use browser file inputs and downloads.

Installation:

1. Run `npm run tauri:build` or download the NSIS installer from a GitHub
   Release.
2. Run the installer. It installs for the current user and does not require
   administrator rights.

Notes:

- The installer uses Tauri's `downloadBootstrapper` WebView2 mode. Windows
  already includes WebView2 on supported versions; if the runtime is missing,
  setup downloads it. An internet connection is needed only for that case.
- UI preferences and custom presets remain in browser storage for each app
  origin/profile. Project JSON files are the portable project format and can
  be moved freely.
- Desktop shortcuts: `Ctrl+N` new project, `Ctrl+O` open, `Ctrl+S` save,
  `Ctrl+Shift+S` save as, `Space` play/pause (when not focused in a control),
  `F11` full screen, `Escape` closes menus or exits full screen, and the File
  menu in the custom title bar tracks the current project and unsaved state.

Publishing:

- The web app remains on GitHub Pages: pushes to `main` run the
  `deploy-pages` workflow, and `workflow_dispatch` can publish it manually.
- Pushing a `v*` tag runs the `desktop-release` workflow: it verifies the tag
  equals `v${package.json.version}`, runs tests and typecheck, then builds the
  Windows x64 Tauri NSIS installer and records its size. The installer and its
  SHA-256 are uploaded as a CI artifact and attached to a GitHub Release. A
  `workflow_dispatch` run only uploads the artifact and never creates a
  Release. Releasing an existing tag fails instead of overwriting it.

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
