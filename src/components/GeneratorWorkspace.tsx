import { useEffect, type ComponentType } from 'react'
import type {
  GeneratorModule,
  RenderedFrameSet,
  GeneratorSession,
  GeneratorSessionAction,
  RegisteredGeneratorAction,
  RegisteredGeneratorSession,
} from '../generators/contract'
import { createRenderedParametersAction } from '../generators/contract'
import { GENERATOR_CATALOG } from '../generators/registry'
import {
  categoryDisplayKeys,
  generatorDisplayKeys,
} from '../i18n/messages'
import { useI18n } from '../i18n/I18nProvider'
import { exportHorizontalSpriteSheet } from './export'
import { Preview } from './Preview'

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
          onFrameCount={(frameCount) => dispatchParameters(
            module.writeFrameCount(typedSession.parameters, frameCount),
          )}
          tools={PreviewTools ? (
            <PreviewTools parameters={typedSession.parameters} onChange={dispatchParameters} onResize={onResize} />
          ) : undefined}
          footer={(
            <ExportBar
              frameSet={typedSession.frames}
              frameCount={frameCount}
              frameWidth={frameWidth}
              frameHeight={frameHeight}
              fileName={t('export.fileName', {
                name: generatorName,
                width: frameWidth,
                height: frameHeight,
                frameCount,
              })}
            />
          )}
        />
      </section>
    )
  }

  return BoundWorkspace
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
  onReset,
  onParameters,
  onCategory,
}: {
  readonly module: GeneratorModule<string, Parameters, Category>
  readonly session: GeneratorSession<Parameters, Category>
  readonly generatorName: string
  readonly category: { readonly id: Category; readonly label: string; readonly description: string }
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
        <div>
          <p className="section-label">{t('workspace.generatorSectionLabel', { index: String(module.definition.index).padStart(2, '0'), name: sectionName })}</p>
          <h2>{t('workspace.parametersTitle', { name: generatorName })}</h2>
        </div>
        <button className="text-button" type="button" onClick={onReset}>{t('workspace.reset')}</button>
      </div>

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

/** Horizontal sprite-sheet export row shared by every generator. */
function ExportBar({
  frameSet,
  frameCount,
  frameWidth,
  frameHeight,
  fileName,
}: {
  readonly frameSet: RenderedFrameSet
  readonly frameCount: number
  readonly frameWidth: number
  readonly frameHeight: number
  readonly fileName: string
}) {
  const { t } = useI18n()
  return (
    <div className="export-row">
      <div>
        <strong>{t('workspace.exportTitle')}</strong>
        <span>{t('workspace.exportDimensions', { width: frameCount * frameWidth, height: frameHeight })}</span>
      </div>
      <button className="primary-button" type="button" onClick={() => exportHorizontalSpriteSheet(frameSet.read(), fileName)}>{t('workspace.exportButton')}</button>
    </div>
  )
}
