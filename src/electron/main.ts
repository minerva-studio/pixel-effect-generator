import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type {
  DesktopMenuAction,
  DesktopSaveKind,
  DesktopSaveResult,
  ProjectOpenResult,
  ProjectSaveResult,
  RecentProject,
  UnsavedChoice,
  UnsavedDialogLabels,
} from './desktopApi'
import { PROJECT_MAX_BYTES, SAVE_SPECS, enforceExtension, parseSaveRequest, sanitizeSuggestedName } from './fileRules'
import {
  addRecent,
  removeRecentById,
  removeRecentByPath,
  toPublicRecents,
  type RecentEntry,
} from './recents'

const PROJECT_EXTENSION = '.json'
const RECENTS_FILE = 'recent-projects.json'
const FALLBACK_UNSAVED_LABELS: UnsavedDialogLabels = {
  title: 'Unsaved changes',
  message: 'Save changes to the current project?',
  save: 'Save',
  discard: 'Discard',
  cancel: 'Cancel',
}

let mainWindow: BrowserWindow | null = null
let currentProjectPath: string | null = null
let dirty = false
let unsavedLabels = FALLBACK_UNSAVED_LABELS
let closeDialogOpen = false
let recentEntries: readonly RecentEntry[] = []
const pendingOpens = new Map<string, string>()

function createWindow(): void {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '..', '..', 'build', 'icon.png')
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    title: 'Pixel Effect Generator',
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('maximize', () => send('desktop:window:maximized-changed', true))
  mainWindow.on('unmaximize', () => send('desktop:window:maximized-changed', false))
  mainWindow.on('close', (event) => {
    if (!dirty || closeDialogOpen) {
      if (closeDialogOpen) {
        event.preventDefault()
      }
      return
    }
    event.preventDefault()
    closeDialogOpen = true
    void handleUnsavedBeforeClose().catch(() => {
      closeDialogOpen = false
    })
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') {
      return
    }
    if (input.key === 'F11') {
      event.preventDefault()
      mainWindow?.setFullScreen(!mainWindow.isFullScreen())
    } else if (input.key === 'Escape' && mainWindow?.isFullScreen() === true) {
      event.preventDefault()
      mainWindow?.setFullScreen(false)
    }
  })

  if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL === 'string' && MAIN_WINDOW_VITE_DEV_SERVER_URL !== '') {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }
}

async function handleUnsavedBeforeClose(): Promise<void> {
  const choice = await showUnsavedDialog()
  if (choice === 'cancel') {
    closeDialogOpen = false
    return
  }
  if (choice === 'discard') {
    dirty = false
    closeDialogOpen = false
    mainWindow?.close()
    return
  }
  // Keep the close guard held while the renderer owns the native save flow.
  // It will report the terminal result through complete-close-save.
  send('desktop:save-requested')
}

async function showUnsavedDialog(): Promise<UnsavedChoice> {
  const window = mainWindow ?? undefined
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    buttons: [unsavedLabels.save, unsavedLabels.discard, unsavedLabels.cancel],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
    title: unsavedLabels.title,
    message: unsavedLabels.message,
  }
  const result = window
    ? await dialog.showMessageBox(window, options)
    : await dialog.showMessageBox(options)
  return result.response === 0 ? 'save' : result.response === 1 ? 'discard' : 'cancel'
}

