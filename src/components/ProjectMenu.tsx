import { useEffect, useId, useReducer, useRef, type RefObject } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import type { MessageKey, TranslateFunction } from '../i18n/messages'
import { parseProjectDocument, serializeJsonValue } from '../shared/project/document'
import type {
  EffectProjectV1,
  ExportError,
  ExportErrorCode,
  GeneratorProjectCodec,
  ProjectExportSettings,
} from '../shared/project/types'
import { normalizeGuid } from '../shared/unity/guid'
import { downloadText } from './export'
import type { FileOperationController } from './fileOperations'
import type { ParsedProjectImport, ProjectBridge, ProjectImportResult } from './projectBridge'
import type { UnityExportSettingsState } from './unitySettings'

export const JSON_MIME = 'application/json'

/** Local UI state of the Project menu; never shared with the generator session. */
export interface ProjectMenuState {
  readonly open: boolean
  readonly error: string | null
  readonly status: 'idle' | 'success'
}

/** State transitions driven by the menu and its file operations. */
export type ProjectMenuAction =
  | { readonly type: 'toggle' }
  | { readonly type: 'close' }
  | { readonly type: 'operationStarted' }
  | { readonly type: 'operationSucceeded' }
  | { readonly type: 'operationFailed'; readonly message: string }

/** Menu starts closed with no status; errors persist until the next operation. */
export function createInitialProjectMenuState(): ProjectMenuState {
  return { open: false, error: null, status: 'idle' }
}

/** Reduces one Project menu interaction into the next local UI state. */
export function projectMenuReducer(state: ProjectMenuState, action: ProjectMenuAction): ProjectMenuState {
  switch (action.type) {
    case 'toggle':
      return { ...state, open: !state.open }
    case 'close':
      return { ...state, open: false }
    case 'operationStarted':
      return { ...state, error: null, status: 'idle' }
    case 'operationSucceeded':
      return { ...state, error: null, status: 'success' }
    case 'operationFailed':
      return { ...state, error: action.message, status: 'idle' }
  }
}

/** Injectable file operations kept apart from React so behavior is testable. */
export interface ProjectMenuDependencies {
  readonly downloadText: (text: string, fileName: string, mime: string) => void
  readonly readFileAsText: (file: File) => Promise<string>
  readonly serializeJson: (document: EffectProjectV1) => string
}

const PROJECT_MENU_DEPENDENCIES: ProjectMenuDependencies = {
  downloadText,
  readFileAsText: (file) => file.text(),
  serializeJson: serializeJsonValue,
}

/** Resolves shared Unity settings into a validated export document input. */
export function resolveProjectSaveSettings(
  settings: UnityExportSettingsState,
): { readonly ok: true; readonly exportSettings: ProjectExportSettings } | { readonly ok: false; readonly error: ExportError } {
  if (!Number.isInteger(settings.pixelsPerUnit) || settings.pixelsPerUnit < 1 || settings.pixelsPerUnit > 1024) {
    return { ok: false, error: { code: 'INVALID_PPU', detail: `Invalid pixelsPerUnit: ${settings.pixelsPerUnit}` } }
  }
  const trimmed = settings.stableGuid.trim()
  if (trimmed === '') {
    return { ok: true, exportSettings: { pixelsPerUnit: settings.pixelsPerUnit, guid: null } }
  }
  const normalized = normalizeGuid(trimmed)
  if (normalized === null) {
    return { ok: false, error: { code: 'INVALID_GUID', detail: `Invalid GUID: ${trimmed}` } }
  }
  return { ok: true, exportSettings: { pixelsPerUnit: settings.pixelsPerUnit, guid: normalized } }
}

/** Builds and downloads the current project document as stable JSON. */
export function runProjectSave(
  bridge: ProjectBridge,
  unitySettings: UnityExportSettingsState,
  fileName: string,
  dependencies: ProjectMenuDependencies,
): { readonly ok: true } | { readonly ok: false; readonly error: ExportError } {
  const resolved = resolveProjectSaveSettings(unitySettings)
  if (!resolved.ok) {
    return resolved
  }
  try {
    const document = bridge.buildDocument(resolved.exportSettings)
    dependencies.downloadText(dependencies.serializeJson(document), fileName, JSON_MIME)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: { code: 'DOWNLOAD_FAILED', detail: describeError(error) } }
  }
}

/**
 * Parses project JSON, validates it through the codec, and asks the workspace
 * to render and commit the import. Rendering happens exactly once and only
 * commits after every validation step succeeds.
 */
export function importProjectFromText(
  text: string,
  codec: GeneratorProjectCodec<unknown>,
  importProject: (project: ParsedProjectImport) => ProjectImportResult,
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
    exportSettings: parsed.project.exportSettings,
  })
  if (!rendered.ok) {
    return { ok: false, error: rendered.error }
  }
  return { ok: true, exportSettings: parsed.project.exportSettings }
}

interface ProjectMenuProps {
  readonly bridge: ProjectBridge
  readonly fileName: string
  readonly unitySettings: UnityExportSettingsState
  readonly fileOperations: FileOperationController
  readonly dependencies?: ProjectMenuDependencies
}

interface ProjectMenuViewProps {
  readonly state: ProjectMenuState
  readonly busy: boolean
  readonly saving: boolean
  readonly opening: boolean
  readonly menuId: string
  readonly buttonRef: RefObject<HTMLButtonElement | null>
  readonly panelRef: RefObject<HTMLDivElement | null>
  readonly fileInputRef: RefObject<HTMLInputElement | null>
  readonly onToggle: () => void
  readonly onSave: () => void
  readonly onOpenClick: () => void
  readonly onFileChange: (file: File) => void
}

