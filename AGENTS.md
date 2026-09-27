# Pixel Effect Generator

React 19 + Vite + TypeScript app that renders deterministic pixel-art VFX (slash, explosion, fireball, flame, projectiles, energy bloom) into RGBA buffers and exports sprite sheets, Unity 6 packages, GIF/APNG, and frame ZIPs. The same frontend ships as a GitHub Pages site and a Tauri 2 Windows desktop app (`src-tauri/`).

# Commands

- `npm run dev` — Vite dev server (`dev.cmd` does the same and opens a browser).
- `npm run test` — Vitest, all suites. Target one file with `npx vitest run <path>`.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run build` — typecheck + production web build.
- `npm run tauri:dev` / `npm run tauri:build` — desktop app / Windows NSIS installer.

Run `npm run typecheck` and the relevant tests before calling a change done. CI (`deploy-pages` on every push to `main`) runs `npm run test` and `npm run build`, so a failing test blocks the site deploy.

# Layout

- `src/generators/<id>/` — one vertical slice per generator: `model.ts` (parameters, defaults, validation, resize), `renderer.ts`, `controls.tsx`, `presets.ts`, `project.ts` (Project JSON codec), `module.ts` (`defineGenerator` + `registerGenerator`), `index.ts` (public exports), and `tests/`.
- `src/generators/contract.ts` — the `GeneratorModule` contract and session reducer.
- `src/generators/registry.ts` — `GENERATOR_REGISTRY` is the single source of truth for navigation order and workspaces. Ids and indexes must be unique.
- `src/generators/shared-effects/` — building blocks reused by explosion and energy bloom (shockwave, fragments, dissolve, timing, palette).
- `src/shared/` — framework-free primitives: `pixel/` (frames, color, RNG, atlas, PNG, sprite sheets), `project/`, `preset/`, `palette/`, `unity/`, `zip/`.
- `src/components/` — generic workbench, preview, export, presets, color dock, desktop shell (`desktop/`), and toasts.
- `src/i18n/` — `resources/en.json` and `resources/zh-CN.json`.
- `src/studies/` — dev-only visual prototypes (for example `?study=vfx`), never part of the production app.

# Rendering rules

- Rendering is deterministic: the same parameters (including `seed`) always produce identical pixels. Use `createXorshift32` / `hashUnit` from `src/shared/pixel/rng.ts`; never `Math.random`, `Date`, or Canvas drawing APIs in `src/generators/` or `src/shared/pixel/`.
- Output is binary alpha: every pixel is fully opaque or fully transparent. Keep renderers writing straight to `PixelFrame` RGBA buffers so the algorithms stay portable to C#/WebAssembly.
- Golden hash tests (for example `fireball/tests/golden.test.ts`, `projectile/tests/golden.test.ts`) pin exact output. Update the expected hashes only when the visual change is intended, and say so in the commit.

# Compatibility

- Project JSON and stored custom presets are user data. Changing a parameter shape requires migrating old payloads in the generator's `project.ts` / `presets.ts` validation, not rejecting them. Legacy schemas stay frozen in their own module (see `explosion/legacy.ts`, `generators/presetMigration.ts`).
- Custom presets live in browser `localStorage` and are never written into Project JSON.
- Mark new or still-changing generators with `stage: 'experimental'` in their definition.

# Adding or changing a generator

1. Implement `GeneratorModule` from `contract.ts` in `src/generators/<id>/module.ts`. Optional capabilities: `projectCodec`, `presetCapability`, `resize` with frame-size bounds, `PreviewTools`, `paletteSlots`.
2. Register it in `GENERATOR_REGISTRY`; navigation and the workspace need no other changes.
3. Add tests under `src/generators/<id>/tests/` for the model, renderer, presets, project codec, and controls.

# UI and i18n

- Every user-visible string goes through i18n. Add the key to both `en.json` and `zh-CN.json` with identical structure (a test enforces this); templates with placeholders also need an entry in `MessageParams` in `src/i18n/messages.ts`.
- Styles live in `src/styles/*.css`; reuse the existing files instead of adding per-component CSS.
- Web and desktop share the same UI. Native file dialogs go through `DesktopProvider`; the web path keeps browser inputs and downloads.

# Source file naming

File casing follows the owning module, not the presence of JSX:

- Named UI modules in `src/components/`, `src/i18n/`, and `src/studies/` use PascalCase (`ColorDock.tsx`, `Controls.tsx`, `I18nProvider.tsx`). `src/App.tsx` follows the same rule.
- Generator feature directories use lowercase role names (`module.ts`, `controls.tsx`, `renderer.ts`, `split.tsx`). Entrypoints and helper modules use lowercase or lowerCamelCase (`main.tsx`, `paletteOps.ts`, `documentSession.ts`).
- A test file keeps the exact stem and casing of the source file it covers (`Controls.test.tsx`, `controls.test.tsx` within a generator).

Choose the owning module first, then apply its filename form consistently. Do not treat both forms as interchangeable within the same module.

# Code style

- Strict TypeScript, ES modules, no semicolons, single quotes, 2-space indent.
- Short `/** ... */` doc comments on exported types and functions; parameters and records are `readonly` and updated immutably.
- Files matching `*.local` / `*.local.test.ts` are local-only and git-ignored.

# Commits

- Conventional Commits with the generator as scope when it applies: `fix(explosion): ...`, `feat: ...`, `test(explosion): ...`, `chore: ...`.
- Commit only the files that belong to the change; leave unrelated working-tree edits (study pages, local dev hooks in `src/main.tsx`) uncommitted.
- Releases: pushing a `v*` tag that matches `package.json` `version` builds the desktop installer and publishes a GitHub Release.
