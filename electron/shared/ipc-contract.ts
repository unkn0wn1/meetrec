import type {
  CalendarConnectInput,
  CalendarList,
  CalendarProviderInput,
  CalendarRecordInput,
  CalendarSelectionInput,
  CalendarStatus,
  OccurrenceInput
} from './calendar-contract'
import type { CloudSetUploadInput, CloudUploadInput, CloudUploadResult } from './cloud-contract'
import type { RecordingDestination } from './destination'
import type { SearchHit, SearchScheduleInput, SearchSnapshot } from './search-contract'

export type { RecordingDestination }

export const IPC = {
  recordingStart: 'recording:start',
  recordingStop: 'recording:stop',
  recordingStatus: 'recording:status',
  libraryList: 'library:list',
  libraryDetail: 'library:detail',
  librarySpeakers: 'library:speakers',
  libraryTranscribe: 'library:transcribe',
  librarySummarize: 'library:summarize',
  libraryJobProgress: 'library:job-progress',
  libraryDelete: 'library:delete',
  settingsGet: 'settings:get',
  settingsSetVoiceDefault: 'settings:setVoiceDefault',
  settingsSetAiDefault: 'settings:setAiDefault',
  settingsSetModel: 'settings:setModel',
  settingsTestProvider: 'settings:testProvider',
  settingsSetXaiKey: 'settings:setXaiKey',
  settingsClearXaiKey: 'settings:clearXaiKey',
  settingsSetOpenAiKey: 'settings:setOpenAiKey',
  settingsClearOpenAiKey: 'settings:clearOpenAiKey',
  settingsStartXaiOAuth: 'settings:startXaiOAuth',
  settingsPollXaiOAuth: 'settings:pollXaiOAuth',
  settingsSignOutXaiOAuth: 'settings:signOutXaiOAuth',
  settingsValidate: 'settings:validate',
  settingsSetDestination: 'settings:setDestination',
  settingsSetAutoRecord: 'settings:setAutoRecord',
  settingsSetSilenceAutoStop: 'settings:setSilenceAutoStop',
  recordingChanged: 'recording:changed',
  calendarStatus: 'calendar:status',
  calendarConnect: 'calendar:connect',
  calendarCancelConnect: 'calendar:cancelConnect',
  calendarDisconnect: 'calendar:disconnect',
  calendarDismiss: 'calendar:dismiss',
  calendarArm: 'calendar:arm',
  calendarCancelArm: 'calendar:cancelArm',
  calendarStart: 'calendar:start',
  calendarList: 'calendar:list',
  calendarSetRecord: 'calendar:setRecord',
  calendarSetCalendars: 'calendar:setCalendars',
  calendarChanged: 'calendar:changed',
  cloudSetUpload: 'cloud:setUpload',
  cloudUpload: 'cloud:upload',
  updaterGet: 'updater:get',
  updaterCheck: 'updater:check',
  updaterInstall: 'updater:install',
  updaterChanged: 'updater:changed'
} as const

export type CaptureMode = 'mix' | 'mic-only'

export type RecordingPhase = 'idle' | 'recording'

export interface RecordingStatus {
  phase: RecordingPhase
  outPath: string | null
  startedAt: string | null
  captureMode: CaptureMode | null
  note: string | null
  /** False on macOS (and unknown OSes) until a real capture backend ships. */
  captureSupported: boolean
  /** User-facing reason when captureSupported is false. */
  unsupportedReason: string | null
}

export interface RecordingStartResult {
  outPath: string
  captureMode: CaptureMode
  note: string | null
}

export interface RecordingStopResult {
  outPath: string
  id: string
  durationMs: number
  bytes: number
  captureMode: CaptureMode
}

export interface SpeakerView {
  id: string
  label: string
  name: string
}

/** Calendar fields the recording header needs to map invitees onto speakers. */
export interface RecordingCalendarView {
  title: string
  attendees: { name: string; email: string | null }[]
}

export interface RecordingMetaView {
  id: string
  startedAt: string
  endedAt: string | null
  durationMs: number
  speakers: SpeakerView[]
  topic: string | null
  captureMode: CaptureMode | null
  note: string | null
  title: string | null
  calendar: RecordingCalendarView | null
}

