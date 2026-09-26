import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from './App'
import { I18nProvider } from './i18n/I18nProvider'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App localized markup', () => {
  it('renders English document toolbar and workspace', () => {
    vi.stubGlobal('navigator', undefined)
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <App />
      </I18nProvider>,
    )
    expect(markup).toContain('Untitled effect')
    expect(markup).toContain('Pixel Effect Generator')
    expect(markup).not.toContain('desktop-titlebar')
    expect(markup).toContain('aria-label="Interface language"')
    expect(markup).toContain('128 × 128')
    expect(markup).toContain('Create a new effect')
    expect(markup).toContain('aria-label="Appearance"')
    expect(markup).toContain('Follow system')
    expect(markup).toContain('effect-mark.svg')
    expect(markup).toContain('Minerva Game Studio')
    expect(markup).toContain('href="https://github.com/minerva-studio/PixelEffectGenerator"')
    expect(markup).toContain('Slash')
    expect(markup).toContain('Sweep study')
    expect(markup).toContain('EXPORT')
    expect(markup).toContain('Export frames')
    expect(markup).toContain('Sprite Sheet')
    expect(markup).toContain('Animation')
    expect(markup).toContain('Frame ZIP')
    expect(markup).toContain('Export PNG')
    expect(markup).toContain('Unity 6 package')
    expect(markup).toContain('Compact grid')
    expect(markup).toContain('>Save<')
    expect(markup).toContain('aria-label="Resize parameters and canvas"')
    expect(markup).not.toContain('>Reset<')
    const exportPanel = markup.indexOf('class="panel export-panel"')
    expect(markup.slice(exportPanel)).not.toContain('>Project<')
  })

  it('renders Chinese document toolbar and workspace', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' })
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <App />
      </I18nProvider>,
    )
    expect(markup).toContain('未命名特效')
    expect(markup).toContain('像素特效生成器')
    expect(markup).toContain('aria-label="外观"')
    expect(markup).toContain('跟随系统')
    expect(markup).toContain('aria-label="界面语言"')
    expect(markup).toContain('128 × 128')
    expect(markup).toContain('特效生成器')
    expect(markup).toContain('斩击')
    expect(markup).toContain('扫掠效果')
    expect(markup).toContain('导出')
    expect(markup).toContain('导出帧')
    expect(markup).toContain('精灵图')
    expect(markup).toContain('动图')
    expect(markup).toContain('逐帧 ZIP')
    expect(markup).toContain('导出 PNG')
    expect(markup).toContain('Unity 6 素材包')
    expect(markup).toContain('紧凑网格')
    expect(markup).toContain('>保存<')
    expect(markup).toContain('aria-label="调整参数与画布宽度"')
    expect(markup).not.toContain('>重置<')
    const exportPanel = markup.indexOf('class="panel export-panel"')
    expect(markup.slice(exportPanel)).not.toContain('项目')
  })
})