function registerIpc(): void {
  ipcMain.handle('desktop:save-file', async (_event, request: unknown): Promise<DesktopSaveResult> => {
    const parsed = parseSaveRequest(request)
    if (parsed === null) {
      return { status: 'failed', error: 'invalid save request' }
    }
    const spec = SAVE_SPECS[parsed.kind]
    const options: Electron.SaveDialogOptions = {
      title: 'Save file',
      defaultPath: path.join(app.getPath('documents'), sanitizeSuggestedName(parsed.suggestedName, spec.extension)),
      filters: [{ name: spec.filter.name, extensions: [...spec.filter.extensions] }],
    }
    const result = focusedWindow()
      ? await dialog.showSaveDialog(focusedWindow()!, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || result.filePath === undefined) {
      return { status: 'cancelled' }
    }
    const filePath = enforceExtension(result.filePath, spec.extension)
    try {
      await writeAtomic(filePath, new Uint8Array(parsed.bytes))
      return { status: 'saved' }
    } catch (error) {
      return { status: 'failed', error: describeError(error) }
    }
  })

  ipcMain.handle('desktop:window:minimize', () => {
    mainWindow?.minimize()
  })
  ipcMain.handle('desktop:window:toggle-maximize', () => {
    if (mainWindow === null) {
      return
    }
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })
  ipcMain.handle('desktop:window:toggle-full-screen', () => {
    if (mainWindow === null) {
      return
    }
    mainWindow.setFullScreen(!mainWindow.isFullScreen())
  })
  ipcMain.handle('desktop:window:request-close', () => {
    mainWindow?.close()
  })
  ipcMain.handle('desktop:window:complete-close-save', (_event, saved: unknown) => {
    if (!closeDialogOpen) {
      return
    }
    if (saved === true) {
      dirty = false
      closeDialogOpen = false
      mainWindow?.close()
      return
    }
    // Cancelled and failed saves both keep the current project open.
    closeDialogOpen = false
  })
  ipcMain.handle('desktop:window:is-maximized', () => mainWindow?.isMaximized() ?? false)

  ipcMain.handle('desktop:project:open', async (): Promise<ProjectOpenResult> => {
    const options: Electron.OpenDialogOptions = {
      title: 'Open project',
      properties: ['openFile'],
      filters: [{ name: 'Project JSON', extensions: ['json'] }],
    }
    const result = focusedWindow()
      ? await dialog.showOpenDialog(focusedWindow()!, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) {
      return { status: 'cancelled' }
    }
    return readProjectFile(result.filePaths[0])
  })

  ipcMain.handle('desktop:project:open-recent', async (_event, id: unknown): Promise<ProjectOpenResult> => {
    if (typeof id !== 'string') {
      return { status: 'failed', error: 'invalid recent id' }
    }
    const entry = recentEntries.find((candidate) => candidate.id === id)
    if (entry === undefined) {
      return { status: 'failed', error: 'recent project not found' }
    }
    return readProjectFile(entry.path)
  })

  ipcMain.handle('desktop:project:confirm-open', (_event, id: unknown) => {
    if (typeof id !== 'string') {
      return
    }
    const filePath = pendingOpens.get(id)
    if (filePath === undefined) {
      return
    }
    pendingOpens.delete(id)
    currentProjectPath = filePath
    dirty = false
    markRecent(filePath)
  })

  ipcMain.handle('desktop:project:save', async (_event, bytes: unknown): Promise<ProjectSaveResult> => {
    const parsed = parseProjectBytes(bytes)
    if (parsed === null) {
      return { status: 'failed', error: 'invalid project bytes' }
    }
    if (currentProjectPath === null) {
      return saveProjectAs(parsed)
    }
    try {
      await writeAtomic(currentProjectPath, parsed)
      dirty = false
      return { status: 'saved', name: path.basename(currentProjectPath) }
    } catch (error) {
      return { status: 'failed', error: describeError(error) }
    }
  })

  ipcMain.handle('desktop:project:save-as', async (_event, request: unknown): Promise<ProjectSaveResult> => {
    const parsed = parseProjectSaveRequest(request)
    if (parsed === null) {
      return { status: 'failed', error: 'invalid save request' }
    }
    return saveProjectAs(parsed.bytes, parsed.suggestedName)
  })

  ipcMain.handle('desktop:project:recent', (): readonly RecentProject[] => toPublicRecents(recentEntries))

  ipcMain.handle('desktop:project:clear-recent', () => {
    recentEntries = []
    void persistRecents()
  })

  ipcMain.handle('desktop:project:set-dirty', (_event, nextDirty: unknown, labels: unknown) => {
    dirty = nextDirty === true
    if (typeof labels === 'object' && labels !== null) {
      const record = labels as Record<string, unknown>
      if (
        typeof record.title === 'string'
        && typeof record.message === 'string'
        && typeof record.save === 'string'
        && typeof record.discard === 'string'
        && typeof record.cancel === 'string'
      ) {
        unsavedLabels = {
          title: record.title,
          message: record.message,
          save: record.save,
          discard: record.discard,
          cancel: record.cancel,
        }
      }
    }
  })

  ipcMain.handle('desktop:project:confirm-unsaved', async (): Promise<UnsavedChoice> => showUnsavedDialog())
}