export interface LibraryListItem {
  id: string
  title: string
  startedAt: string
  durationMs: number
  topic: string | null
  speakerCount: number
  hasTranscript: boolean
  hasSummary: boolean
  hasGoogleDrive: boolean
  hasOneDrive: boolean
}

export interface TranscriptSegmentView {
  speakerId: string
  speakerLabel: string
  /** Seconds from the start of the audio. Playback seek uses milliseconds. */
  start: number
  /** Seconds from the start of the audio. */
  end: number
  text: string
}

export interface TranscriptView {
  text: string
  language: string | null
  durationSec: number | null
  segments: TranscriptSegmentView[]
}

export interface LibraryDetail {
  meta: RecordingMetaView
  hasTranscript: boolean
  hasSummary: boolean
  transcript: TranscriptView | null
  summary: string | null
  audioUrl: string
}

export interface LibraryDeleteOptions {
  removeCloud?: boolean
}

export const TRANSCRIBE_STAGES = ['preparing', 'uploading', 'waiting', 'saving'] as const
export type TranscribeStage = (typeof TRANSCRIBE_STAGES)[number]

export const SUMMARIZE_STAGES = ['preparing', 'waiting', 'saving'] as const
export type SummarizeStage = (typeof SUMMARIZE_STAGES)[number]

export type LibraryJobKind = 'transcribe' | 'summarize'

export interface LibraryJobProgress {
  id: string
  job: LibraryJobKind
  /** null clears the row after the job settles. */
  stage: TranscribeStage | SummarizeStage | null
  /** Main sets this for multi-piece transcribe progress and leaves it unset otherwise. */
  message?: string
  /** Date.now() at job start. The same value on every event for that job, including the clear. */
  startedAt: number
}

export type ProviderId = 'xai-oauth' | 'xai-key' | 'openai'

export type ProviderRole = 'voice' | 'ai'

export type KeySource = 'settings' | 'env' | 'none'

export type LiveState = 'unknown' | 'ok' | 'bad'

export type ProbeState = 'idle' | 'pass' | 'fail' | 'na'

export type CredentialKind = 'xai-oauth' | 'xai-key' | 'openai-key'

export interface RoleProbe {
  state: ProbeState
  message: string
}

export interface ModelOption {
  id: string
  label: string
}

export interface ProviderCardStatus {
  id: ProviderId
  label: string
  credential: CredentialKind
  configured: boolean
  statusLabel: string
  supportsVoice: boolean
  supportsAi: boolean
  voiceModels: ModelOption[]
  aiModels: ModelOption[]
  voiceModel: string
  aiModel: string
  isVoiceDefault: boolean
  isAiDefault: boolean
  live: LiveState
  liveMessage: string
  voiceProbe: RoleProbe
  aiProbe: RoleProbe
}

export const SILENCE_AUTO_STOP_SECONDS_MIN = 30
export const SILENCE_AUTO_STOP_SECONDS_MAX = 600
export const SILENCE_AUTO_STOP_SECONDS_DEFAULT = 120

export interface SilenceAutoStopInput {
  enabled: boolean
  seconds: number
}

export interface SettingsStatus {
  voiceProviderId: ProviderId
  aiProviderId: ProviderId
  cards: ProviderCardStatus[]
  canTranscribe: boolean
  canSummarize: boolean
  voiceGate: string | null
  aiGate: string | null
  xaiKeySource: KeySource
  openaiKeySource: KeySource
  oauthPending: boolean
  oauthUserCode: string | null
  verificationUrl: string | null
  oauthExpiresAt: number | null
  oauthIntervalSec: number | null
  destination: RecordingDestination
  autoRecord: boolean
  silenceAutoStop: boolean
  silenceAutoStopSeconds: number
}

export interface SetModelInput {
  providerId: ProviderId
  role: ProviderRole
  modelId: string
}

export type UpdatePhase =
  | 'idle'
  | 'unsupported'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'up-to-date'
  | 'error'

