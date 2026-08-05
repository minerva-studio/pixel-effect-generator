import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RenderedFrameSet } from '../generators/contract'
import { I18nProvider } from '../i18n/I18nProvider'
import { DEFAULT_SLASH_PARAMETERS } from '../generators/slash/model'
import { slashProjectCodec } from '../generators/slash/project'
import type { PixelFrame } from '../shared/pixel/frame'
import { packSpriteSheet } from '../shared/pixel/atlas'
import type { WorkspaceFileTask } from './fileOperations'
import type { UnityExportSettingsState } from './unitySettings'
import {
  ExportPanel,
  ExportPanelView,
  checkUnityAtlasSize,
  createInitialExportPanelState,
  exportPanelReducer,
  resolveStableGuid,
  resolveUnitySettings,
  runAnimationExport,
  runFrameZipExport,
  runSpriteSheetExport,
  runUnityExport,
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

const sampleFrameSet = () => new RenderedFrameSet([
  sampleFrame(256, 128, 255),
  sampleFrame(256, 128, 0),
])

const defaultUnitySettings: UnityExportSettingsState = { pixelsPerUnit: 32, stableGuid: '' }

function fileOperations(activeTask: WorkspaceFileTask | null = null) {
  return {
    activeTask,
    tryStart: vi.fn(() => true),
    finish: vi.fn(),
  }
}

function panelMarkup(
  locale: 'en' | 'zh-CN',
  frameSet: RenderedFrameSet = sampleFrameSet(),
): string {
  vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : undefined)
  return renderToStaticMarkup(
    <I18nProvider>
      <ExportPanel
        frameSet={frameSet}
        previewFps={12}
        generatorId="slash"
        generatorName="Slash"
        unitySettings={defaultUnitySettings}
        onUnitySettingsChange={vi.fn()}
        fileOperations={fileOperations()}
      />
    </I18nProvider>,
  )
}

describe('ExportPanel structure', () => {
  it('renders the three asset tabs and defaults to Sprite Sheet', () => {
    const markup = panelMarkup('en')
    expect(markup).toContain('class="panel export-panel"')
    expect(markup).toContain('EXPORT')
    expect(markup).toContain('Export frames')
    expect(markup).toContain('Sprite Sheet')
    expect(markup).toContain('Animation')
    expect(markup).toContain('Frame ZIP')
    expect(markup).toContain('Export PNG')
    expect(markup).not.toContain('Export GIF')
    expect(markup).not.toContain('Export Frame ZIP')
  })

  it('renders the same structure in Simplified Chinese', () => {
    const markup = panelMarkup('zh-CN')
    expect(markup).toContain('导出')
    expect(markup).toContain('导出帧')
    expect(markup).toContain('精灵图')
    expect(markup).toContain('动图')
    expect(markup).toContain('逐帧 ZIP')
    expect(markup).toContain('导出 PNG')
  })

  it('never renders Project controls, JSON input, or import status', () => {
    const markup = panelMarkup('en')
    expect(markup).not.toContain('>Project<')
    expect(markup).not.toContain('Save JSON')
    expect(markup).not.toContain('Load JSON')
    expect(markup).not.toContain('type="file"')
    expect(markup).not.toContain('role="status"')
  })

  it('derives canvas size, frame count, FPS, and expected sheet size from the shared frame set', () => {
    const markup = panelMarkup('en')
    expect(markup).toContain('256 × 128 canvas · 2 frames · 12 FPS')
    expect(markup).toContain('512 × 128 px')
  })

  it('reads the current RenderedFrameSet without copying or re-rendering', () => {
    let reads = 0
    class CountingFrameSet extends RenderedFrameSet {
      read(): readonly PixelFrame[] {
        reads += 1
        return super.read()
      }
    }
    panelMarkup('en', new CountingFrameSet([sampleFrame(16, 16, 255)]))
    expect(reads).toBeGreaterThan(0)
  })

  it('reflects a new frame set and FPS without stale metadata', () => {
    vi.stubGlobal('navigator', undefined)
    const first = renderToStaticMarkup(
      <I18nProvider>
        <ExportPanel
          frameSet={sampleFrameSet()}
          previewFps={12}
          generatorId="slash"
          generatorName="Slash"
          unitySettings={defaultUnitySettings}
          onUnitySettingsChange={vi.fn()}
          fileOperations={fileOperations()}
        />
      </I18nProvider>,
    )
    expect(first).toContain('256 × 128 canvas · 2 frames · 12 FPS')

    const second = renderToStaticMarkup(
      <I18nProvider>
        <ExportPanel
          frameSet={new RenderedFrameSet([sampleFrame(64, 64, 255)])}
          previewFps={24}
          generatorId="slash"
          generatorName="Slash"
          unitySettings={defaultUnitySettings}
          onUnitySettingsChange={vi.fn()}
          fileOperations={fileOperations()}
        />
      </I18nProvider>,
    )
    expect(second).toContain('64 × 64 canvas · 1 frames · 24 FPS')
    expect(second).not.toContain('256 × 128')
  })
})