async function saveProjectAs(bytes: Uint8Array, suggestedName = 'project.json'): Promise<ProjectSaveResult> {
  const options: Electron.SaveDialogOptions = {
    title: 'Save project',
    defaultPath: path.join(app.getPath('documents'), sanitizeSuggestedName(suggestedName, PROJECT_EXTENSION)),
    filters: [{ name: 'Project JSON', extensions: ['json'] }],
  }
  const result = focusedWindow()
    ? await dialog.showSaveDialog(focusedWindow()!, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || result.filePath === undefined) {
    return { status: 'cancelled' }
  }
  const filePath = enforceExtension(result.filePath, PROJECT_EXTENSION)
  try {
    await writeAtomic(filePath, bytes)
  } catch (error) {
    return { status: 'failed', error: describeError(error) }
  }
  currentProjectPath = filePath
  dirty = false
  markRecent(filePath)
  return { status: 'saved', name: path.basename(filePath) }
}

async function readProjectFile(filePath: string): Promise<ProjectOpenResult> {
  try {
    const stat = await fs.stat(filePath)
    if (stat.size > PROJECT_MAX_BYTES) {
      recentEntries = removeRecentByPath(recentEntries, filePath)
      void persistRecents()
      return { status: 'failed', error: 'project too large' }
    }
    const text = await fs.readFile(filePath, 'utf8')
    const id = crypto.randomUUID()
    pendingOpens.set(id, filePath)
    return { status: 'opened', id, name: path.basename(filePath), text }
  } catch (error) {
    recentEntries = removeRecentByPath(recentEntries, filePath)
    void persistRecents()
    return { status: 'failed', error: describeError(error) }
  }
}

function markRecent(filePath: string): void {
  recentEntries = addRecent(recentEntries, {
    id: crypto.randomUUID(),
    name: path.basename(filePath),
    path: filePath,
  })
  void persistRecents()
}

async function persistRecents(): Promise<void> {
  try {
    const file = path.join(app.getPath('userData'), RECENTS_FILE)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify(recentEntries, null, 2), 'utf8')
  } catch {
    // Recent projects are a convenience; storage failures are non-fatal.
  }
}

async function loadRecents(): Promise<void> {
  try {
    const file = path.join(app.getPath('userData'), RECENTS_FILE)
    const raw = await fs.readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      recentEntries = parsed
        .filter((entry): entry is RecentEntry => (
          typeof entry === 'object'
          && entry !== null
          && typeof (entry as RecentEntry).id === 'string'
          && typeof (entry as RecentEntry).name === 'string'
          && typeof (entry as RecentEntry).path === 'string'
        ))
        .slice(0, 8)
    }
  } catch {
    recentEntries = []
  }
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('new') },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('open') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenuAction('saveAs') },
        { type: 'separator' },
        { label: 'Exit', role: 'close' },
      ],
    },
    { label: 'Edit', role: 'editMenu' },
    { label: 'View', role: 'viewMenu' },
    { label: 'Window', role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function sendMenuAction(action: DesktopMenuAction): void {
  send('desktop:menu-action', action)
}

function send(channel: string, ...args: unknown[]): void {
  mainWindow?.webContents.send(channel, ...args)
}

function focusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow()
}

/** Writes to a sibling temp file first so a crash never corrupts the target. */
async function writeAtomic(filePath: string, bytes: Uint8Array): Promise<void> {
  const directory = path.dirname(filePath)
  const tempPath = path.join(directory, `.${path.basename(filePath)}.tmp-${crypto.randomUUID()}`)
  await fs.writeFile(tempPath, bytes)
  await fs.rename(tempPath, filePath)
}

function parseProjectBytes(value: unknown): Uint8Array | null {
  return value instanceof ArrayBuffer && value.byteLength <= PROJECT_MAX_BYTES
    ? new Uint8Array(value)
    : null
}

function parseProjectSaveRequest(request: unknown): { readonly bytes: Uint8Array; readonly suggestedName: string } | null {
  if (typeof request !== 'object' || request === null) {
    return null
  }
  const record = request as Record<string, unknown>
  const bytes = parseProjectBytes(record.bytes)
  if (bytes === null || typeof record.suggestedName !== 'string') {
    return null
  }
  return { bytes, suggestedName: record.suggestedName }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

app.setAppUserModelId('com.minervagamestudio.pixeleffectgenerator')

app.whenReady().then(async () => {
  await loadRecents()
  createMenu()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Block arbitrary new windows and external navigation.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event, url) => {
    const devServer = typeof MAIN_WINDOW_VITE_DEV_SERVER_URL === 'string' ? MAIN_WINDOW_VITE_DEV_SERVER_URL : ''
    const allowed = url.startsWith('file:') || (devServer !== '' && url.startsWith(devServer))
    if (!allowed) {
      event.preventDefault()
    }
  })
})
