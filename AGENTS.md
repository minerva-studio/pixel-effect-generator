# Source file naming

File casing follows the owning module, not the presence of JSX:

- Named UI modules in `src/components/`, `src/i18n/`, and `src/studies/` use PascalCase (`ColorDock.tsx`, `Controls.tsx`, `I18nProvider.tsx`). `src/App.tsx` follows the same rule.
- Generator feature directories use lowercase role names (`module.ts`, `controls.tsx`, `renderer.ts`, `split.tsx`). Entrypoints and helper modules use lowercase or lowerCamelCase (`main.tsx`, `paletteOps.ts`, `documentSession.ts`).
- A test file keeps the exact stem and casing of the source file it covers (`Controls.test.tsx`, `controls.test.tsx` within a generator).

Choose the owning module first, then apply its filename form consistently. Do not treat both forms as interchangeable within the same module.
