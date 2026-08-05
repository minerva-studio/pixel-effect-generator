import { useReducer } from 'react'
import type { RenderedFrameSet } from '../generators/contract'
import { useI18n } from '../i18n/I18nProvider'
import {
  encodeAnimation,
  type AnimationEncodeInput,
  type AnimationFormat,
  type AnimationResult,
} from '../shared/pixel/animation'
import type { PixelFrame } from '../shared/pixel/frame'
import { downloadBytes, exportHorizontalSpriteSheet } from './export'

interface ExportPanelProps {
  readonly frameSet: RenderedFrameSet
  readonly previewFps: number
  readonly generatorName: string
}

/** Local UI state of the export panel; never shared with the generator session. */
export interface ExportPanelState {
  readonly loop: boolean
  readonly encoding: AnimationFormat | null
  readonly error: string | null
}

/** State transitions driven by the export buttons and the loop toggle. */
export type ExportPanelAction =
  | { readonly type: 'toggleLoop'; readonly checked: boolean }
  | { readonly type: 'startEncoding'; readonly format: AnimationFormat }
  | { readonly type: 'encodingSucceeded' }
  | { readonly type: 'encodingFailed'; readonly message: string }

/** Loop starts enabled (infinite); encoding and errors start empty. */
export function createInitialExportPanelState(): ExportPanelState {
  return { loop: true, encoding: null, error: null }
}

/** Reduces one export-panel interaction into the next local UI state. */
export function exportPanelReducer(state: ExportPanelState, action: ExportPanelAction): ExportPanelState {
  switch (action.type) {
    case 'toggleLoop':
      return { ...state, loop: action.checked }
    case 'startEncoding':
      if (state.encoding !== null) {
        return state
      }
      return { ...state, encoding: action.format, error: null }
    case 'encodingSucceeded':
      return { ...state, encoding: null }
    case 'encodingFailed':
      return { ...state, encoding: null, error: action.message }
  }
}

/** Injectable export operations kept apart from React so behavior is testable. */
export interface ExportDependencies {
  readonly downloadSpriteSheet: (frames: readonly PixelFrame[], fileName: string) => void
  readonly encodeAnimation: (input: AnimationEncodeInput) => AnimationResult
  readonly downloadBytes: (bytes: Uint8Array, fileName: string, mime: string) => void
}

const EXPORT_DEPENDENCIES: ExportDependencies = {
  downloadSpriteSheet: exportHorizontalSpriteSheet,
  encodeAnimation,
  downloadBytes,
}

/** Runs one sprite-sheet export against the current frame set. */
export function runSpriteSheetExport(
  frameSet: RenderedFrameSet,
  fileName: string,
  dependencies: ExportDependencies,
): void {
  dependencies.downloadSpriteSheet(frameSet.read(), fileName)
}

/** Encodes and downloads one animation; returns false when encoding fails. */
export function runAnimationExport(
  format: AnimationFormat,
  frameSet: RenderedFrameSet,
  fps: number,
  loop: boolean,
  fileName: string,
  dependencies: ExportDependencies,
): boolean {
  try {
    const result = dependencies.encodeAnimation({ format, frames: frameSet.read(), fps, loop })
    dependencies.downloadBytes(result.bytes, fileName, result.mime)
    return true
  } catch {
    return false
  }
}

/** Derived display metadata refreshed from the current frame set on every render. */
export interface ExportPanelMetadata {
  readonly width: number
  readonly height: number
  readonly frameCount: number
  readonly fps: number
}

interface ExportPanelViewProps {
  readonly state: ExportPanelState
  readonly metadata: ExportPanelMetadata
  readonly onToggleLoop: (checked: boolean) => void
  readonly onExportPng: () => void
  readonly onExportGif: () => void
  readonly onExportApng: () => void
}

