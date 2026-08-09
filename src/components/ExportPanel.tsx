import { useEffect, useId, useMemo, useReducer, useRef, type RefObject } from 'react'
import type { RenderedFrameSet } from '../generators/contract'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey, TranslateFunction } from '../i18n/messages'
import {
  encodeAnimation,
  type AnimationEncodeInput,
  type AnimationFormat,
  type AnimationResult,
} from '../shared/pixel/animation'
import { chooseCompactColumns, packSpriteSheet, type PackedSpriteSheet, type SpriteSheetLayout } from '../shared/pixel/atlas'
import type { PixelFrame } from '../shared/pixel/frame'
import { encodePng } from '../shared/pixel/png'
import { resolvePreviewSize } from '../shared/preview/zoom'
import type {
  EffectProjectV1,
  ExportError,
  ExportErrorCode,
  ProjectExportSettings,
} from '../shared/project/types'
import { normalizeGuid, randomGuid } from '../shared/unity/guid'
import { UNITY_MAX_ATLAS_SIZE } from '../shared/unity/textureSize'
import { buildFrameZip, buildUnityZip, type FrameZipInput, type UnityZipInput } from '../shared/zip/zip'
import { drawFrame, exportHorizontalSpriteSheet } from './export'
import { createFileDelivery, getDesktopFileApi, type FileDelivery, type FileSaveResult } from './fileDelivery'
import type { FileOperationController, WorkspaceFileTask } from './fileOperations'
import { useToast } from './toast/ToastProvider'
import type { UnityExportSettingsState } from './unitySettings'

export const PNG_MIME = 'image/png'
export const ZIP_MIME = 'application/zip'

/** Asset-only export categories; project JSON lives in the parameter header. */
export type ExportCategory = 'spriteSheet' | 'animation' | 'frameZip'

export type SpriteTarget = 'png' | 'unity'
export type AtlasZoom = 'fit' | 1 | 2 | 4

/** Local UI state of the export panel; never shared with the generator session. */
export interface ExportPanelState {
  readonly activeCategory: ExportCategory
  readonly spriteLayout: SpriteSheetLayout
  readonly spriteTarget: SpriteTarget
  readonly animationFormat: AnimationFormat
  readonly loop: boolean
  readonly atlasPreviewOpen: boolean
  readonly atlasZoom: AtlasZoom
  readonly categoryErrors: Readonly<Partial<Record<ExportCategory, string>>>
}

/** State transitions driven by the export controls. */
export type ExportPanelAction =
  | { readonly type: 'selectCategory'; readonly category: ExportCategory }
  | { readonly type: 'setSpriteLayout'; readonly layout: SpriteSheetLayout }
  | { readonly type: 'setSpriteTarget'; readonly target: SpriteTarget }
  | { readonly type: 'setAnimationFormat'; readonly format: AnimationFormat }
  | { readonly type: 'toggleLoop'; readonly checked: boolean }
  | { readonly type: 'toggleAtlasPreview' }
  | { readonly type: 'setAtlasZoom'; readonly zoom: AtlasZoom }
  | { readonly type: 'categoryError'; readonly category: ExportCategory; readonly message: string }
  | { readonly type: 'clearCategoryError'; readonly category: ExportCategory }

/** Export panel starts on Sprite Sheet with PNG output and no errors. */
export function createInitialExportPanelState(): ExportPanelState {
  return {
    activeCategory: 'spriteSheet',
    spriteLayout: 'horizontal',
    spriteTarget: 'png',
    animationFormat: 'gif',
    loop: true,
    atlasPreviewOpen: false,
    atlasZoom: 'fit',
    categoryErrors: {},
  }
}

/** Reduces one export-panel interaction into the next local UI state. */
export function exportPanelReducer(state: ExportPanelState, action: ExportPanelAction): ExportPanelState {
  switch (action.type) {
    case 'selectCategory':
      return { ...state, activeCategory: action.category }
    case 'setSpriteLayout':
      return { ...state, spriteLayout: action.layout }
    case 'setSpriteTarget':
      return { ...state, spriteTarget: action.target }
    case 'setAnimationFormat':
      return { ...state, animationFormat: action.format }
    case 'toggleLoop':
      return { ...state, loop: action.checked }
    case 'toggleAtlasPreview':
      return { ...state, atlasPreviewOpen: !state.atlasPreviewOpen }
    case 'setAtlasZoom':
      return { ...state, atlasZoom: action.zoom }
    case 'categoryError':
      return {
        ...state,
        categoryErrors: { ...state.categoryErrors, [action.category]: action.message },
      }
    case 'clearCategoryError':
      return {
        ...state,
        categoryErrors: clearCategoryError(state.categoryErrors, action.category),
      }
  }
}

