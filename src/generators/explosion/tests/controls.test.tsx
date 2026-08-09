import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/I18nProvider'
import { en, messagesForLocale, translate, type MessageKey } from '../../../i18n/messages'
import { ShapeCardGrid, ShockwaveControls, type DissolvePatch, type FamilyTranslate } from '../../shared-effects/controls'
import type { SharedShockwaveParameters } from '../../shared-effects/types'
import { ExplosionControls, ExplosionPreviewTools } from '../controls'
import { DEFAULT_EXPLOSION_PARAMETERS, MODERN_EXPLOSION_PARAMETERS, type ExplosionParameters } from '../model'
import type { ExplosionCategory } from '../module'

afterEach(() => vi.unstubAllGlobals())

/** Renders one localized category for static markup assertions. */
function renderControls(category: ExplosionCategory, locale: 'en' | 'zh-CN' = 'en', parameters: ExplosionParameters = DEFAULT_EXPLOSION_PARAMETERS) {
  vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : { language: 'en-US' })
  return renderToStaticMarkup(<I18nProvider><ExplosionControls category={category} parameters={parameters} onChange={() => undefined} /></I18nProvider>)
}

describe('combustion explosion controls', () => {
  it('renders fixed-seed shape cards and shape-specific body controls', () => {
    const body = renderControls('body', 'en', MODERN_EXPLOSION_PARAMETERS)
    expect(body).toContain('Rolling fireball')
    expect(body).toContain('Shock blast')
    expect(body).not.toContain('Coming soon')
    expect(body).not.toContain('aria-disabled="true"')
    expect(body).toContain('Legacy radial')
    expect(body.indexOf('Legacy radial')).toBeLessThan(body.indexOf('Rolling fireball'))
    expect(body.indexOf('Smoke burst')).toBeLessThan(body.indexOf('Shock blast'))
    expect(body).toContain('shape-card')
    expect(body).toContain('Fire-mass expansion')
    expect(body).toContain('Fire-mass count')
    expect(body).not.toContain('Surface material')
    expect(body).not.toContain('Volume layering')
    expect(body).not.toContain('Internal structure')
    const retro = renderControls('body')
    expect(retro).toContain('Legacy radial')
    expect(retro).not.toContain('Fire-mass expansion')
    const shock = renderControls('body', 'en', { ...MODERN_EXPLOSION_PARAMETERS, body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'shockBlast' } })
    expect(shock).toContain('Shell count')
    expect(shock).toContain('Shell thickness')
    expect(shock).toContain('Shell sharpness')
    expect(shock).toContain('min="3"')
    expect(shock).toContain('max="12"')
    expect(shock).toContain('max="48"')
    expect(shock).not.toContain('Fire-mass expansion')
    const smoke = renderControls('body', 'en', { ...MODERN_EXPLOSION_PARAMETERS, body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'smokeBurst' } })
    expect(smoke).toContain('Smoke motion')
    expect(smoke).toContain('Rolling billows')
    expect(smoke).toContain('Particle dissolve')
    expect(smoke).toContain('Smoke puff count')
    expect(smoke).toContain('min="3"')
    expect(smoke).toContain('max="9"')
    expect(shock).not.toContain('Smoke puff count')
    expect(shock).not.toContain('Smoke motion')
  })

  it('does not render or select disabled future shape cards', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    const renderFrames = vi.fn(() => [{ width: 1, height: 1, pixels: new Uint8ClampedArray(4) }])
    const markup = renderToStaticMarkup(
      <I18nProvider><ShapeCardGrid
        familyId="disabled-shape-test"
        label="Shapes"
        selected="active"
        options={[
          { value: 'active', labelKey: 'explosion.options.rollingFireball', descriptionKey: 'explosion.shapeDescriptions.rollingFireball', buildParameters: () => ({ id: 'active' }) },
          { value: 'future', labelKey: 'explosion.options.shockBlast', descriptionKey: 'explosion.shapeDescriptions.shockBlast', disabled: true },
        ]}
        render={renderFrames}
        onSelect={() => undefined}
      /></I18nProvider>,
    )
    expect(renderFrames).toHaveBeenCalledTimes(1)
    expect(markup).toContain('aria-disabled="true"')
    expect(markup).toContain('disabled=""')
  })

  it('renders an alpha slider and 8-digit hex for every palette band', () => {
    const palette = renderControls('palette')
    expect(palette).toContain('Alpha')
    expect(palette).toContain('type="range"')
    expect(palette).toContain('min="0"')
    expect(palette).toContain('max="255"')
    expect(palette).toContain('#FFFAE0FF')
    expect(renderControls('palette', 'zh-CN')).toContain('透明度')
  })

  it('renders the motion tab with direction, curve, and timing controls', () => {
    const motion = renderControls('motion')
    expect(motion).toContain('Direction')
    expect(motion).toContain('Motion curve')
    expect(motion).toContain('Formation time')
    expect(motion).toContain('Hold time')
    expect(motion).not.toContain('Dissolve time')
  })

  it('defaults every effect section collapsed with one title and an accessible compact switch', () => {
    const on = renderControls('effects', 'en', MODERN_EXPLOSION_PARAMETERS)
    expect(on.match(/<span class="field-title">Fire jets<\/span>/g)).toHaveLength(1)
    expect(on).toContain('effect-section-toggle')
    expect(on).not.toContain('aria-expanded="true"')
    expect(on).toContain('aria-label="Fire jets"')
    expect(on).not.toContain('Jet length')
    expect(on).not.toContain('Arc count')
    expect(on).not.toContain('Fragment count')
    const retro = renderControls('effects')
    expect(retro).toContain('Off')
    expect(retro).not.toContain('Core radius')
  })

  it('shows internal structure instead of inactive flat-surface controls for volume bodies', () => {
    const burning = renderControls('material', 'en', MODERN_EXPLOSION_PARAMETERS)
    expect(burning).toContain('Internal structure')
    expect(burning).toContain('Hard shell')
    expect(burning).toContain('Molten core')
    expect(burning).not.toContain('Band curvature')
    expect(burning).not.toContain('Dissolve time')
    expect(burning).not.toContain('Body integrity')
  })

  it('explains fixed smoke structure without showing a redundant selector', () => {
    const smoke = renderControls('material', 'en', {
      ...MODERN_EXPLOSION_PARAMETERS,
      body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'smokeBurst' },
      volume: { enabled: true, profile: 'smokeFire' },
    })
    expect(smoke).toContain('Internal structure: Smoke and fire (fixed by Smoke Burst).')
    expect(smoke).not.toContain('<select')
  })

  it('keeps legacy flat controls behind an explicit compatibility conversion', () => {
    const flat = renderControls('material', 'en', {
      ...MODERN_EXPLOSION_PARAMETERS,
      volume: { enabled: false, profile: 'hardShell' },
    })
    expect(flat).toContain('legacy flat renderer')
    expect(flat).toContain('Convert to volume rendering')
    expect(flat).toContain('Band curvature')
    expect(flat).toContain('Dissolve time')
  })

  it('shows dissolve settings under the retro pixel surface in Material', () => {
    const material = renderControls('material')
    expect(material).toContain('Dissolve style')
    expect(material).toContain('Circle size')
    expect(renderControls('material', 'en', MODERN_EXPLOSION_PARAMETERS)).not.toContain('Dissolve style')
    expect(renderControls('body')).not.toContain('Dissolve style')
  })

  it('renders localized labels and shared preview tools', () => {
    const body = renderControls('body', 'zh-CN')
    expect(body).toContain('翻滚火团')
    expect(body).toContain('冲击爆破')
    expect(body).toContain('主体形状')
    expect(renderControls('effects', 'zh-CN')).toContain('火焰喷流')
    vi.stubGlobal('navigator', { language: 'en-US' })
    const tools = renderToStaticMarkup(<I18nProvider><ExplosionPreviewTools parameters={DEFAULT_EXPLOSION_PARAMETERS} onChange={() => undefined} /></I18nProvider>)
    expect(tools).toContain('Canvas size')
    expect(tools).toContain('Random seed')
  })

  it('exposes compound multi-ring with ring, spacing, squash, and gradient controls', () => {
    const markup = renderShockwaveControls({ ...MODERN_EXPLOSION_PARAMETERS.shockwave, mode: 'multiRing' })
    expect(markup).toContain('Compound multi-ring')
    expect(markup).toContain('Ring count')
    expect(markup).toContain('Ring spacing')
    expect(markup).toContain('Squash amount')
    expect(markup).toContain('Squash angle')
    expect(markup).toContain('Single color')
    expect(markup).toContain('Radial gradient')
    expect(markup).not.toContain('Arc count')
    expect(markup).not.toContain('Arc span')
  })

  it('shows squash for a single ring without ring-count fields', () => {
    const markup = renderShockwaveControls({ ...MODERN_EXPLOSION_PARAMETERS.shockwave, mode: 'ring', squash: 0.2 })
    expect(markup).toContain('Squash amount')
    expect(markup).toContain('Squash angle')
    expect(markup).not.toContain('Ring count')
    expect(markup).not.toContain('Ring spacing')
  })

  it('localizes the multi-ring option label', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' })
    const t: FamilyTranslate = (suffix) => translate(messagesForLocale('zh-CN'), suffix as MessageKey)
    expect(renderToStaticMarkup(
      <I18nProvider><ShockwaveControls family="explosion" t={t} shockwave={MODERN_EXPLOSION_PARAMETERS.shockwave} onChange={() => undefined} /></I18nProvider>,
    )).toContain('复合多环')
  })

  it('uses model field names in the dissolve patch contract', () => {
    const patch: DissolvePatch = {
      dissolveStyle: 'circleFade',
      dissolveSize: 6,
      dissolveJitter: 0.5,
      dissolveDensity: 0,
      dissolveSpeed: 1,
    }
    expect(Object.keys(patch).sort()).toEqual([
      'dissolveDensity',
      'dissolveJitter',
      'dissolveSize',
      'dissolveSpeed',
      'dissolveStyle',
    ])
  })
})

/** Renders the shockwave fields with real English translations. */
function renderShockwaveControls(shockwave: SharedShockwaveParameters): string {
  const t: FamilyTranslate = (suffix) => translate(en, suffix as MessageKey)
  return renderToStaticMarkup(
    <I18nProvider><ShockwaveControls family="explosion" t={t} shockwave={shockwave} onChange={() => undefined} /></I18nProvider>,
  )
}
