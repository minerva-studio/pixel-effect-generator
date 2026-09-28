# Pixel Effect Generator

[简体中文](README.zh-CN.md) · [Open the web app](https://minerva-studio.github.io/pixel-effect-generator/) · [Windows releases](https://github.com/minerva-studio/pixel-effect-generator/releases)

Pixel Effect Generator is a browser and Windows desktop editor for pixel-art visual effects. Adjust a generator, preview its animation frame by frame, and export sprite sheets, animated images, or assets for Unity 6. Rendering is deterministic: the same parameters and seed produce the same pixels.

## Generators

| Stage | Generator | Effect |
| --- | --- | --- |
| Stable | Slash | Weapon trails and sweeping attack arcs |
| Stable | Explosion | Fire, smoke, shock blasts, rolling fireballs, and retro explosions |
| Stable | Fireball | Looping fireball flight in four forms |
| Stable | Flame | Looping candle, torch, and campfire flames |
| Experimental | Arrow | Solid and energy arrow flight loops |
| Experimental | Crystal | Faceted crystal projectile loops |
| Experimental | Energy Bloom | Petal, star, and corolla energy effects |

Experimental generators are still being refined; their parameters and output may change.

## Make an effect

1. Choose **New** and select a generator. The dialog separates stable and experimental generators.
2. Start from a built-in preset or save your own. Adjust the generator's shape, motion, material, and effect controls where available. A restore action appears beside the generator name when the effect differs from its preset or default settings.
3. Edit colors directly in the color dock below the playback controls. Click a swatch to change its HEX value, opacity, or position; use **Color cards** to apply a palette. Lock colors before applying a preset to keep the current colors.
4. Play or scrub the preview. Adjust frame count, playback speed, canvas size, and seed as needed.
5. Use **Save** to keep an editable project, or **Export** to create assets.

The interface is available in English and Simplified Chinese. The web editor uses browser file downloads and uploads; the Windows app adds native file dialogs and recent projects.

## Export formats

| Format | Contents |
| --- | --- |
| PNG sprite sheet | Transparent frames in a horizontal strip or compact grid |
| GIF / APNG | Animated image, with optional looping |
| Unity 6 ZIP | Sprite atlas PNG, Unity `.meta` file, and manifest; pixels per unit and GUID are configurable |
| Frame ZIP | One transparent PNG per frame and a manifest |

**Project JSON** is available through **Save** and **Open**, separately from the image exports. It stores generator settings (including the current colors), canvas and animation settings, seed, and Unity export settings. Custom preset and color-card libraries stay in local app storage; they are not included in project files.

Energy Bloom currently supports PNG, GIF, and APNG export, but does not yet support project JSON, Unity ZIP, or frame ZIP.

## Run locally

Use Node.js 22 and npm:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. On Windows, `dev.cmd` also starts the development server and opens a browser.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the web development server |
| `npm run build` | Typecheck and build the production web app |
| `npm run typecheck` | Check TypeScript without building |
| `npm run test` | Run the Vitest suite |
| `npm run tauri:dev` | Run the Windows desktop app in development |
| `npm run tauri:build` | Build the Windows desktop installer |

Desktop development and builds also require Rust and the Tauri 2 Windows prerequisites. The desktop installer uses NSIS and WebView2.

## Project layout

- `src/generators/<id>/` contains each generator's parameters, renderer, controls, presets, and project codec where supported.
- `src/generators/registry.ts` registers generators and defines their order and stage.
- `src/shared/` contains pixel rendering, palette, project, and export primitives.
- `src/components/` contains the workbench, preview, color dock, presets, and export UI.
- `src/i18n/resources/` contains the English and Simplified Chinese strings.
- `src-tauri/` contains the Windows desktop shell.

The web app is deployed from `main`. Version tags matching `package.json` trigger Windows release builds.

## License

[MIT](LICENSE) © 2026 Minerva Game Studio.
