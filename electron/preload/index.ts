import { contextBridge, ipcRenderer } from 'electron'
import type { MeetrecApi } from '../shared/ipc-contract'
import { IPC } from '../shared/ipc-contract'

const api: MeetrecApi = {
  recording: {
    start: () => ipcRenderer.invoke(IPC.recordingStart),
    stop: () => ipcRenderer.invoke(IPC.recordingStop),
    status: () => ipcRenderer.invoke(IPC.recordingStatus)
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('meetrec', api)
} else {
  throw new Error('meetrec preload requires contextIsolation.')
}
