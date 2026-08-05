import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RenderedFrameSet } from '../generators/contract'
import { I18nProvider } from '../i18n/I18nProvider'
import type { PixelFrame } from '../shared/pixel/frame'
import {
  ExportPanel,
  ExportPanelView,
  createInitialExportPanelState,
  exportPanelReducer,
  runAnimationExport,
  runSpriteSheetExport,
  type ExportDependencies,
  type ExportPanelMetadata,
  type ExportPanelState,
} from './ExportPanel'

afterEach(() => {
  vi.unstubAllGlobals()
})

function sampleFrame(width: number, height: number, value: number): PixelFrame {
  const pixels = new Uint8ClampedArray(width * height * 4)
  pixels[3] = value
  return { width, height, pixels }
}

function panelMarkup(
  locale: 'en' | 'zh-CN',
  frameSet: RenderedFrameSet = new RenderedFrameSet([
    sampleFrame(256, 128, 255),
    sampleFrame(256, 128, 0),
  ]),
): string {
  vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : undefined)
  return renderToStaticMarkup(
    <I18nProvider>
      <ExportPanel frameSet={frameSet} previewFps={12} generatorName="Slash" />
    </I18nProvider>,
  )
}

describe('ExportPanel structure', () => {
  it('renders an independent panel with both export cards in English', () => {
    const markup = panelMarkup('en')
    expect(markup).toContain('class="panel export-panel"')
    expect(markup).toContain('EXPORT')
    expect(markup).toContain('Export frames')
    expect(markup).toContain('Sprite sheet')
    expect(markup).toContain('Animated image')
    expect(markup).toContain('Export PNG')
    expect(markup).toContain('Export GIF')
    expect(markup).toContain('Export APNG')
    expect(markup).toContain('aria-label="Loop animation"')
  })

  it('renders the same structure in Simplified Chinese', () => {
    const markup = panelMarkup('zh-CN')
    expect(markup).toContain('class="panel export-panel"')
    expect(markup).toContain('导出')
    expect(markup).toContain('导出帧')
    expect(markup).toContain('精灵图')
    expect(markup).toContain('动图')
    expect(markup).toContain('导出 PNG')
    expect(markup).toContain('导出 GIF')
    expect(markup).toContain('导出 APNG')
    expect(markup).toContain('aria-label="循环动画"')
  })

  it('derives canvas size, frame count, and FPS from the shared frame set', () => {
    const markup = panelMarkup('en')
    expect(markup).toContain('256 × 128 canvas · 2 frames · 12 FPS')
    expect(markup).toContain('256 × 128 px · 2 frames · 12 FPS')
    expect(markup).toContain('512 × 128 px · transparent PNG')
  })

  it('keeps PNG actions in the sprite card and GIF, APNG, and Loop in the animated card', () => {
    const markup = panelMarkup('en')
    const animatedCard = markup.indexOf('class="export-card animated"')
    expect(animatedCard).toBeGreaterThan(-1)
    expect(markup.indexOf('Export PNG')).toBeLessThan(animatedCard)
    expect(markup.indexOf('Export GIF')).toBeGreaterThan(animatedCard)
    expect(markup.indexOf('Export APNG')).toBeGreaterThan(animatedCard)
    expect(markup.indexOf('aria-label="Loop animation"')).toBeGreaterThan(animatedCard)
  })

  it('reads the current RenderedFrameSet without copying or re-rendering', () => {
    let reads = 0
    class CountingFrameSet extends RenderedFrameSet {
      read(): readonly PixelFrame[] {
        reads += 1
        return super.read()
      }
    }
    const markup = panelMarkup('en', new CountingFrameSet([sampleFrame(16, 16, 255)]))
    expect(reads).toBeGreaterThan(0)
    expect(markup).toContain('16 × 16 canvas · 1 frames · 12 FPS')
  })

  it('reflects a new frame set and FPS without stale metadata', () => {
    vi.stubGlobal('navigator', undefined)
    const first = renderToStaticMarkup(
      <I18nProvider>
        <ExportPanel
          frameSet={new RenderedFrameSet([sampleFrame(256, 128, 255), sampleFrame(256, 128, 0)])}
          previewFps={12}
          generatorName="Slash"
        />
      </I18nProvider>,
    )
    expect(first).toContain('256 × 128 canvas · 2 frames · 12 FPS')

    const second = renderToStaticMarkup(
      <I18nProvider>
        <ExportPanel
          frameSet={new RenderedFrameSet([sampleFrame(64, 64, 255)])}
          previewFps={24}
          generatorName="Slash"
        />
      </I18nProvider>,
    )
    expect(second).toContain('64 × 64 canvas · 1 frames · 24 FPS')
    expect(second).not.toContain('256 × 128')
  })
})

