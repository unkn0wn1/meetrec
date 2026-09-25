export interface MeetingSearchPrefs {
  enabled: boolean
  indexAfterTranscript: boolean
  indexAfterSummary: boolean
  idleCatchUp: boolean
}

export type SearchPhase = 'off' | 'needs-runtime' | 'installing' | 'downloading' | 'ready' | 'error'

export interface SearchDownload {
  label: string
  bytes: number
  percent: number | null
}

export interface SearchIndexActivity {
  running: boolean
  currentId: string | null
}

export interface SearchRecordView {
  state: 'pending' | 'indexed' | 'error'
  error: string | null
}

/** Session hint for the confirm step. Not written to settings.json. */
export interface SearchRuntimeHint {
  nodeOk: boolean
  qmdOnPath: boolean
  installed: boolean
  needsDownload: boolean
}

export interface SearchSnapshot {
  prefs: MeetingSearchPrefs
  phase: SearchPhase
  modelsReady: boolean
  download: SearchDownload | null
  index: SearchIndexActivity
  error: string | null
  records: Record<string, SearchRecordView>
  runtime: SearchRuntimeHint
}

export interface SearchScheduleInput {
  indexAfterTranscript: boolean
  indexAfterSummary: boolean
  idleCatchUp: boolean
}

export interface SearchHit {
  recordingId: string
  title: string
  snippet: string
  startMs: number | null
  score: number
}

export const SEARCH_IPC = {
  get: 'search:get',
  preflight: 'search:preflight',
  enable: 'search:enable',
  disable: 'search:disable',
  setSchedule: 'search:setSchedule',
  indexAll: 'search:indexAll',
  rebuild: 'search:rebuild',
  retry: 'search:retry',
  cancelDownload: 'search:cancelDownload',
  query: 'search:query',
  changed: 'search:changed'
} as const
