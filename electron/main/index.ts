import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'
import { optimizer, is } from '@electron-toolkit/utils'
import { registerRecordingIpc } from './ipc'
import { RecordingController } from './recording-controller'
import { createTray } from './tray'

let mainWindow: BrowserWindow | null = null

function preloadPath(): string {
  const js = join(__dirname, '../preload/index.js')
  if (existsSync(js)) return js
  return join(__dirname, '../preload/index.mjs')
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 480,
    height: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'meetrec',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  window.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

app.whenReady().then(() => {
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerRecordingIpc(new RecordingController())
  mainWindow = createWindow()
  createTray(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