describe('export panel state', () => {
  it('starts on Sprite Sheet with PNG output and no errors', () => {
    expect(createInitialExportPanelState()).toEqual({
      activeCategory: 'spriteSheet',
      spriteLayout: 'horizontal',
      spriteTarget: 'png',
      animationFormat: 'gif',
      loop: true,
      atlasPreviewOpen: false,
      atlasZoom: 'fit',
      categoryErrors: {},
    })
  })

  it('switches categories and toggles options independently', () => {
    let state = exportPanelReducer(createInitialExportPanelState(), { type: 'selectCategory', category: 'animation' })
    expect(state.activeCategory).toBe('animation')
    state = exportPanelReducer(state, { type: 'setAnimationFormat', format: 'apng' })
    expect(state.animationFormat).toBe('apng')
    state = exportPanelReducer(state, { type: 'toggleLoop', checked: false })
    expect(state.loop).toBe(false)
    state = exportPanelReducer(state, { type: 'setSpriteTarget', target: 'unity' })
    expect(state.spriteTarget).toBe('unity')
    expect(state.activeCategory).toBe('animation')
  })

  it('keeps errors in their category and clears them on request', () => {
    let state = exportPanelReducer(createInitialExportPanelState(), {
      type: 'categoryError',
      category: 'spriteSheet',
      message: 'boom',
    })
    expect(state.categoryErrors.spriteSheet).toBe('boom')
    expect(state.categoryErrors.animation).toBeUndefined()
    state = exportPanelReducer(state, { type: 'clearCategoryError', category: 'spriteSheet' })
    expect(state.categoryErrors.spriteSheet).toBeUndefined()
  })

  it('toggles the atlas preview and its zoom independently', () => {
    let state = exportPanelReducer(createInitialExportPanelState(), { type: 'toggleAtlasPreview' })
    expect(state.atlasPreviewOpen).toBe(true)
    state = exportPanelReducer(state, { type: 'setAtlasZoom', zoom: 2 })
    expect(state.atlasZoom).toBe(2)
    state = exportPanelReducer(state, { type: 'toggleAtlasPreview' })
    expect(state.atlasPreviewOpen).toBe(false)
    expect(state.atlasZoom).toBe(2)
  })
})

