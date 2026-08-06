import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
// GeneratorWorkspace must load before the slash module so the registry
// evaluates with the app's registry-first import order.
import { createGeneratorWorkspace, createProjectImportHandler } from './GeneratorWorkspace'
import { I18nProvider } from '../i18n/I18nProvider'
import { slashGenerator } from '../generators/slash/module'
import { blipGenerator, blipModule } from '../generators/tests/blipFixture'
import type { RegisteredGeneratorAction } from '../generators/contract'
import { DEFAULT_UNITY_EXPORT_SETTINGS } from './unitySettings'
import { createFileOperationLock } from './fileOperations'

function workspaceMarkup(generatorId: 'slash' | 'blip', locale: 'en' | 'zh-CN' = 'en'): string {
  vi.stubGlobal('navigator', locale === 'zh-CN' ? { language: 'zh-CN' } : undefined)
  const generator = generatorId === 'slash' ? slashGenerator : blipGenerator
  const Workspace = generator.Workspace
  const session = generator.createSession(12)
  const lock = createFileOperationLock()
  return renderToStaticMarkup(
    <I18nProvider>
      <Workspace
        session={session}
        selectedGeneratorId={generatorId}
        onSelectGenerator={() => undefined}
        onSessionAction={() => undefined}
        onReset={() => undefined}
        unitySettings={DEFAULT_UNITY_EXPORT_SETTINGS}
        onUnitySettingsChange={() => undefined}
        fileOperations={{
          activeTask: lock.current,
          tryStart: (task) => lock.tryStart(task),
          finish: (task) => lock.finish(task),
        }}
      />
    </I18nProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createProjectImportHandler', () => {
  it('commits the session action and shared Unity settings together', () => {
    const onSessionAction = vi.fn()
    const onUnitySettingsChange = vi.fn()
    const handler = createProjectImportHandler(blipModule, onSessionAction, onUnitySettingsChange)

    const result = handler({
      parameters: { intensity: 3, frameCount: 6 },
      fps: 18,
      exportSettings: { pixelsPerUnit: 64, guid: 'b93362e4a2b3bc240b452b57b97a4147' },
    })

    expect(result.ok).toBe(true)
    expect(onSessionAction).toHaveBeenCalledTimes(1)
    const [action] = onSessionAction.mock.calls[0] as [RegisteredGeneratorAction<string>]
    expect(action.generatorId).toBe('blip')
    expect(action.action.type).toBe('importProject')
    expect(onUnitySettingsChange).toHaveBeenCalledWith({
      pixelsPerUnit: 64,
      stableGuid: 'b93362e4a2b3bc240b452b57b97a4147',
    })
  })

  it('does not commit anything when the renderer throws', () => {
    const render = vi.fn(() => { throw new Error('render exploded') })
    const module = { ...blipModule, render }
    const onSessionAction = vi.fn()
    const onUnitySettingsChange = vi.fn()
    const handler = createProjectImportHandler(module, onSessionAction, onUnitySettingsChange)

    const result = handler({
      parameters: { intensity: 1, frameCount: 5 },
      fps: 12,
      exportSettings: { pixelsPerUnit: 32, guid: null },
    })

    expect(result).toMatchObject({ ok: false, error: { code: 'RENDER_FAILED' } })
    expect(render).toHaveBeenCalledTimes(1)
    expect(onSessionAction).not.toHaveBeenCalled()
    expect(onUnitySettingsChange).not.toHaveBeenCalled()
  })

  it('keeps a previously committed session when a later import fails', () => {
    const onSessionAction = vi.fn()
    const onUnitySettingsChange = vi.fn()
    const handler = createProjectImportHandler(blipModule, onSessionAction, onUnitySettingsChange)

    expect(handler({ parameters: { intensity: 2, frameCount: 5 }, fps: 12, exportSettings: { pixelsPerUnit: 32, guid: null } }).ok).toBe(true)
    const failing = createProjectImportHandler(
      { ...blipModule, render: () => { throw new Error('boom') } },
      onSessionAction,
      onUnitySettingsChange,
    )
    expect(failing({ parameters: { intensity: 9, frameCount: 5 }, fps: 12, exportSettings: { pixelsPerUnit: 64, guid: null } }).ok).toBe(false)
    expect(onSessionAction).toHaveBeenCalledTimes(1)
    expect(onUnitySettingsChange).toHaveBeenCalledTimes(1)
  })
})

describe('GeneratorWorkspace integration', () => {
  it('places the Project menu in the Controls header, not the Export panel', () => {
    const markup = workspaceMarkup('slash')
    const controlsHeading = markup.indexOf('controls-heading"')
    const exportPanel = markup.indexOf('class="panel export-panel"')
    const menu = markup.indexOf('class="project-menu-button"')
    const reset = markup.indexOf('>Reset<')

    expect(controlsHeading).toBeGreaterThan(-1)
    expect(menu).toBeGreaterThan(controlsHeading)
    expect(reset).toBeGreaterThan(menu)
    expect(menu).toBeLessThan(exportPanel)
    expect(markup.slice(exportPanel)).not.toContain('project-menu')
    expect(markup.slice(exportPanel)).not.toContain('>Project<')
    expect(markup).toContain('>Project</span>')
  })

  it('renders preset header controls for generators with preset capability', () => {
    const markup = workspaceMarkup('slash')
    expect(markup).not.toContain('preset-panel')
    expect(markup).not.toContain('preset-bar')
    expect(markup).toContain('>Presets<')
    expect(markup).toContain('preset-actions')
    expect(markup).not.toContain('preset-dialog')
  })

  it('renders the Project menu in Simplified Chinese', () => {
    const markup = workspaceMarkup('slash', 'zh-CN')
    expect(markup).toContain('>项目</span>')
  })

  it('hides the Project menu for generators without a project codec', () => {
    const markup = workspaceMarkup('blip')
    expect(markup).not.toContain('project-menu')
    expect(markup).not.toContain('>Project<')
    expect(markup).not.toContain('Select preset…')
    expect(markup).not.toContain('preset-actions')
  })

  it('keeps the Export panel first category as Sprite Sheet', () => {
    const markup = workspaceMarkup('slash')
    const exportPanel = markup.indexOf('class="panel export-panel"')
    const exportSection = markup.slice(exportPanel)
    expect(exportSection.indexOf('>Sprite Sheet<')).toBeGreaterThan(-1)
    expect(exportSection.indexOf('>Export PNG<')).toBeGreaterThan(exportSection.indexOf('>Sprite Sheet<'))
  })

  it('creates typed workspaces for modules without codecs through the registry path', () => {
    const Workspace = createGeneratorWorkspace(blipModule, {} as never)
    const session = blipGenerator.createSession(12)
    const lock = createFileOperationLock()
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <Workspace
          session={session}
          selectedGeneratorId="blip"
          onSelectGenerator={() => undefined}
          onSessionAction={() => undefined}
          onReset={() => undefined}
          unitySettings={DEFAULT_UNITY_EXPORT_SETTINGS}
          onUnitySettingsChange={() => undefined}
          fileOperations={{
            activeTask: lock.current,
            tryStart: (task) => lock.tryStart(task),
            finish: (task) => lock.finish(task),
          }}
        />
      </I18nProvider>,
    )
    expect(markup).toContain('class="panel export-panel"')
    expect(markup).not.toContain('project-menu')
  })
})