describe('export panel state', () => {
  it('starts with infinite loop and no encoding or error', () => {
    expect(createInitialExportPanelState()).toEqual({ loop: true, encoding: null, error: null })
  })

  it('toggles the loop flag', () => {
    const state = createInitialExportPanelState()
    expect(exportPanelReducer(state, { type: 'toggleLoop', checked: false }).loop).toBe(false)
    expect(exportPanelReducer({ ...state, loop: false }, { type: 'toggleLoop', checked: true }).loop).toBe(true)
  })

  it('disables encoding until it succeeds and then restores', () => {
    let state = exportPanelReducer(createInitialExportPanelState(), { type: 'startEncoding', format: 'gif' })
    expect(state.encoding).toBe('gif')
    expect(state.error).toBeNull()
    state = exportPanelReducer(state, { type: 'encodingSucceeded' })
    expect(state.encoding).toBeNull()
  })

  it('shows an error after failure and clears it on the next export', () => {
    let state = exportPanelReducer(createInitialExportPanelState(), { type: 'encodingFailed', message: 'Export failed.' })
    expect(state.error).toBe('Export failed.')
    expect(state.encoding).toBeNull()
    state = exportPanelReducer(state, { type: 'startEncoding', format: 'apng' })
    expect(state.error).toBeNull()
    expect(state.encoding).toBe('apng')
  })

  it('ignores a second export start while already encoding', () => {
    const encoding = exportPanelReducer(createInitialExportPanelState(), { type: 'startEncoding', format: 'gif' })
    expect(exportPanelReducer(encoding, { type: 'startEncoding', format: 'apng' })).toBe(encoding)
  })
})