describe('export panel actions', () => {
  const frames = [sampleFrame(128, 128, 255), sampleFrame(128, 128, 0)]
  const frameSet = new RenderedFrameSet(frames)

  it('exports a horizontal sprite sheet through the browser canvas path exactly once', async () => {
    const downloadSpriteSheet = vi.fn()
    const deps = dependencies({ downloadSpriteSheet })
    const ok = await runSpriteSheetExport(frameSet, 'horizontal', 'sheet.png', deps)
    expect(ok).toBe(true)
    expect(downloadSpriteSheet).toHaveBeenCalledTimes(1)
    expect(downloadSpriteSheet).toHaveBeenCalledWith(frames, 'sheet.png')
    expect(deps.fileDelivery.saveBytes).not.toHaveBeenCalled()
  })

  it('encodes compact sheets through the pure PNG path and browser delivery', async () => {
    const encodePng = vi.fn((_frame: PixelFrame) => new Uint8Array([7, 8]))
    const fileDelivery = browserDelivery()
    const ok = await runSpriteSheetExport(frameSet, 'compact', 'compact.png', dependencies({ encodePng, fileDelivery }))
    expect(ok).toBe(true)
    expect(encodePng).toHaveBeenCalledTimes(1)
    expect(fileDelivery.saveBytes).toHaveBeenCalledWith('spritesheet-png', 'compact.png', expect.any(ArrayBuffer))
    const buffer = fileDelivery.saveBytes.mock.calls[0][2] as unknown as ArrayBuffer
    expect(Array.from(new Uint8Array(buffer))).toEqual([7, 8])
  })

  it('routes every desktop export through native save with the matching kind', async () => {
    const fileDelivery = desktopDelivery()
    const deps = dependencies({ fileDelivery })
    const ok = await runSpriteSheetExport(frameSet, 'horizontal', 'sheet.png', deps)
    expect(ok).toBe(true)
    expect(fileDelivery.saveBytes).toHaveBeenCalledWith('spritesheet-png', 'sheet.png', expect.any(ArrayBuffer))
    expect(deps.downloadSpriteSheet).not.toHaveBeenCalled()
  })

  it('encodes and saves GIF and APNG with the loop state and FPS', async () => {
    const encodeAnimation = vi.fn(() => ({
      format: 'gif' as const,
      mime: 'image/gif',
      extension: 'gif',
      bytes: new Uint8Array([1, 2, 3]),
    }))
    const fileDelivery = browserDelivery()
    const ok = await runAnimationExport('gif', frameSet, 12, false, 'clip.gif', dependencies({ encodeAnimation, fileDelivery }))

    expect(ok).toBe(true)
    expect(encodeAnimation).toHaveBeenCalledWith({ format: 'gif', frames, fps: 12, loop: false })
    expect(fileDelivery.saveBytes).toHaveBeenCalledWith('gif', 'clip.gif', expect.any(ArrayBuffer))
  })

  it('reports failure without saving when animation encoding throws', async () => {
    const encodeAnimation = vi.fn(() => { throw new Error('encode failed') })
    const fileDelivery = browserDelivery()
    const ok = await runAnimationExport('apng', frameSet, 24, true, 'clip.png', dependencies({ encodeAnimation, fileDelivery }))
    expect(ok).toBe(false)
    expect(fileDelivery.saveBytes).not.toHaveBeenCalled()
  })

  it('builds and saves a Unity ZIP with the current frames and settings', async () => {
    const buildUnityZip = vi.fn(() => new Uint8Array([9]))
    const fileDelivery = browserDelivery()
    const document = {
      schema: 'minerva.pixel-effect' as const,
      version: 1 as const,
      generator: 'slash',
      parameters: slashProjectCodec.serialize(DEFAULT_SLASH_PARAMETERS),
      playback: { fps: 12 },
      export: { unity: { pixelsPerUnit: 100, guid: 'b93362e4a2b3bc240b452b57b97a4147' } },
    }
    const ok = await runUnityExport(
      frameSet,
      'compact',
      12,
      document,
      100,
      'b93362e4a2b3bc240b452b57b97a4147',
      'folder',
      'atlas.png',
      'atlas.zip',
      dependencies({ buildUnityZip, fileDelivery }),
    )
    expect(ok).toBe(true)
    expect(buildUnityZip).toHaveBeenCalledWith(expect.objectContaining({
      generatorId: 'slash',
      frames,
      fps: 12,
      pixelsPerUnit: 100,
      guid: 'b93362e4a2b3bc240b452b57b97a4147',
      layout: 'compact',
      folderName: 'folder',
      imageName: 'atlas.png',
    }))
    expect(fileDelivery.saveBytes).toHaveBeenCalledWith('unity-zip', 'atlas.zip', expect.any(ArrayBuffer))
  })

  it('builds and saves a frame ZIP with the current frames', async () => {
    const buildFrameZip = vi.fn(() => new Uint8Array([7]))
    const fileDelivery = browserDelivery()
    const document = {
      schema: 'minerva.pixel-effect' as const,
      version: 1 as const,
      generator: 'slash',
      parameters: slashProjectCodec.serialize(DEFAULT_SLASH_PARAMETERS),
      playback: { fps: 12 },
      export: { unity: { pixelsPerUnit: 32, guid: null } },
    }
    const ok = await runFrameZipExport(frameSet, 12, document, 'frames', 'slash', 'frames.zip', dependencies({ buildFrameZip, fileDelivery }))
    expect(ok).toBe(true)
    expect(buildFrameZip).toHaveBeenCalledWith(expect.objectContaining({
      generatorId: 'slash',
      frames,
      fps: 12,
      folderName: 'frames',
      frameNamePrefix: 'slash',
    }))
    expect(fileDelivery.saveBytes).toHaveBeenCalledWith('frame-zip', 'frames.zip', expect.any(ArrayBuffer))
  })

  it('reads the frame set at export time instead of caching stale frames', async () => {
    let latest = [frames[0]]
    const frameSetAtCallTime = { read: () => latest } as unknown as RenderedFrameSet
    const encodeAnimation = vi.fn(() => ({
      format: 'gif' as const,
      mime: 'image/gif',
      extension: 'gif',
      bytes: new Uint8Array([3]),
    }))

    await runAnimationExport('gif', frameSetAtCallTime, 12, true, 'a.gif', dependencies({ encodeAnimation }))
    latest = frames
    await runAnimationExport('gif', frameSetAtCallTime, 12, true, 'b.gif', dependencies({ encodeAnimation }))

    expect(encodeAnimation).toHaveBeenNthCalledWith(1, { format: 'gif', frames: [frames[0]], fps: 12, loop: true })
    expect(encodeAnimation).toHaveBeenNthCalledWith(2, { format: 'gif', frames, fps: 12, loop: true })
  })
})

