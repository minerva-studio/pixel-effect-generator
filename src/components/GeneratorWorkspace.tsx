import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import type {
  GeneratorModule,
  GeneratorSession,
  GeneratorSessionAction,
  RegisteredGeneratorAction,
  RegisteredGeneratorSession,
} from '../generators/contract'
import { createImportedProjectAction, createRenderedParametersAction } from '../generators/contract'
import { GENERATOR_CATALOG } from '../generators/registry'
import {
  categoryDisplayKeys,
  generatorDisplayKeys,
} from '../i18n/messages'
import { useI18n } from '../i18n/I18nProvider'
import { buildProjectDocument } from '../shared/project/document'
import type { GeneratorProjectCodec, ProjectExportSettings } from '../shared/project/types'
import type { PreviewZoom } from '../shared/preview/zoom'
import { ExportPanel } from './ExportPanel'
import { useFileOperationController } from './fileOperations'
import { Preview } from './Preview'
import { PresetBar } from './PresetBar'
import { ProjectMenu } from './ProjectMenu'
import type { ParsedProjectImport, ProjectBridge, ProjectImportResult } from './projectBridge'
import { DEFAULT_UNITY_EXPORT_SETTINGS, type UnityExportSettingsState } from './unitySettings'

/**
 * Creates the workspace import handler. The full session action is built
 * before any state mutation so renderer failures leave both the session and
 * the shared Unity settings untouched; React batches the two commits.
 */
export function createProjectImportHandler<Id extends string, Parameters, Category extends string>(
  module: GeneratorModule<Id, Parameters, Category>,
  onSessionAction: (action: RegisteredGeneratorAction<Id>) => void,
  onUnitySettingsChange: (settings: UnityExportSettingsState) => void,
): (project: ParsedProjectImport) => ProjectImportResult {
  return ({ parameters, fps, exportSettings }) => {
    try {
      const action = createImportedProjectAction(module, parameters as Parameters, fps)
      onSessionAction({
        generatorId: module.definition.id,
        action: action as GeneratorSessionAction<unknown, string>,
      })
      onUnitySettingsChange({
        pixelsPerUnit: exportSettings.pixelsPerUnit,
        stableGuid: exportSettings.guid ?? '',
      })
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: { code: 'RENDER_FAILED', detail: describeError(error) },
      }
    }
  }
}

interface RegisteredWorkspaceProps {
  readonly session: RegisteredGeneratorSession<string>
  readonly selectedGeneratorId: string
  readonly onSelectGenerator: (id: string) => void
  readonly onSessionAction: (action: RegisteredGeneratorAction<string>) => void
  readonly onReset: () => void
}

/**
 * Binds a fully typed module into the opaque registered workspace surface.
 * This is the only place a concrete session is cast; the App and the module
 * never see `unknown` session state.
 */