/** Injectable export operations kept apart from React so behavior is testable. */
export interface ExportDependencies {
  readonly downloadSpriteSheet: (frames: readonly PixelFrame[], fileName: string) => void
  readonly encodeAnimation: (input: AnimationEncodeInput) => AnimationResult
  readonly encodePng: (frame: PixelFrame) => Uint8Array
  readonly buildFrameZip: (input: FrameZipInput) => Uint8Array
  readonly buildUnityZip: (input: UnityZipInput) => Uint8Array
  readonly randomGuid: () => string
  readonly fileDelivery: FileDelivery
  readonly packSpriteSheet: (
    frames: readonly PixelFrame[],
    layout: SpriteSheetLayout,
    namePrefix: string,
  ) => PackedSpriteSheet
}

const EXPORT_DEPENDENCIES: ExportDependencies = {
  downloadSpriteSheet: exportHorizontalSpriteSheet,
  encodeAnimation,
  encodePng,
  buildFrameZip,
  buildUnityZip,
  randomGuid,
  fileDelivery: createFileDelivery(getDesktopFileApi()),
  packSpriteSheet,
}

/** Runs one sprite-sheet export against the current frame set. */
export async function runSpriteSheetExport(
  frameSet: RenderedFrameSet,
  layout: SpriteSheetLayout,
  fileName: string,
  dependencies: ExportDependencies,
): Promise<FileSaveResult> {
  try {
    if (!dependencies.fileDelivery.isDesktop && layout === 'horizontal') {
      dependencies.downloadSpriteSheet(frameSet.read(), fileName)
      return 'saved'
    }
    const packed = packSpriteSheet(frameSet.read(), layout, 'frame')
    const bytes = dependencies.encodePng(packed.frame)
    return dependencies.fileDelivery.saveBytes('spritesheet-png', fileName, toArrayBuffer(bytes))
  } catch {
    return 'failed'
  }
}

/** Encodes and saves one animation; returns the native save result. */
export async function runAnimationExport(
  format: AnimationFormat,
  frameSet: RenderedFrameSet,
  fps: number,
  loop: boolean,
  fileName: string,
  dependencies: ExportDependencies,
): Promise<FileSaveResult> {
  try {
    const result = dependencies.encodeAnimation({ format, frames: frameSet.read(), fps, loop })
    return dependencies.fileDelivery.saveBytes(format, fileName, toArrayBuffer(result.bytes))
  } catch {
    return 'failed'
  }
}

/** Builds and saves one Unity 6 atlas ZIP. */
export async function runUnityExport(
  frameSet: RenderedFrameSet,
  layout: SpriteSheetLayout,
  fps: number,
  document: EffectProjectV1,
  pixelsPerUnit: number,
  guid: string,
  folderName: string,
  imageName: string,
  zipFileName: string,
  dependencies: ExportDependencies,
): Promise<FileSaveResult> {
  try {
    const zip = dependencies.buildUnityZip({
      generatorId: document.generator,
      frames: frameSet.read(),
      fps,
      project: document,
      pixelsPerUnit,
      guid,
      layout,
      folderName,
      imageName,
    })
    return dependencies.fileDelivery.saveBytes('unity-zip', zipFileName, toArrayBuffer(zip))
  } catch {
    return 'failed'
  }
}

/** Builds and saves one per-frame transparent PNG ZIP. */
export async function runFrameZipExport(
  frameSet: RenderedFrameSet,
  fps: number,
  document: EffectProjectV1,
  folderName: string,
  frameNamePrefix: string,
  fileName: string,
  dependencies: ExportDependencies,
): Promise<FileSaveResult> {
  try {
    const zip = dependencies.buildFrameZip({
      generatorId: document.generator,
      frames: frameSet.read(),
      fps,
      project: document,
      folderName,
      frameNamePrefix,
    })
    return dependencies.fileDelivery.saveBytes('frame-zip', fileName, toArrayBuffer(zip))
  } catch {
    return 'failed'
  }
}

