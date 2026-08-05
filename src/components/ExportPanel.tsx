import { useReducer, useRef, type RefObject } from 'react'
import type { RenderedFrameSet } from '../generators/contract'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey } from '../i18n/messages'
import {
  encodeAnimation,
  type AnimationEncodeInput,
  type AnimationFormat,
  type AnimationResult,
} from '../shared/pixel/animation'
import { chooseCompactColumns, packSpriteSheet, type SpriteSheetLayout } from '../shared/pixel/atlas'
import type { PixelFrame } from '../shared/pixel/frame'
import { encodePng } from '../shared/pixel/png'
import { serializeJsonValue, parseProjectDocument } from '../shared/project/document'
import type {
  EffectProjectV1,
  ExportError,
  ExportErrorCode,
  GeneratorProjectCodec,
  ProjectExportSettings,
} from '../shared/project/types'
import { randomGuid } from '../shared/unity/guid'
import { normalizeGuid } from '../shared/unity/guid'
import { UNITY_MAX_ATLAS_SIZE } from '../shared/unity/textureSize'
import { buildFrameZip, buildUnityZip, type FrameZipInput, type UnityZipInput } from '../shared/zip/zip'
import { downloadBytes, downloadText, exportHorizontalSpriteSheet } from './export'

export const PNG_MIME = 'image/png'
export const ZIP_MIME = 'application/zip'
export const JSON_MIME = 'application/json'

/** The four export categories; Project is hidden for generators without codecs. */
export type ExportCategory = 'project' | 'spriteSheet' | 'animation' | 'frameZip'

export type SpriteTarget = 'png' | 'unity'
export type ExportTask = 'projectJson' | 'spriteSheet' | 'unityPackage' | 'gif' | 'apng' | 'frameZip' | null

/** Local UI state of the export panel; never shared with the generator session. */
export interface ExportPanelState {
  readonly activeCategory: ExportCategory
  readonly spriteLayout: SpriteSheetLayout
  readonly spriteTarget: SpriteTarget
  readonly animationFormat: AnimationFormat
  readonly loop: boolean
  readonly pixelsPerUnit: number
  readonly stableGuid: string
  readonly activeTask: ExportTask
  readonly categoryErrors: Readonly<Partial<Record<ExportCategory, string>>>
  readonly projectImportStatus: 'idle' | 'success' | 'error'
}

/** State transitions driven by the export controls. */
export type ExportPanelAction =
  | { readonly type: 'selectCategory'; readonly category: ExportCategory }
  | { readonly type: 'setSpriteLayout'; readonly layout: SpriteSheetLayout }
  | { readonly type: 'setSpriteTarget'; readonly target: SpriteTarget }
  | { readonly type: 'setAnimationFormat'; readonly format: AnimationFormat }
  | { readonly type: 'toggleLoop'; readonly checked: boolean }
  | { readonly type: 'setPixelsPerUnit'; readonly value: number }
  | { readonly type: 'setStableGuid'; readonly value: string }
  | { readonly type: 'startTask'; readonly task: Exclude<ExportTask, null> }
  | { readonly type: 'taskSucceeded'; readonly task: Exclude<ExportTask, null> }
  | { readonly type: 'taskFailed'; readonly task: Exclude<ExportTask, null>; readonly category: ExportCategory; readonly message: string }
  | { readonly type: 'categoryError'; readonly category: ExportCategory; readonly message: string }
  | { readonly type: 'importSucceeded'; readonly pixelsPerUnit: number; readonly guid: string }
  | { readonly type: 'importFailed'; readonly message: string }

/** Category owning each heavy task; errors stay inside that category. */
export const TASK_CATEGORY: Readonly<Record<Exclude<ExportTask, null>, ExportCategory>> = {
  projectJson: 'project',
  spriteSheet: 'spriteSheet',
  unityPackage: 'spriteSheet',
  gif: 'animation',
  apng: 'animation',
  frameZip: 'frameZip',
}

