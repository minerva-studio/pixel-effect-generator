import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n/I18nProvider'
import { ExplosionControls, ExplosionPreviewTools } from '../controls'
import { DEFAULT_EXPLOSION_PARAMETERS } from '../model'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Renders one localized control category for static markup assertions. */
function renderControls(category: 'shape' | 'palette' | 'motion' | 'fragments' | 'trails', locale: 'en' | 'zh-CN' = 'en') {
  vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : undefined)
  return renderToStaticMarkup(<I18nProvider><ExplosionControls category={category} parameters={DEFAULT_EXPLOSION_PARAMETERS} onChange={() => undefined} /></I18nProvider>)
}

describe('Explosion controls', () => {
  it('renders both effect modes, style selects, and all four layer controls', () => {
    const shape = renderControls('shape')
    expect(shape).toContain('Explosion')
    expect(shape).toContain('Implosion')
    expect(shape).toContain('Clean clusters')
    expect(shape).toContain('Pixel noise')
    expect(shape).toContain('Segmented arc')
    expect(shape).toContain('Full ring')
    expect(shape).toContain('Body strength')
    expect(shape).toContain('Flash core')
    expect(shape).toContain('Shockwave width')
    expect(renderControls('fragments')).toContain('Tangential drift')
  })

  it('renders the trail system with all four parameters', () => {
    const trails = renderControls('trails')
    expect(trails).toContain('Energy rays')
    expect(trails).toContain('Flame strands')
    expect(trails).toContain('Trail count')
    expect(trails).toContain('Trail length')
    expect(trails).toContain('Trail width')
    expect(trails).toContain('Length randomness')
  })

  it('renders the experimental controls in Simplified Chinese', () => {
    const shape = renderControls('shape', 'zh-CN')
    expect(shape).toContain('爆炸')
    expect(shape).toContain('内聚')
    expect(shape).toContain('干净色块')
    expect(shape).toContain('像素噪点')
    expect(shape).toContain('分段弧')
    expect(shape).toContain('完整圆环')
    expect(shape).toContain('爆体强度')
    expect(shape).toContain('冲击环宽度')
    expect(renderControls('trails', 'zh-CN')).toContain('火焰拉丝')
  })

  it('renders the shared canvas and seed preview tools in both languages', () => {
    const render = (locale: 'en' | 'zh-CN') => {
      vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : { language: 'en-US' })
      return renderToStaticMarkup(
        <I18nProvider><ExplosionPreviewTools parameters={DEFAULT_EXPLOSION_PARAMETERS} onChange={() => undefined} /></I18nProvider>,
      )
    }
    const enMarkup = render('en')
    expect(enMarkup).toContain('Canvas size')
    expect(enMarkup).toContain('Scale effect')
    expect(enMarkup).toContain('Canvas preset')
    expect(enMarkup).toContain('Custom')
    expect(enMarkup).toContain('Random seed')
    expect(enMarkup).toContain('Randomize')
    const zhMarkup = render('zh-CN')
    expect(zhMarkup).toContain('画布尺寸')
    expect(zhMarkup).toContain('缩放效果')
    expect(zhMarkup).toContain('画布预设')
    expect(zhMarkup).toContain('随机种子')
    expect(zhMarkup).toContain('随机化')
  })
})