/** Presentational Project menu; rendering depends only on state and props. */
export function ProjectMenuView({
  state,
  busy,
  saving,
  opening,
  menuId,
  buttonRef,
  panelRef,
  fileInputRef,
  onToggle,
  onSave,
  onOpenClick,
  onFileChange,
}: ProjectMenuViewProps) {
  const { t } = useI18n()
  return (
    <div className="project-menu" ref={panelRef}>
      <button
        className="project-menu-button"
        type="button"
        ref={buttonRef}
        aria-controls={menuId}
        aria-expanded={state.open}
        aria-haspopup="menu"
        onClick={onToggle}
      >
        <span>{t('project.menu')}</span>
        <span className="project-menu-chevron" aria-hidden="true">▾</span>
      </button>
      {state.open ? (
        <div className="project-menu-panel" id={menuId} role="menu" aria-label={t('project.menu')}>
          <button className="project-menu-item" type="button" role="menuitem" disabled={busy} onClick={onOpenClick}>
            {opening ? t('project.opening') : t('project.open')}
          </button>
          <button className="project-menu-item" type="button" role="menuitem" disabled={busy} onClick={onSave}>
            {saving ? t('project.saving') : t('project.save')}
          </button>
          <input
            ref={fileInputRef}
            className="project-file-input"
            type="file"
            accept=".json,application/json"
            aria-label={t('project.fileLabel')}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                onFileChange(file)
              }
            }}
          />
          {state.status === 'success' ? (
            <p className="project-menu-status" role="status" aria-live="polite">{t('project.imported')}</p>
          ) : null}
          {state.error ? (
            <p className="project-menu-error" role="alert">{state.error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Project JSON menu shown in the parameter panel header. It owns JSON
 * serialization/download and file parsing; rendering and commit go through
 * the workspace-provided ProjectBridge so failures never leave partial state.
 */
export function ProjectMenu({
  bridge,
  fileName,
  unitySettings,
  fileOperations,
  dependencies = PROJECT_MENU_DEPENDENCIES,
}: ProjectMenuProps) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(projectMenuReducer, undefined, createInitialProjectMenuState)
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const busy = fileOperations.activeTask !== null
  const saving = fileOperations.activeTask === 'projectSave'
  const opening = fileOperations.activeTask === 'projectLoad'

  useEffect(() => {
    if (!state.open) {
      return undefined
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        dispatch({ type: 'close' })
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dispatch({ type: 'close' })
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [state.open])

  const handleSave = () => {
    if (!fileOperations.tryStart('projectSave')) {
      return
    }
    dispatch({ type: 'operationStarted' })
    try {
      const result = runProjectSave(bridge, unitySettings, fileName, dependencies)
      if (!result.ok) {
        dispatch({ type: 'operationFailed', message: projectErrorMessage(t, result.error.code) })
      }
    } catch {
      dispatch({ type: 'operationFailed', message: projectErrorMessage(t, 'DOWNLOAD_FAILED') })
    } finally {
      fileOperations.finish('projectSave')
    }
  }

  const handleOpenClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (file: File) => {
    if (!fileOperations.tryStart('projectLoad')) {
      return
    }
    dispatch({ type: 'operationStarted' })
    try {
      const text = await dependencies.readFileAsText(file)
      const result = importProjectFromText(text, bridge.codec, bridge.importProject)
      if (result.ok) {
        dispatch({ type: 'operationSucceeded' })
      } else {
        dispatch({ type: 'operationFailed', message: projectErrorMessage(t, result.error.code) })
      }
    } catch {
      dispatch({ type: 'operationFailed', message: projectErrorMessage(t, 'PROJECT_FILE_UNREADABLE') })
    } finally {
      fileOperations.finish('projectLoad')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <ProjectMenuView
      state={state}
      busy={busy}
      saving={saving}
      opening={opening}
      menuId={menuId}
      buttonRef={buttonRef}
      panelRef={panelRef}
      fileInputRef={fileInputRef}
      onToggle={() => dispatch({ type: 'toggle' })}
      onSave={handleSave}
      onOpenClick={handleOpenClick}
      onFileChange={handleFileChange}
    />
  )
}

/** Localized message key for every Project-flow error. */
const PROJECT_ERROR_KEYS: Readonly<Partial<Record<ExportErrorCode, MessageKey>>> = {
  PROJECT_FILE_UNREADABLE: 'project.errors.projectFileUnreadable',
  INVALID_JSON: 'project.errors.invalidJson',
  UNSUPPORTED_SCHEMA: 'project.errors.unsupportedSchema',
  UNSUPPORTED_VERSION: 'project.errors.unsupportedVersion',
  WRONG_GENERATOR: 'project.errors.wrongGenerator',
  INVALID_PARAMETERS: 'project.errors.invalidParameters',
  INVALID_FPS: 'project.errors.invalidFps',
  INVALID_PPU: 'project.errors.invalidPpu',
  INVALID_GUID: 'project.errors.invalidGuid',
  RENDER_FAILED: 'project.errors.renderFailed',
  DOWNLOAD_FAILED: 'project.errors.downloadFailed',
}

function projectErrorMessage(translate: TranslateFunction, code: ExportErrorCode): string {
  return translate(PROJECT_ERROR_KEYS[code] ?? 'project.errors.downloadFailed')
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
