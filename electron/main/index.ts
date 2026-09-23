import { app, BrowserWindow, protocol, safeStorage, shell } from 'electron'
import { optimizer } from '@electron-toolkit/utils'
import { LibraryService } from '../domains/recording/library'
import { SecretStore } from '../domains/settings/secret-store'
import { SettingsService } from '../domains/settings/settings-service'
import { attachHideToTray, markAppQuitting } from './app-lifecycle'
import { attachCalendar } from './calendar-runtime'
import { registerAppIpc } from './ipc'
import { registerLibraryProtocol } from './library-protocol'
import { RecordingController, recordingsDir } from './recording-controller'
import { loadRenderer, preloadPath } from './renderer-window'

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
let stopCalendar: (() => void) | null = null

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

  loadRenderer(window)

  return window
}

app.whenReady().then(() => {
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerLibraryProtocol(recordingsDir)
  const userDataDir = (): string => app.getPath('userData')
  const secrets = new SecretStore({
    userDataDir,
    safeStorage,
    warn: (message) => console.warn(message)
  })
  const settings = new SettingsService({
    secrets,
    userDataDir,
    openExternal: (url) => shell.openExternal(url)
  })
  const controller = new RecordingController()
  registerAppIpc(
    controller,
    new LibraryService(recordingsDir, (role) => settings.readAuth(role)),
    settings
  )
  mainWindow = createWindow()
  const calendar = attachCalendar({
    mainWindow,
    secrets,
    controller,
    userDataDir
  })
  stopCalendar = calendar.stop

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('before-quit', () => {
  markAppQuitting()
  stopCalendar?.()
})

app.on('window-all-closed', () => {
  // Hide-to-tray keeps the BrowserWindow alive; quit only via tray Quit.
})
