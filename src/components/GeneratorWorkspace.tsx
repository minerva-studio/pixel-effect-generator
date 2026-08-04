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
    const typedSession = session as unknown as Session
    const frameCount = module.readFrameCount(typedSession.parameters)
    const category = module.categories.find((entry) => entry.id === typedSession.activeCategory)!
    const Controls = module.Controls

    const dispatch = (action: GeneratorSessionAction<Parameters, Category>) => {
      onSessionAction({
        generatorId: module.definition.id,
        action: action as GeneratorSessionAction<unknown, string>,
      })
    }

    const dispatchParameters = (parameters: Parameters) => {
      dispatch(createRenderedParametersAction(module, parameters))
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
          category={category}
          onReset={onReset}
          onParameters={dispatchParameters}
          onCategory={(nextCategory) => dispatch({ type: 'category', category: nextCategory })}
        />
        <Preview
          frameSet={typedSession.frames}
          previewTitle={module.previewTitle}
          frameWidth={module.frameWidth}
          frameHeight={module.frameHeight}
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
          footer={(
            <ExportBar
              frameSet={typedSession.frames}
              frameCount={frameCount}
              frameWidth={module.frameWidth}
              frameHeight={module.frameHeight}
              fileName={`pixel-${module.definition.id}-${frameCount}-frames.png`}
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
  return (
    <nav className="panel generator-panel" aria-label="Effect generators">
      <div className="navigation-heading">
        <p className="section-label">GENERATORS</p>
        <span>{GENERATOR_CATALOG.length.toString().padStart(2, '0')}</span>
      </div>
      <div className="generator-list">
        {GENERATOR_CATALOG.map((generator) => (
          <button
            className={`generator-item ${selectedGeneratorId === generator.id ? 'active' : ''}`}
            type="button"
            key={generator.id}
            aria-current={selectedGeneratorId === generator.id ? 'page' : undefined}
            onClick={() => onSelectGenerator(generator.id)}
          >
            <span className="generator-index">{String(generator.index).padStart(2, '0')}</span>
            <span>
              <strong>{generator.name}</strong>
              <small>{generator.description}</small>
            </span>
          </button>
        ))}
      </div>
      <p className="catalog-note">New effect families can join this catalog without changing the workspace.</p>
    </nav>
  )
}

/** Parameter panel with category tabs, reset, and the module's controls. */
function ControlsPanel<Parameters, Category extends string>({
  module,
  session,
  category,
  onReset,
  onParameters,
  onCategory,
}: {
  readonly module: GeneratorModule<string, Parameters, Category>
  readonly session: GeneratorSession<Parameters, Category>
  readonly category: { readonly id: Category; readonly label: string; readonly description: string }
  readonly onReset: () => void
  readonly onParameters: (parameters: Parameters) => void
  readonly onCategory: (category: Category) => void
}) {
  const Controls = module.Controls
  return (
    <aside className="panel controls-panel">
      <div className="panel-heading controls-heading">
        <div>
          <p className="section-label">GENERATOR {String(module.definition.index).padStart(2, '0')} · {module.definition.name.toUpperCase()}</p>
          <h2>{module.definition.name} parameters</h2>
        </div>
        <button className="text-button" type="button" onClick={onReset}>Reset</button>
      </div>

      <div className="category-tabs" role="tablist" aria-label={`${module.definition.name} parameter categories`}>
        {module.categories.map((entry) => (
          <button
            className={session.activeCategory === entry.id ? 'active' : ''}
            type="button"
            role="tab"
            aria-selected={session.activeCategory === entry.id}
            key={entry.id}
            onClick={() => onCategory(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <section className="category-content" aria-labelledby="active-category-title">
        <div className="category-heading">
          <p className="section-label">{category.label.toUpperCase()}</p>
          <h3 id="active-category-title">{category.label} controls</h3>
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
  return (
    <div className="export-row">
      <div>
        <strong>Horizontal sprite sheet</strong>
        <span>{frameCount * frameWidth} × {frameHeight} px · transparent PNG</span>
      </div>
      <button className="primary-button" type="button" onClick={() => exportHorizontalSpriteSheet(frameSet.read(), fileName)}>Export PNG</button>
    </div>
  )
}
