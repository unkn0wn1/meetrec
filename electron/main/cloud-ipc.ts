import { app, ipcMain } from 'electron'
import type { CalendarService } from '../domains/calendar/service'
import { uploadRecording } from '../domains/cloud/job'
import { readAppSettings } from '../domains/settings/settings-file'
import { effectiveDestination } from '../shared/destination'
import { IPC } from '../shared/ipc-contract'
import { recordingsDir } from './recording-controller'

export function registerCloudIpc(calendar: CalendarService): void {
  ipcMain.handle(IPC.cloudSetUpload, (_event, input: unknown) => {
    const record = objectInput(input)
    const provider = record.provider
    if (provider !== 'google' && provider !== 'microsoft') {
      return Promise.reject(new Error('Choose Google or Microsoft.'))
    }
    if (typeof record.enabled !== 'boolean') {
      return Promise.reject(new Error('Choose whether upload is on.'))
    }
    return calendar.setUpload(provider, record.enabled)
  })
  ipcMain.handle(IPC.cloudUpload, async (_event, input: unknown) => {
    const record = objectInput(input)
    const provider = record.provider
    if (provider !== 'google' && provider !== 'microsoft') {
      throw new Error('Choose Google or Microsoft.')
    }
    if (typeof record.recordingId !== 'string') throw new Error('That recording was not found.')
    return uploadRecording({
      recordingsRoot: recordingsDir(),
      recordingId: record.recordingId,
      provider,
      getAccess: (force = false) => calendar.accessToken(provider, force)
    })
  })
}

export async function uploadIfEnabled(
  calendar: CalendarService,
  recordingId: string
): Promise<void> {
  const status = await calendar.status()
  const stored = await readAppSettings(app.getPath('userData'))
  const destination = effectiveDestination(stored.settings.destination, {
    google:
      status.google.connected && status.google.uploadEnabled && status.google.uploadScopeGranted,
    microsoft:
      status.microsoft.connected &&
      status.microsoft.uploadEnabled &&
      status.microsoft.uploadScopeGranted
  })
  if (destination === 'local') return
  const result = await uploadRecording({
    recordingsRoot: recordingsDir(),
    recordingId,
    provider: destination,
    getAccess: (force = false) => calendar.accessToken(destination, force)
  })
  if (!result.ok) console.warn(result.message)
}

function objectInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new Error('That request was not understood.')
  return value as Record<string, unknown>
}
