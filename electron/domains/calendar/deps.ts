import type { CalendarStatus } from '../../shared/calendar-contract'
import type { RecordingCalendarLink } from '../recording/meta'
import type { SecretStore } from '../settings/secret-store'
import type { CalendarPreferences } from './preferences'
import type { ListedCalendar } from './selection'
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
  events: {
    googleByConnection: Record<string, CalendarEvent[]>
    microsoft: CalendarEvent[]
  }
  fetchedAt: {
    googleByConnection: Record<string, number>
    microsoft: number | null
  }
  /** Section-level connect error. Per-account fetch errors live in `accountErrors`. */
  errors: { google: string | null; microsoft: string | null }
  accountErrors: Record<string, string | null>
  lists: {
    google: Record<string, ListedCalendar[]>
    microsoft: ListedCalendar[]
  }
  connectPending: 'google' | 'microsoft' | null
  /** Google card a reconnect or Drive consent is updating. Null adds an account. */
  connectTargetId: string | null
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
    events: { googleByConnection: {}, microsoft: [] },
    fetchedAt: { googleByConnection: {}, microsoft: null },
    errors: { google: null, microsoft: null },
    accountErrors: {},
    lists: { google: {}, microsoft: [] },
    connectPending: null,
    connectTargetId: null,
    connectCancel: null,
    connectGeneration: 0
  }
}
