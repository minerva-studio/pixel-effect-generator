import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RenderedFrameSet } from '../generators/contract'
import { I18nProvider } from '../i18n/I18nProvider'
import type { PixelFrame } from '../shared/pixel/frame'
import { Preview } from './Preview'

afterEach(() => {
  vi.unstubAllGlobals()
})

function sampleFrame(): PixelFrame {
  const pixels = new Uint8ClampedArray(4 * 4 * 4)
  return { width: 4, height: 4, pixels }
}

function previewMarkup(locale: 'en' | 'zh-CN'): string {
  vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : undefined)
  return renderToStaticMarkup(
    <I18nProvider>
      <Preview
        frameSet={new RenderedFrameSet([sampleFrame()])}
        previewTitle="Sweep study"
        frameWidth={4}
        frameHeight={4}
        frameIndex={0}
        isPlaying={false}
        previewFps={12}
        frameCount={8}
        minimumFrameCount={5}
        maximumFrameCount={24}
        onFrameIndex={() => undefined}
        onPlaying={() => undefined}
        onPreviewFps={() => undefined}
        onFrameCount={() => undefined}
        zoom="fit"
        onZoomChange={() => undefined}
      />
    </I18nProvider>,
  )
}

describe('Preview localized markup', () => {
  it('renders English preview labels and aria labels', () => {
    const markup = previewMarkup('en')
    expect(markup).toContain('LIVE PREVIEW')
    expect(markup).toContain('aria-label="Animated pixel effect preview"')
    expect(markup).toContain('aria-label="Zoom"')
    expect(markup).toContain('Fit')
    expect(markup).toContain('1×')
    expect(markup).toContain('8×')
    expect(markup).toContain('aria-label="Play animation"')
    expect(markup).toContain('aria-label="Current frame"')
    expect(markup).toContain('Total frames')
    expect(markup).toContain('Playback FPS')
    expect(markup).toContain('12 FPS preview')
  })

  it('renders Chinese preview labels and aria labels', () => {
    const markup = previewMarkup('zh-CN')
    expect(markup).toContain('实时预览')
    expect(markup).toContain('aria-label="像素特效动画预览"')
    expect(markup).toContain('aria-label="播放动画"')
    expect(markup).toContain('aria-label="当前帧"')
    expect(markup).toContain('总帧数')
    expect(markup).toContain('播放帧率')
    expect(markup).toContain('12 FPS 预览')
  })

  it('does not render any export content', () => {
    const markup = previewMarkup('en')
    expect(markup).not.toContain('Export PNG')
    expect(markup).not.toContain('Sprite sheet')
    expect(markup).not.toContain('Animated image')
    expect(markup).not.toContain('Export GIF')
    expect(markup).not.toContain('Export APNG')
  })
})
