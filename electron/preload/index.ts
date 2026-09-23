import { contextBridge, ipcRenderer } from 'electron'
import type { MeetrecApi } from '../shared/ipc-contract'
import { IPC } from '../shared/ipc-contract'

const api: MeetrecApi = {
  recording: {
    start: () => ipcRenderer.invoke(IPC.recordingStart),
    stop: () => ipcRenderer.invoke(IPC.recordingStop),
    status: () => ipcRenderer.invoke(IPC.recordingStatus)
  },
  library: {
    list: () => ipcRenderer.invoke(IPC.libraryList),
    detail: (id) => ipcRenderer.invoke(IPC.libraryDetail, id),
    updateSpeakers: (id, names) => ipcRenderer.invoke(IPC.librarySpeakers, id, names),
    transcribe: (id) => ipcRenderer.invoke(IPC.libraryTranscribe, id),
    summarize: (id) => ipcRenderer.invoke(IPC.librarySummarize, id)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    setVoiceDefault: (provider) => ipcRenderer.invoke(IPC.settingsSetVoiceDefault, provider),
    setAiDefault: (provider) => ipcRenderer.invoke(IPC.settingsSetAiDefault, provider),
    setModel: (input) => ipcRenderer.invoke(IPC.settingsSetModel, input),
    testProvider: (provider) => ipcRenderer.invoke(IPC.settingsTestProvider, provider),
    setXaiKey: (key) => ipcRenderer.invoke(IPC.settingsSetXaiKey, key),
    clearXaiKey: () => ipcRenderer.invoke(IPC.settingsClearXaiKey),
    setOpenAiKey: (key) => ipcRenderer.invoke(IPC.settingsSetOpenAiKey, key),
    clearOpenAiKey: () => ipcRenderer.invoke(IPC.settingsClearOpenAiKey),
    startXaiOAuth: () => ipcRenderer.invoke(IPC.settingsStartXaiOAuth),
    pollXaiOAuth: () => ipcRenderer.invoke(IPC.settingsPollXaiOAuth),
    signOutXaiOAuth: () => ipcRenderer.invoke(IPC.settingsSignOutXaiOAuth),
    validate: () => ipcRenderer.invoke(IPC.settingsValidate)
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('meetrec', api)
} else {
  throw new Error('meetrec preload requires contextIsolation.')
}
