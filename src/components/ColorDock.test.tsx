import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ColorDock, ColorDockView } from './ColorDock'
import { I18nProvider } from '../i18n/I18nProvider'
import '../generators/registry'
import { slashModule } from '../generators/slash/module'
import { projectileModule } from '../generators/projectile/module'

afterEach(() => vi.unstubAllGlobals())

describe('ColorDock', () => {
  it('shows one compact row for a single-slot generator', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    const markup = renderToStaticMarkup(<I18nProvider><ColorDock slots={slashModule.paletteSlots} parameters={slashModule.defaultParameters} onParameters={() => undefined} locked={false} onLockedChange={() => undefined} /></I18nProvider>)
    expect(markup.match(/class="color-dock-row"/g)).toHaveLength(1)
    expect(markup.match(/class="color-dock-swatch"/g)).toHaveLength(slashModule.paletteSlots[0].read(slashModule.defaultParameters).length)
    expect(markup).toContain('aria-label="Generator colors"')
  })

  it('shows two compact rows for a multi-slot generator', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    const markup = renderToStaticMarkup(<I18nProvider><ColorDock slots={projectileModule.paletteSlots} parameters={projectileModule.defaultParameters} onParameters={() => undefined} locked={false} onLockedChange={() => undefined} /></I18nProvider>)
    expect(markup.match(/class="color-dock-row"/g)).toHaveLength(2)
    expect(markup.match(/class="color-dock-swatch"/g)).toHaveLength(projectileModule.paletteSlots.reduce((count, slot) => count + slot.read(projectileModule.defaultParameters).length, 0))
  })

  it('renders one full palette editor per slot when expanded', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    const markup = renderToStaticMarkup(<I18nProvider><ColorDockView slots={projectileModule.paletteSlots} parameters={projectileModule.defaultParameters} onParameters={() => undefined} expanded activeColor={null} onActiveColor={() => undefined} onToggleExpanded={() => undefined} locked={false} onLockedChange={() => undefined} /></I18nProvider>)
    expect(markup).toContain('class="color-dock expanded"')
    expect(markup.match(/class="palette-editor"/g)).toHaveLength(2)
    expect(markup.match(/class="color-dock-row"/g)).toHaveLength(2)
  })

  it('exposes the color lock as a pressed state', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    const markup = renderToStaticMarkup(<I18nProvider><ColorDockView slots={slashModule.paletteSlots} parameters={slashModule.defaultParameters} onParameters={() => undefined} expanded={false} activeColor={null} onActiveColor={() => undefined} onToggleExpanded={() => undefined} locked onLockedChange={() => undefined} /></I18nProvider>)
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('Lock colors: keep current colors when applying a preset')
    expect(markup).toContain('color-dock locked')
  })
})
