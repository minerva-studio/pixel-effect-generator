import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopFileApi } from './desktopApi'

// Exposes only the minimal file bridge; no generic IPC is available to the
// renderer, which also has no Node.js or filesystem access.
const api: DesktopFileApi = {
  isDesktop: true,
  saveFile: (request) => ipcRenderer.invoke('desktop:save-file', request),
  openProject: () => ipcRenderer.invoke('desktop:open-project'),
}

contextBridge.exposeInMainWorld('pixelEffectDesktop', api)
