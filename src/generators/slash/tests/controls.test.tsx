import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider } from '../../../i18n/I18nProvider'
import { SlashControls, SlashPreviewTools } from '../controls'
import { DEFAULT_SLASH_PARAMETERS } from '../model'

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderControls(category: 'shape' | 'palette' | 'motion' | 'breakup' | 'fragments', locale: 'en' | 'zh-CN' = 'en') {
  vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : undefined)
  return renderToStaticMarkup(
    <I18nProvider>
      <SlashControls
        category={category}
        parameters={DEFAULT_SLASH_PARAMETERS}
        onChange={() => undefined}
      />
    </I18nProvider>,
  )
}

describe('Slash controls', () => {
  it('renders an alpha slider and 8-digit hex for every palette band', () => {
    const markup = renderControls('palette')
    expect(markup).toContain('Alpha')
    expect(markup).toContain('type="range"')
    expect(markup).toContain('min="0"')
    expect(markup).toContain('max="255"')
    expect(markup).toContain('#FFFFFFFF')
    expect(renderControls('palette', 'zh-CN')).toContain('透明度')
  })

  it('exposes adjacent minimum and maximum fragment size fields for every drawing mode', () => {
    const markup = renderControls('fragments')

    expect(markup).toContain('Minimum size')
    expect(markup).toContain('Maximum size')
    expect(markup).toContain('Smallest chunk width, shard line length, or spark trail length')
    expect(markup).toContain('Largest chunk width, shard line length, or spark trail length')
    expect(markup).not.toContain('>Size<')
  })

  it('renders the fragments category in Simplified Chinese', () => {
    const markup = renderControls('fragments', 'zh-CN')

    expect(markup).toContain('碎片模式')
    expect(markup).toContain('最小尺寸')
    expect(markup).toContain('最大尺寸')
    expect(markup).toContain('像素方块')
    expect(markup).toContain('定向碎片')
    expect(markup).toContain('能量火花')
    expect(markup).toContain('切向速度')
    expect(markup).toContain('存活时间')
  })

  it('separates arc breakup, fragments, and preview seed controls', () => {
    const breakupMarkup = renderControls('breakup')
    const fragmentMarkup = renderControls('fragments')
    const previewToolsMarkup = renderToStaticMarkup(
      <I18nProvider>
        <SlashPreviewTools parameters={DEFAULT_SLASH_PARAMETERS} onChange={() => undefined} />
      </I18nProvider>,
    )

    expect(breakupMarkup).toContain('Dissolve mode')
    expect(breakupMarkup).not.toContain('Fragment mode')
    expect(fragmentMarkup).toContain('Fragment mode')
    expect(fragmentMarkup).not.toContain('Dissolve mode')
    expect(breakupMarkup).not.toContain('Random seed')
    expect(fragmentMarkup).not.toContain('Random seed')
    expect(previewToolsMarkup).toContain('Random seed')
    expect(previewToolsMarkup).toContain('Randomize')
  })

  it('renders the shared canvas preset, scaling, custom size, and seed tools', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <SlashPreviewTools parameters={DEFAULT_SLASH_PARAMETERS} onChange={() => undefined} />
      </I18nProvider>,
    )
    expect(markup).toContain('Canvas size')
    expect(markup).toContain('Scale effect')
    expect(markup).toContain('Canvas preset')
    expect(markup).toContain('Custom')
    expect(markup).toContain('Random seed')
    expect(markup).toContain('Randomize')
    expect(markup).toContain('canvas-size-control')
    expect(markup).toContain('preview-seed-control')
  })

  it('keeps the same separation in Simplified Chinese', () => {
    const breakupMarkup = renderControls('breakup', 'zh-CN')
    const fragmentMarkup = renderControls('fragments', 'zh-CN')
    const previewToolsMarkup = renderToStaticMarkup(
      <I18nProvider>
        <SlashPreviewTools parameters={DEFAULT_SLASH_PARAMETERS} onChange={() => undefined} />
      </I18nProvider>,
    )

    expect(breakupMarkup).toContain('溶解模式')
    expect(breakupMarkup).not.toContain('碎片模式')
    expect(fragmentMarkup).toContain('碎片模式')
    expect(fragmentMarkup).not.toContain('溶解模式')
    expect(breakupMarkup).not.toContain('随机种子')
    expect(fragmentMarkup).not.toContain('随机种子')
    expect(previewToolsMarkup).toContain('随机种子')
  })

  it('keeps option values, parameter values, and form ids stable across languages', () => {
    const en = renderControls('fragments')
    const zh = renderControls('fragments', 'zh-CN')

    const optionValues = (markup: string) => [...markup.matchAll(/<option value="([^"]+)"/g)].map((match) => match[1])
    const inputValues = (markup: string) => [...markup.matchAll(/<input[^>]* value="([^"]+)"/g)].map((match) => match[1])
    const formIds = (markup: string) => [...markup.matchAll(/ id="([^"]+)"/g)].map((match) => match[1])

    expect(optionValues(zh)).toEqual(optionValues(en))
    expect(inputValues(zh)).toEqual(inputValues(en))
    expect(formIds(zh)).toEqual(formIds(en))
  })
})