/** Export panel starts on Sprite Sheet with Unity defaults and no task. */
export function createInitialExportPanelState(): ExportPanelState {
  return {
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
    case 'setPixelsPerUnit':
      return { ...state, pixelsPerUnit: action.value }
    case 'setStableGuid':
      return { ...state, stableGuid: action.value }
    case 'startTask':
      if (state.activeTask !== null) {
        return state
      }
      return {
        ...state,
        activeTask: action.task,
        categoryErrors: clearCategoryError(state.categoryErrors, TASK_CATEGORY[action.task]),
      }
    case 'taskSucceeded':
      return state.activeTask === action.task ? { ...state, activeTask: null } : state
    case 'taskFailed':
      return state.activeTask === action.task
        ? {
            ...state,
            activeTask: null,
            categoryErrors: { ...state.categoryErrors, [action.category]: action.message },
          }
        : state
    case 'categoryError':
      return {
        ...state,
        categoryErrors: { ...state.categoryErrors, [action.category]: action.message },
      }
    case 'importSucceeded':
      return {
        ...state,
        activeTask: null,
        pixelsPerUnit: action.pixelsPerUnit,
        stableGuid: action.guid,
        projectImportStatus: 'success',
        categoryErrors: clearCategoryError(state.categoryErrors, 'project'),
      }
    case 'importFailed':
      return {
        ...state,
        activeTask: null,
        projectImportStatus: 'error',
        categoryErrors: { ...state.categoryErrors, project: action.message },
      }
  }
}

/** Injectable export operations kept apart from React so behavior is testable. */
export interface ExportDependencies {
  readonly downloadSpriteSheet: (frames: readonly PixelFrame[], fileName: string) => void
  readonly encodeAnimation: (input: AnimationEncodeInput) => AnimationResult
  readonly downloadBytes: (bytes: Uint8Array, fileName: string, mime: string) => void
  readonly downloadText: (text: string, fileName: string, mime: string) => void
  readonly encodePng: (frame: PixelFrame) => Uint8Array
  readonly buildFrameZip: (input: FrameZipInput) => Uint8Array
  readonly buildUnityZip: (input: UnityZipInput) => Uint8Array
  readonly randomGuid: () => string
  readonly readFileAsText: (file: File) => Promise<string>
}

const EXPORT_DEPENDENCIES: ExportDependencies = {
  downloadSpriteSheet: exportHorizontalSpriteSheet,
  encodeAnimation,
  downloadBytes,
  downloadText,
  encodePng,
  buildFrameZip,
  buildUnityZip,
  randomGuid,
  readFileAsText: (file) => file.text(),
}

/** Runs one sprite-sheet export against the current frame set. */
export function runSpriteSheetExport(
  frameSet: RenderedFrameSet,
  layout: SpriteSheetLayout,
  fileName: string,
  dependencies: ExportDependencies,
): boolean {
  try {
    if (layout === 'horizontal') {
      dependencies.downloadSpriteSheet(frameSet.read(), fileName)
    } else {
      const packed = packSpriteSheet(frameSet.read(), 'compact', 'frame')
      dependencies.downloadBytes(dependencies.encodePng(packed.frame), fileName, PNG_MIME)
    }
    return true
  } catch {
    return false
  }
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

/** Downloads the current project document as stable JSON. */
export function runProjectJsonExport(
  document: EffectProjectV1,
  fileName: string,
  dependencies: ExportDependencies,
): boolean {
  try {
    dependencies.downloadText(serializeJsonValue(document), fileName, JSON_MIME)
    return true
  } catch {
    return false
  }
}

/** Builds and downloads one Unity 6 atlas ZIP. */
export function runUnityExport(
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
): boolean {
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
    dependencies.downloadBytes(zip, zipFileName, ZIP_MIME)
    return true
  } catch {
    return false
  }
}

/** Builds and downloads one per-frame transparent PNG ZIP. */
export function runFrameZipExport(
  frameSet: RenderedFrameSet,
  fps: number,
  document: EffectProjectV1,
  folderName: string,
  frameNamePrefix: string,
  fileName: string,
  dependencies: ExportDependencies,
): boolean {
  try {
    const zip = dependencies.buildFrameZip({
      generatorId: document.generator,
      frames: frameSet.read(),
      fps,
      project: document,
      folderName,
      frameNamePrefix,
    })
    dependencies.downloadBytes(zip, fileName, ZIP_MIME)
    return true
  } catch {
    return false
  }
}

/** Request contract between ExportPanel and the typed generator workspace. */
export type ImportProjectHandler = (request: {
  readonly parameters: unknown
  readonly fps: number
}) => { readonly ok: true } | { readonly ok: false; readonly error: ExportError }

/**
 * Parses project JSON, validates it through the codec, and asks the workspace
 * to render the imported parameters. Rendering happens exactly once and only
 * commits after every step succeeds.
 */
