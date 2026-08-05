import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopAppApi, DesktopMenuAction } from './desktopApi'

// Exposes only the narrow desktop bridge; no generic IPC, Node.js, or
// filesystem access is available to the renderer.
const api: DesktopAppApi = {
  isDesktop: true,
  saveFile: (request) => ipcRenderer.invoke('desktop:save-file', request),
  window: {
    minimize: () => ipcRenderer.invoke('desktop:window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('desktop:window:toggle-maximize'),
    toggleFullScreen: () => ipcRenderer.invoke('desktop:window:toggle-full-screen'),
    requestClose: () => ipcRenderer.invoke('desktop:window:request-close'),
    completeCloseSave: (saved) => ipcRenderer.invoke('desktop:window:complete-close-save', saved),
    isMaximized: () => ipcRenderer.invoke('desktop:window:is-maximized'),
    onMaximizedChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, maximized: boolean) => listener(maximized)
      ipcRenderer.on('desktop:window:maximized-changed', handler)
      return () => ipcRenderer.removeListener('desktop:window:maximized-changed', handler)
    },
  },
  project: {
    open: () => ipcRenderer.invoke('desktop:project:open'),
    openRecent: (id) => ipcRenderer.invoke('desktop:project:open-recent', id),
    confirmOpen: (id) => ipcRenderer.invoke('desktop:project:confirm-open', id),
    save: (bytes) => ipcRenderer.invoke('desktop:project:save', bytes),
    saveAs: (suggestedName, bytes) => ipcRenderer.invoke('desktop:project:save-as', { suggestedName, bytes }),
    recent: () => ipcRenderer.invoke('desktop:project:recent'),
    clearRecent: () => ipcRenderer.invoke('desktop:project:clear-recent'),
    setDirty: (dirty, labels) => ipcRenderer.invoke('desktop:project:set-dirty', dirty, labels),
    confirmUnsaved: (labels) => ipcRenderer.invoke('desktop:project:confirm-unsaved', labels),
    onMenuAction: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, action: DesktopMenuAction) => listener(action)
      ipcRenderer.on('desktop:menu-action', handler)
      return () => ipcRenderer.removeListener('desktop:menu-action', handler)
    },
    onSaveRequested: (listener) => {
      const handler = () => listener()
      ipcRenderer.on('desktop:save-requested', handler)
      return () => ipcRenderer.removeListener('desktop:save-requested', handler)
    },
  },
}

contextBridge.exposeInMainWorld('pixelEffectDesktop', api)
