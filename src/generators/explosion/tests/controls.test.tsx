import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/I18nProvider'
import { ExplosionControls, ExplosionPreviewTools } from '../controls'
import { DEFAULT_EXPLOSION_PARAMETERS } from '../model'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Renders one localized control category for static markup assertions. */
function renderControls(category: 'shape' | 'palette' | 'motion' | 'fragments', locale: 'en' | 'zh-CN' = 'en') {
  vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : undefined)
  return renderToStaticMarkup(<I18nProvider><ExplosionControls category={category} parameters={DEFAULT_EXPLOSION_PARAMETERS} onChange={() => undefined} /></I18nProvider>)
}

describe('Explosion controls', () => {
  it('renders both effect modes and all four layer controls', () => {
    const shape = renderControls('shape')
    expect(shape).toContain('Explosion')
    expect(shape).toContain('Implosion')
    expect(shape).toContain('Body strength')
    expect(shape).toContain('Flash core')
    expect(shape).toContain('Shockwave width')
    expect(renderControls('fragments')).toContain('Tangential drift')
  })

  it('renders the experimental controls in Simplified Chinese', () => {
    const shape = renderControls('shape', 'zh-CN')
    expect(shape).toContain('爆炸')
    expect(shape).toContain('内聚')
    expect(shape).toContain('爆体强度')
    expect(shape).toContain('冲击环宽度')
  })

  it('keeps canvas and seed controls below the preview', () => {
    const markup = renderToStaticMarkup(<I18nProvider><ExplosionPreviewTools parameters={DEFAULT_EXPLOSION_PARAMETERS} onChange={() => undefined} /></I18nProvider>)
    expect(markup).toContain('Canvas width')
    expect(markup).toContain('Canvas height')
    expect(markup).toContain('Random seed')
  })
})