/** Resolves a stable GUID input to normalized form; empty input means null. */
export function resolveStableGuid(
  stableGuid: string,
): { readonly ok: true; readonly guid: string | null } | { readonly ok: false; readonly error: ExportError } {
  const trimmed = stableGuid.trim()
  if (trimmed === '') {
    return { ok: true, guid: null }
  }
  const normalized = normalizeGuid(trimmed)
  if (normalized === null) {
    return { ok: false, error: { code: 'INVALID_GUID', detail: `Invalid GUID: ${trimmed}` } }
  }
  return { ok: true, guid: normalized }
}

/** Validates shared Unity settings before a Unity export starts. */
export function resolveUnitySettings(
  pixelsPerUnit: number,
  stableGuid: string,
  randomGuidValue: string,
): { readonly ok: true; readonly pixelsPerUnit: number; readonly guid: string } | { readonly ok: false; readonly error: ExportError } {
  if (!Number.isInteger(pixelsPerUnit) || pixelsPerUnit < 1 || pixelsPerUnit > 1024) {
    return { ok: false, error: { code: 'INVALID_PPU', detail: `Invalid pixelsPerUnit: ${pixelsPerUnit}` } }
  }
  const resolved = resolveStableGuid(stableGuid)
  if (!resolved.ok) {
    return resolved
  }
  return { ok: true, pixelsPerUnit, guid: resolved.guid === null ? randomGuidValue : resolved.guid }
}

/** Unity atlas size failure carrying the oversized dimensions for messages. */
export interface UnityAtlasTooLarge extends ExportError {
  readonly code: 'UNITY_ATLAS_TOO_LARGE'
  readonly width: number
  readonly height: number
}

export type UnityAtlasCheckResult =
  | { readonly ok: true; readonly width: number; readonly height: number }
  | { readonly ok: false; readonly error: UnityAtlasTooLarge }

/** Checks whether the selected layout fits inside the Unity 6 atlas limit. */
export function checkUnityAtlasSize(
  frameCount: number,
  frameWidth: number,
  frameHeight: number,
  layout: SpriteSheetLayout,
): UnityAtlasCheckResult {
  const size = computeSheetSize(frameCount, frameWidth, frameHeight, layout)
  if (Math.max(size.width, size.height) > UNITY_MAX_ATLAS_SIZE) {
    return {
      ok: false,
      error: {
        code: 'UNITY_ATLAS_TOO_LARGE',
        detail: `Atlas ${size.width}x${size.height} exceeds the Unity 6 limit.`,
        width: size.width,
        height: size.height,
      },
    }
  }
  return { ok: true, width: size.width, height: size.height }
}

/** Derived display metadata refreshed from the current frame set on every render. */
export interface ExportPanelMetadata {
  readonly width: number
  readonly height: number
  readonly frameCount: number
  readonly fps: number
  readonly sheetWidth: number
  readonly sheetHeight: number
  readonly generatorName: string
}

interface ExportPanelViewProps {
  readonly state: ExportPanelState
  readonly metadata: ExportPanelMetadata
  readonly unitySettings: UnityExportSettingsState
  readonly normalizedGuid: string
  readonly activeTask: WorkspaceFileTask | null
  readonly packed: PackedSpriteSheet | null
  readonly atlasCanvasRef: RefObject<HTMLCanvasElement | null>
  readonly atlasPreviewId: string
  readonly onUnitySettingsChange: (settings: UnityExportSettingsState) => void
  readonly onSelectCategory: (category: ExportCategory) => void
  readonly onSetLayout: (layout: SpriteSheetLayout) => void
  readonly onSetTarget: (target: SpriteTarget) => void
  readonly onSetFormat: (format: AnimationFormat) => void
  readonly onToggleLoop: (checked: boolean) => void
  readonly onExportSpriteSheet: () => void
  readonly onExportUnity: () => void
  readonly onExportAnimation: () => void
  readonly onExportFrameZip: () => void
  readonly onToggleAtlasPreview: () => void
  readonly onSetAtlasZoom: (zoom: AtlasZoom) => void
}

