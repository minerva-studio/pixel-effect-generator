import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ColorDock } from './ColorDock'
import { I18nProvider } from '../i18n/I18nProvider'
import '../generators/registry'
import { slashModule } from '../generators/slash/module'
import { projectileModule } from '../generators/projectile/module'

afterEach(() => vi.unstubAllGlobals())

describe('ColorDock', () => {
  it('shows one compact row for a single-slot generator', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    const markup = renderToStaticMarkup(<I18nProvider><ColorDock slots={slashModule.paletteSlots} parameters={slashModule.defaultParameters} onParameters={() => undefined} /></I18nProvider>)
    expect(markup.match(/class="color-dock-row"/g)).toHaveLength(1)
    expect(markup.match(/class="color-dock-swatch"/g)).toHaveLength(slashModule.paletteSlots[0].read(slashModule.defaultParameters).length)
    expect(markup).toContain('aria-label="Generator colors"')
  })

  it('shows two compact rows for a multi-slot generator', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    const markup = renderToStaticMarkup(<I18nProvider><ColorDock slots={projectileModule.paletteSlots} parameters={projectileModule.defaultParameters} onParameters={() => undefined} /></I18nProvider>)
    expect(markup.match(/class="color-dock-row"/g)).toHaveLength(2)
    expect(markup.match(/class="color-dock-swatch"/g)).toHaveLength(projectileModule.paletteSlots.reduce((count, slot) => count + slot.read(projectileModule.defaultParameters).length, 0))
  })
})