export function createGeneratorWorkspace<Id extends string, Parameters, Category extends string>(
  module: GeneratorModule<Id, Parameters, Category>,
  _sessionType: GeneratorSession<Parameters, Category>,
): ComponentType<RegisteredWorkspaceProps> {
  type Session = GeneratorSession<Parameters, Category>

  const BoundWorkspace = ({ session, selectedGeneratorId, onSelectGenerator, onSessionAction, onReset }: RegisteredWorkspaceProps) => {
    const { t, locale } = useI18n()
    const [unitySettings, setUnitySettings] = useState<UnityExportSettingsState>(DEFAULT_UNITY_EXPORT_SETTINGS)
    const [previewZoom, setPreviewZoom] = useState<PreviewZoom>('fit')
    const fileOperations = useFileOperationController()
    const dispatch = (action: GeneratorSessionAction<Parameters, Category>) => {
      onSessionAction({
        generatorId: module.definition.id,
        action: action as GeneratorSessionAction<unknown, string>,
      })
    }
    const typedSession = session as unknown as Session
    const frameCount = module.readFrameCount(typedSession.parameters)
    const category = module.categories.find((entry) => entry.id === typedSession.activeCategory)!
    const Controls = module.Controls
    const PreviewTools = module.PreviewTools
    const frames = typedSession.frames.read()
    const firstFrame = frames[0]
    const parameterFrameSize = module.readFrameSize(typedSession.parameters)
    const frameWidth = firstFrame?.width ?? parameterFrameSize.width
    const frameHeight = firstFrame?.height ?? parameterFrameSize.height
    const dispatchParameters = (parameters: Parameters) => {
      dispatch(createRenderedParametersAction(module, parameters))
    }
    const resizeHandler = module.resize
    const onResize = resizeHandler
      ? (nextSize: { readonly width: number; readonly height: number }, scaleEffect: boolean) => {
          dispatchParameters(resizeHandler(typedSession.parameters, nextSize, scaleEffect))
        }
      : undefined
    const displayKeys = generatorDisplayKeys(module.definition.id)
    const generatorName = displayKeys ? t(displayKeys.name) : module.definition.name
    const previewTitle = displayKeys ? t(displayKeys.previewTitle) : module.previewTitle
    const categoryKeys = categoryDisplayKeys(module.definition.id, category.id)
    const activeCategory = {
      id: category.id,
      label: categoryKeys ? t(categoryKeys.label) : category.label,
      description: categoryKeys ? t(categoryKeys.description) : category.description,
    }
    const projectCodec = module.projectCodec
    const importProject = createProjectImportHandler(module, onSessionAction, setUnitySettings)
    const projectBridge: ProjectBridge | undefined = projectCodec ? {
      codec: projectCodec as unknown as GeneratorProjectCodec<unknown>,
      buildDocument: (settings: ProjectExportSettings) => buildProjectDocument(
        projectCodec as unknown as GeneratorProjectCodec<unknown>,
        typedSession.parameters,
        typedSession.previewFps,
        settings,
      ),
      importProject,
    } : undefined
    const projectFileName = projectBridge ? t('project.fileName', {
      name: module.definition.id,
      width: frameWidth,
      height: frameHeight,
      frameCount,
    }) : undefined
    const projectMenu = projectBridge && projectFileName ? (
      <ProjectMenu
        bridge={projectBridge}
        fileName={projectFileName}
        unitySettings={unitySettings}
        fileOperations={fileOperations}
      />
    ) : undefined
    const presetBar = module.presetCapability ? (
      <PresetBar
        capability={module.presetCapability}
        generatorId={module.definition.id}
        parameters={typedSession.parameters}
        onApply={dispatchParameters}
      />
    ) : undefined

    useEffect(() => {
      if (typedSession.frameIndex >= frameCount) {
        dispatch({ type: 'frame', frameIndex: frameCount - 1 })
      }
    }, [frameCount, typedSession.frameIndex])

    return (
      <section className="workspace">
        <GeneratorNav selectedGeneratorId={selectedGeneratorId} onSelectGenerator={onSelectGenerator} />
        <ControlsPanel
          module={module}
          session={typedSession}
          generatorName={generatorName}
          category={activeCategory}
          projectMenu={projectMenu}
          presetBar={presetBar}
          onReset={onReset}
          onParameters={dispatchParameters}
          onCategory={(nextCategory) => dispatch({ type: 'category', category: nextCategory })}
        />
        <Preview
          frameSet={typedSession.frames}
          previewTitle={previewTitle}
          frameWidth={frameWidth}
          frameHeight={frameHeight}
          frameIndex={typedSession.frameIndex}
          isPlaying={typedSession.isPlaying}
          previewFps={typedSession.previewFps}
          frameCount={frameCount}
          minimumFrameCount={module.minimumFrameCount}
          maximumFrameCount={module.maximumFrameCount}
          onFrameIndex={(frameIndex) => dispatch({ type: 'frame', frameIndex })}
          onPlaying={(isPlaying) => dispatch({ type: 'play', isPlaying })}
          onPreviewFps={(previewFps) => dispatch({ type: 'fps', previewFps })}
          zoom={previewZoom}
          onZoomChange={setPreviewZoom}
          onFrameCount={(frameCount) => dispatchParameters(
            module.writeFrameCount(typedSession.parameters, frameCount),
          )}
          tools={PreviewTools ? (
            <PreviewTools parameters={typedSession.parameters} onChange={dispatchParameters} onResize={onResize} />
          ) : undefined}
        />
        <ExportPanel
          frameSet={typedSession.frames}
          previewFps={typedSession.previewFps}
          generatorId={module.definition.id}
          generatorName={generatorName}
          unitySettings={unitySettings}
          onUnitySettingsChange={setUnitySettings}
          fileOperations={fileOperations}
          buildProjectDocument={projectBridge?.buildDocument}
        />
      </section>
    )
  }

  return BoundWorkspace
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Navigation sidebar listing every registered generator. */
function GeneratorNav({
  selectedGeneratorId,
  onSelectGenerator,
}: {
  readonly selectedGeneratorId: string
  readonly onSelectGenerator: (id: string) => void
}) {
  const { t } = useI18n()
  return (
    <nav className="panel generator-panel" aria-label={t('workspace.navLabel')}>
      <div className="navigation-heading">
        <p className="section-label">{t('workspace.generatorsLabel')}</p>
        <span>{GENERATOR_CATALOG.length.toString().padStart(2, '0')}</span>
      </div>
      <div className="generator-list">
        {GENERATOR_CATALOG.map((generator) => {
          const displayKeys = generatorDisplayKeys(generator.id)
          const name = displayKeys ? t(displayKeys.name) : generator.name
          const description = displayKeys ? t(displayKeys.description) : generator.description
          return (
            <button
              className={`generator-item ${selectedGeneratorId === generator.id ? 'active' : ''}`}
              type="button"
              key={generator.id}
              aria-current={selectedGeneratorId === generator.id ? 'page' : undefined}
              onClick={() => onSelectGenerator(generator.id)}
            >
              <span className="generator-index">{String(generator.index).padStart(2, '0')}</span>
              <span>
                <strong>{name}</strong>
                <small>{description}</small>
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/** Parameter panel with category tabs, reset, and the module's controls. */
function ControlsPanel<Parameters, Category extends string>({
  module,
  session,
  generatorName,
  category,
  projectMenu,
  presetBar,
  onReset,
  onParameters,
  onCategory,
}: {
  readonly module: GeneratorModule<string, Parameters, Category>
  readonly session: GeneratorSession<Parameters, Category>
  readonly generatorName: string
  readonly category: { readonly id: Category; readonly label: string; readonly description: string }
  readonly projectMenu?: ReactNode
  readonly presetBar?: ReactNode
  readonly onReset: () => void
  readonly onParameters: (parameters: Parameters) => void
  readonly onCategory: (category: Category) => void
}) {
  const { t, locale } = useI18n()
  const Controls = module.Controls
  const sectionName = locale === 'en' ? generatorName.toUpperCase() : generatorName
  return (
    <aside className="panel controls-panel">
      <div className="panel-heading controls-heading">
        <div className="controls-heading-copy">
          <p className="section-label">{t('workspace.generatorSectionLabel', { index: String(module.definition.index).padStart(2, '0'), name: sectionName })}</p>
          <h2>{t('workspace.parametersTitle', { name: generatorName })}</h2>
        </div>
        <div className="controls-heading-actions">
          {projectMenu}
          <button className="text-button" type="button" onClick={onReset}>{t('workspace.reset')}</button>
        </div>
      </div>

      {presetBar}

      <div className="category-tabs" role="tablist" aria-label={t('workspace.categoryTabsLabel', { name: generatorName })}>
        {module.categories.map((entry) => {
          const entryKeys = categoryDisplayKeys(module.definition.id, entry.id)
          const label = entryKeys ? t(entryKeys.label) : entry.label
          return (
            <button
              className={session.activeCategory === entry.id ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={session.activeCategory === entry.id}
              key={entry.id}
              onClick={() => onCategory(entry.id)}
            >
              {label}
            </button>
          )
        })}
      </div>

      <section className="category-content" aria-labelledby="active-category-title">
        <div className="category-heading">
          <p className="section-label">{locale === 'en' ? category.label.toUpperCase() : category.label}</p>
          <h3 id="active-category-title">{t('workspace.categoryControls', { label: category.label })}</h3>
          <p>{category.description}</p>
        </div>
        <Controls category={session.activeCategory} parameters={session.parameters} onChange={onParameters} />
      </section>
    </aside>
  )
}
