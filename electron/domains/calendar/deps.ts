import type { CalendarStatus } from '../../shared/calendar-contract'
import type { CaptureMode } from '../../shared/ipc-contract'
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
  }): Promise<{ captureMode: CaptureMode; note: string | null }>
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
    microsoftByConnection: Record<string, CalendarEvent[]>
  }
  fetchedAt: {
    googleByConnection: Record<string, number>
    microsoftByConnection: Record<string, number>
  }
  /** Section-level connect error. Per-account fetch errors are keyed by connection id. */
  errors: { google: string | null; microsoft: string | null }
  accountErrors: Record<string, string | null>
  microsoftAccountErrors: Record<string, string | null>
  lists: {
    google: Record<string, ListedCalendar[]>
    microsoft: Record<string, ListedCalendar[]>
  }
  connectPending: 'google' | 'microsoft' | null
  /** Account card a reconnect or upload consent is updating. Null adds an account. */
  connectTargetId: string | null
  connectCancel: (() => void) | null
  connectGeneration: number
}

export interface CalendarCore {
  deps: CalendarDeps
  memory: CalendarMemory
  /** Set just before publish when that calendar start recorded mic-only. */
  revealMicOnlyNote: boolean
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
    events: { googleByConnection: {}, microsoftByConnection: {} },
    fetchedAt: { googleByConnection: {}, microsoftByConnection: {} },
    errors: { google: null, microsoft: null },
    accountErrors: {},
    microsoftAccountErrors: {},
    lists: { google: {}, microsoft: {} },
    connectPending: null,
    connectTargetId: null,
    connectCancel: null,
    connectGeneration: 0
  }
}
