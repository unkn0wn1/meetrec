import electronUpdater from 'electron-updater'
import { updateInfoChannel } from './policy'
import type { UpdateAvailableInfo, UpdateClient, UpdateProgressInfo } from './service'

const { autoUpdater } = electronUpdater

export function isWindowsPortable(): boolean {
  return process.platform === 'win32' && Boolean(process.env.PORTABLE_EXECUTABLE_FILE)
}

/** Real feed. Call only after `feedBlock` allows a check. */
export function createElectronFeed(): UpdateClient {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  // Stable builds stay on latest. A prerelease version follows beta, rc, or alpha.
  autoUpdater.allowPrerelease = updateInfoChannel(String(autoUpdater.currentVersion)) !== 'latest'
  return {
    checkForUpdates: () => autoUpdater.checkForUpdates(),
    quitAndInstall(isSilent, isForceRunAfter) {
      autoUpdater.quitAndInstall(isSilent, isForceRunAfter)
    },
    on(event, listener) {
      switch (event) {
        case 'checking-for-update':
          autoUpdater.on(event, () => {
            ;(listener as () => void)()
          })
          return
        case 'update-available':
          autoUpdater.on(event, (info) => {
            ;(listener as (next: UpdateAvailableInfo) => void)(info)
          })
          return
        case 'update-not-available':
          autoUpdater.on(event, (info) => {
            ;(listener as (next: UpdateAvailableInfo) => void)(info)
          })
          return
        case 'download-progress':
          autoUpdater.on(event, (info) => {
            ;(listener as (progress: UpdateProgressInfo) => void)(info)
          })
          return
        case 'update-downloaded':
          autoUpdater.on(event, (info) => {
            ;(listener as (next: UpdateAvailableInfo) => void)(info)
          })
          return
        case 'error':
          autoUpdater.on(event, (error) => {
            ;(listener as (next: Error) => void)(error)
          })
          return
        default: {
          const unexpected: never = event
          return unexpected
        }
      }
    }
  }
}