export interface UpdateSnapshot {
  phase: UpdatePhase
  currentVersion: string
  availableVersion: string | null
  message: string
  transferred: number | null
  total: number | null
  deferred: boolean
}

export interface MeetrecApi {
  recording: {
    start: () => Promise<RecordingStartResult>
    stop: () => Promise<RecordingStopResult>
    status: () => Promise<RecordingStatus>
    onChanged: (listener: (status: RecordingStatus) => void) => () => void
  }
  calendar: {
    status: () => Promise<CalendarStatus>
    connect: (input: CalendarConnectInput) => Promise<CalendarStatus>
    cancelConnect: () => Promise<CalendarStatus>
    disconnect: (input: CalendarProviderInput) => Promise<CalendarStatus>
    dismiss: (input: OccurrenceInput) => Promise<CalendarStatus>
    arm: (input: OccurrenceInput) => Promise<CalendarStatus>
    cancelArm: () => Promise<CalendarStatus>
    start: (input: OccurrenceInput) => Promise<CalendarStatus>
    list: () => Promise<CalendarList>
    setRecord: (input: CalendarRecordInput) => Promise<CalendarStatus>
    setCalendars: (input: CalendarSelectionInput) => Promise<CalendarStatus>
    onChanged: (listener: (status: CalendarStatus) => void) => () => void
  }
  cloud: {
    setUpload: (input: CloudSetUploadInput) => Promise<CalendarStatus>
    upload: (input: CloudUploadInput) => Promise<CloudUploadResult>
  }
  library: {
    list: () => Promise<LibraryListItem[]>
    detail: (id: string) => Promise<LibraryDetail>
    updateSpeakers: (id: string, names: Record<string, string>) => Promise<RecordingMetaView>
    transcribe: (id: string) => Promise<LibraryDetail>
    summarize: (id: string) => Promise<LibraryDetail>
    delete: (id: string, options?: LibraryDeleteOptions) => Promise<void>
    onJobProgress: (listener: (event: LibraryJobProgress) => void) => () => void
  }
  settings: {
    get: () => Promise<SettingsStatus>
    setVoiceDefault: (provider: ProviderId) => Promise<SettingsStatus>
    setAiDefault: (provider: ProviderId) => Promise<SettingsStatus>
    setModel: (input: SetModelInput) => Promise<SettingsStatus>
    testProvider: (provider: ProviderId) => Promise<SettingsStatus>
    setXaiKey: (key: string) => Promise<SettingsStatus>
    clearXaiKey: () => Promise<SettingsStatus>
    setOpenAiKey: (key: string) => Promise<SettingsStatus>
    clearOpenAiKey: () => Promise<SettingsStatus>
    startXaiOAuth: () => Promise<SettingsStatus>
    pollXaiOAuth: () => Promise<SettingsStatus>
    signOutXaiOAuth: () => Promise<SettingsStatus>
    validate: () => Promise<SettingsStatus>
    setDestination: (destination: RecordingDestination) => Promise<SettingsStatus>
    setAutoRecord: (enabled: boolean) => Promise<SettingsStatus>
    setSilenceAutoStop: (input: SilenceAutoStopInput) => Promise<SettingsStatus>
  }
  updater: {
    get: () => Promise<UpdateSnapshot>
    check: () => Promise<UpdateSnapshot>
    install: () => Promise<UpdateSnapshot>
    onChanged: (listener: (snapshot: UpdateSnapshot) => void) => () => void
  }
  search: {
    get: () => Promise<SearchSnapshot>
    preflight: () => Promise<SearchSnapshot>
    enable: () => Promise<SearchSnapshot>
    disable: () => Promise<SearchSnapshot>
    setSchedule: (input: SearchScheduleInput) => Promise<SearchSnapshot>
    indexAll: () => Promise<SearchSnapshot>
    rebuild: () => Promise<SearchSnapshot>
    retry: (id: string) => Promise<SearchSnapshot>
    cancelDownload: () => Promise<SearchSnapshot>
    query: (text: string) => Promise<SearchHit[]>
    onChanged: (listener: (snapshot: SearchSnapshot) => void) => () => void
  }
}