describe('export panel actions', () => {
  const frames = [sampleFrame(128, 128, 255), sampleFrame(128, 128, 0)]
  const frameSet = new RenderedFrameSet(frames)
  const dependencies: ExportDependencies = {
    downloadSpriteSheet: vi.fn(),
    encodeAnimation: vi.fn(),
    downloadBytes: vi.fn(),
  }

  it('exports the sprite sheet exactly once with the current frames and file name', () => {
    const downloadSpriteSheet = vi.fn()
    runSpriteSheetExport(frameSet, 'pixel-Slash-128x128-2-frames.png', { ...dependencies, downloadSpriteSheet })
    expect(downloadSpriteSheet).toHaveBeenCalledTimes(1)
    expect(downloadSpriteSheet).toHaveBeenCalledWith(frames, 'pixel-Slash-128x128-2-frames.png')
  })

  it('encodes and downloads GIF with the loop state and FPS', () => {
    const encodeAnimation = vi.fn(() => ({
      format: 'gif' as const,
      mime: 'image/gif',
      extension: 'gif',
      bytes: new Uint8Array([1, 2, 3]),
    }))
    const downloadBytes = vi.fn()
    const ok = runAnimationExport('gif', frameSet, 12, false, 'clip.gif', { ...dependencies, encodeAnimation, downloadBytes })

    expect(ok).toBe(true)
    expect(encodeAnimation).toHaveBeenCalledTimes(1)
    expect(encodeAnimation).toHaveBeenCalledWith({ format: 'gif', frames, fps: 12, loop: false })
    expect(downloadBytes).toHaveBeenCalledTimes(1)
    expect(downloadBytes).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), 'clip.gif', 'image/gif')
  })

  it('encodes and downloads APNG with an infinite loop by default', () => {
    const encodeAnimation = vi.fn(() => ({
      format: 'apng' as const,
      mime: 'image/png',
      extension: 'png',
      bytes: new Uint8Array([9]),
    }))
    const downloadBytes = vi.fn()
    const ok = runAnimationExport('apng', frameSet, 24, true, 'clip.png', { ...dependencies, encodeAnimation, downloadBytes })

    expect(ok).toBe(true)
    expect(encodeAnimation).toHaveBeenCalledWith({ format: 'apng', frames, fps: 24, loop: true })
    expect(downloadBytes).toHaveBeenCalledWith(new Uint8Array([9]), 'clip.png', 'image/png')
  })

  it('reports failure without downloading when encoding throws', () => {
    const encodeAnimation = vi.fn(() => {
      throw new Error('encode failed')
    })
    const downloadBytes = vi.fn()
    const ok = runAnimationExport('gif', frameSet, 12, true, 'clip.gif', { ...dependencies, encodeAnimation, downloadBytes })

    expect(ok).toBe(false)
    expect(encodeAnimation).toHaveBeenCalledTimes(1)
    expect(downloadBytes).not.toHaveBeenCalled()
  })

  it('reads the frame set at export time instead of caching stale frames', () => {
    let latest = [frames[0]]
    const frameSetAtCallTime = { read: () => latest } as unknown as RenderedFrameSet
    const encodeAnimation = vi.fn(() => ({
      format: 'gif' as const,
      mime: 'image/gif',
      extension: 'gif',
      bytes: new Uint8Array([7]),
    }))
    const deps = { ...dependencies, encodeAnimation, downloadBytes: vi.fn() }

    runAnimationExport('gif', frameSetAtCallTime, 12, true, 'a.gif', deps)
    latest = frames
    runAnimationExport('gif', frameSetAtCallTime, 12, true, 'b.gif', deps)

    expect(encodeAnimation).toHaveBeenNthCalledWith(1, { format: 'gif', frames: [frames[0]], fps: 12, loop: true })
    expect(encodeAnimation).toHaveBeenNthCalledWith(2, { format: 'gif', frames, fps: 12, loop: true })
  })
})

describe('ExportPanelView states', () => {
  const metadata: ExportPanelMetadata = { width: 128, height: 128, frameCount: 8, fps: 12 }
  const noop = () => undefined

  function viewMarkup(state: ExportPanelState, locale: 'en' | 'zh-CN' = 'en'): string {
    vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : undefined)
    return renderToStaticMarkup(
      <I18nProvider>
        <ExportPanelView
          state={state}
          metadata={metadata}
          onToggleLoop={noop}
          onExportPng={noop}
          onExportGif={noop}
          onExportApng={noop}
        />
      </I18nProvider>,
    )
  }

  it('enables all buttons while idle and shows the animated label', () => {
    const markup = viewMarkup(createInitialExportPanelState())
    expect(markup).toContain('Export PNG')
    expect(markup).toContain('Export GIF')
    expect(markup).toContain('Export APNG')
    expect(markup).not.toContain('disabled=""')
    expect(markup).not.toContain('role="alert"')
  })

  it('disables GIF and APNG while encoding and keeps PNG enabled', () => {
    const markup = viewMarkup({ loop: true, encoding: 'gif', error: null })
    const disabledCount = (markup.match(/disabled=""/g) ?? []).length
    expect(disabledCount).toBe(2)
    expect(markup).toContain('Encoding…')
    expect(markup).not.toContain('role="alert"')
  })

  it('renders the error alert only inside the animated card', () => {
    const markup = viewMarkup({ loop: true, encoding: null, error: 'Export failed.' })
    const animatedCard = markup.indexOf('class="export-card animated"')
    const alert = markup.indexOf('role="alert"')
    expect(alert).toBeGreaterThan(animatedCard)
    expect(markup).toContain('Export failed.')
  })
})
