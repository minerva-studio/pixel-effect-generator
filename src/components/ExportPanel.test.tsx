import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RenderedFrameSet } from '../generators/contract'
import { I18nProvider } from '../i18n/I18nProvider'
import { serializeProjectDocument } from '../shared/project/document'
import { DEFAULT_SLASH_PARAMETERS } from '../generators/slash/model'
import { slashProjectCodec } from '../generators/slash/project'
import type { PixelFrame } from '../shared/pixel/frame'
import type { JsonValue } from '../shared/project/types'
import {
  ExportPanel,
  ExportPanelView,
  checkUnityAtlasSize,
  createInitialExportPanelState,
  exportPanelReducer,
  importProjectFromText,
  resolveStableGuid,
  resolveUnitySettings,
  runAnimationExport,
  runFrameZipExport,
  runProjectJsonExport,
  runSpriteSheetExport,
  runUnityExport,
  type ExportDependencies,
  type ExportPanelMetadata,
  type ExportPanelState,
  type ImportProjectHandler,
  type ProjectExportBridge,
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

function bridge(importProject: ImportProjectHandler = () => ({ ok: true })): ProjectExportBridge {
  return {
    codec: slashProjectCodec,
    buildDocument: (settings) => ({
      schema: 'minerva.pixel-effect',
      version: 1,
      generator: 'slash',
      parameters: slashProjectCodec.serialize(DEFAULT_SLASH_PARAMETERS) as JsonValue,
      playback: { fps: 12 },
      export: { unity: settings },
    }),
    importProject,
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
        projectBridge={bridge()}
      />
    </I18nProvider>,
  )
}

describe('ExportPanel structure', () => {
  it('renders the four category tabs and defaults to Sprite Sheet', () => {
    const markup = panelMarkup('en')
    expect(markup).toContain('class="panel export-panel"')
    expect(markup).toContain('EXPORT')
    expect(markup).toContain('Export frames')
    expect(markup).toContain('Project')
    expect(markup).toContain('Sprite Sheet')
    expect(markup).toContain('Animation')
    expect(markup).toContain('Frame ZIP')
    expect(markup).toContain('Export PNG')
    expect(markup).not.toContain('Export GIF')
    expect(markup).not.toContain('Export Frame ZIP')
    expect(markup).not.toContain('Save JSON')
  })

  it('renders the same structure in Simplified Chinese', () => {
    const markup = panelMarkup('zh-CN')
    expect(markup).toContain('导出')
    expect(markup).toContain('导出帧')
    expect(markup).toContain('项目')
    expect(markup).toContain('精灵图')
    expect(markup).toContain('动图')
    expect(markup).toContain('逐帧 ZIP')
    expect(markup).toContain('导出 PNG')
  })

  it('hides the Project tab and JSON controls when no codec exists', () => {
    vi.stubGlobal('navigator', undefined)
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ExportPanel frameSet={sampleFrameSet()} previewFps={12} generatorId="blip" generatorName="Blip" />
      </I18nProvider>,
    )
    expect(markup).not.toContain('Project')
    expect(markup).not.toContain('Save JSON')
    expect(markup).not.toContain('Load JSON')
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
        <ExportPanel frameSet={sampleFrameSet()} previewFps={12} generatorId="slash" generatorName="Slash" projectBridge={bridge()} />
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
          projectBridge={bridge()}
        />
      </I18nProvider>,
    )
    expect(second).toContain('64 × 64 canvas · 1 frames · 24 FPS')
    expect(second).not.toContain('256 × 128')
  })
})

