import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/I18nProvider'
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
    expect(body).toContain('Billowing fireball')
    expect(body).toContain('Pressure burst')
    expect(body).toContain('Legacy radial')
    expect(body).toContain('shape-card')
    expect(body).toContain('Churn amount')
    expect(body).toContain('Surface material')
    const retro = renderControls('body')
    expect(retro).toContain('Legacy radial')
    expect(retro).not.toContain('Churn amount')
    const pressure = renderControls('body', 'en', { ...MODERN_EXPLOSION_PARAMETERS, body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'pressureBurst' } })
    expect(pressure).toContain('Pressure front')
    expect(pressure).not.toContain('Churn amount')
  })

  it('renders the motion tab with direction, curve, and timing controls', () => {
    const motion = renderControls('motion')
    expect(motion).toContain('Direction')
    expect(motion).toContain('Motion curve')
    expect(motion).toContain('Formation time')
    expect(motion).toContain('Hold time')
    expect(motion).toContain('Dissolve time')
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

  it('renders only the active surface material controls', () => {
    const burning = renderControls('body', 'en', MODERN_EXPLOSION_PARAMETERS)
    expect(burning).toContain('Band curvature')
    const soot = renderControls('body', 'en', { ...MODERN_EXPLOSION_PARAMETERS, surface: { style: 'rollingSoot', coverage: 0.9, sootAmount: 0.3, sootScale: 11 } })
    expect(soot).toContain('Soot amount')
    expect(soot).not.toContain('Band curvature')
  })

  it('renders localized labels and shared preview tools', () => {
    const body = renderControls('body', 'zh-CN')
    expect(body).toContain('翻滚火球')
    expect(body).toContain('压力爆裂')
    expect(body).toContain('主体形状')
    expect(renderControls('effects', 'zh-CN')).toContain('火焰喷流')
    vi.stubGlobal('navigator', { language: 'en-US' })
    const tools = renderToStaticMarkup(<I18nProvider><ExplosionPreviewTools parameters={DEFAULT_EXPLOSION_PARAMETERS} onChange={() => undefined} /></I18nProvider>)
    expect(tools).toContain('Canvas size')
    expect(tools).toContain('Random seed')
  })
})
