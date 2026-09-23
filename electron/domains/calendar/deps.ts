import type { CalendarStatus } from '../../shared/calendar-contract'
import type { RecordingCalendarLink } from '../recording/meta'
import type { SecretStore } from '../settings/secret-store'
import type { CalendarPreferences } from './preferences'
import type { CalendarEvent } from './source'
import type { CalendarRuntimeState } from './state-file'
import type { TrayModel } from './tray-model'

export interface RecordingPort {
  status(): { phase: 'idle' | 'recording' }
  recordingId(): string | null
  start(input?: {
    title?: string | null
    calendar?: RecordingCalendarLink | null
  }): Promise<unknown>
  stop(): Promise<unknown>
}

export interface CalendarDeps {
  userDataDir: () => string
  secrets: SecretStore
  openExternal: (url: string) => Promise<void>
  recording: RecordingPort
  fetchImpl: typeof fetch
  now: () => number
  onStatus: (status: CalendarStatus) => void
  onTray: (model: TrayModel) => void
  onPrompt: (visible: boolean) => void
  onNotify: (notice: { title: string; body: string }) => void
}

export interface CalendarMemory {
  prefs: CalendarPreferences
  runtime: CalendarRuntimeState
  events: { google: CalendarEvent[]; microsoft: CalendarEvent[] }
  fetchedAt: { google: number | null; microsoft: number | null }
  errors: { google: string | null; microsoft: string | null }
  connectPending: 'google' | 'microsoft' | null
  connectCancel: (() => void) | null
  connectGeneration: number
}

export interface CalendarCore {
  deps: CalendarDeps
  memory: CalendarMemory
  publish(): Promise<void>
  saveRuntime(): Promise<void>
  fetchGoogle(): Promise<void>
  fetchMicrosoft(): Promise<void>
  run<T>(work: () => Promise<T>): Promise<T>
}

export function emptyMemory(
  prefs: CalendarPreferences,
  runtime: CalendarRuntimeState
): CalendarMemory {
  return {
    prefs,
    runtime,
    events: { google: [], microsoft: [] },
    fetchedAt: { google: null, microsoft: null },
    errors: { google: null, microsoft: null },
    connectPending: null,
    connectCancel: null,
    connectGeneration: 0
  }
}
