import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type {
  DesktopAppApi,
  DesktopMenuAction,
  DesktopSaveKind,
  DesktopSaveResult,
  ProjectOpenResult,
  ProjectSaveResult,
  RecentProject,
  UnsavedChoice,
  UnsavedDialogLabels,
} from '../desktop/desktopApi'

type TauriWindow = ReturnType<typeof getCurrentWindow>

/**
 * Creates the Tauri implementation of the existing desktop contract.
 * Native file paths and lifecycle state remain in the Rust backend; the
 * renderer receives only opaque project ids and display names.
 */
export function createTauriDesktopApi(): DesktopAppApi {
  const appWindow = getCurrentWindow()
  let dirty = false
  let closePending = false
  let unsavedLabels: UnsavedDialogLabels | null = null
  let saveRequestedListener: (() => void) | null = null

  void appWindow.onCloseRequested((event) => {
    if (!dirty) {
      return
    }
    event.preventDefault()
    if (!closePending) {
      closePending = true
      saveRequestedListener?.()
    }
  })
  return {
    isDesktop: true,
    saveFile: (request) => invoke<DesktopSaveResult>('save_file', {
      request: {
        kind: request.kind,
        suggestedName: request.suggestedName,
        bytes: toByteArray(request.bytes),
      },
    }),
    window: {
      minimize: () => appWindow.minimize(),
      toggleMaximize: () => appWindow.toggleMaximize(),
      toggleFullScreen: async () => {
        await appWindow.setFullscreen(!(await appWindow.isFullscreen()))
      },
      requestClose: () => appWindow.close(),
      completeCloseSave: async (saved) => {
        closePending = false
        if (saved) {
          dirty = false
          await appWindow.destroy()
        }
      },
      isMaximized: () => appWindow.isMaximized(),
      onMaximizedChanged: (listener) => {
        let active = true
        let unlisten: (() => void) | null = null
        void appWindow.onResized(async () => {
          if (active) {
            listener(await appWindow.isMaximized())
          }
        }).then((cleanup) => {
          if (active) {
            unlisten = cleanup
          } else {
            cleanup()
          }
        })
        return () => {
          active = false
          unlisten?.()
        }
      },
    },
    project: {
      open: () => invoke<ProjectOpenResult>('project_open'),
      openRecent: (id) => invoke<ProjectOpenResult>('project_open_recent', { id }),
      confirmOpen: (id) => invoke<void>('project_confirm_open', { id }),
      save: (bytes) => invoke<ProjectSaveResult>('project_save', { bytes: toByteArray(bytes) }),
      saveAs: (suggestedName, bytes) => invoke<ProjectSaveResult>('project_save_as', {
        request: {
          suggestedName,
          bytes: toByteArray(bytes),
        },
      }),
      recent: () => invoke<readonly RecentProject[]>('project_recent'),
      clearRecent: () => invoke<void>('project_clear_recent'),
      setDirty: async (nextDirty, labels) => {
        dirty = nextDirty
        unsavedLabels = labels
      },
      confirmUnsaved: (labels) => invoke<UnsavedChoice>('confirm_unsaved', {
        labels: unsavedLabels ?? labels,
      }),
      onMenuAction: (listener) => subscribeToShortcuts(listener, appWindow),
      onSaveRequested: (listener) => {
        saveRequestedListener = listener
        return () => {
          if (saveRequestedListener === listener) {
            saveRequestedListener = null
          }
        }
      },
    },
  }
}

function toByteArray(bytes: ArrayBuffer): number[] {
  return Array.from(new Uint8Array(bytes))
}

function subscribeToShortcuts(listener: (action: DesktopMenuAction) => void, _appWindow: TauriWindow): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    const modifier = event.ctrlKey || event.metaKey
    let action: DesktopMenuAction | null = null
    if (modifier && !event.altKey) {
      if (event.key.toLowerCase() === 'n') action = 'new'
      if (event.key.toLowerCase() === 'o') action = 'open'
      if (event.key.toLowerCase() === 's') action = event.shiftKey ? 'saveAs' : 'save'
    }
    if (action !== null) {
      event.preventDefault()
      listener(action)
    }
  }
  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}