function browserDelivery() {
  return {
    isDesktop: false,
    saveBytes: vi.fn(async (_kind: string, _name: string, _bytes: ArrayBuffer) => 'saved' as const),
    saveText: vi.fn(async (_kind: string, _name: string, _text: string) => 'saved' as const),
    openProjectText: vi.fn(async () => ({ status: 'cancelled' } as const)),
  }
}

function desktopDelivery() {
  return {
    isDesktop: true,
    saveBytes: vi.fn(async (_kind: string, _name: string, _bytes: ArrayBuffer) => 'saved' as const),
    saveText: vi.fn(async (_kind: string, _name: string, _text: string) => 'saved' as const),
    openProjectText: vi.fn(async () => ({ status: 'cancelled' } as const)),
  }
}

describe('resolveStableGuid', () => {
  it('trims surrounding whitespace before normalizing valid GUIDs', () => {
    expect(resolveStableGuid('  B93362E4-A2B3-BC24-0B45-2B57B97A4147  '))
      .toEqual({ ok: true, guid: 'b93362e4a2b3bc240b452b57b97a4147' })
    expect(resolveStableGuid('b93362e4a2b3bc240b452b57b97a4147'))
      .toEqual({ ok: true, guid: 'b93362e4a2b3bc240b452b57b97a4147' })
  })

  it('treats empty and whitespace-only input as no stable GUID', () => {
    expect(resolveStableGuid('')).toEqual({ ok: true, guid: null })
    expect(resolveStableGuid('   ')).toEqual({ ok: true, guid: null })
  })

  it('rejects invalid GUIDs', () => {
    expect(resolveStableGuid('not-a-guid')).toMatchObject({ ok: false, error: { code: 'INVALID_GUID' } })
    expect(resolveStableGuid('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toMatchObject({ ok: false, error: { code: 'INVALID_GUID' } })
  })
})

describe('resolveUnitySettings', () => {
  it('normalizes hyphenated GUIDs and accepts empty input with a random GUID', () => {
    expect(resolveUnitySettings(100, 'B93362E4-A2B3-BC24-0B45-2B57B97A4147', 'fixed'))
      .toEqual({ ok: true, pixelsPerUnit: 100, guid: 'b93362e4a2b3bc240b452b57b97a4147' })
    expect(resolveUnitySettings(64, '', 'random-guid')).toEqual({ ok: true, pixelsPerUnit: 64, guid: 'random-guid' })
    expect(resolveUnitySettings(64, '  B93362E4-A2B3-BC24-0B45-2B57B97A4147  ', 'random-guid'))
      .toEqual({ ok: true, pixelsPerUnit: 64, guid: 'b93362e4a2b3bc240b452b57b97a4147' })
  })

  it('rejects invalid PPU and GUID values', () => {
    expect(resolveUnitySettings(0, '', 'x')).toMatchObject({ ok: false, error: { code: 'INVALID_PPU' } })
    expect(resolveUnitySettings(12.5, '', 'x')).toMatchObject({ ok: false, error: { code: 'INVALID_PPU' } })
    expect(resolveUnitySettings(100, 'not-a-guid', 'x')).toMatchObject({ ok: false, error: { code: 'INVALID_GUID' } })
  })
})

describe('checkUnityAtlasSize', () => {
  it('accepts layouts inside the Unity 6 limit and returns the sheet size', () => {
    expect(checkUnityAtlasSize(24, 128, 128, 'horizontal')).toEqual({ ok: true, width: 3072, height: 128 })
    expect(checkUnityAtlasSize(8, 128, 128, 'compact')).toEqual({ ok: true, width: 384, height: 384 })
  })

  it('rejects layouts whose longest edge exceeds 16384px with the actual size', () => {
    const result = checkUnityAtlasSize(200, 128, 128, 'horizontal')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('UNITY_ATLAS_TOO_LARGE')
      expect(result.error.width).toBe(25600)
      expect(result.error.height).toBe(128)
    }
  })
})

describe('ExportPanelView states', () => {
  const metadata: ExportPanelMetadata = {
    width: 128,
    height: 128,
    frameCount: 8,
    fps: 12,
    sheetWidth: 384,
    sheetHeight: 384,
    generatorName: 'Slash',
  }
  const noop = () => undefined

  function viewMarkup(
    state: ExportPanelState,
    locale: 'en' | 'zh-CN' = 'en',
    activeTask: WorkspaceFileTask | null = null,
    unitySettings: UnityExportSettingsState = defaultUnitySettings,
    packed: ReturnType<typeof packSpriteSheet> | null = null,
  ): string {
    vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : undefined)
    return renderToStaticMarkup(
      <I18nProvider>
        <ExportPanelView
          state={state}
          metadata={metadata}
          unitySettings={unitySettings}
          normalizedGuid={unitySettings.stableGuid.trim() === '' ? '' : unitySettings.stableGuid.replace(/-/g, '').toLowerCase()}
          activeTask={activeTask}
          packed={packed}
          atlasCanvasRef={{ current: null }}
          atlasPreviewId="atlas-preview"
          onUnitySettingsChange={noop}
          onSelectCategory={noop}
          onSetLayout={noop}
          onSetTarget={noop}
          onSetFormat={noop}
          onToggleLoop={noop}
          onExportSpriteSheet={noop}
          onExportUnity={noop}
          onExportAnimation={noop}
          onExportFrameZip={noop}
          onToggleAtlasPreview={noop}
          onSetAtlasZoom={noop}
        />
      </I18nProvider>,
    )
  }

  it('shows Unity settings and the Unity button only for the Unity target', () => {
    const png = viewMarkup(createInitialExportPanelState())
    expect(png).toContain('Export PNG')
    expect(png).not.toContain('Pixels Per Unit')
    expect(png).not.toContain('Stable GUID')

    const unity = viewMarkup({ ...createInitialExportPanelState(), spriteTarget: 'unity' })
    expect(unity).toContain('Export Unity ZIP')
    expect(unity).toContain('Pixels Per Unit')
    expect(unity).toContain('Stable GUID')
  })

  it('renders Unity fields from the shared settings state', () => {
    const markup = viewMarkup(
      { ...createInitialExportPanelState(), spriteTarget: 'unity' },
      'en',
      null,
      { pixelsPerUnit: 64, stableGuid: 'B93362E4-A2B3-BC24-0B45-2B57B97A4147' },
    )
    expect(markup).toContain('value="64"')
    expect(markup).toContain('value="B93362E4-A2B3-BC24-0B45-2B57B97A4147"')
    expect(markup).toContain('Normalized GUID: b93362e4a2b3bc240b452b57b97a4147')
  })

  it('renders the animation category with one format-aware button and Loop', () => {
    const markup = viewMarkup({ ...createInitialExportPanelState(), activeCategory: 'animation' })
    expect(markup).toContain('Export GIF')
    expect(markup).not.toContain('Export APNG')
    expect(markup).toContain('aria-label="Loop animation"')

    const apng = viewMarkup({ ...createInitialExportPanelState(), activeCategory: 'animation', animationFormat: 'apng' })
    expect(apng).toContain('Export APNG')
    expect(apng).not.toContain('Export GIF')
  })

  it('renders the frame ZIP category with its summary and button', () => {
    const markup = viewMarkup({ ...createInitialExportPanelState(), activeCategory: 'frameZip' })
    expect(markup).toContain('8 frames · 128 × 128 px · 12 FPS')
    expect(markup).toContain('Includes manifest.json for frame metadata.')
    expect(markup).toContain('Export Frame ZIP')
  })

  it('disables every export button while any file task is active', () => {
    const markup = viewMarkup({ ...createInitialExportPanelState(), activeCategory: 'animation' }, 'en', 'projectSave')
    expect((markup.match(/disabled=""/g) ?? []).length).toBe(1)
    expect(markup).toContain('Export GIF')
  })

  it('shows Encoding… and Preparing… labels while the matching task runs', () => {
    const gif = viewMarkup({ ...createInitialExportPanelState(), activeCategory: 'animation' }, 'en', 'gif')
    expect(gif).toContain('Encoding…')

    const zip = viewMarkup({ ...createInitialExportPanelState(), activeCategory: 'frameZip' }, 'en', 'frameZip')
    expect(zip).toContain('Preparing…')
  })

  it('keeps errors inside their own category only', () => {
    const markup = viewMarkup({
      ...createInitialExportPanelState(),
      activeCategory: 'animation',
      categoryErrors: { animation: 'animation failed', spriteSheet: 'sheet failed' },
    })
    expect(markup).toContain('animation failed')
    expect(markup).not.toContain('sheet failed')
  })

  it('renders the atlas preview foldout closed with ARIA wiring', () => {
    const markup = viewMarkup(createInitialExportPanelState())
    expect(markup).toContain('Sprite sheet preview')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('aria-controls="atlas-preview"')
    expect(markup).not.toContain('id="atlas-preview"')
  })

  it('renders packed atlas, frame labels, and zoom when open', () => {
    const frames = [sampleFrame(16, 16, 255), sampleFrame(16, 16, 0)]
    const packed = packSpriteSheet(frames, 'compact', 'slash')
    const markup = viewMarkup(
      { ...createInitialExportPanelState(), atlasPreviewOpen: true, atlasZoom: 'fit', spriteLayout: 'compact' },
      'en',
      null,
      defaultUnitySettings,
      packed,
    )
    expect(markup).toContain('aria-expanded="true"')
    expect(markup).toContain('id="atlas-preview"')
    expect(markup).toContain('16 × 32 px · Compact grid')
    expect(markup).toContain('aria-label="Packed sprite sheet preview"')
    expect(markup).toContain('Fit')
    expect(markup).toContain('>1×</option>')
    expect(markup).toContain('>2×</option>')
    expect(markup).toContain('>4×</option>')
  })
})

