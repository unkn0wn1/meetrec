import { ipcMain } from 'electron'
import type { LibraryService } from '../domains/recording/library'
import type { SettingsService } from '../domains/settings/settings-service'
import {
  IPC,
  type LibraryDetail,
  type ProviderId,
  type ProviderRole,
  type RecordingMetaView,
  type SetModelInput,
  type SettingsStatus
} from '../shared/ipc-contract'
import type { RecordingController } from './recording-controller'

export function registerAppIpc(
  controller: RecordingController,
  library: LibraryService,
  settings: SettingsService
): void {
  ipcMain.handle(IPC.recordingStart, () => controller.start())
  ipcMain.handle(IPC.recordingStop, () => controller.stop())
  ipcMain.handle(IPC.recordingStatus, () => controller.status())
  ipcMain.handle(IPC.libraryList, () => library.list())
  ipcMain.handle(IPC.libraryDetail, (_event, id: string) => library.detail(id).then(toDetailView))
  ipcMain.handle(IPC.librarySpeakers, (_event, id: string, names: Record<string, string>) =>
    library.updateSpeakers(id, names).then(toMetaView)
  )
  ipcMain.handle(IPC.libraryTranscribe, (_event, id: string) =>
    library.transcribe(id).then(toDetailView)
  )
  ipcMain.handle(IPC.librarySummarize, (_event, id: string) =>
    library.summarize(id).then(toDetailView)
  )
  ipcMain.handle(IPC.settingsGet, (): Promise<SettingsStatus> => settings.status())
  ipcMain.handle(IPC.settingsSetVoiceDefault, (_event, provider: ProviderId) =>
    settings.setVoiceDefault(provider)
  )
  ipcMain.handle(IPC.settingsSetAiDefault, (_event, provider: ProviderId) =>
    settings.setAiDefault(provider)
  )
  ipcMain.handle(IPC.settingsSetModel, (_event, input: SetModelInput) => {
    if (
      !input ||
      (input.role !== 'voice' && input.role !== 'ai') ||
      typeof input.modelId !== 'string'
    ) {
      return Promise.reject(new Error('Choose a model.'))
    }
    const role: ProviderRole = input.role
    return settings.setModel(input.providerId, role, input.modelId)
  })
  ipcMain.handle(IPC.settingsTestProvider, (_event, provider: ProviderId) =>
    settings.testProvider(provider)
  )
  ipcMain.handle(IPC.settingsSetXaiKey, (_event, key: string): Promise<SettingsStatus> => {
    if (typeof key !== 'string') {
      return Promise.reject(new Error('Enter an xAI API key before saving.'))
    }
    return settings.setXaiKey(key)
  })
  ipcMain.handle(IPC.settingsClearXaiKey, (): Promise<SettingsStatus> => settings.clearXaiKey())
  ipcMain.handle(IPC.settingsSetOpenAiKey, (_event, key: string): Promise<SettingsStatus> => {
    if (typeof key !== 'string') {
      return Promise.reject(new Error('Enter an OpenAI API key before saving.'))
    }
    return settings.setOpenAiKey(key)
  })
  ipcMain.handle(IPC.settingsClearOpenAiKey, (): Promise<SettingsStatus> =>
    settings.clearOpenAiKey()
  )
  ipcMain.handle(IPC.settingsStartXaiOAuth, (): Promise<SettingsStatus> => settings.startXaiOAuth())
  ipcMain.handle(IPC.settingsPollXaiOAuth, (): Promise<SettingsStatus> => settings.pollXaiOAuth())
  ipcMain.handle(IPC.settingsSignOutXaiOAuth, (): Promise<SettingsStatus> =>
    settings.signOutXaiOAuth()
  )
  ipcMain.handle(IPC.settingsValidate, (): Promise<SettingsStatus> => settings.validate())
}

function toMetaView(meta: {
  id: string
  startedAt: string
  endedAt: string | null
  durationMs: number
  speakers: RecordingMetaView['speakers']
  topic: string | null
  captureMode: RecordingMetaView['captureMode']
  note: string | null
  title: string | null
}): RecordingMetaView {
  return {
    id: meta.id,
    startedAt: meta.startedAt,
    endedAt: meta.endedAt,
    durationMs: meta.durationMs,
    speakers: meta.speakers.map((speaker) => ({
      id: speaker.id,
      label: speaker.label,
      name: speaker.name
    })),
    topic: meta.topic,
    captureMode: meta.captureMode,
    note: meta.note,
    title: meta.title
  }
}

function toDetailView(detail: {
  meta: Parameters<typeof toMetaView>[0]
  flags: { hasTranscript: boolean; hasSummary: boolean }
  transcript: LibraryDetail['transcript']
  summary: string | null
  audioUrl: string
}): LibraryDetail {
  return {
    meta: toMetaView(detail.meta),
    hasTranscript: detail.flags.hasTranscript,
    hasSummary: detail.flags.hasSummary,
    transcript: detail.transcript
      ? {
          text: detail.transcript.text,
          language: detail.transcript.language,
          durationSec: detail.transcript.durationSec,
          segments: detail.transcript.segments.map((segment) => ({
            speakerId: segment.speakerId,
            speakerLabel: segment.speakerLabel,
            start: segment.start,
            end: segment.end,
            text: segment.text
          }))
        }
      : null,
    summary: detail.summary,
    audioUrl: detail.audioUrl
  }
}