export function importProjectFromText(
  text: string,
  codec: GeneratorProjectCodec<unknown>,
  importProject: ImportProjectHandler,
): { readonly ok: true; readonly exportSettings: ProjectExportSettings } | { readonly ok: false; readonly error: ExportError } {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { ok: false, error: { code: 'INVALID_JSON', detail: 'The file is not valid JSON.' } }
  }
  const parsed = parseProjectDocument(value, codec)
  if (!parsed.ok) {
    return { ok: false, error: parsed.error }
  }
  const rendered = importProject({
    parameters: parsed.project.project.parameters,
    fps: parsed.project.fps,
  })
  if (!rendered.ok) {
    return { ok: false, error: rendered.error }
  }
  return { ok: true, exportSettings: parsed.project.exportSettings }
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

/** Validates local Unity settings before a Unity export starts. */
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

/** Typed bridge into the generator workspace for project documents. */
export interface ProjectExportBridge {
  readonly codec: GeneratorProjectCodec<unknown>
  readonly buildDocument: (settings: ProjectExportSettings) => EffectProjectV1
  readonly importProject: ImportProjectHandler
}

interface ExportPanelViewProps {
  readonly state: ExportPanelState
  readonly metadata: ExportPanelMetadata
  readonly hasProjectSupport: boolean
  readonly normalizedGuid: string
  readonly fileInputRef: RefObject<HTMLInputElement | null>
  readonly onSelectCategory: (category: ExportCategory) => void
  readonly onSetLayout: (layout: SpriteSheetLayout) => void
  readonly onSetTarget: (target: SpriteTarget) => void
  readonly onSetFormat: (format: AnimationFormat) => void
  readonly onToggleLoop: (checked: boolean) => void
  readonly onSetPixelsPerUnit: (value: number) => void
  readonly onSetStableGuid: (value: string) => void
  readonly onSaveProject: () => void
  readonly onLoadProjectClick: () => void
  readonly onLoadProjectFile: (file: File) => void
  readonly onExportSpriteSheet: () => void
  readonly onExportUnity: () => void
  readonly onExportAnimation: () => void
  readonly onExportFrameZip: () => void
}

/** Presentational export panel; rendering depends only on state and metadata. */
export function ExportPanelView({
  state,
  metadata,
  hasProjectSupport,
  normalizedGuid,
  fileInputRef,
  onSelectCategory,
  onSetLayout,
  onSetTarget,
  onSetFormat,
  onToggleLoop,
  onSetPixelsPerUnit,
  onSetStableGuid,
  onSaveProject,
  onLoadProjectClick,
  onLoadProjectFile,
  onExportSpriteSheet,
  onExportUnity,
  onExportAnimation,
  onExportFrameZip,
}: ExportPanelViewProps) {
  const { t } = useI18n()
  const busy = state.activeTask !== null
  const preparing = t('export.preparing')
  const encoding = t('export.encoding')
  const allTabs: readonly { readonly id: ExportCategory; readonly key: MessageKey }[] = [
    { id: 'project', key: 'export.tabs.project' },
    { id: 'spriteSheet', key: 'export.tabs.spriteSheet' },
    { id: 'animation', key: 'export.tabs.animation' },
    { id: 'frameZip', key: 'export.tabs.frameZip' },
  ]
  const tabs = hasProjectSupport ? allTabs : allTabs.filter((tab) => tab.id !== 'project')

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

      {state.activeCategory === 'project' && hasProjectSupport ? (
        <div className="export-category">
          <p className="export-category-summary">{t('export.project.summary', {
            name: metadata.generatorName,
            width: metadata.width,
            height: metadata.height,
            frameCount: metadata.frameCount,
            fps: metadata.fps,
          })}</p>
          <div className="export-category-actions equal">
            <button className="primary-button" type="button" disabled={busy} onClick={onSaveProject}>
              {state.activeTask === 'projectJson' ? preparing : t('export.project.save')}
            </button>
            <button className="primary-button" type="button" disabled={busy} onClick={onLoadProjectClick}>
              {t('export.project.load')}
            </button>
            <input
              ref={fileInputRef}
              className="export-file-input"
              type="file"
              accept=".json,application/json"
              aria-label={t('export.project.fileLabel')}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  onLoadProjectFile(file)
                }
              }}
            />
          </div>
          {state.projectImportStatus === 'success' ? (
            <p className="export-card-success" role="status">{t('export.project.imported')}</p>
          ) : null}
          {state.categoryErrors.project ? (
            <p className="export-card-error" role="alert">{state.categoryErrors.project}</p>
          ) : null}
        </div>
      ) : null}

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
                  value={state.pixelsPerUnit}
                  onChange={(event) => onSetPixelsPerUnit(Number(event.target.value))}
                />
              </label>
              <label className="export-field">
                <span>{t('export.spriteSheet.stableGuid')}</span>
                <input
                  type="text"
                  spellCheck={false}
                  aria-label={t('export.spriteSheet.stableGuid')}
                  placeholder={t('export.spriteSheet.stableGuidPlaceholder')}
                  value={state.stableGuid}
                  onChange={(event) => onSetStableGuid(event.target.value)}
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
          <div className="export-category-actions">
            <button className="primary-button" type="button" disabled={busy} onClick={state.spriteTarget === 'unity' ? onExportUnity : onExportSpriteSheet}>
              {state.activeTask === 'spriteSheet' || state.activeTask === 'unityPackage'
                ? preparing
                : state.spriteTarget === 'unity'
                  ? t('export.spriteSheet.exportUnityZip')
                  : t('export.spriteSheet.exportPng')}
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
              {state.activeTask === state.animationFormat
                ? encoding
                : state.animationFormat === 'gif'
                  ? t('export.animation.exportGif')
                  : t('export.animation.exportApng')}
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
              {state.activeTask === 'frameZip' ? preparing : t('export.frameZip.exportButton')}
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
  readonly projectBridge?: ProjectExportBridge
  readonly dependencies?: ExportDependencies
}

