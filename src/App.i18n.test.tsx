import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from './App'
import { I18nProvider } from './i18n/I18nProvider'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App localized markup', () => {
  it('renders English chrome and generator navigation', () => {
    vi.stubGlobal('navigator', undefined)
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <App />
      </I18nProvider>,
    )
    expect(markup).toContain('PIXEL EFFECT TOOLKIT')
    expect(markup).toContain('Pixel Effect Generator')
    expect(markup).toContain('aria-label="Interface language"')
    expect(markup).toContain('128 × 128 RGBA')
    expect(markup).toContain('Effect generators')
    expect(markup).toContain('GENERATORS')
    expect(markup).toContain('Slash')
    expect(markup).toContain('Sweep study')
    expect(markup).toContain('Horizontal sprite sheet')
    expect(markup).toContain('Export PNG')
  })

  it('renders Chinese chrome and generator navigation', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' })
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <App />
      </I18nProvider>,
    )
    expect(markup).toContain('像素特效工具集')
    expect(markup).toContain('像素特效生成器')
    expect(markup).toContain('aria-label="界面语言"')
    expect(markup).toContain('128 × 128 RGBA')
    expect(markup).toContain('特效生成器')
    expect(markup).toContain('斩击')
    expect(markup).toContain('扫掠效果')
    expect(markup).toContain('横向精灵图')
    expect(markup).toContain('导出 PNG')
  })
})