/** Presentational export panel; rendering depends only on state and metadata. */
export function ExportPanelView({
  state,
  metadata,
  onToggleLoop,
  onExportPng,
  onExportGif,
  onExportApng,
}: ExportPanelViewProps) {
  const { t } = useI18n()
  return (
    <section className="panel export-panel" aria-label={t('export.title')}>
      <div className="panel-heading export-heading">
        <div>
          <p className="section-label">{t('export.sectionLabel')}</p>
          <h2>{t('export.title')}</h2>
          <p className="export-summary">{t('export.summary', {
            width: metadata.width,
            height: metadata.height,
            frameCount: metadata.frameCount,
            fps: metadata.fps,
          })}</p>
        </div>
      </div>
      <div className="export-cards">
        <div className="export-card">
          <div className="export-card-head">
            <strong>{t('export.spriteSheetTitle')}</strong>
          </div>
          <div className="export-card-meta">
            <span>{t('workspace.exportDimensions', {
              width: metadata.frameCount * metadata.width,
              height: metadata.height,
            })}</span>
          </div>
          <div className="export-card-actions">
            <button className="primary-button" type="button" onClick={onExportPng}>
              {t('workspace.exportButton')}
            </button>
          </div>
        </div>
        <div className="export-card animated">
          <div className="export-card-head">
            <strong>{t('export.animatedTitle')}</strong>
            <label className="loop-toggle">
              <input
                aria-label={t('export.loopLabel')}
                type="checkbox"
                checked={state.loop}
                onChange={(event) => onToggleLoop(event.target.checked)}
              />
              <span>{t('export.loop')}</span>
            </label>
          </div>
          <div className="export-card-meta">
            <span>{t('export.animatedDescription', {
              width: metadata.width,
              height: metadata.height,
              frameCount: metadata.frameCount,
              fps: metadata.fps,
            })}</span>
          </div>
          <div className="export-card-actions">
            <button
              className="primary-button"
              type="button"
              disabled={state.encoding !== null}
              onClick={onExportGif}
            >
              {state.encoding === 'gif' ? t('export.encoding') : t('export.gifButton')}
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={state.encoding !== null}
              onClick={onExportApng}
            >
              {state.encoding === 'apng' ? t('export.encoding') : t('export.apngButton')}
            </button>
          </div>
          {state.error ? <p className="export-card-error" role="alert">{state.error}</p> : null}
        </div>
      </div>
    </section>
  )
}

/**
 * Standalone export panel for the active generator session. It consumes the
 * same already-rendered `RenderedFrameSet` as the Preview without copying
 * frames or re-rendering; Loop and encoding state stay local to this panel.
 */
export function ExportPanel({ frameSet, previewFps, generatorName }: ExportPanelProps) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(exportPanelReducer, undefined, createInitialExportPanelState)
  const frames = frameSet.read()
  const metadata: ExportPanelMetadata = {
    width: frames[0]?.width ?? 0,
    height: frames[0]?.height ?? 0,
    frameCount: frames.length,
    fps: previewFps,
  }
  const spriteSheetFileName = t('export.fileName', {
    name: generatorName,
    width: metadata.width,
    height: metadata.height,
    frameCount: metadata.frameCount,
  })
  const animationFileName = (format: AnimationFormat): string => {
    const params = {
      name: generatorName,
      width: metadata.width,
      height: metadata.height,
      frameCount: metadata.frameCount,
      fps: previewFps,
    }
    return format === 'gif'
      ? t('export.gifFileName', params)
      : t('export.apngFileName', params)
  }
  const handleAnimationExport = (format: AnimationFormat) => {
    if (state.encoding !== null) {
      return
    }
    dispatch({ type: 'startEncoding', format })
    window.setTimeout(() => {
      const succeeded = runAnimationExport(
        format,
        frameSet,
        previewFps,
        state.loop,
        animationFileName(format),
        EXPORT_DEPENDENCIES,
      )
      dispatch(succeeded
        ? { type: 'encodingSucceeded' }
        : { type: 'encodingFailed', message: t('export.error') })
    }, 0)
  }

  return (
    <ExportPanelView
      state={state}
      metadata={metadata}
      onToggleLoop={(checked) => dispatch({ type: 'toggleLoop', checked })}
      onExportPng={() => runSpriteSheetExport(frameSet, spriteSheetFileName, EXPORT_DEPENDENCIES)}
      onExportGif={() => handleAnimationExport('gif')}
      onExportApng={() => handleAnimationExport('apng')}
    />
  )
}
