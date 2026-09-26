import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/I18nProvider'
import { FireballControls } from '../controls'
import { DEFAULT_FIREBALL_PARAMETERS, selectFireballShape } from '../model'

beforeEach(() => vi.stubGlobal('navigator', { language: 'en-US' }))
afterEach(() => vi.unstubAllGlobals())

describe('fireball controls', () => {
  it('changes only the selected fireball form', () => {
    const base = { ...DEFAULT_FIREBALL_PARAMETERS, warmPalette: DEFAULT_FIREBALL_PARAMETERS.warmPalette.slice().reverse() }
    const selected = selectFireballShape(base, 'puff')
    expect(selected.form).toBe('puff')
    expect(selected.warmPalette).toBe(base.warmPalette)
    expect(selected.smokePalette).toBe(base.smokePalette)
    expect(selected.sparks).toBe(base.sparks)
    expect(selected.puff).toBe(base.puff)
  })

  it('keeps four form previews and selects the wrapped core through a shape setting', () => {
    const parameters = { ...DEFAULT_FIREBALL_PARAMETERS, form: 'classic' as const }
    const markup = renderToStaticMarkup(
      <I18nProvider><FireballControls category="shape" parameters={parameters} onChange={() => undefined} /></I18nProvider>,
    )

    expect(markup.match(/class="shape-card /g)).toHaveLength(4)
    expect(markup.indexOf('Particle mass')).toBeLessThan(markup.indexOf('Classic'))
    expect(markup).toContain('Rear flame reach')

    const molten = renderToStaticMarkup(<I18nProvider><FireballControls category="shape"
      parameters={{ ...DEFAULT_FIREBALL_PARAMETERS, wrapped: { ...DEFAULT_FIREBALL_PARAMETERS.wrapped, fireballBall: 'molten' } }}
      onChange={() => undefined} /></I18nProvider>)
    expect(molten.match(/class="shape-card /g)).toHaveLength(4)
    expect(molten).toMatch(/shape-card active[^>]+aria-pressed="true"[^>]*>[\s\S]*?Wrapped solid/)
    expect(molten).toMatch(/<option value="molten" selected="">Iron core<\/option>/)
  })

  it('renders translated, descriptive fireball control hints and units', () => {
    const markup = renderToStaticMarkup(<I18nProvider><FireballControls category="shape"
      parameters={DEFAULT_FIREBALL_PARAMETERS} onChange={() => undefined} /></I18nProvider>)

    expect(markup).toContain('px')
    expect(markup).toContain('°')
    expect(markup).toContain('Sets the fireball head radius in pixels.')
  })

  it('keeps shape facets in Shape and shares the projectile trail section in Classic', () => {
    const shape = renderToStaticMarkup(<I18nProvider><FireballControls category="shape" parameters={DEFAULT_FIREBALL_PARAMETERS} onChange={() => undefined} /></I18nProvider>)
    const motion = renderToStaticMarkup(<I18nProvider><FireballControls category="motion" parameters={DEFAULT_FIREBALL_PARAMETERS} onChange={() => undefined} /></I18nProvider>)
    expect(shape).toContain('Shape facets')
    expect(motion).not.toContain('Shape facets')
    const trail = renderToStaticMarkup(<I18nProvider><FireballControls category="trail" parameters={{ ...DEFAULT_FIREBALL_PARAMETERS, form: 'classic' }} onChange={() => undefined} /></I18nProvider>)
    expect(trail).toContain('aria-label="Trail"')
  })
})
