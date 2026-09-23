import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, protocol, safeStorage, shell } from 'electron'
import { optimizer, is } from '@electron-toolkit/utils'
import { LibraryService } from '../domains/recording/library'
import { SecretStore } from '../domains/settings/secret-store'
import { SettingsService } from '../domains/settings/settings-service'
import { registerAppIpc } from './ipc'
import { registerLibraryProtocol } from './library-protocol'
import { RecordingController, recordingsDir } from './recording-controller'
import { attachHideToTray, markAppQuitting } from './app-lifecycle'
import { createTray } from './tray'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'meetrec',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
])

let mainWindow: BrowserWindow | null = null

function preloadPath(): string {
  const js = join(__dirname, '../preload/index.js')
  if (existsSync(js)) return js
  return join(__dirname, '../preload/index.mjs')
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 960,
    height: 720,
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

  attachHideToTray(window)

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

  registerLibraryProtocol(recordingsDir)
  const userDataDir = (): string => app.getPath('userData')
  const settings = new SettingsService({
    secrets: new SecretStore({
      userDataDir,
      safeStorage,
      warn: (message) => console.warn(message)
    }),
    userDataDir,
    openExternal: (url) => shell.openExternal(url)
  })
  registerAppIpc(
    new RecordingController(),
    new LibraryService(recordingsDir, () => settings.readAuthForActiveProvider()),
    settings
  )
  mainWindow = createWindow()
  createTray(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('before-quit', () => {
  markAppQuitting()
})

app.on('window-all-closed', () => {
  // Hide-to-tray keeps the BrowserWindow alive; quit only via tray Quit.
})
