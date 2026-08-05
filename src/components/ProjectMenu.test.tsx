import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider } from '../i18n/I18nProvider'
import { serializeProjectDocument } from '../shared/project/document'
import { DEFAULT_SLASH_PARAMETERS } from '../generators/slash/model'
import { slashProjectCodec } from '../generators/slash/project'
import type { EffectProjectV1 } from '../shared/project/types'
import type { WorkspaceFileTask } from './fileOperations'
import type { ProjectBridge } from './projectBridge'
import type { UnityExportSettingsState } from './unitySettings'
import {
  ProjectMenu,
  ProjectMenuView,
  createInitialProjectMenuState,
  importProjectFromText,
  projectMenuReducer,
  resolveProjectSaveSettings,
  runProjectSave,
  type ProjectMenuDependencies,
  type ProjectMenuState,
} from './ProjectMenu'

afterEach(() => {
  vi.unstubAllGlobals()
})

const unitySettings: UnityExportSettingsState = { pixelsPerUnit: 32, stableGuid: '' }

function bridge(importProject: ProjectBridge['importProject'] = () => ({ ok: true } as const)): ProjectBridge {
  return {
    codec: slashProjectCodec,
    buildDocument: (settings): EffectProjectV1 => ({
      schema: 'minerva.pixel-effect',
      version: 1,
      generator: 'slash',
      parameters: slashProjectCodec.serialize(DEFAULT_SLASH_PARAMETERS),
      playback: { fps: 12 },
      export: { unity: settings },
    }),
    importProject,
  }
}

function fileOperations(activeTask: WorkspaceFileTask | null = null) {
  return {
    activeTask,
    tryStart: vi.fn(() => true),
    finish: vi.fn(),
  }
}

function dependencies(overrides: Partial<ProjectMenuDependencies> = {}): ProjectMenuDependencies {
  return {
    downloadText: vi.fn(),
    readFileAsText: vi.fn(async () => '{}'),
    serializeJson: vi.fn((document) => JSON.stringify(document)),
    ...overrides,
  }
}

describe('ProjectMenuView structure', () => {
  function viewMarkup(
    state: ProjectMenuState,
    options: { readonly busy?: boolean; readonly saving?: boolean; readonly opening?: boolean } = {},
    locale: 'en' | 'zh-CN' = 'en',
  ): string {
    vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : undefined)
    return renderToStaticMarkup(
      <I18nProvider>
        <ProjectMenuView
          state={state}
          busy={options.busy ?? false}
          saving={options.saving ?? false}
          opening={options.opening ?? false}
          menuId="project-menu-panel"
          buttonRef={{ current: null }}
          panelRef={{ current: null }}
          fileInputRef={{ current: null }}
          onToggle={() => undefined}
          onSave={() => undefined}
          onOpenClick={() => undefined}
          onFileChange={() => undefined}
        />
      </I18nProvider>,
    )
  }

  it('renders a closed Project button with correct ARIA', () => {
    const markup = viewMarkup(createInitialProjectMenuState())
    expect(markup).toContain('class="project-menu-button"')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('aria-haspopup="menu"')
    expect(markup).toContain('aria-controls="project-menu-panel"')
    expect(markup).toContain('>Project</span>')
    expect(markup).not.toContain('id="project-menu-panel"')
    expect(markup).not.toContain('role="menu"')
  })

  it('renders two menu items when open with the menu ARIA wiring', () => {
    const markup = viewMarkup({ open: true, error: null, status: 'idle' })
    expect(markup).toContain('aria-expanded="true"')
    expect(markup).toContain('aria-controls="project-menu-panel"')
    expect(markup).toContain('id="project-menu-panel"')
    expect(markup).toContain('role="menu"')
    expect((markup.match(/role="menuitem"/g) ?? []).length).toBe(2)
    expect(markup).toContain('Open project…')
    expect(markup).toContain('Save project')
  })

  it('shows Opening… and Saving… while the matching task runs and disables items', () => {
    const opening = viewMarkup({ open: true, error: null, status: 'idle' }, { opening: true, busy: true })
    expect(opening).toContain('Opening…')
    expect(opening).toContain('Save project')
    expect((opening.match(/disabled=""/g) ?? []).length).toBe(2)

    const saving = viewMarkup({ open: true, error: null, status: 'idle' }, { saving: true, busy: true })
    expect(saving).toContain('Saving…')
    expect(saving).toContain('Open project…')
  })

  it('shows success status and errors below the items', () => {
    const success = viewMarkup({ open: true, error: null, status: 'success' })
    expect(success).toContain('Project imported successfully.')
    expect(success).toContain('role="status"')
    expect(success).toContain('aria-live="polite"')

    const failed = viewMarkup({ open: true, error: 'bad file', status: 'idle' })
    expect(failed).toContain('role="alert"')
    expect(failed).toContain('bad file')
  })

  it('renders Simplified Chinese labels', () => {
    const markup = viewMarkup({ open: true, error: null, status: 'idle' }, {}, 'zh-CN')
    expect(markup).toContain('打开项目…')
    expect(markup).toContain('保存项目')
  })
})

