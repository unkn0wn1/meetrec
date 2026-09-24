import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { parseLibraryDeleteOptions } from '../domains/recording/delete-options'
import type { LibraryService } from '../domains/recording/library'
import type { SettingsService } from '../domains/settings/settings-service'
import {
  IPC,
  type LibraryDetail,
  type LibraryJobKind,
  type LibraryJobProgress,
  type ProviderId,
  type ProviderRole,
  type RecordingMetaView,
  type SetModelInput,
  type RecordingDestination,
  type SettingsStatus
} from '../shared/ipc-contract'
import type { RecordingController } from './recording-controller'

export interface RecordingHooks {
  afterSaved?: (id: string) => Promise<void>
}

export function registerAppIpc(
  controller: RecordingController,
  library: LibraryService,
  settings: SettingsService,
  hooks: RecordingHooks = {}
): void {
  ipcMain.handle(IPC.recordingStart, () => controller.start())
  ipcMain.handle(IPC.recordingStop, async () => {
    const result = await controller.stop()
    await runHook(hooks, result.id)
    return result
  })
  ipcMain.handle(IPC.recordingStatus, () => controller.status())
  ipcMain.handle(IPC.libraryList, () => library.list())
  ipcMain.handle(IPC.libraryDetail, (_event, id: string) => library.detail(id).then(toDetailView))
  ipcMain.handle(IPC.librarySpeakers, (_event, id: string, names: Record<string, string>) =>
    library.updateSpeakers(id, names).then(toMetaView)
  )
  ipcMain.handle(IPC.libraryTranscribe, async (event, id: unknown) => {
    if (typeof id !== 'string') {
      throw new Error('Unknown recording.')
    }
    const detail = await withJobProgress(event, id, 'transcribe', (report) =>
      library.transcribe(id, report)
    )
    await runHook(hooks, id)
    return toDetailView(detail)
  })
  ipcMain.handle(IPC.librarySummarize, async (event, id: unknown) => {
    if (typeof id !== 'string') {
      throw new Error('Unknown recording.')
    }
    const detail = await withJobProgress(event, id, 'summarize', (report) =>
      library.summarize(id, report)
    )
    await runHook(hooks, id)
    return toDetailView(detail)
  })
  ipcMain.handle(IPC.libraryDelete, async (_event, id: unknown, options: unknown) => {
    if (typeof id !== 'string') {
      throw new Error('Unknown recording.')
    }
    const { removeCloud } = parseLibraryDeleteOptions(options)
    if (controller.recordingId() === id) {
      throw new Error('Stop the recording before deleting it.')
    }
    await library.delete(id, { removeCloud })
  })
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
  ipcMain.handle(IPC.settingsSetDestination, (_event, destination: unknown) => {
    if (destination !== 'local' && destination !== 'google' && destination !== 'microsoft') {
      return Promise.reject(new Error('Choose a destination.'))
    }
    const next: RecordingDestination = destination
    return settings.setDestination(next)
  })
  ipcMain.handle(IPC.settingsSetAutoRecord, (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') {
      return Promise.reject(new Error('Choose whether auto-record is on.'))
    }
    return settings.setAutoRecord(enabled)
  })
}

type JobStage = NonNullable<LibraryJobProgress['stage']>

async function withJobProgress<T>(
  event: IpcMainInvokeEvent,
  id: string,
  job: LibraryJobKind,
  run: (report: (stage: JobStage) => void) => Promise<T>
): Promise<T> {
  const startedAt = Date.now()
  const send = (stage: LibraryJobProgress['stage']): void => {
    if (event.sender.isDestroyed()) return
    const payload: LibraryJobProgress = { id, job, stage, startedAt }
    event.sender.send(IPC.libraryJobProgress, payload)
  }
  try {
    return await run((stage) => {
      send(stage)
    })
  } finally {
    send(null)
  }
}

async function runHook(hooks: RecordingHooks, id: string): Promise<void> {
  try {
    await hooks.afterSaved?.(id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.'
    console.warn(message)
  }
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
