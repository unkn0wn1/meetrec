export const IPC = {
  recordingStart: 'recording:start',
  recordingStop: 'recording:stop',
  recordingStatus: 'recording:status',
  libraryList: 'library:list',
  libraryDetail: 'library:detail',
  librarySpeakers: 'library:speakers',
  libraryTranscribe: 'library:transcribe',
  librarySummarize: 'library:summarize',
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
  settingsValidate: 'settings:validate'
} as const

export type CaptureMode = 'mix' | 'mic-only'

export type RecordingPhase = 'idle' | 'recording'

export interface RecordingStatus {
  phase: RecordingPhase
  outPath: string | null
  startedAt: string | null
  captureMode: CaptureMode | null
  note: string | null
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
}

export interface TranscriptSegmentView {
  speakerId: string
  speakerLabel: string
  start: number
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
  }
  library: {
    list: () => Promise<LibraryListItem[]>
    detail: (id: string) => Promise<LibraryDetail>
    updateSpeakers: (id: string, names: Record<string, string>) => Promise<RecordingMetaView>
    transcribe: (id: string) => Promise<LibraryDetail>
    summarize: (id: string) => Promise<LibraryDetail>
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
  }
}
