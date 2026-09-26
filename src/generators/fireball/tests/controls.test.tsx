import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../../i18n/I18nProvider'
import { FireballControls } from '../controls'
import { DEFAULT_FIREBALL_PARAMETERS } from '../model'

describe('fireball controls', () => {
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

  it('uses the same palette controls for classic and the other fireballs', () => {
    const markup = renderToStaticMarkup(<I18nProvider><FireballControls category="palette"
      parameters={DEFAULT_FIREBALL_PARAMETERS} onChange={() => undefined} /></I18nProvider>)
    expect(markup.match(/class="palette-library"/g)).toHaveLength(2)
    expect(markup).toContain('Retro Burst')
    expect(markup.match(/Add color band/g)).toHaveLength(2)
    expect(markup.match(/type="range"/g)).toHaveLength(11)
    expect(markup).toContain('Opacity')
    const classic = renderToStaticMarkup(<I18nProvider><FireballControls category="palette"
      parameters={{ ...DEFAULT_FIREBALL_PARAMETERS, form: 'classic' }} onChange={() => undefined} /></I18nProvider>)
    expect(classic).toBe(markup)
  })

  it('renders translated, descriptive fireball control hints and units', () => {
    const markup = renderToStaticMarkup(<I18nProvider><FireballControls category="shape"
      parameters={DEFAULT_FIREBALL_PARAMETERS} onChange={() => undefined} /></I18nProvider>)

    expect(markup).toContain('px')
    expect(markup).toContain('°')
    expect(markup).toContain('Sets the fireball head radius in pixels.')
  })
})
