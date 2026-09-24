import { BrowserWindow, ipcMain } from 'electron'
import type { UpdateService } from '../domains/updater/service'
import { IPC, type UpdateSnapshot } from '../shared/ipc-contract'
import { markAppQuitting } from './app-lifecycle'

const LAUNCH_CHECK_DELAY_MS = 3000

export function registerUpdaterIpc(service: UpdateService): void {
  ipcMain.handle(IPC.updaterGet, () => service.snapshot())
  ipcMain.handle(IPC.updaterCheck, () => service.check())
  ipcMain.handle(IPC.updaterInstall, () => {
    service.requestInstall(() => {
      markAppQuitting()
    })
    return service.snapshot()
  })
  service.onChange((snapshot) => {
    broadcastUpdate(snapshot)
  })
}

export function scheduleLaunchUpdateCheck(
  window: BrowserWindow,
  check: () => Promise<UpdateSnapshot>
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const start = (): void => {
    timer = setTimeout(() => {
      timer = null
      void check()
    }, LAUNCH_CHECK_DELAY_MS)
  }
  window.once('ready-to-show', start)
  return () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    window.removeListener('ready-to-show', start)
  }
}

function broadcastUpdate(snapshot: UpdateSnapshot): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue
    window.webContents.send(IPC.updaterChanged, snapshot)
  }
}
