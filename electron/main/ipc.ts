import { ipcMain } from 'electron'
import { IPC } from '../shared/ipc-contract'
import type { RecordingController } from './recording-controller'

export function registerRecordingIpc(controller: RecordingController): void {
  ipcMain.handle(IPC.recordingStart, () => controller.start())
  ipcMain.handle(IPC.recordingStop, () => controller.stop())
  ipcMain.handle(IPC.recordingStatus, () => controller.status())
}