describe('Project menu state', () => {
  it('starts closed with no status or error', () => {
    expect(createInitialProjectMenuState()).toEqual({ open: false, error: null, status: 'idle' })
  })

  it('toggles open and closes without clearing the last error', () => {
    const withError = { open: true, error: 'boom', status: 'idle' as const }
    expect(projectMenuReducer(createInitialProjectMenuState(), { type: 'toggle' })).toMatchObject({ open: true })
    expect(projectMenuReducer(withError, { type: 'close' })).toEqual({ open: false, error: 'boom', status: 'idle' })
  })

  it('clears the previous error when a new operation starts', () => {
    const started = projectMenuReducer({ open: true, error: 'boom', status: 'idle' }, { type: 'operationStarted' })
    expect(started).toEqual({ open: true, error: null, status: 'idle' })
  })

  it('records success and failure status separately', () => {
    expect(projectMenuReducer({ open: true, error: null, status: 'idle' }, { type: 'operationSucceeded' }))
      .toEqual({ open: true, error: null, status: 'success' })
    expect(projectMenuReducer({ open: true, error: null, status: 'idle' }, { type: 'operationFailed', message: 'nope' }))
      .toEqual({ open: true, error: 'nope', status: 'idle' })
  })
})

describe('runProjectSave', () => {
  it('saves the latest parameters, FPS, PPU, and GUID without rendering', () => {
    const downloadText = vi.fn()
    const serializeJson = vi.fn((document: EffectProjectV1) => JSON.stringify(document))
    const importProject = vi.fn()
    const deps = dependencies({ downloadText, serializeJson })
    const result = runProjectSave(
      bridge(importProject),
      { pixelsPerUnit: 64, stableGuid: '  B93362E4-A2B3-BC24-0B45-2B57B97A4147  ' },
      'project.json',
      deps,
    )

    expect(result.ok).toBe(true)
    expect(importProject).not.toHaveBeenCalled()
    expect(downloadText).toHaveBeenCalledTimes(1)
    const [text, fileName, mime] = downloadText.mock.calls[0] as [string, string, string]
    expect(fileName).toBe('project.json')
    expect(mime).toBe('application/json')
    expect(JSON.parse(text).export.unity.guid).toBe('b93362e4a2b3bc240b452b57b97a4147')
    expect(JSON.parse(text).export.unity.pixelsPerUnit).toBe(64)
  })

  it('rejects invalid PPU and GUID without downloading', () => {
    const downloadText = vi.fn()
    const deps = dependencies({ downloadText })
    expect(runProjectSave(bridge(), { pixelsPerUnit: 0, stableGuid: '' }, 'p.json', deps))
      .toMatchObject({ ok: false, error: { code: 'INVALID_PPU' } })
    expect(runProjectSave(bridge(), { pixelsPerUnit: 32, stableGuid: 'nope' }, 'p.json', deps))
      .toMatchObject({ ok: false, error: { code: 'INVALID_GUID' } })
    expect(downloadText).not.toHaveBeenCalled()
  })

  it('reports download failures when serialization or download throws', () => {
    const failingBridge = { ...bridge(), buildDocument: () => { throw new Error('boom') } }
    const result = runProjectSave(failingBridge, unitySettings, 'p.json', dependencies())
    expect(result).toMatchObject({ ok: false, error: { code: 'DOWNLOAD_FAILED' } })
  })
})

describe('resolveProjectSaveSettings', () => {
  it('normalizes trimmed GUIDs and keeps null for empty input', () => {
    expect(resolveProjectSaveSettings({ pixelsPerUnit: 32, stableGuid: '  B93362E4-A2B3-BC24-0B45-2B57B97A4147  ' }))
      .toEqual({ ok: true, exportSettings: { pixelsPerUnit: 32, guid: 'b93362e4a2b3bc240b452b57b97a4147' } })
    expect(resolveProjectSaveSettings({ pixelsPerUnit: 32, stableGuid: '   ' }))
      .toEqual({ ok: true, exportSettings: { pixelsPerUnit: 32, guid: null } })
  })
})

describe('importProjectFromText', () => {
  const projectText = serializeProjectDocument(slashProjectCodec, DEFAULT_SLASH_PARAMETERS, 12, {
    pixelsPerUnit: 64,
    guid: null,
  })

  it('parses, validates, and imports a valid project exactly once', () => {
    const importProject = vi.fn(() => ({ ok: true } as const))
    const result = importProjectFromText(projectText, slashProjectCodec, importProject)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.exportSettings).toEqual({ pixelsPerUnit: 64, guid: null })
    }
    expect(importProject).toHaveBeenCalledTimes(1)
    expect(importProject).toHaveBeenCalledWith({
      parameters: DEFAULT_SLASH_PARAMETERS,
      fps: 12,
      exportSettings: { pixelsPerUnit: 64, guid: null },
    })
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
    const importProject = vi.fn(() => ({
      ok: false as const,
      error: { code: 'RENDER_FAILED' as const, detail: 'render exploded' },
    }))
    const result = importProjectFromText(projectText, slashProjectCodec, importProject)
    expect(result).toMatchObject({ ok: false, error: { code: 'RENDER_FAILED' } })
    expect(importProject).toHaveBeenCalledTimes(1)
  })

  it('can import the same text again after the input is cleared', () => {
    const importProject = vi.fn(() => ({ ok: true } as const))
    expect(importProjectFromText(projectText, slashProjectCodec, importProject).ok).toBe(true)
    expect(importProjectFromText(projectText, slashProjectCodec, importProject).ok).toBe(true)
    expect(importProject).toHaveBeenCalledTimes(2)
  })
})

describe('ProjectMenu component', () => {
  it('renders without codec-independent props and stays closed by default', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ProjectMenu
          bridge={bridge()}
          fileName="project.json"
          unitySettings={unitySettings}
          fileOperations={fileOperations()}
        />
      </I18nProvider>,
    )
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('aria-controls=')
    expect(markup).not.toContain('role="menu"')
  })
})
