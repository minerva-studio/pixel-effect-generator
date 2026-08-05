import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/I18nProvider'
import { BloomControls, BloomPreviewTools } from '../controls'
import { DEFAULT_BLOOM_PARAMETERS, type BloomParameters } from '../model'
import type { BloomCategory } from '../module'

afterEach(() => vi.unstubAllGlobals())

/** Renders one localized category for static markup assertions. */
function renderControls(category: BloomCategory, locale: 'en' | 'zh-CN' = 'en', parameters: BloomParameters = DEFAULT_BLOOM_PARAMETERS) {
  vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : { language: 'en-US' })
  return renderToStaticMarkup(<I18nProvider><BloomControls category={category} parameters={parameters} onChange={() => undefined} /></I18nProvider>)
}

describe('energy bloom controls', () => {
  it('renders the three bloom shape cards with shape-specific controls', () => {
    const body = renderControls('body')
    expect(body).toContain('Soft petals')
    expect(body).toContain('Sharp starburst')
    expect(body).toContain('Layered corolla')
    expect(body).toContain('shape-card')
    expect(body).toContain('Petal count')
    const star = renderControls('body', 'en', { ...DEFAULT_BLOOM_PARAMETERS, body: { ...DEFAULT_BLOOM_PARAMETERS.body, shape: 'sharpStarburst' } })
    expect(star).toContain('Ray count')
    expect(star).not.toContain('Petal count')
  })

  it('shows the corolla layer delay only under the layered shape in Motion', () => {
    const petalMotion = renderControls('motion')
    expect(petalMotion).not.toContain('Layer delay')
    const corollaMotion = renderControls('motion', 'en', { ...DEFAULT_BLOOM_PARAMETERS, body: { ...DEFAULT_BLOOM_PARAMETERS.body, shape: 'layeredCorolla' } })
    expect(corollaMotion).toContain('Layer delay')
  })

  it('defaults every effect section collapsed with one title and an accessible compact switch', () => {
    const on = renderControls('effects', 'en', { ...DEFAULT_BLOOM_PARAMETERS, tongues: { ...DEFAULT_BLOOM_PARAMETERS.tongues, enabled: true } })
    expect(on.match(/<span class="field-title">Energy tongues<\/span>/g)).toHaveLength(1)
    expect(on).toContain('effect-section-toggle')
    expect(on).not.toContain('aria-expanded="true"')
    expect(on).toContain('aria-label="Energy tongues"')
    expect(on).not.toContain('Tongue length')
    const retro = renderControls('effects')
    expect(retro).toContain('Off')
    expect(retro).not.toContain('Core radius')
  })

  it('renders localized labels and shared preview tools', () => {
    const body = renderControls('body', 'zh-CN')
    expect(body).toContain('圆润花瓣')
    expect(body).toContain('锐利星芒')
    expect(renderControls('effects', 'zh-CN')).toContain('能量焰舌')
    vi.stubGlobal('navigator', { language: 'en-US' })
    const tools = renderToStaticMarkup(<I18nProvider><BloomPreviewTools parameters={DEFAULT_BLOOM_PARAMETERS} onChange={() => undefined} /></I18nProvider>)
    expect(tools).toContain('Canvas size')
    expect(tools).toContain('Random seed')
  })
})