describe('export panel state', () => {
  it('starts on Sprite Sheet with Unity defaults and no task', () => {
    expect(createInitialExportPanelState()).toEqual({
      activeCategory: 'spriteSheet',
      spriteLayout: 'horizontal',
      spriteTarget: 'png',
      animationFormat: 'gif',
      loop: true,
      pixelsPerUnit: 32,
      stableGuid: '',
      activeTask: null,
      categoryErrors: {},
      projectImportStatus: 'idle',
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

  it('ignores a second export start while a task is running', () => {
    const running = exportPanelReducer(createInitialExportPanelState(), { type: 'startTask', task: 'gif' })
    expect(exportPanelReducer(running, { type: 'startTask', task: 'apng' })).toBe(running)
  })

  it('restores idle after success and keeps errors in their category on failure', () => {
    let state = exportPanelReducer(createInitialExportPanelState(), { type: 'startTask', task: 'unityPackage' })
    expect(state.activeTask).toBe('unityPackage')
    state = exportPanelReducer(state, { type: 'taskFailed', task: 'unityPackage', category: 'spriteSheet', message: 'boom' })
    expect(state.activeTask).toBeNull()
    expect(state.categoryErrors.spriteSheet).toBe('boom')
    expect(state.categoryErrors.animation).toBeUndefined()

    state = exportPanelReducer(state, { type: 'startTask', task: 'gif' })
    expect(state.categoryErrors.spriteSheet).toBe('boom')
    state = exportPanelReducer(state, { type: 'taskSucceeded', task: 'gif' })
    expect(state.activeTask).toBeNull()

    state = exportPanelReducer(state, { type: 'startTask', task: 'spriteSheet' })
    expect(state.categoryErrors.spriteSheet).toBeUndefined()
    expect(state.activeTask).toBe('spriteSheet')
    state = exportPanelReducer(state, { type: 'taskSucceeded', task: 'spriteSheet' })
    expect(state.activeTask).toBeNull()
  })

  it('updates Unity settings after a successful import', () => {
    const state = exportPanelReducer(createInitialExportPanelState(), {
      type: 'importSucceeded',
      pixelsPerUnit: 64,
      guid: 'b93362e4a2b3bc240b452b57b97a4147',
    })
    expect(state.pixelsPerUnit).toBe(64)
    expect(state.stableGuid).toBe('b93362e4a2b3bc240b452b57b97a4147')
    expect(state.projectImportStatus).toBe('success')
    expect(state.activeTask).toBeNull()
  })

  it('records import failures in the project category', () => {
    const state = exportPanelReducer(createInitialExportPanelState(), {
      type: 'importFailed',
      message: 'bad file',
    })
    expect(state.projectImportStatus).toBe('error')
    expect(state.categoryErrors.project).toBe('bad file')
    expect(state.activeTask).toBeNull()
  })

  it('shows category errors without requiring an active task', () => {
    const state = exportPanelReducer(createInitialExportPanelState(), {
      type: 'categoryError',
      category: 'spriteSheet',
      message: 'invalid ppu',
    })
    expect(state.categoryErrors.spriteSheet).toBe('invalid ppu')
    expect(state.activeTask).toBeNull()
  })
})

describe('export panel actions', () => {
  const frames = [sampleFrame(128, 128, 255), sampleFrame(128, 128, 0)]
  const frameSet = new RenderedFrameSet(frames)

  function dependencies(overrides: Partial<ExportDependencies> = {}): ExportDependencies {
    return {
      downloadSpriteSheet: vi.fn(),
      encodeAnimation: vi.fn(),
      downloadBytes: vi.fn(),
      downloadText: vi.fn(),
      encodePng: vi.fn((frame: PixelFrame) => new Uint8Array([frame.width])),
      buildFrameZip: vi.fn(() => new Uint8Array([1, 2, 3])),
      buildUnityZip: vi.fn(() => new Uint8Array([4, 5, 6])),
      randomGuid: vi.fn(() => 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
      readFileAsText: vi.fn(async (file: File) => file.text()),
      ...overrides,
    }
  }

  it('exports a horizontal sprite sheet exactly once with the current frames', () => {
    const downloadSpriteSheet = vi.fn()
    const ok = runSpriteSheetExport(frameSet, 'horizontal', 'sheet.png', dependencies({ downloadSpriteSheet }))
    expect(ok).toBe(true)
    expect(downloadSpriteSheet).toHaveBeenCalledTimes(1)
    expect(downloadSpriteSheet).toHaveBeenCalledWith(frames, 'sheet.png')
  })

  it('encodes compact sheets through the pure PNG path', () => {
    const encodePng = vi.fn((frame: PixelFrame) => new Uint8Array([frame.width, frame.height]))
    const downloadBytes = vi.fn()
    const ok = runSpriteSheetExport(frameSet, 'compact', 'compact.png', dependencies({ encodePng, downloadBytes }))
    expect(ok).toBe(true)
    expect(encodePng).toHaveBeenCalledTimes(1)
    expect(downloadBytes).toHaveBeenCalledWith(new Uint8Array([128, 256]), 'compact.png', 'image/png')
  })

  it('encodes and downloads GIF and APNG with the loop state and FPS', () => {
    const encodeAnimation = vi.fn(() => ({
      format: 'gif' as const,
      mime: 'image/gif',
      extension: 'gif',
      bytes: new Uint8Array([1, 2, 3]),
    }))
    const downloadBytes = vi.fn()
    const ok = runAnimationExport('gif', frameSet, 12, false, 'clip.gif', dependencies({ encodeAnimation, downloadBytes }))

    expect(ok).toBe(true)
    expect(encodeAnimation).toHaveBeenCalledWith({ format: 'gif', frames, fps: 12, loop: false })
    expect(downloadBytes).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), 'clip.gif', 'image/gif')
  })

  it('reports failure without downloading when animation encoding throws', () => {
    const encodeAnimation = vi.fn(() => { throw new Error('encode failed') })
    const downloadBytes = vi.fn()
    const ok = runAnimationExport('apng', frameSet, 24, true, 'clip.png', dependencies({ encodeAnimation, downloadBytes }))
    expect(ok).toBe(false)
    expect(downloadBytes).not.toHaveBeenCalled()
  })

  it('downloads the project document as stable JSON text', () => {
    const downloadText = vi.fn()
    const document = bridge().buildDocument({ pixelsPerUnit: 100, guid: null })
    const ok = runProjectJsonExport(document, 'project.json', dependencies({ downloadText }))
    expect(ok).toBe(true)
    const [text, fileName, mime] = downloadText.mock.calls[0] as [string, string, string]
    expect(fileName).toBe('project.json')
    expect(mime).toBe('application/json')
    expect(text.endsWith('\n')).toBe(true)
    expect(JSON.parse(text).schema).toBe('minerva.pixel-effect')
  })

  it('builds and downloads a Unity ZIP with the current frames and settings', () => {
    const buildUnityZip = vi.fn(() => new Uint8Array([9]))
    const downloadBytes = vi.fn()
    const document = bridge().buildDocument({ pixelsPerUnit: 100, guid: 'b93362e4a2b3bc240b452b57b97a4147' })
    const ok = runUnityExport(
      frameSet,
      'compact',
      12,
      document,
      100,
      'b93362e4a2b3bc240b452b57b97a4147',
      'folder',
      'atlas.png',
      'atlas.zip',
      dependencies({ buildUnityZip, downloadBytes }),
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
    expect(downloadBytes).toHaveBeenCalledWith(new Uint8Array([9]), 'atlas.zip', 'application/zip')
  })

  it('builds and downloads a frame ZIP with the current frames', () => {
    const buildFrameZip = vi.fn(() => new Uint8Array([7]))
    const downloadBytes = vi.fn()
    const document = bridge().buildDocument({ pixelsPerUnit: 100, guid: null })
    const ok = runFrameZipExport(frameSet, 12, document, 'frames', 'slash', 'frames.zip', dependencies({ buildFrameZip, downloadBytes }))
    expect(ok).toBe(true)
    expect(buildFrameZip).toHaveBeenCalledWith(expect.objectContaining({
      generatorId: 'slash',
      frames,
      fps: 12,
      folderName: 'frames',
      frameNamePrefix: 'slash',
    }))
    expect(downloadBytes).toHaveBeenCalledWith(new Uint8Array([7]), 'frames.zip', 'application/zip')
  })

  it('reads the frame set at export time instead of caching stale frames', () => {
    let latest = [frames[0]]
    const frameSetAtCallTime = { read: () => latest } as unknown as RenderedFrameSet
    const encodeAnimation = vi.fn(() => ({
      format: 'gif' as const,
      mime: 'image/gif',
      extension: 'gif',
      bytes: new Uint8Array([3]),
    }))

    runAnimationExport('gif', frameSetAtCallTime, 12, true, 'a.gif', dependencies({ encodeAnimation }))
    latest = frames
    runAnimationExport('gif', frameSetAtCallTime, 12, true, 'b.gif', dependencies({ encodeAnimation }))

    expect(encodeAnimation).toHaveBeenNthCalledWith(1, { format: 'gif', frames: [frames[0]], fps: 12, loop: true })
    expect(encodeAnimation).toHaveBeenNthCalledWith(2, { format: 'gif', frames, fps: 12, loop: true })
  })
})

describe('project import', () => {
  const projectText = serializeProjectDocument(slashProjectCodec, DEFAULT_SLASH_PARAMETERS, 12, {
    pixelsPerUnit: 100,
    guid: null,
  })

  it('parses, validates, and renders a valid project exactly once', () => {
    const importProject = vi.fn(() => ({ ok: true } as const))
    const result = importProjectFromText(projectText, slashProjectCodec, importProject)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.exportSettings).toEqual({ pixelsPerUnit: 100, guid: null })
    }
    expect(importProject).toHaveBeenCalledTimes(1)
    expect(importProject).toHaveBeenCalledWith({ parameters: DEFAULT_SLASH_PARAMETERS, fps: 12 })
  })

  it('rejects invalid JSON without calling the renderer', () => {
    const importProject = vi.fn(() => ({ ok: true } as const))
    const result = importProjectFromText('{not json', slashProjectCodec, importProject)
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_JSON' } })
    expect(importProject).not.toHaveBeenCalled()
  })

  it('rejects documents for another schema or generator before rendering', () => {
    const wrongSchema = JSON.parse(projectText) as Record<string, unknown>
    const result = importProjectFromText(JSON.stringify({ ...wrongSchema, schema: 'other.schema' }), slashProjectCodec, vi.fn())
    expect(result).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED_SCHEMA' } })

    const wrongGenerator = importProjectFromText(
      JSON.stringify({ ...wrongSchema, generator: 'blip' }),
      slashProjectCodec,
      vi.fn(),
    )
    expect(wrongGenerator).toMatchObject({ ok: false, error: { code: 'WRONG_GENERATOR' } })
  })

  it('surfaces renderer failures without committing anything', () => {
    const importProject: ImportProjectHandler = () => ({
      ok: false,
      error: { code: 'RENDER_FAILED', detail: 'render exploded' },
    })
    const result = importProjectFromText(projectText, slashProjectCodec, importProject)
    expect(result).toMatchObject({ ok: false, error: { code: 'RENDER_FAILED' } })
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
    hasProjectSupport = true,
    normalizedGuid = '',
  ): string {
    vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : undefined)
    return renderToStaticMarkup(
      <I18nProvider>
        <ExportPanelView
          state={state}
          metadata={metadata}
          hasProjectSupport={hasProjectSupport}
          normalizedGuid={normalizedGuid}
          fileInputRef={{ current: null }}
          onSelectCategory={noop}
          onSetLayout={noop}
          onSetTarget={noop}
          onSetFormat={noop}
          onToggleLoop={noop}
          onSetPixelsPerUnit={noop}
          onSetStableGuid={noop}
          onSaveProject={noop}
          onLoadProjectClick={noop}
          onLoadProjectFile={noop}
          onExportSpriteSheet={noop}
          onExportUnity={noop}
          onExportAnimation={noop}
          onExportFrameZip={noop}
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

  it('shows the normalized GUID line when a stable GUID is entered', () => {
    const markup = viewMarkup(
      { ...createInitialExportPanelState(), spriteTarget: 'unity', stableGuid: 'B93362E4-A2B3-BC24-0B45-2B57B97A4147' },
      'en',
      true,
      'b93362e4a2b3bc240b452b57b97a4147',
    )
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

  it('renders the project category with Save/Load JSON and import status', () => {
    const success = viewMarkup({ ...createInitialExportPanelState(), activeCategory: 'project', projectImportStatus: 'success' })
    expect(success).toContain('Slash · 128 × 128 · 8 frames · 12 FPS')
    expect(success).toContain('Save JSON')
    expect(success).toContain('Load JSON')
    expect(success).toContain('Project imported successfully.')
    expect(success).toContain('role="status"')

    const failed = viewMarkup({ ...createInitialExportPanelState(), activeCategory: 'project', projectImportStatus: 'error', categoryErrors: { project: 'bad file' } })
    expect(failed).toContain('role="alert"')
    expect(failed).toContain('bad file')
  })

  it('shows Encoding… and Preparing… labels while a task is active', () => {
    const gif = viewMarkup({ ...createInitialExportPanelState(), activeCategory: 'animation', activeTask: 'gif' })
    expect(gif).toContain('Encoding…')
    expect((gif.match(/disabled=""/g) ?? []).length).toBe(1)

    const zip = viewMarkup({ ...createInitialExportPanelState(), activeCategory: 'frameZip', activeTask: 'frameZip' })
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
})
