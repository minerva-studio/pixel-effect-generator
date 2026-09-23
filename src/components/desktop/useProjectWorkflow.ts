import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DesktopAppApi, RecentProject, UnsavedDialogLabels } from '../../desktop/desktopApi'
import type {
  RegisteredGenerator,
  RegisteredGeneratorSession,
} from '../../generators/contract'
import type { TranslateFunction } from '../../i18n/messages'
import { buildProjectDocument, serializeJsonValue } from '../../shared/project/document'
import type { GeneratorProjectCodec, ProjectExportSettings } from '../../shared/project/types'
import type { FileOperationController } from '../fileOperations'
import { documentGenerator, prepareNewDocument, prepareOpenedDocument, type PreparedDocument } from '../documentSession'
import type { ToastApi } from '../toast/ToastProvider'
import type { UnityExportSettingsState } from '../unitySettings'

export interface ProjectWorkflow {
  readonly currentFileName: string | null
  readonly dirty: boolean
  readonly canSave: boolean
  readonly recents: readonly RecentProject[]
  readonly newProject: () => void
  /** Creates the selected document only after unsaved changes have been resolved. */
  readonly createProject: (id: string) => Promise<boolean>
  readonly openProject: () => void
  readonly openRecent: (id: string) => void
  readonly saveProject: () => void
  readonly saveProjectAs: () => void
  readonly exitProject: () => void
  readonly clearRecent: () => void
}

/** Dirty baseline belongs to the current document and its generator. */
export interface ProjectBaseline {
  readonly generatorId: string
  readonly text: string
}

/** Stable dirty snapshot; codec-less generators use a snapshot that must never be saved as a project. */
export function serializeProjectSnapshot(
  codec: GeneratorProjectCodec<unknown> | undefined,
  parameters: unknown,
  fps: number,
  unitySettings: UnityExportSettingsState,
): string {
  if (codec === undefined) {
    // A generator without a file codec still needs unsaved-change protection.
    // This fallback is a dirty snapshot only; save operations require a codec.
    return JSON.stringify({ parameters, fps, unitySettings })
  }
  try {
    const trimmed = unitySettings.stableGuid.trim()
    const settings: ProjectExportSettings = {
      pixelsPerUnit: unitySettings.pixelsPerUnit,
      guid: trimmed === '' ? null : trimmed,
    }
    return serializeJsonValue(buildProjectDocument(codec, parameters, fps, settings))
  } catch {
    return ''
  }
}

/** True when the current serialization differs from the matching baseline. */
export function isProjectDirty(
  baseline: ProjectBaseline | null,
  generatorId: string,
  serialized: string,
): boolean {
  return baseline !== null && baseline.generatorId === generatorId && serialized !== baseline.text
}