/** Presentational export panel; rendering depends only on state and props. */
export function ExportPanelView({
  state,
  metadata,
  unitySettings,
  normalizedGuid,
  activeTask,
  packed,
  atlasCanvasRef,
  atlasPreviewId,
  onUnitySettingsChange,
  onSelectCategory,
  onSetLayout,
  onSetTarget,
  onSetFormat,
  onToggleLoop,
  onExportSpriteSheet,
  onExportUnity,
  onExportAnimation,
  onExportFrameZip,
  onToggleAtlasPreview,
  onSetAtlasZoom,
}: ExportPanelViewProps) {
  const { t } = useI18n()
  const busy = activeTask !== null
  const preparing = t('export.preparing')
  const encoding = t('export.encoding')
  const tabs: readonly { readonly id: ExportCategory; readonly key: MessageKey }[] = [
    { id: 'spriteSheet', key: 'export.tabs.spriteSheet' },
    { id: 'animation', key: 'export.tabs.animation' },
    { id: 'frameZip', key: 'export.tabs.frameZip' },
  ]

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
      <div className="export-tabs" role="tablist" aria-label={t('export.tabsLabel')}>
        {tabs.map((tab) => (
          <button
            className={state.activeCategory === tab.id ? 'active' : ''}
            type="button"
            role="tab"
            aria-selected={state.activeCategory === tab.id}
            key={tab.id}
            onClick={() => onSelectCategory(tab.id)}
          >
            {t(tab.key)}
          </button>
        ))}
      </div>

      {state.activeCategory === 'spriteSheet' ? (
        <div className="export-category">
          <div className="export-field-row">
            <label className="export-field">
              <span>{t('export.spriteSheet.layout')}</span>
              <select
                aria-label={t('export.spriteSheet.layout')}
                value={state.spriteLayout}
                onChange={(event) => onSetLayout(event.target.value as SpriteSheetLayout)}
              >
                <option value="horizontal">{t('export.spriteSheet.horizontal')}</option>
                <option value="compact">{t('export.spriteSheet.compactGrid')}</option>
              </select>
            </label>
            <label className="export-field">
              <span>{t('export.spriteSheet.target')}</span>
              <select
                aria-label={t('export.spriteSheet.target')}
                value={state.spriteTarget}
                onChange={(event) => onSetTarget(event.target.value as SpriteTarget)}
              >
                <option value="png">{t('export.spriteSheet.pngTarget')}</option>
                <option value="unity">{t('export.spriteSheet.unityTarget')}</option>
              </select>
            </label>
          </div>
          <p className="export-card-meta">{t('export.spriteSheet.expectedSize', {
            width: metadata.sheetWidth,
            height: metadata.sheetHeight,
          })}</p>
          {state.spriteTarget === 'unity' ? (
            <div className="export-unity-settings">
              <label className="export-field">
                <span>{t('export.spriteSheet.pixelsPerUnit')}</span>
                <input
                  type="number"
                  min={1}
                  max={1024}
                  step={1}
                  aria-label={t('export.spriteSheet.pixelsPerUnit')}
                  value={unitySettings.pixelsPerUnit}
                  onChange={(event) => onUnitySettingsChange({
                    ...unitySettings,
                    pixelsPerUnit: Number(event.target.value),
                  })}
                />
              </label>
              <label className="export-field">
                <span>{t('export.spriteSheet.stableGuid')}</span>
                <input
                  type="text"
                  spellCheck={false}
                  aria-label={t('export.spriteSheet.stableGuid')}
                  placeholder={t('export.spriteSheet.stableGuidPlaceholder')}
                  value={unitySettings.stableGuid}
                  onChange={(event) => onUnitySettingsChange({
                    ...unitySettings,
                    stableGuid: event.target.value,
                  })}
                />
              </label>
              <p className="export-hint">{t('export.spriteSheet.unityHint')}</p>
              {normalizedGuid !== '' ? (
                <p className="export-card-meta">{t('export.spriteSheet.stableGuidValue', { guid: normalizedGuid })}</p>
              ) : null}
            </div>
          ) : null}
          {state.categoryErrors.spriteSheet ? (
            <p className="export-card-error" role="alert">{state.categoryErrors.spriteSheet}</p>
          ) : null}
          <div className="atlas-preview">
            <button
              className="foldout-toggle"
              type="button"
              aria-expanded={state.atlasPreviewOpen}
              aria-controls={atlasPreviewId}
              onClick={onToggleAtlasPreview}
            >
              <span>{t('export.atlasPreview.toggle')}</span>
              <span className="foldout-chevron" aria-hidden="true">{state.atlasPreviewOpen ? '▾' : '▸'}</span>
            </button>
            {state.atlasPreviewOpen && packed ? (
              <div className="atlas-preview-body" id={atlasPreviewId}>
                <div className="atlas-preview-head">
                  <p className="export-card-meta">{t('export.atlasPreview.meta', {
                    width: packed.frame.width,
                    height: packed.frame.height,
                    layout: state.spriteLayout === 'horizontal'
                      ? t('export.atlasPreview.layoutHorizontal')
                      : t('export.atlasPreview.layoutCompact'),
                  })}</p>
                  <label className="preview-zoom">
                    <span>{t('export.atlasPreview.zoomLabel')}</span>
                    <select
                      aria-label={t('export.atlasPreview.zoomLabel')}
                      value={state.atlasZoom}
                      onChange={(event) => onSetAtlasZoom(event.target.value as AtlasZoom)}
                    >
                      <option value="fit">{t('export.atlasPreview.zoomFit')}</option>
                      <option value={1}>{t('export.atlasPreview.zoomOption', { zoom: 1 })}</option>
                      <option value={2}>{t('export.atlasPreview.zoomOption', { zoom: 2 })}</option>
                      <option value={4}>{t('export.atlasPreview.zoomOption', { zoom: 4 })}</option>
                    </select>
                  </label>
                </div>
                <div className="atlas-preview-stage">
                  <div
                    className={state.atlasZoom === 'fit' ? 'atlas-preview-wrap fit' : 'atlas-preview-wrap'}
                    style={{
                      width: resolvePreviewSize(state.atlasZoom, packed.frame.width, packed.frame.height, 640, 420).width,
                      height: resolvePreviewSize(state.atlasZoom, packed.frame.width, packed.frame.height, 640, 420).height,
                    }}
                  >
                    <canvas ref={atlasCanvasRef} className="pixel-canvas" aria-label={t('export.atlasPreview.canvasLabel')} />
                    <div className="atlas-frame-overlay" aria-hidden="true">
                      {Array.from({ length: Math.max(0, packed.columns - 1) }, (_, index) => (
                        <span
                          className="atlas-grid-line vertical"
                          key={`v${index}`}
                          style={{ left: `${((index + 1) / packed.columns) * 100}%` }}
                        />
                      ))}
                      {Array.from({ length: Math.max(0, packed.rows - 1) }, (_, index) => (
                        <span
                          className="atlas-grid-line horizontal"
                          key={`h${index}`}
                          style={{ top: `${((index + 1) / packed.rows) * 100}%` }}
                        />
                      ))}
                      {packed.sprites.map((sprite) => (
                        <span
                          className="atlas-frame-label"
                          key={sprite.name}
                          style={{
                            left: `${(sprite.x / packed.frame.width) * 100}%`,
                            top: `${(sprite.y / packed.frame.height) * 100}%`,
                          }}
                        >
                          {String(sprite.index).padStart(2, '0')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="export-category-actions">
            <button className="primary-button" type="button" disabled={busy} onClick={state.spriteTarget === 'unity' ? onExportUnity : onExportSpriteSheet}>
              {activeTask === 'spriteSheet' || activeTask === 'unityPackage' ? (
                <span className="button-spinner" aria-hidden="true" />
              ) : null}
              <span>
                {activeTask === 'spriteSheet' || activeTask === 'unityPackage'
                  ? preparing
                  : state.spriteTarget === 'unity'
                    ? t('export.spriteSheet.exportUnityZip')
                    : t('export.spriteSheet.exportPng')}
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {state.activeCategory === 'animation' ? (
        <div className="export-category">
          <div className="export-field-row">
            <label className="export-field">
              <span>{t('export.animation.format')}</span>
              <select
                aria-label={t('export.animation.format')}
                value={state.animationFormat}
                onChange={(event) => onSetFormat(event.target.value as AnimationFormat)}
              >
                <option value="gif">{t('export.animation.gif')}</option>
                <option value="apng">{t('export.animation.apng')}</option>
              </select>
            </label>
            <label className="loop-toggle export-field">
              <span>{t('export.animation.loop')}</span>
              <input
                aria-label={t('export.animation.loopLabel')}
                type="checkbox"
                checked={state.loop}
                onChange={(event) => onToggleLoop(event.target.checked)}
              />
            </label>
          </div>
          <p className="export-card-meta">{t('export.animation.summary', {
            width: metadata.width,
            height: metadata.height,
            frameCount: metadata.frameCount,
            fps: metadata.fps,
          })}</p>
          {state.categoryErrors.animation ? (
            <p className="export-card-error" role="alert">{state.categoryErrors.animation}</p>
          ) : null}
          <div className="export-category-actions">
            <button
              className="primary-button"
              type="button"
              disabled={busy}
              onClick={onExportAnimation}
            >
              {activeTask === state.animationFormat ? (
                <span className="button-spinner" aria-hidden="true" />
              ) : null}
              <span>
                {activeTask === state.animationFormat
                  ? encoding
                  : state.animationFormat === 'gif'
                    ? t('export.animation.exportGif')
                    : t('export.animation.exportApng')}
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {state.activeCategory === 'frameZip' ? (
        <div className="export-category">
          <p className="export-card-meta">{t('export.frameZip.summary', {
            frameCount: metadata.frameCount,
            width: metadata.width,
            height: metadata.height,
            fps: metadata.fps,
          })}</p>
          <p className="export-hint">{t('export.frameZip.includesManifest')}</p>
          {state.categoryErrors.frameZip ? (
            <p className="export-card-error" role="alert">{state.categoryErrors.frameZip}</p>
          ) : null}
          <div className="export-category-actions">
            <button className="primary-button" type="button" disabled={busy} onClick={onExportFrameZip}>
              {activeTask === 'frameZip' ? <span className="button-spinner" aria-hidden="true" /> : null}
              <span>{activeTask === 'frameZip' ? preparing : t('export.frameZip.exportButton')}</span>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

interface ExportPanelProps {
  readonly frameSet: RenderedFrameSet
  readonly previewFps: number
  readonly generatorId: string
  readonly generatorName: string
  readonly unitySettings: UnityExportSettingsState
  readonly onUnitySettingsChange: (settings: UnityExportSettingsState) => void
  readonly fileOperations: FileOperationController
  /** Builds the manifest project document; absent for generators without codecs. */
  readonly buildProjectDocument?: (settings: ProjectExportSettings) => EffectProjectV1
  readonly dependencies?: ExportDependencies
}

/**
 * Asset-only export panel for the active generator session. It consumes the
 * same already-rendered `RenderedFrameSet` as the Preview without copying
 * frames or re-rendering. Category and loop state stay local; Unity settings
 * and the file operation lock live in the workspace so ProjectMenu and this
 * panel never disagree about in-flight work.
 */
export function ExportPanel({
  frameSet,
  previewFps,
  generatorId,
  generatorName,
  unitySettings,
  onUnitySettingsChange,
  fileOperations,
  buildProjectDocument: buildDocument,
  dependencies = EXPORT_DEPENDENCIES,
}: ExportPanelProps) {
  const { t } = useI18n()
  const toast = useToast()
  const [state, dispatch] = useReducer(exportPanelReducer, undefined, createInitialExportPanelState)
  const atlasCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const atlasPreviewId = useId()
  const frames = frameSet.read()
  const packed = useMemo(() => {
    if (!state.atlasPreviewOpen) {
      return null
    }
    return dependencies.packSpriteSheet(frames, state.spriteLayout, generatorId)
  }, [state.atlasPreviewOpen, state.spriteLayout, frames, generatorId, dependencies])

  useEffect(() => {
    const canvas = atlasCanvasRef.current
    if (canvas && packed) {
      drawFrame(canvas, packed.frame)
    }
  }, [packed])

  const metadata: ExportPanelMetadata = {
    width: frames[0]?.width ?? 0,
    height: frames[0]?.height ?? 0,
    frameCount: frames.length,
    fps: previewFps,
    sheetWidth: computeSheetSize(frames.length, frames[0]?.width ?? 0, frames[0]?.height ?? 0, state.spriteLayout).width,
    sheetHeight: computeSheetSize(frames.length, frames[0]?.width ?? 0, frames[0]?.height ?? 0, state.spriteLayout).height,
    generatorName,
  }
  const normalizedGuid = normalizeGuid(unitySettings.stableGuid.trim()) ?? ''

  const spriteSheetFileName = t('export.fileName', {
    name: generatorName,
    width: metadata.width,
    height: metadata.height,
    frameCount: metadata.frameCount,
  })
  const compactPngFileName = t('export.fileNames.compactPng', {
    name: generatorId,
    width: metadata.width,
    height: metadata.height,
    frameCount: metadata.frameCount,
  })
  const layoutName = state.spriteLayout
  const unityFolderName = t('export.fileNames.folder', {
    name: generatorId,
    width: metadata.width,
    height: metadata.height,
    frameCount: metadata.frameCount,
    layout: layoutName,
  })
  const unityImageName = t('export.fileNames.unityImage', {
    name: generatorId,
    width: metadata.width,
    height: metadata.height,
    frameCount: metadata.frameCount,
    layout: layoutName,
  })
  const unityZipFileName = t('export.fileNames.unityZip', {
    name: generatorId,
    width: metadata.width,
    height: metadata.height,
    frameCount: metadata.frameCount,
    layout: layoutName,
  })
  const frameZipFolderName = t('export.fileNames.folderSequence', {
    name: generatorId,
    width: metadata.width,
    height: metadata.height,
    frameCount: metadata.frameCount,
  })
  const frameZipFileName = t('export.fileNames.frameZip', {
    name: generatorId,
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

  const currentDocument = (guid: string | null): EffectProjectV1 => {
    if (!buildDocument) {
      throw new Error('Project document requires a generator project codec.')
    }
    return buildDocument({ pixelsPerUnit: unitySettings.pixelsPerUnit, guid })
  }

  const handleExport = async (
    task: WorkspaceFileTask,
    run: () => Promise<FileSaveResult>,
    category: ExportCategory,
  ) => {
    if (!fileOperations.tryStart(task)) {
      return
    }
    dispatch({ type: 'clearCategoryError', category })
    const toastKeys = exportToastKeys(task)
    const pendingId = toastKeys === null ? null : toast.show('pending', t(toastKeys.pending))
    try {
      let result: FileSaveResult = 'failed'
      try {
        result = await run()
      } catch {
        result = 'failed'
      }
      if (pendingId !== null) {
        toast.dismiss(pendingId)
      }
      if (result === 'failed') {
        dispatch({ type: 'categoryError', category, message: t('export.errors.exportFailed') })
        toast.show('error', t('export.errors.exportFailed'))
      } else if (result === 'saved' && toastKeys !== null) {
        toast.show('success', t(toastKeys.success))
      }
      // 'cancelled' is a normal user outcome: no success or error feedback.
    } finally {
      fileOperations.finish(task)
    }
  }

  const handleExportUnity = () => {
    if (fileOperations.activeTask !== null || !buildDocument) {
      return
    }
    const atlasCheck = checkUnityAtlasSize(metadata.frameCount, metadata.width, metadata.height, state.spriteLayout)
    if (!atlasCheck.ok) {
      dispatch({
        type: 'categoryError',
        category: 'spriteSheet',
        message: t('export.errors.unityAtlasTooLarge', {
          width: atlasCheck.error.width,
          height: atlasCheck.error.height,
        }),
      })
      return
    }
    const settings = resolveUnitySettings(unitySettings.pixelsPerUnit, unitySettings.stableGuid, dependencies.randomGuid())
    if (!settings.ok) {
      dispatch({ type: 'categoryError', category: 'spriteSheet', message: exportErrorMessage(t, settings.error.code) })
      return
    }
    handleExport('unityPackage', () => runUnityExport(
      frameSet,
      state.spriteLayout,
      previewFps,
      buildDocument({ pixelsPerUnit: settings.pixelsPerUnit, guid: settings.guid }),
      settings.pixelsPerUnit,
      settings.guid,
      unityFolderName,
      unityImageName,
      unityZipFileName,
      dependencies,
    ), 'spriteSheet')
  }

  const handleExportFrameZip = () => {
    if (fileOperations.activeTask !== null || !buildDocument) {
      return
    }
    const resolvedGuid = resolveStableGuid(unitySettings.stableGuid)
    if (!resolvedGuid.ok) {
      dispatch({ type: 'categoryError', category: 'frameZip', message: exportErrorMessage(t, resolvedGuid.error.code) })
      return
    }
    handleExport('frameZip', () => runFrameZipExport(
      frameSet,
      previewFps,
      currentDocument(resolvedGuid.guid),
      frameZipFolderName,
      generatorId,
      frameZipFileName,
      dependencies,
    ), 'frameZip')
  }

  const handleAnimationExport = (format: AnimationFormat) => {
    if (fileOperations.activeTask !== null) {
      return
    }
    handleExport(format, () => runAnimationExport(
      format,
      frameSet,
      previewFps,
      state.loop,
      animationFileName(format),
      dependencies,
    ), 'animation')
  }

  return (
    <ExportPanelView
      state={state}
      metadata={metadata}
      unitySettings={unitySettings}
      normalizedGuid={normalizedGuid}
      activeTask={fileOperations.activeTask}
      packed={packed}
      atlasCanvasRef={atlasCanvasRef}
      atlasPreviewId={atlasPreviewId}
      onUnitySettingsChange={onUnitySettingsChange}
      onSelectCategory={(category) => dispatch({ type: 'selectCategory', category })}
      onSetLayout={(layout) => dispatch({ type: 'setSpriteLayout', layout })}
      onSetTarget={(target) => dispatch({ type: 'setSpriteTarget', target })}
      onSetFormat={(format) => dispatch({ type: 'setAnimationFormat', format })}
      onToggleLoop={(checked) => dispatch({ type: 'toggleLoop', checked })}
      onExportSpriteSheet={() => handleExport(
        'spriteSheet',
        () => runSpriteSheetExport(frameSet, state.spriteLayout, state.spriteLayout === 'horizontal' ? spriteSheetFileName : compactPngFileName, dependencies),
        'spriteSheet',
      )}
      onExportUnity={handleExportUnity}
      onExportAnimation={() => handleAnimationExport(state.animationFormat)}
      onExportFrameZip={handleExportFrameZip}
      onToggleAtlasPreview={() => dispatch({ type: 'toggleAtlasPreview' })}
      onSetAtlasZoom={(zoom) => dispatch({ type: 'setAtlasZoom', zoom })}
    />
  )
}

/** Localized message key for every export-flow error. */
const EXPORT_ERROR_KEYS: Readonly<Partial<Record<ExportErrorCode, MessageKey>>> = {
  INVALID_PPU: 'export.errors.invalidPpu',
  INVALID_GUID: 'export.errors.invalidGuid',
  UNITY_ATLAS_TOO_LARGE: 'export.errors.unityAtlasTooLarge',
  DOWNLOAD_FAILED: 'export.errors.exportFailed',
}

function exportErrorMessage(translate: TranslateFunction, code: ExportErrorCode): string {
  return translate(EXPORT_ERROR_KEYS[code] ?? 'export.errors.exportFailed')
}

/** Computes the expected sheet size for the selected layout. */
function computeSheetSize(
  frameCount: number,
  frameWidth: number,
  frameHeight: number,
  layout: SpriteSheetLayout,
): { readonly width: number; readonly height: number } {
  if (frameCount === 0 || frameWidth === 0 || frameHeight === 0) {
    return { width: 0, height: 0 }
  }
  if (layout === 'horizontal') {
    return { width: frameCount * frameWidth, height: frameHeight }
  }
  const columns = chooseCompactColumns(frameCount, frameWidth, frameHeight)
  const rows = Math.ceil(frameCount / columns)
  return { width: columns * frameWidth, height: rows * frameHeight }
}

function clearCategoryError(
  errors: Readonly<Partial<Record<ExportCategory, string>>>,
  category: ExportCategory,
): Readonly<Partial<Record<ExportCategory, string>>> {
  if (!(category in errors)) {
    return errors
  }
  const next = { ...errors }
  delete next[category]
  return next
}

/** Copies a typed array into an exact-sized ArrayBuffer for IPC and Blobs. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/** Pending and success toast keys for each export task. */
function exportToastKeys(
  task: WorkspaceFileTask,
): { readonly pending: MessageKey; readonly success: MessageKey } | null {
  switch (task) {
    case 'spriteSheet':
      return { pending: 'export.toasts.exportingPng', success: 'export.toasts.exportedPng' }
    case 'unityPackage':
      return { pending: 'export.toasts.exportingUnityZip', success: 'export.toasts.exportedUnityZip' }
    case 'gif':
      return { pending: 'export.toasts.exportingGif', success: 'export.toasts.exportedGif' }
    case 'apng':
      return { pending: 'export.toasts.exportingApng', success: 'export.toasts.exportedApng' }
    case 'frameZip':
      return { pending: 'export.toasts.exportingFrameZip', success: 'export.toasts.exportedFrameZip' }
    default:
      return null
  }
}
