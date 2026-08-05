import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DesktopAppApi, RecentProject, UnsavedDialogLabels } from '../../electron/desktopApi'
import type {
  RegisteredGenerator,
  RegisteredGeneratorAction,
  RegisteredGeneratorSession,
} from '../../generators/contract'
import type { TranslateFunction } from '../../i18n/messages'
import { buildProjectDocument, serializeJsonValue } from '../../shared/project/document'
import type { ProjectExportSettings } from '../../shared/project/types'
import type { FileOperationController } from '../fileOperations'
import { importProjectFromText } from '../ProjectMenu'
import type { ToastApi } from '../toast/ToastProvider'
import { DEFAULT_UNITY_EXPORT_SETTINGS, type UnityExportSettingsState } from '../unitySettings'

export interface ProjectWorkflow {
  readonly currentFileName: string | null
  readonly dirty: boolean
  readonly recents: readonly RecentProject[]
  readonly newProject: () => void
  readonly openProject: () => void
  readonly openRecent: (id: string) => void
  readonly saveProject: () => void
  readonly saveProjectAs: () => void
  readonly exitProject: () => void
  readonly clearRecent: () => void
}

interface ProjectWorkflowDeps {
  readonly api: DesktopAppApi
  readonly generator: RegisteredGenerator<string>
  readonly session: RegisteredGeneratorSession<string>
  readonly unitySettings: UnityExportSettingsState
  readonly onUnitySettingsChange: (settings: UnityExportSettingsState) => void
  readonly onSessionAction: (action: RegisteredGeneratorAction<string>) => void
  readonly onReset: () => void
  readonly fileOperations: FileOperationController
  readonly toast: ToastApi
  readonly t: TranslateFunction
}

/**
 * Desktop project lifecycle: dirty baseline, native open/save flows, recent
 * projects, and the three-way unsaved-changes protection. Every operation
 * shares the workspace file-operation lock.
 */
