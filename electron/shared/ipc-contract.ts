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
  cloudUpload: 'cloud:upload'
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
}

export interface SetModelInput {
  providerId: ProviderId
  role: ProviderRole
  modelId: string
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
    delete: (id: string) => Promise<void>
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
  }
}
