import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { DesktopOpenProjectResult, DesktopSaveResult } from './desktopApi'
import { PROJECT_MAX_BYTES, SAVE_SPECS, parseSaveRequest, sanitizeSuggestedName } from './fileRules'

function registerIpc(): void {
  ipcMain.handle('desktop:save-file', async (_event, request: unknown): Promise<DesktopSaveResult> => {
    const parsed = parseSaveRequest(request)
    if (parsed === null) {
      return { status: 'cancelled' }
    }
    const spec = SAVE_SPECS[parsed.kind]
    const window = BrowserWindow.getFocusedWindow()
    const options: Electron.SaveDialogOptions = {
      title: 'Save file',
      defaultPath: path.join(app.getPath('documents'), sanitizeSuggestedName(parsed.suggestedName, spec.extension)),
      filters: [{ name: spec.filter.name, extensions: [...spec.filter.extensions] }],
    }
    const result = window === null
      ? await dialog.showSaveDialog(options)
      : await dialog.showSaveDialog(window, options)
    if (result.canceled || result.filePath === undefined) {
      return { status: 'cancelled' }
    }
    await fs.writeFile(result.filePath, new Uint8Array(parsed.bytes))
    return { status: 'saved' }
  })

  ipcMain.handle('desktop:open-project', async (): Promise<DesktopOpenProjectResult> => {
    const window = BrowserWindow.getFocusedWindow()
    const options: Electron.OpenDialogOptions = {
      title: 'Open project',
      properties: ['openFile'],
      filters: [{ name: 'Project JSON', extensions: ['json'] }],
    }
    const result = window === null
      ? await dialog.showOpenDialog(options)
      : await dialog.showOpenDialog(window, options)
    if (result.canceled || result.filePaths.length === 0) {
      return { status: 'cancelled' }
    }
    const filePath = result.filePaths[0]
    const stat = await fs.stat(filePath)
    if (stat.size > PROJECT_MAX_BYTES) {
      return { status: 'cancelled' }
    }
    const text = await fs.readFile(filePath, 'utf8')
    return { status: 'opened', name: path.basename(filePath), text }
  })
}

function createWindow(): void {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '..', '..', 'build', 'icon.png')
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    title: 'Pixel Effect Generator',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL === 'string' && MAIN_WINDOW_VITE_DEV_SERVER_URL !== '') {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }
}

app.setAppUserModelId('com.minervagamestudio.pixeleffectgenerator')

app.whenReady().then(() => {
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

// Block arbitrary new windows and external navigation; external links belong
// in the system browser if ever needed.
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