export function useProjectWorkflow({
  api,
  generator,
  session,
  unitySettings,
  onUnitySettingsChange,
  onSessionAction,
  onReset,
  fileOperations,
  toast,
  t,
}: ProjectWorkflowDeps): ProjectWorkflow {
  const [currentFileName, setCurrentFileName] = useState<string | null>(null)
  const [baseline, setBaseline] = useState<string | null>(null)
  const [recents, setRecents] = useState<readonly RecentProject[]>([])

  const codec = generator.projectCodec
  const serializeCurrent = useCallback((): string => {
    if (codec === undefined) {
      return ''
    }
    try {
      const trimmed = unitySettings.stableGuid.trim()
      const settings: ProjectExportSettings = {
        pixelsPerUnit: unitySettings.pixelsPerUnit,
        guid: trimmed === '' ? null : trimmed,
      }
      return serializeJsonValue(buildProjectDocument(codec, session.parameters, session.previewFps, settings))
    } catch {
      return ''
    }
  }, [codec, session.parameters, session.previewFps, unitySettings.pixelsPerUnit, unitySettings.stableGuid])

  const serialized = serializeCurrent()
  const dirty = baseline !== null && serialized !== baseline

  const unsavedLabels = useMemo<UnsavedDialogLabels>(() => ({
    title: t('desktop.confirm.title'),
    message: t('desktop.confirm.message'),
    save: t('desktop.confirm.save'),
    discard: t('desktop.confirm.discard'),
    cancel: t('desktop.confirm.cancel'),
  }), [t])

  const refreshRecents = useCallback(() => {
    void api.project.recent().then(setRecents)
  }, [api])

  useEffect(() => {
    void api.project.setDirty(dirty, unsavedLabels)
  }, [api, dirty, unsavedLabels])

  useEffect(() => {
    refreshRecents()
  }, [api, refreshRecents])

  const baselineFor = useCallback((parameters: unknown, fps: number, settings: ProjectExportSettings): string => {
    if (codec === undefined) {
      return ''
    }
    try {
      return serializeJsonValue(buildProjectDocument(codec, parameters, fps, settings))
    } catch {
      return ''
    }
  }, [codec])

  const saveProject = useCallback(async (): Promise<boolean> => {
    if (codec === undefined || !fileOperations.tryStart('projectSave')) {
      return false
    }
    try {
      const text = serializeCurrent()
      if (text === '') {
        toast.show('error', t('desktop.toasts.saveFailed'))
        return false
      }
      const pendingId = toast.show('pending', t('export.toasts.savingProject'))
      const bytes = new TextEncoder().encode(text).buffer
      const result = await api.project.save(bytes)
      toast.dismiss(pendingId)
      if (result.status === 'saved') {
        setBaseline(text)
        setCurrentFileName(result.name)
        toast.show('success', t('desktop.toasts.savedProject'))
        return true
      }
      if (result.status === 'failed') {
        toast.show('error', t('desktop.toasts.saveFailed'))
      }
      return false
    } finally {
      fileOperations.finish('projectSave')
    }
  }, [api, codec, fileOperations, serializeCurrent, toast, t])

  const saveProjectAs = useCallback(async (): Promise<boolean> => {
    if (codec === undefined || !fileOperations.tryStart('projectSave')) {
      return false
    }
    try {
      const text = serializeCurrent()
      if (text === '') {
        toast.show('error', t('desktop.toasts.saveFailed'))
        return false
      }
      const pendingId = toast.show('pending', t('export.toasts.savingProject'))
      const bytes = new TextEncoder().encode(text).buffer
      const result = await api.project.saveAs(projectSuggestedName(generator, session, t), bytes)
      toast.dismiss(pendingId)
      if (result.status === 'saved') {
        setBaseline(text)
        setCurrentFileName(result.name)
        toast.show('success', t('desktop.toasts.savedProject'))
        refreshRecents()
        return true
      }
      if (result.status === 'failed') {
        toast.show('error', t('desktop.toasts.saveFailed'))
      }
      return false
    } finally {
      fileOperations.finish('projectSave')
    }
  }, [api, codec, fileOperations, generator, serializeCurrent, session, toast, t, refreshRecents])

  const confirmBeforeProceeding = useCallback(async (): Promise<boolean> => {
    if (!dirty) {
      return true
    }
    const choice = await api.project.confirmUnsaved(unsavedLabels)
    if (choice === 'cancel') {
      return false
    }
    if (choice === 'discard') {
      return true
    }
    return saveProject()
  }, [api, dirty, unsavedLabels, saveProject])

  const applyOpenedProject = useCallback(async (result: { readonly id: string; readonly name: string; readonly text: string }): Promise<void> => {
    if (codec === undefined) {
      return
    }
    const imported = importProjectFromText(result.text, codec, ({ parameters, fps, exportSettings }) => {
      try {
        onSessionAction(generator.createImportedAction(parameters, fps))
        onUnitySettingsChange({
          pixelsPerUnit: exportSettings.pixelsPerUnit,
          stableGuid: exportSettings.guid ?? '',
        })
        return { ok: true }
      } catch (error) {
        return { ok: false, error: { code: 'RENDER_FAILED', detail: describeError(error) } }
      }
    })
    if (!imported.ok) {
      toast.show('error', t('desktop.toasts.openFailed'))
      return
    }
    await api.project.confirmOpen(result.id)
    setBaseline(baselineFor(imported.parameters, imported.fps, imported.exportSettings))
    setCurrentFileName(result.name)
    refreshRecents()
  }, [api, baselineFor, codec, generator, onSessionAction, onUnitySettingsChange, refreshRecents, toast, t])

  const newProject = useCallback(async (): Promise<void> => {
    if (!(await confirmBeforeProceeding())) {
      return
    }
    onReset()
    onUnitySettingsChange(DEFAULT_UNITY_EXPORT_SETTINGS)
    const defaults = generator.createSession(12)
    setBaseline(baselineFor(defaults.parameters, defaults.previewFps, {
      pixelsPerUnit: DEFAULT_UNITY_EXPORT_SETTINGS.pixelsPerUnit,
      guid: null,
    }))
    setCurrentFileName(null)
    toast.show('success', t('desktop.toasts.newProject'))
  }, [baselineFor, confirmBeforeProceeding, generator, onReset, onUnitySettingsChange, toast, t])

  const openProject = useCallback(async (): Promise<void> => {
    if (!(await confirmBeforeProceeding())) {
      return
    }
    const result = await api.project.open()
    if (result.status === 'opened') {
      await applyOpenedProject(result)
    } else if (result.status === 'failed') {
      toast.show('error', t('desktop.toasts.openFailed'))
    }
  }, [api, applyOpenedProject, confirmBeforeProceeding, toast, t])

  const openRecent = useCallback(async (id: string): Promise<void> => {
    if (!(await confirmBeforeProceeding())) {
      return
    }
    const result = await api.project.openRecent(id)
    if (result.status === 'opened') {
      await applyOpenedProject(result)
    } else if (result.status === 'failed') {
      toast.show('error', t('desktop.toasts.recentFailed'))
      refreshRecents()
    }
  }, [api, applyOpenedProject, confirmBeforeProceeding, refreshRecents, toast, t])

  const exitProject = useCallback(() => {
    void api.window.requestClose()
  }, [api])

  const clearRecent = useCallback(() => {
    void api.project.clearRecent().then(refreshRecents)
  }, [api, refreshRecents])

  useEffect(() => {
    const offMenu = api.project.onMenuAction((action) => {
      switch (action) {
        case 'new':
          void newProject()
          break
        case 'open':
          void openProject()
          break
        case 'save':
          void saveProject()
          break
        case 'saveAs':
          void saveProjectAs()
          break
        case 'exit':
          exitProject()
          break
      }
    })
    const offSave = api.project.onSaveRequested(() => {
      void saveProject().then((saved) => {
        if (saved) {
          void api.window.requestClose()
        }
      })
    })
    return () => {
      offMenu()
      offSave()
    }
  }, [api, exitProject, newProject, openProject, saveProject, saveProjectAs])

  return {
    currentFileName,
    dirty,
    recents,
    newProject: () => void newProject(),
    openProject: () => void openProject(),
    openRecent: (id) => void openRecent(id),
    saveProject: () => void saveProject(),
    saveProjectAs: () => void saveProjectAs(),
    exitProject,
    clearRecent,
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Builds the suggested Project JSON file name from the current effect. */
function projectSuggestedName(
  generator: RegisteredGenerator<string>,
  session: RegisteredGeneratorSession<string>,
  t: TranslateFunction,
): string {
  const frames = session.frames.read()
  const frame = frames[0]
  return t('project.fileName', {
    name: generator.id,
    width: frame?.width ?? 128,
    height: frame?.height ?? 128,
    frameCount: frames.length,
  })
}