describe('ExportPanel atlas packing', () => {
  it('does not pack the atlas while the foldout is closed', () => {
    const packSpriteSheetSpy = vi.fn()
    vi.stubGlobal('navigator', undefined)
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ExportPanel
          frameSet={sampleFrameSet()}
          previewFps={12}
          generatorId="slash"
          generatorName="Slash"
          unitySettings={defaultUnitySettings}
          onUnitySettingsChange={vi.fn()}
          fileOperations={fileOperations()}
          dependencies={dependencies({ packSpriteSheet: packSpriteSheetSpy })}
        />
      </I18nProvider>,
    )
    expect(markup).toContain('Sprite sheet preview')
    expect(packSpriteSheetSpy).not.toHaveBeenCalled()
  })
})

function dependencies(overrides: Partial<ExportDependencies> = {}): ExportDependencies {
  return {
    downloadSpriteSheet: vi.fn(),
    encodeAnimation: vi.fn(),
    encodePng: vi.fn((frame: PixelFrame) => new Uint8Array([frame.width])),
    buildFrameZip: vi.fn(() => new Uint8Array([1, 2, 3])),
    buildUnityZip: vi.fn(() => new Uint8Array([4, 5, 6])),
    randomGuid: vi.fn(() => 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    fileDelivery: browserDelivery(),
    packSpriteSheet: vi.fn(),
    ...overrides,
  }
}
