import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { CalendarStatus } from '../shared/calendar-contract'
import type {
  LibraryJobProgress,
  MeetrecApi,
  RecordingStatus,
  UpdateSnapshot
} from '../shared/ipc-contract'
import { IPC } from '../shared/ipc-contract'

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const wrapped = (_event: IpcRendererEvent, payload: T): void => {
    listener(payload)
  }
  ipcRenderer.on(channel, wrapped)
  return () => {
    ipcRenderer.removeListener(channel, wrapped)
  }
}

const api: MeetrecApi = {
  recording: {
    start: () => ipcRenderer.invoke(IPC.recordingStart),
    stop: () => ipcRenderer.invoke(IPC.recordingStop),
    status: () => ipcRenderer.invoke(IPC.recordingStatus),
    onChanged: (listener) => subscribe<RecordingStatus>(IPC.recordingChanged, listener)
  },
  calendar: {
    status: () => ipcRenderer.invoke(IPC.calendarStatus),
    connect: (input) => ipcRenderer.invoke(IPC.calendarConnect, input),
    cancelConnect: () => ipcRenderer.invoke(IPC.calendarCancelConnect),
    disconnect: (input) => ipcRenderer.invoke(IPC.calendarDisconnect, input),
    dismiss: (input) => ipcRenderer.invoke(IPC.calendarDismiss, input),
    arm: (input) => ipcRenderer.invoke(IPC.calendarArm, input),
    cancelArm: () => ipcRenderer.invoke(IPC.calendarCancelArm),
    start: (input) => ipcRenderer.invoke(IPC.calendarStart, input),
    list: () => ipcRenderer.invoke(IPC.calendarList),
    setRecord: (input) => ipcRenderer.invoke(IPC.calendarSetRecord, input),
    setCalendars: (input) => ipcRenderer.invoke(IPC.calendarSetCalendars, input),
    onChanged: (listener) => subscribe<CalendarStatus>(IPC.calendarChanged, listener)
  },
  cloud: {
    setUpload: (input) => ipcRenderer.invoke(IPC.cloudSetUpload, input),
    upload: (input) => ipcRenderer.invoke(IPC.cloudUpload, input)
  },
  library: {
    list: () => ipcRenderer.invoke(IPC.libraryList),
    detail: (id) => ipcRenderer.invoke(IPC.libraryDetail, id),
    updateSpeakers: (id, names) => ipcRenderer.invoke(IPC.librarySpeakers, id, names),
    transcribe: (id) => ipcRenderer.invoke(IPC.libraryTranscribe, id),
    summarize: (id) => ipcRenderer.invoke(IPC.librarySummarize, id),
    delete: (id, options) => ipcRenderer.invoke(IPC.libraryDelete, id, options),
    onJobProgress: (listener) => subscribe<LibraryJobProgress>(IPC.libraryJobProgress, listener)
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
    validate: () => ipcRenderer.invoke(IPC.settingsValidate),
    setDestination: (destination) => ipcRenderer.invoke(IPC.settingsSetDestination, destination),
    setAutoRecord: (enabled) => ipcRenderer.invoke(IPC.settingsSetAutoRecord, enabled),
    setSilenceAutoStop: (input) => ipcRenderer.invoke(IPC.settingsSetSilenceAutoStop, input)
  },
  updater: {
    get: () => ipcRenderer.invoke(IPC.updaterGet),
    check: () => ipcRenderer.invoke(IPC.updaterCheck),
    install: () => ipcRenderer.invoke(IPC.updaterInstall),
    onChanged: (listener) => subscribe<UpdateSnapshot>(IPC.updaterChanged, listener)
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('meetrec', api)
} else {
  throw new Error('meetrec preload requires contextIsolation.')
}