interface ProjectWorkflowDeps {
  readonly api: DesktopAppApi
  readonly generator: RegisteredGenerator<string>
  readonly session: RegisteredGeneratorSession<string>
  readonly unitySettings: UnityExportSettingsState
  readonly onRequestNew: () => void
  readonly onReplaceDocument: (document: PreparedDocument) => void
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
  onRequestNew,
  onReplaceDocument,
  fileOperations,
  toast,
  t,
}: ProjectWorkflowDeps): ProjectWorkflow {
  const codec = generator.projectCodec
  const [currentFileName, setCurrentFileName] = useState<string | null>(null)
  const [baseline, setBaseline] = useState<ProjectBaseline | null>(() => ({
    generatorId: generator.id,
    text: serializeProjectSnapshot(codec, session.parameters, session.previewFps, unitySettings),
  }))
  const [recents, setRecents] = useState<readonly RecentProject[]>([])

  const serializeCurrent = useCallback((): string => {
    return serializeProjectSnapshot(codec, session.parameters, session.previewFps, unitySettings)
  }, [codec, session.parameters, session.previewFps, unitySettings.pixelsPerUnit, unitySettings.stableGuid])

  const serialized = serializeCurrent()
  const dirty = isProjectDirty(baseline, generator.id, serialized)

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
      const result = currentFileName === null
        ? await api.project.saveAs(projectSuggestedName(generator, session, t), bytes)
        : await api.project.save(bytes)
      toast.dismiss(pendingId)
      if (result.status === 'saved') {
        setBaseline({ generatorId: generator.id, text })
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
  }, [api, codec, fileOperations, serializeCurrent, currentFileName, generator, session, toast, t, refreshRecents])

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
        setBaseline({ generatorId: generator.id, text })
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

  const acceptDocument = useCallback((document: PreparedDocument, name: string | null) => {
    const owner = documentGenerator(document.session.generatorId)
    const text = serializeProjectSnapshot(owner.projectCodec, document.session.parameters, document.session.previewFps, document.unitySettings)
    onReplaceDocument(document)
    setBaseline({ generatorId: owner.id, text })
    setCurrentFileName(name)
  }, [onReplaceDocument])

  const applyOpenedProject = useCallback(async (result: { readonly id: string; readonly name: string; readonly text: string }): Promise<void> => {
    try {
      const document = prepareOpenedDocument(result.text)
      await api.project.confirmOpen(result.id)
      acceptDocument(document, result.name)
      refreshRecents()
    } catch {
      toast.show('error', t('workbench.openFailed'))
    }
  }, [api, acceptDocument, refreshRecents, toast, t])

  const createProject = useCallback(async (id: string): Promise<boolean> => {
    if (fileOperations.activeTask !== null || !(await confirmBeforeProceeding())) return false
    try {
      const document = prepareNewDocument(id)
      acceptDocument(document, null)
      toast.show('success', t('desktop.toasts.newProject'))
      return true
    } catch {
      toast.show('error', t('workbench.newFailed'))
      return false
    }
  }, [acceptDocument, confirmBeforeProceeding, fileOperations, toast, t])

  const newProject = useCallback(() => {
    if (fileOperations.activeTask === null) onRequestNew()
  }, [fileOperations.activeTask, onRequestNew])

  const openProject = useCallback(async (): Promise<void> => {
    if (fileOperations.activeTask !== null) {
      return
    }
    if (!(await confirmBeforeProceeding())) {
      return
    }
    if (!fileOperations.tryStart('projectLoad')) return
    try {
      const result = await api.project.open()
      if (result.status === 'opened') await applyOpenedProject(result)
      else if (result.status === 'failed') toast.show('error', t('desktop.toasts.openFailed'))
    } catch { toast.show('error', t('desktop.toasts.openFailed')) }
    finally { fileOperations.finish('projectLoad') }
  }, [api, applyOpenedProject, confirmBeforeProceeding, fileOperations, toast, t])

  const openRecent = useCallback(async (id: string): Promise<void> => {
    if (fileOperations.activeTask !== null) {
      return
    }
    if (!(await confirmBeforeProceeding())) {
      return
    }
    if (!fileOperations.tryStart('projectLoad')) return
    try {
      const result = await api.project.openRecent(id)
      if (result.status === 'opened') await applyOpenedProject(result)
      else if (result.status === 'failed') {
        toast.show('error', t('desktop.toasts.recentFailed'))
        refreshRecents()
      }
    } catch { toast.show('error', t('desktop.toasts.recentFailed')) }
    finally { fileOperations.finish('projectLoad') }
  }, [api, applyOpenedProject, confirmBeforeProceeding, fileOperations, refreshRecents, toast, t])

  const exitProject = useCallback(() => {
    void api.window.requestClose()
  }, [api])

  const clearRecent = useCallback(() => {
    if (fileOperations.activeTask !== null) {
      return
    }
    void api.project.clearRecent().then(refreshRecents)
  }, [api, fileOperations.activeTask, refreshRecents])

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
      void saveProject().then(
        (saved) => api.window.completeCloseSave(saved),
        () => api.window.completeCloseSave(false),
      )
    })
    return () => {
      offMenu()
      offSave()
    }
  }, [api, exitProject, newProject, openProject, saveProject, saveProjectAs])

  return {
    currentFileName,
    dirty,
    canSave: codec !== undefined,
    recents,
    newProject,
    createProject,
    openProject: () => void openProject(),
    openRecent: (id) => void openRecent(id),
    saveProject: () => void saveProject(),
    saveProjectAs: () => void saveProjectAs(),
    exitProject,
    clearRecent,
  }
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