/**
 * Standalone export panel for the active generator session. It consumes the
 * same already-rendered `RenderedFrameSet` as the Preview without copying
 * frames or re-rendering; category, loop, and task state stay local to this
 * panel so parameter edits and Reset never disturb in-flight exports.
 */
export function ExportPanel({ frameSet, previewFps, generatorId, generatorName, projectBridge, dependencies = EXPORT_DEPENDENCIES }: ExportPanelProps) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(exportPanelReducer, undefined, createInitialExportPanelState)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const frames = frameSet.read()
  const metadata: ExportPanelMetadata = {
    width: frames[0]?.width ?? 0,
    height: frames[0]?.height ?? 0,
    frameCount: frames.length,
    fps: previewFps,
    sheetWidth: computeSheetSize(frames.length, frames[0]?.width ?? 0, frames[0]?.height ?? 0, state.spriteLayout).width,
    sheetHeight: computeSheetSize(frames.length, frames[0]?.width ?? 0, frames[0]?.height ?? 0, state.spriteLayout).height,
    generatorName,
  }
  const normalizedGuid = normalizeGuid(state.stableGuid.trim()) ?? ''

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
  const projectFileName = t('export.fileNames.project', {
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
    if (!projectBridge) {
      throw new Error('Project export requires a project bridge.')
    }
    return projectBridge.buildDocument({
      pixelsPerUnit: state.pixelsPerUnit,
      guid,
    })
  }

  const handleExport = (
    task: Exclude<ExportTask, null>,
    run: () => boolean,
    category: ExportCategory,
  ) => {
    if (state.activeTask !== null) {
      return
    }
    dispatch({ type: 'startTask', task })
    window.setTimeout(() => {
      const succeeded = run()
      dispatch(succeeded
        ? { type: 'taskSucceeded', task }
        : { type: 'taskFailed', task, category, message: t(ERROR_MESSAGE_KEYS.DOWNLOAD_FAILED) })
    }, 0)
  }

  const handleSaveProject = () => {
    if (!projectBridge || state.activeTask !== null) {
      return
    }
    const resolvedGuid = resolveStableGuid(state.stableGuid)
    if (!resolvedGuid.ok) {
      dispatch({ type: 'categoryError', category: 'project', message: t(ERROR_MESSAGE_KEYS.INVALID_GUID) })
      return
    }
    dispatch({ type: 'startTask', task: 'projectJson' })
    window.setTimeout(() => {
      let succeeded = false
      try {
        succeeded = runProjectJsonExport(currentDocument(resolvedGuid.guid), projectFileName, dependencies)
      } catch {
        succeeded = false
      }
      dispatch(succeeded
        ? { type: 'taskSucceeded', task: 'projectJson' }
        : { type: 'taskFailed', task: 'projectJson', category: 'project', message: t(ERROR_MESSAGE_KEYS.DOWNLOAD_FAILED) })
    }, 0)
  }

  const handleExportUnity = () => {
    if (!projectBridge || state.activeTask !== null) {
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
    const settings = resolveUnitySettings(state.pixelsPerUnit, state.stableGuid, dependencies.randomGuid())
    if (!settings.ok) {
      dispatch({ type: 'categoryError', category: 'spriteSheet', message: t(ERROR_MESSAGE_KEYS[settings.error.code]) })
      return
    }
    handleExport('unityPackage', () => runUnityExport(
      frameSet,
      state.spriteLayout,
      previewFps,
      projectBridge.buildDocument({ pixelsPerUnit: settings.pixelsPerUnit, guid: settings.guid }),
      settings.pixelsPerUnit,
      settings.guid,
      unityFolderName,
      unityImageName,
      unityZipFileName,
      dependencies,
    ), 'spriteSheet')
  }

  const handleExportFrameZip = () => {
    if (!projectBridge || state.activeTask !== null) {
      return
    }
    const resolvedGuid = resolveStableGuid(state.stableGuid)
    if (!resolvedGuid.ok) {
      dispatch({ type: 'categoryError', category: 'frameZip', message: t(ERROR_MESSAGE_KEYS.INVALID_GUID) })
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
    if (state.activeTask !== null) {
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

  const handleLoadProjectFile = (file: File) => {
    if (!projectBridge || state.activeTask !== null) {
      return
    }
    dispatch({ type: 'startTask', task: 'projectJson' })
    dependencies.readFileAsText(file).then(
      (text) => {
        const result = importProjectFromText(text, projectBridge.codec, projectBridge.importProject)
        if (result.ok) {
          dispatch({ type: 'importSucceeded', pixelsPerUnit: result.exportSettings.pixelsPerUnit, guid: result.exportSettings.guid ?? '' })
        } else {
          dispatch({ type: 'importFailed', message: t(ERROR_MESSAGE_KEYS[result.error.code]) })
        }
      },
      () => {
        dispatch({ type: 'importFailed', message: t(ERROR_MESSAGE_KEYS.PROJECT_FILE_UNREADABLE) })
      },
    ).finally(() => {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    })
  }

  return (
    <ExportPanelView
      state={state}
      metadata={metadata}
      hasProjectSupport={projectBridge !== undefined}
      normalizedGuid={normalizedGuid}
      fileInputRef={fileInputRef}
      onSelectCategory={(category) => dispatch({ type: 'selectCategory', category })}
      onSetLayout={(layout) => dispatch({ type: 'setSpriteLayout', layout })}
      onSetTarget={(target) => dispatch({ type: 'setSpriteTarget', target })}
      onSetFormat={(format) => dispatch({ type: 'setAnimationFormat', format })}
      onToggleLoop={(checked) => dispatch({ type: 'toggleLoop', checked })}
      onSetPixelsPerUnit={(value) => dispatch({ type: 'setPixelsPerUnit', value })}
      onSetStableGuid={(value) => dispatch({ type: 'setStableGuid', value })}
      onSaveProject={handleSaveProject}
      onLoadProjectClick={() => fileInputRef.current?.click()}
      onLoadProjectFile={handleLoadProjectFile}
      onExportSpriteSheet={() => handleExport(
        'spriteSheet',
        () => runSpriteSheetExport(frameSet, state.spriteLayout, state.spriteLayout === 'horizontal' ? spriteSheetFileName : compactPngFileName, dependencies),
        'spriteSheet',
      )}
      onExportUnity={handleExportUnity}
      onExportAnimation={() => handleAnimationExport(state.animationFormat)}
      onExportFrameZip={handleExportFrameZip}
    />
  )
}

/** Localized message key for every user-distinguishable export error. */
const ERROR_MESSAGE_KEYS: Readonly<Record<ExportErrorCode, MessageKey>> = {
  PROJECT_FILE_UNREADABLE: 'export.errors.projectFileUnreadable',
  INVALID_JSON: 'export.errors.invalidJson',
  UNSUPPORTED_SCHEMA: 'export.errors.unsupportedSchema',
  UNSUPPORTED_VERSION: 'export.errors.unsupportedVersion',
  WRONG_GENERATOR: 'export.errors.wrongGenerator',
  INVALID_PARAMETERS: 'export.errors.invalidParameters',
  INVALID_FPS: 'export.errors.invalidFps',
  INVALID_PPU: 'export.errors.invalidPpu',
  INVALID_GUID: 'export.errors.invalidGuid',
  UNITY_ATLAS_TOO_LARGE: 'export.errors.unityAtlasTooLarge',
  RENDER_FAILED: 'export.errors.renderFailed',
  PNG_ENCODING_FAILED: 'export.errors.exportFailed',
  ZIP_ENCODING_FAILED: 'export.errors.exportFailed',
  ANIMATION_ENCODING_FAILED: 'export.errors.exportFailed',
  DOWNLOAD_FAILED: 'export.errors.exportFailed',
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
